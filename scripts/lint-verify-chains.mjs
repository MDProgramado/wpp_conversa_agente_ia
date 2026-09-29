#!/usr/bin/env node
/**
 * lint-verify-chains.mjs — barreira mecânica para os blocos <verify>/<automated> dos planos.
 *
 * PROBLEMA QUE ESTE SCRIPT EXISTE PARA IMPEDIR
 * --------------------------------------------
 * Uma cadeia de verificação que "sai com 0" sem ter provado nada é pior do que nenhuma
 * verificação: ela transforma um plano em algo que parece verificado. Os quatro padrões
 * abaixo mascaram falha, e todos os quatro são erro de *composição de shell*, não de lógica:
 *
 *   1. `npx vitest run 2>/dev/null || npx vitest run --reporter=dot 2>&1 | tail -5`
 *      O `||` troca a suíte que falhou por outra whose output é truncado: o plano passa.
 *   2. `npx vitest run 2>&1 | grep -qE 'Tests.*([0-9]+ passed)'`
 *      "12 failed | 40 passed" casa com o padrão. A suíte falha e o gate passa.
 *   3. `npx vitest run 2>&1 | tail -20`
 *      O código de saída do `tail` é o do pipeline, não o do vitest. A suíte falha e o gate passa.
 *   4. `! grep -q 'sendText(' outbox-worker.ts queue-per-lead.ts`
 *      `grep -q` com vários arquivos sai 0 se **qualquer um** casar. A negação de dois arquivos
 *      não é "nenhum contém": é "pelo menos um não contém".
 *
 * AS QUATRO FORMAS CANÔNICAS (as únicas permitidas dentro de <automated>)
 * -------------------------------------------------------------------------
 *   presença:        grep -q 'pattern' <path>
 *   ausência:        ! grep -q 'pattern' <path>          -- por arquivo, um comando por arquivo
 *   suíte positiva:  npx vitest run <path>                 -- sem pipe, sem `||`, sem redirecionar
 *   suíte negativa:  ! npx vitest run <path>
 *   composição:      exclusivamente com &&                 -- nunca `||`, nunca `;`
 *
 * Um pipeline só é aceito quando o lado direito é um `grep` cujo padrão é **evidência de
 * falha** (`fail`, `error`, `erro`, `warning`, `FATAL`) — ou seja, quando o pipe é a
 * asserção ("o verificador TEM de reportar um problema") e não uma máscara sobre um run
 * verde. Padrão que case com sucesso (`passed`, `ok`, `checked`, `no errors`) é sempre
 * violação: `12 failed | 40 passed` casa com "passed", e aí o gate mente.
 *
 * USO
 * ---
 *   node scripts/lint-verify-chains.mjs .planning/phases/01-funda-o-canal-e-gate-de-envio
 *   node scripts/lint-verify-chains.mjs --self-test
 *
 * Sai com 0 se não houver violação, e com 1 imprimindo `arquivo:linha` para cada uma.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const DOCS = `Formas canonicas aceitas em <automated>:
  presenca:   grep -q 'pattern' <path>
  ausencia:   ! grep -q 'pattern' <path>   (por arquivo)
  suite +:    npx vitest run <path>          (sem pipe)
  suite -:    ! npx vitest run <path>
  composicao: apenas &&                      (nunca ||, nunca ;)`;

const SUITE_RUNNERS = [
  /\bvitest\s+run\b/,
  /\bnpx\s+tsc\b/,
  /\bnpx\s+biome\s+(check|lint|format)\b/,
  /\bnpx\s+drizzle-kit\b/,
  /\bnpm\s+(test|run\s+test)\b/,
  /\bpytest\b/,
  /\bnode\s+--test\b/,
];

const FAILURE_EVIDENCE = /fail|error|erro|warning|warn:|FATAL/i;
const READ_COMMANDS = /^(tail|head|wc|sort|uniq|cat|tr|awk|sed|cut|tee|nl|xargs|less|more)\b/;

/** Decodifica as entidades HTML que os planos usam dentro dos blocos XML. */
function decodeEntities(s) {
  return s
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'");
}

/**
 * Tokeniza a linha respeitando aspas simples, aspas duplas e aninhamento de $( ... ).
 * Devolve os operadores que estão FORA de aspas — é só eles que importam: um `;` dentro de
 * "-tAc \"select 1;\"" é SQL, e um `\|` dentro de "a\|b" é uma alternância do grep.
 */
function operatorsOutsideQuotes(line) {
  const out = [];
  let quote = null;
  let depth = 0;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) {
      if (c === '\\') { i++; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === "'" || c === '"') { quote = c; continue; }
    if (c === '\\') { i++; continue; }
    if (c === '$' && line[i + 1] === '(') { depth++; out.push({ op: '$(', i }); continue; }
    if (c === ')' && depth > 0) { depth--; continue; }
    if (c === '|') {
      if (line[i + 1] === '|') { out.push({ op: '||', i }); i++; continue; }
      if (line[i + 1] === '&') { out.push({ op: '|&', i }); i++; continue; }
      out.push({ op: '|', i });
      continue;
    }
    if (c === ';') { out.push({ op: ';', i, depth }); continue; }
    if (c === '&' && line[i + 1] === '&') { out.push({ op: '&&', i }); i++; continue; }
  }
  return out;
}

/** Separa um trecho em comandos, respeitando aspas. */
function splitTopLevel(line, sep) {
  const parts = [];
  let cur = '';
  let quote = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) {
      cur += c;
      if (c === '\\' && i + 1 < line.length) { cur += line[++i]; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === "'" || c === '"') { quote = c; cur += c; continue; }
    if (c === '\\') { cur += c; if (i + 1 < line.length) cur += line[++i]; continue; }
    if (c === sep) { parts.push(cur); cur = ''; continue; }
    cur += c;
  }
  parts.push(cur);
  return parts.map((p) => p.trim()).filter((p) => p.length > 0);
}

/** Separa um trecho em comandos unidos por `&&`, respeitando aspas. */
function splitCommands(line) {
  const parts = [];
  let cur = '';
  let quote = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) {
      cur += c;
      if (c === '\\' && i + 1 < line.length) { cur += line[++i]; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === "'" || c === '"') { quote = c; cur += c; continue; }
    if (c === '\\') { cur += c; if (i + 1 < line.length) cur += line[++i]; continue; }
    if (c === '&' && line[i + 1] === '&') { parts.push(cur); cur = ''; i++; continue; }
    cur += c;
  }
  parts.push(cur);
  return parts.map((p) => p.trim()).filter((p) => p.length > 0);
}

function unquote(s) {
  return s.replace(/^["']|["']$/g, '').trim();
}

function isSuite(cmd) {
  return SUITE_RUNNERS.some((re) => re.test(cmd));
}

/** Tokeniza em palavras respeitando aspas: um padrao com espaco ('net start|x') e UM argumento. */
function words(cmd) {
  const out = [];
  let cur = '';
  let quote = null;
  for (let i = 0; i < cmd.length; i++) {
    const c = cmd[i];
    if (quote) {
      cur += c;
      if (c === '\\' && i + 1 < cmd.length) { cur += cmd[++i]; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === "'" || c === '"') { quote = c; cur += c; continue; }
    if (/\s/.test(c)) { if (cur.length) { out.push(cur); cur = ''; } continue; }
    cur += c;
  }
  if (cur.length) out.push(cur);
  return out;
}

/** Tokens de flag de um grep (os que aparecem antes do padrao), para nao confundir "src/outbox-worker.ts" com "-r". */
function grepFlags(cmd) {
  const flags = [];
  for (const t of words(cmd).slice(1)) {
    if (t.startsWith('-') && t.length > 1) { flags.push(t); continue; }
    if (t === '--') continue;
    break; // primeiro token que nao e flag: e o padrao
  }
  return flags;
}

/** Arquivos-operando de um grep: tokens que nao sao flags e vem depois do padrao. */
function grepOperands(cmd) {
  const tokens = words(cmd).slice(1);
  const operands = [];
  let sawPattern = false;
  for (const t of tokens) {
    if (t.startsWith('-') && t.length > 1) continue;
    if (t === '--') continue;
    if (!sawPattern) { sawPattern = true; continue; }
    operands.push(unquote(t));
  }
  return operands;
}

function lintCommandLine(line) {
  const found = [];
  const ops = operatorsOutsideQuotes(line);

  for (const { op, i } of ops) {
    if (op === '||' || op === '|&') {
      found.push({ col: i, msg: '`||` mascara falha: um lado que falha e o outro que passa tornariam o plano verde. Use apenas `&&`.' });
    }
    if (op === ';') {
      found.push({ col: i, msg: '`;` descarta o status do comando anterior: a verificacao passa mesmo se a primeira parte falhar. Use `&&`.' });
    }
  }

  // Pipelines: o que importa e o que acontece DEPOIS de uma suite.
  for (const command of splitCommands(line)) {
    const segments = splitTopLevel(command, '|');
    for (let i = 0; i < segments.length - 1; i++) {
      const left = segments[i];
      const right = segments[i + 1];
      const nextIsAnotherPipe = operatorsOutsideQuotes(right).some((o) => o.op === '|');

      if (isSuite(left)) {
        if (/^(tail|head)\b/.test(right)) {
          found.push({ msg: `pipe de uma suite para \`${right.split(/\s+/)[0]}\` descarta o codigo de saida: a suite pode falhar e o gate passar. Rode a suite sem pipe.` });
          continue;
        }
        if (/^grep\b/.test(right)) {
          const pattern = unquote((right.match(/grep[^|]*?(-[a-zA-Z]+\s+)*(['"])(.*?)\2/) ?? [])[3] ?? '');
          if (!FAILURE_EVIDENCE.test(pattern)) {
            found.push({ msg: `pipe de uma suite para \`grep\` com o padrao "${pattern}" nao prova sucesso: uma suite parcialmente verde casa com ele, e o codigo de saida da suite se perde no pipe. Remova o pipe; se a assercao e "isto tem de falhar", o padrao tem de ser evidencia de falha (\`fail\`, \`error\`, \`erro\`, \`warning\`).` });
          }
          continue;
        }
        if (READ_COMMANDS.test(right) && !nextIsAnotherPipe) {
          found.push({ msg: `pipe de uma suite para \`${right.split(/\s+/)[0]}\` descarta o codigo de saida da suite. Rode a suite sem pipe.` });
        }
      }
    }
  }

  // Negacao multi-arquivo: `! grep -q 'x' a.ts b.ts` passa se QUALQUER um casar.
  for (const command of splitCommands(line)) {
    const segment = command;
    const negated = /^\s*!\s+/.test(segment);
    if (!negated) continue;
    const body = segment.replace(/^\s*!\s+/, '');
    if (!/^grep\b/.test(body)) continue;
    const operands = grepOperands(body).filter((o) => o && !o.startsWith('-'));
    const looksRecursive = grepFlags(body).some((f) => /^-[a-zA-Z]*r/.test(f));
    if (operands.length > 1 && !looksRecursive) {
      found.push({ msg: `negacao de ${operands.length} arquivos de uma vez (\`${operands.join('`, `')}\`): \`grep -q\` sai 0 se QUALQUER arquivo casar, entao a negacao so prova "pelo menos um nao contem". Faça uma negacao por arquivo, unida por \`&&\`.` });
    }
  }

  // Contagem dupla: `grep -c ... | grep -c ...` conta linhas, nao arquivos infratores.
  // Os literais entre aspas sao removidos antes do teste para que um `(` dentro de um padrao
  // (ex.: 'sendText(') nao confunda com parenteses de substituicao de comando.
  const bare = line.replace(/'[^']*'/g, "''").replace(/"[^"]*"/g, '""');
  if (/grep\b[^|)()]*-c\b[^|)()]*\|[^|()]*grep\b[^|()]*-c\b/.test(bare)) {
    found.push({ msg: 'contagem dupla (`grep -c ... | grep -c ...`) conta linhas casadas, nao arquivos infratores: passa quando so parte dos alvos viola. Use negacao por arquivo.' });
  }

  // Deduplica preservando a coluna, ordena por coluna.
  const seen = new Set();
  return found
    .filter((f) => {
      const k = `${f.col ?? -1}|${f.msg}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => (a.col ?? -1) - (b.col ?? -1));
}

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) files.push(...walk(p));
    else if (p.endsWith('.md')) files.push(p);
  }
  return files;
}

/** Extrai o conteudo de <automated>...</automated> e de <verify>...</verify> sem <automated>.
 *
 * As tagsOpening e Closing so casam quando estao no inicio de uma linha (com indentacao): um plano
 * legitimo sempre poe <verify>, <automated> e <verification> em linhas proprias, enquanto prosa
 * dentro de <action> pode citar esses nomes em crases — "ele varre <verify> e <automated>" — e sem
 * esta exigencia o extrator comecaria num `</action>` e terminaria no `</verify>` seguinte, ou
 * pior, comecaria e terminaria dentro da propria prosa, inventando um bloco que nao existe. */
function extractBlocks(text) {
  const blocks = [];
  const lineOf = (index) => text.slice(0, index).split('\n').length;
  const reAutomated = /^[ \t]*<automated>([\s\S]*?)<\/automated>/gm;
  let m;
  while ((m = reAutomated.exec(text)) !== null) {
    blocks.push({ kind: 'automated', start: lineOf(m.index), body: decodeEntities(m[1]) });
  }
  const reVerify = /^[ \t]*<verify>([\s\S]*?)<\/verify>/gm;
  while ((m = reVerify.exec(text)) !== null) {
    const inner = m[1].replace(/^[ \t]*<automated>[\s\S]*?<\/automated>/gm, '');
    if (inner.trim().length === 0) continue;
    blocks.push({ kind: 'verify', start: lineOf(m.index), body: decodeEntities(inner) });
  }
  // Blocos bash de <verification> tambem sao shell executado pelo executor.
  const reVerification = /^[ \t]*<verification>([\s\S]*?)<\/verification>/gm;
  while ((m = reVerification.exec(text)) !== null) {
    for (const fence of m[1].matchAll(/```(?:bash|sh|shell)?\n([\s\S]*?)```/g)) {
      blocks.push({ kind: 'verification', start: lineOf(m.index) + fence.index, body: fence[1] });
    }
  }
  return blocks.sort((a, b) => a.start - b.start);
}

export function lintText(text) {
  const violations = [];
  for (const block of extractBlocks(text)) {
    const lines = block.body.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim().length === 0) continue;
      if (line.trim().startsWith('#')) continue;
      for (const v of lintCommandLine(line)) {
        violations.push({
          line: block.start + i + 1,
          kind: block.kind,
          msg: v.msg,
          text: line.trim(),
        });
      }
    }
  }
  return violations;
}

export function lintTargets(target) {
  const st = statSync(resolve(target));
  const files = st.isDirectory() ? walk(resolve(target)) : [resolve(target)];
  const report = [];
  for (const file of files.sort()) {
    const violations = lintText(readFileSync(file, 'utf8'));
    if (violations.length > 0) report.push({ file, violations });
  }
  return report;
}

function selfTest() {
  const mustFail = [
    ['`||` mascara', "npx tsc --noEmit && npx vitest run tests/a.test.ts || npx vitest run tests/ --reporter=dot 2>&1 | tail -5"],
    ['pipe mascara verde', "npx vitest run 2>&1 | grep -qE 'Tests.*([0-9]+ passed)'"],
    ['tail descarta saida', 'npx vitest run 2>&1 | tail -20'],
    ['`;` descarta status', 'psql -d db -c "update messages set body=1" > /dev/null; echo ok'],
    ['negacao multi-arquivo', "! grep -q 'sendText(' src/application/outbox-worker.ts src/application/queue-per-lead.ts"],
    ['contagem dupla', "grep -c 'x' src/ | grep -c ':0'"],
    ['grep sem evidencia de falha', "npx biome check . 2>&1 | grep -q 'checked'"],
    ['pipe de suite para wc', 'npx vitest run | wc -l'],
  ];
  const mustPass = [
    ['presenca', "grep -q 'splitLongMessage' src/application/humanize.ts"],
    ['ausencia por arquivo', "! grep -q 'sendText(' src/application/outbox-worker.ts && ! grep -q 'sendText(' src/application/queue-per-lead.ts"],
    ['suite positiva', 'npx vitest run tests/ops/humanize.test.ts'],
    ['suite negativa', '! npx vitest run tests/ops/humanize.test.ts'],
    ['pipe de suite para grep de auditoria', "npx biome check . 2>&1 | grep -qE '(error|warning)'"],
    ['pipe de grep para grep -v', "test -z \"$(grep -rl '@whiskeysockets/baileys' src --include='*.ts' | grep -v '^src/channel/')\""],
    ['contagem dentro de test', 'test "$(grep -rc \'sendText\' src/application/dispatcher.ts)" -ge 1'],
    ['SQL com ponto e virgula dentro de aspas', 'psql -d db -tAc "select count(*) from leads;" | grep -qE \'^[0-9]+$\''],
    ['BRE com barra vertical', '! grep -q "channelAccountId\\|\'0@s.whatsapp.net\'" src/domain/gate/types.ts'],
  ];

  // O envelope espelha a forma real de um plano: cada tag na sua propria linha, porque o
  // extrator so aceita tag no inicio da linha (ver extractBlocks).
  const envelope = (snippet) => `<verify>\n<automated>${snippet}</automated>\n</verify>`;

  let failures = 0;
  for (const [label, snippet] of mustFail) {
    const v = lintText(envelope(snippet));
    const ok = v.length > 0;
    if (!ok) failures++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  [rejeita] ${label}${ok ? ` -> ${v.length} violacao(oes)` : ' -> NAO DETECTOU'}`);
  }
  for (const [label, snippet] of mustPass) {
    const v = lintText(envelope(snippet));
    const ok = v.length === 0;
    if (!ok) failures++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  [aceita ] ${label}${ok ? '' : ` -> ${v.map((x) => x.msg).join(' / ')}`}`);
  }
  console.log(failures === 0 ? '\nself-test OK' : `\nself-test FALHOU (${failures})`);
  return failures === 0;
}

const isMain = process.argv[1] && resolve(process.argv[1]).endsWith('lint-verify-chains.mjs');
if (isMain) {
  if (process.argv.includes('--self-test')) {
    process.exit(selfTest() ? 0 : 1);
  }
  const targets = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  if (targets.length === 0) {
    console.error('uso: node scripts/lint-verify-chains.mjs <dir-ou-arquivo>... | --self-test');
    process.exit(2);
  }
  let total = 0;
  for (const target of targets) {
    const report = lintTargets(target);
    for (const { file, violations } of report) {
      for (const v of violations) {
        total++;
        console.error(`${file}:${v.line} [${v.kind}] ${v.msg}`);
        console.error(`    ${v.text}`);
      }
    }
  }
  console.log(`lint-verify-chains: ${total} violacao(oes).`);
  if (total > 0) {
    console.log(DOCS);
    process.exit(1);
  }
  console.log(DOCS);
  console.log('Todas as cadeias de <verify>/<automated> sao fail-closed.');
}
