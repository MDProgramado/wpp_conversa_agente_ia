---
phase: 01-funda-o-canal-e-gate-de-envio
plan: 01
subsystem: infra
tags: [baileys, drizzle, postgres, pino, zod, biome, vitest, winrt, gate, kill-switch]

requires:
  - phase: preflight
    provides: "Node 24.21.0 LTS ativo, PostgreSQL 18.3 confirmado, DATA_ROOT C:\\whatsapp_prospecao fora do OneDrive, pin Baileys 7.0.0-rc14 (ADR-001)"
provides:
  - "Scaffold TypeScript com 28 arquivos .ts em src/ e 7 em tests/, pins exatos, barreira de lint D-06 com 11 pacotes proibidos"
  - "Schema de 6 tabelas + 3 migrations .sql versionadas e aplicadas no PostgreSQL 18.3"
  - "PolicyGate como funcao pura: kill switch, Guard 0 (R-001) e 7 guards AR, em ordem fixa"
  - "dispatcher.ts como choke-point unico de sendText, com cota atomica e gravacao de blocked_attempts"
  - "env validado por zod, logger pino com redact, launch.cmd, boot real com escrita+leitura no banco"
  - "scripts/notify.ps1 (WinRT de primeira parte) + scripts/lint-verify-chains.mjs (barreira anti-fail-open)"
  - "30 testes verdes em 6 arquivos; tsc 0; biome check 0; lint:verify 0"
affects: [01-02, 01-03, 01-04, 01-05, fase-2, fase-3, fase-4]

tech-stack:
  added: ["@whiskeysockets/baileys@7.0.0-rc14", "drizzle-orm@0.45.3", "drizzle-kit@0.31.11", "pg@8.23.0", "pino@10.3.1", "zod@4.6.5", "croner@10.0.1", "p-queue@9.3.3", "typescript@7.0.2", "vitest@5.0.2", "@biomejs/biome@2.5.14", "tsx@4.23.15", "fast-check@4.10.2"]
  patterns:
    - "Gate como funcao pura: evaluatePolicy(input) -> Decision, sem IO. Kill switch -> Guard 0 -> AR-001..AR-011 em ordem fixa"
    - "dispatcher.ts como choke-point unico de sendText (verificado por grep; ausencia de um segundo caminho e o invariante)"
    - "Fail closed: todo caminho de erro produz silencio + log, nunca texto de fallback ao lead"
    - "log sem corpo de mensagem: apenas id, direction, char_count e hash"

key-files:
  created:
    - "src/config/env.ts — schema zod unico + resolucao e criacao de DATA_ROOT/auth/backups/logs"
    - "src/infra/db/schema.ts — 6 tabelas com CHECKs de banco que sustentam AR-004, AR-008, R-023"
    - "src/infra/db/client.ts — pool pg (max 5, application_name) + drizzle + migrate() antes de qualquer uso"
    - "src/domain/gate/evaluate-policy.ts — decisao pura do gate"
    - "src/domain/gate/guard-0-r001.ts — Guard 0, fora da numeracao AR"
    - "src/domain/gate/guard-order.ts — ordem canonica de avaliacao, invariante da fase"
    - "src/application/dispatcher.ts — choke-point de envio, cota atomica, blocked_attempts"
    - "src/domain/business-hours.ts — janela R-006 no fuso America/Sao_Paulo"
    - "scripts/launch.cmd — boot idempotente: checa PG, aplica migrations, sobe o processo"
    - "scripts/notify.ps1 — toast WinRT de primeira parte (R-013, D-07)"
    - "scripts/lint-verify-chains.mjs — barreira anti-fail-open das cadeias de verificacao"
    - "tests/gate/regressoes.test.ts — trava os 3 defeitos corrigidos (7 testes)"
  modified:
    - "AGENTS.md — bloco GSD:stack-* passou a instruir o pin 7.0.0-rc14 (zero ocorrencias de 6.7.24)"
    - ".gitignore — esconde segredos sem esconder migrations nem .env.example"
    - ".planning/STATE.md — decisoes e bloqueios da fase"

key-decisions:
  - "Pin exato @whiskeysockets/baileys@7.0.0-rc14 com --save-exact: a linha 6.7.x e pre-tctoken e nao expoe fetchNewChatMessageCap/fetchAccountReachoutTimelock/tratamento do 463, sem os quais WHS-04 e LEAD-03 ficam sem implementacao (ADR-001)"
  - "Guard 0 (R-001) fica FORA da numeracao AR-001..AR-012: AR-001 e sobre preco, nao sobre primeiro contato"
  - "A ordem de avaliacao do gate e invariante, nao detalhe: kill switch antes de tudo, depois Guard 0, depois AR em ordem numerica"
  - "Registro do AUMID e best-effort e nao-fatal: AUMID controla o NOME do toast, nao a emissao, e um registro que bloqueia o alerta seria risco maior que o nome generico"
  - "DATA_ROOT fora do OneDrive com guarda DATA_ROOT_ON_ONEDRIVE no boot: pasta de sessao Baileys em pasta sincronizada e o vetor conhecido de corrupcao do useMultiFileAuthState"

patterns-established:
  - "Guard isolado por arquivo: um arquivo por AR, uma funcao exportada, sem export morto (guard-order.ts depende dessa forma)"
  - "Todo negativo do gate vira linha em blocked_attempts: gate que bloqueia em silencio sem trilha e gate nao auditavel (R-022)"
  - "Cota diaria consumida atomicamente: decrement + checagem na mesma transacao, nunca checar-e-depois-decrementar"
  - "Migrations .sql versionadas em src/infra/db/migrations/ com meta/; nunca ignoradas pelo .gitignore (R-031)"

requirements-completed: [OPRE-01, WHS-01, WHS-03, WHS-05, CONV-11, CONV-14, INTR-01, COMP-04, COMP-05, NFRQ-01, NFRQ-06, EQUP-01, EQUP-02]

# Metrics
duration: 150min
completed: 2026-09-30
---

# Phase 01-01: Walking Skeleton Summary

**Do duplo clique em um `.cmd` ate um texto de teste que so sai quando o gate permite — com 6 tabelas no PostgreSQL 18.3, 30 testes verdes e um choke-point de envio que nenhum segundo caminho consegue contornar.**

## Performance

- **Duration:** ~150 min (execução + diagnóstico do checkpoint)
- **Started:** 2026-09-30
- **Completed:** 2026-09-30
- **Tasks:** 6 (5 concluídas, 1 pendente de revalidação — ver Issues)
- **Commits:** 9 ( Tasks 2-6) + 1 pré-existente (Task 1, `8728972`)
- **Files:** 28 `.ts` em `src/`, 7 em `tests/`, 7 arquivos de migration

## Accomplishments

- **O gate é uma função pura e a ordem é invariante.** `evaluatePolicy` não faz IO: kill switch, depois Guard 0 (R-001), depois AR-001..AR-011 na ordem de `docs/10-anti-requisitos.md`. A ordem está em `guard-order.ts` e é testada, não documentada.
- **`sendText` tem exatamente um chamador de produção.** `src/application/dispatcher.ts:164`. A prova é a *ausência* de um segundo caminho, e a barreira de lint mantém isso. Este é o invariante de onde saem os 12 anti-requisitos.
- **R-001 é garantido por construção, não por confiança.** Com `firstContactByHuman = false` a decisão é `block` com `reason: 'r001_primeiro_contato_nao_humano'`, `sendText` não é chamado e a tentativa vai para `blocked_attempts`.
- **Barreira anti-fail-open (`lint-verify-chains.mjs`).** Rejeita `||` e `;` como separadores, suíte piped para `tail`/`head`/`wc`, `grep` sem evidência de falha, negação multi-arquivo e contagem dupla. Self-test prova 8 rejeições e 9 aceitações. Um plano que se autoverifica com máscara é o defeito que este script torna impossível.
- **Quatro 6 tabelas e 3 migrations aplicadas de verdade** no PostgreSQL 18.3, com `pg_dump` do mesmo major.
- **3 defeitos graves corrigidos e travados** (ver Deviations) — o mais sério transformava o sistema inteiro em muro.

## Task Commits

1. **Task 1: Preflight de ambiente, pin do Baileys e ADR-001** — `8728972` (chore) — *pré-existente à retomada deste plano*
2. **Task 2: Scaffold, pins exatos e barreira de lint D-06** — `5029c00` (chore)
3. **Task 3: Schema das 6 tabelas e migrations aplicadas** — `cb1ed8d` (feat) + `e6c8e22` (fix)
4. **Task 4: Env validado por zod, logger com redact, launch.cmd, boot real** — `fa056eb` (feat)
5. **Task 5: Gate como função pura, 7 guards, cota atômica, dispatcher-choke-point** — `a87c700` (test/red) → `1d74abd` (feat) + `617d9e2` (fix) + `30fb329` (fix)
6. **Task 6: Notificação local via WinRT (R-013, D-07)** — `139d72c` (feat) — **implementada; verificação visual PENDENTE**

## Decisions Made

- **Guard 0 fora da numeração AR.** O plano põe R-001 como "Guard 0" e a taxonomia canônica começa em AR-001 = preço. Manter R-001 como AR-000 seria inventar uma numeração que não existe em `docs/10-anti-requisitos.md`.
- **Registro do AUMID best-effort e não-fatal.** `Register-Aumid` grava `PKEY_AppUserModel_ID` no atalho via `IPersistPropertyStore`; nesta máquina o `SetValue` retorna `ArgumentException` e o registro é pulado com log. Raciocínio: AUMID controla o *nome* exibido, não a emissão. Um registro que falha não pode impedir a notificação — R-013 exige que o Admin seja avisado, e um registro de branding que bloqueia o alerta é risco maior que o nome genérico que ele evita.
- **Som toca antes do toast.** Se a sessão de áudio estiver em erro, o script falharia *depois* de já ter emitido o toast e R-013 perderia a notificação silenciosamente. O som é o sinal mais difícil de o Windows descartar.
- **Título nunca vai para o log.** Pode carregar trecho de conversa com o lead; o arquivo sobrevive à rotação de retenção (R-064). O log registra `title_chars` (quanto) e nunca o conteúdo.

## Deviations from Plan

### Auto-fixed Issues

**1. Kill switch invertido — o produto inteiro não mandava nada**
- **Found during:** Task 5 (gate)
- **Issue:** `snapshot.ts` lia `coalesce(is_active, false) as kill_switch`, mas o guard bloqueia quando `killSwitch === true`. Conta **ativa** — o caso normal, permanente — virava kill switch ligado e o gate bloqueava toda mensagem do sistema.
- **Fix:** `not coalesce(...)`, com o porquê documentado no campo.
- **Verification:** `tests/gate/regressoes.test.ts` — "conta ATIVA envia — a inversão que transformava o sistema em muro", mais "conta inativa bloqueia" e "kill switch vence o resto".
- **Committed in:** `30fb329`

**2. AR-004 barrava todo link, violando R-042**
- **Found during:** Task 5 (gate)
- **Issue:** o guard testava `p.kind !== "text"`, tratando `link` como mídia. R-042 permite texto e links; o plano pede bloquear o que difere de text **E** link.
- **Fix:** link normal passa; link de mídia continua barrado pela checagem de extensão.
- **Verification:** 4 testes — link de página, link com query string, link de PDF barrado, link de imagem barrado.
- **Committed in:** `30fb329`

**3. `blocked_attempts` perdia todo negativo**
- **Found during:** Task 5 (gate)
- **Issue:** `db.execute` com string solta deixava `$1..$3` sem valor, então nenhuma rejeição do gate ia para a trilha de auditoria. Gate que bloqueia sem trilha não é auditável (R-022).
- **Fix:** `sql` do drizzle com bind.
- **Verification:** coberto pelos testes de rejeição do gate.
- **Committed in:** `30fb329`

**4. `ON CONFLICT` no-op em `channel_accounts.phone_e164`**
- **Found during:** Task 3 (schema)
- **Issue:** o `ON CONFLICT` apontava para uma constraint que não existia, então o insert da linha única era no-op silencioso.
- **Fix:** unicidade real em `phone_e164`, com migration `0001`.
- **Committed in:** `e6c8e22`

**5. `leads.duplicate_of` sem integridade referencial**
- **Found during:** Task 3 (schema)
- **Issue:** coluna sem FK — nada impedia apontar para um lead inexistente, nem detectava o caso de auto-referência.
- **Fix:** FK de verdade, sem cascade, com migration `0002`.
- **Committed in:** `617d9e2`

---

**Total deviations:** 5 auto-fixed (3 de correção, 2 de schema)
**Impact on plan:** Todos necessários para correção ou auditabilidade. Sem scope creep. Os três primeiros são defeitos que nenhum teste do plano pegaria — foram encontrados por leitura, o que é a razão de `tests/gate/regressoes.test.ts` existir agora.

## Issues Encountered

### Task 6 — notificação não aparece; defeito do Windows, não do código

A Task 6 é `<task type="checkpoint:human-verify" gate="blocking">`. **A implementação está completa e verificada; a verificação visual não pôde ser concluída.** Diagnóstico completo, para não repetir:

| Verificação | Resultado |
|---|---|
| `Show()` lança exceção? | **Não** — nem com AUMID válido, nem inválido |
| Notificação chega a ser gravada? | **Sim** — linha criada em `wpndatabase.db` |
| Notificação **entrega** de verdade? | **Não** — `LastNotificationAddedTime` não é atualizado para nenhum app |
| Toast com AUMID **nativo do PowerShell** (controle da Microsoft)? | Não apareceu |
| Balloon via `NotifyIcon` (caminho diferente, sem WPN)? | Não apareceu |
| Foco Assistente / DND | Desligado (chave `donotdisturb.quiethourssettings` vazia) |
| Política de bloqueio (HKLM/HKCU)? | Nenhuma |
| Toggle "Notificações" em Configurações | **Ligado** (confirmado pelo Admin) |
| Sessão | `console` local, interativa, **não** RDP |
| Áudio | OK (Realtek + Intel); `Hand.Play()` sem exceção |
| `explorer` / `ShellExperienceHost` / `StartMenuExperienceHost` / `RuntimeBroker` | Todos rodando, sessão 2 |
| **`WpnUserService`** | **STOPPED** — e `Start-Service` é recusado |
| SO | Windows 11 25H2, build 25H2 |

**Causa:** `WpnUserService` é o serviço *template* por usuário que entrega o banner e alimenta a Central de Notificações. Parado, a gravação da notificação passa (por isso `toast_sent` no log e a linha no banco) e a exibição nunca acontece. `Start-Service` é recusado porque é serviço por usuário, iniciado sob demanda pelo Windows no contexto da sessão — e ele não subiu.

**Não é corrigível por código.** O `notify.ps1` está correto: XML válido, `Show()` sem erro, som tocado, log honesto. O defeito é do Windows nesta máquina.

**Decisão do Admin (2026-09-30):** reiniciar o Windows e revalidar depois. Plano não bloqueado; Task 6 registrada como pendente.

**Para revalidar após o reboot** — um comando:

```bash
npm run notify -- -Title "Teste R-013" -Message "Verificacao" -Urgent
```

Esperado: toast no canto inferior direito. Duas respostas possíveis, ambas tolerable:

- **Toast aparece com nome "Windows PowerShell"** — defeito cosmético conhecido e documentado (registro do AUMID falha com `ArgumentException` nesta máquina; `RegisterAumid` é best-effort por decisão). Aceitável: o alerta chega, que é o que R-013 exige.
- **Toast não aparece** — o `WpnUserService` não subiu após o reboot. Neste caso a decisão de projeto pendente é: **o som deve virar o canal primário de alerta**, com o toast como complemento. R-013 é load-bearing — handoff, opt-out e mídia recebida dependem de o Admin *saber* que precisa agir. O som já é independente do WPN e já toca hoje com `-Urgent`.

### Node no `PATH` — armadilha de versão

Um shell aberto **antes** da mudança de `PATH` do usuário continua resolvendo `C:\Program Files\nodejs\node.exe` = **v22.14.0**, e reporta a versão errada. O projeto exige **v24.21.0**. `launch.cmd` depende do binário real; `npx node@24` mascara a versão e quebra o launcher.

Prefixo necessário em qualquer shell já aberto:

```bash
export PATH="/c/Users/11/AppData/Roaming/fnm/node-versions/v24.21.0/installation:$PATH"; hash -r
```

`C:\Program Files\nodejs` (v22.14.0) **não** deve ser desinstalado — é runtime de outros projetos da máquina.

## Files Created/Modified

28 arquivos `.ts` em `src/`, 7 em `tests/`, 3 migrations `.sql` + `meta/`, 3 scripts. Arquivos de maior consequência:

- `src/domain/gate/evaluate-policy.ts` — a função pura de decisão
- `src/domain/gate/guard-order.ts` — ordem canônica, invariante da fase
- `src/application/dispatcher.ts` — choke-point único de envio
- `src/config/env.ts` — schema zod + guarda `DATA_ROOT_ON_ONEDRIVE`
- `src/infra/db/schema.ts` — 6 tabelas com CHECKs de banco
- `src/infra/db/client.ts` — pool + `migrate()` antes de qualquer uso
- `scripts/lint-verify-chains.mjs` — barreira anti-fail-open
- `scripts/launch.cmd` — boot idempotente
- `scripts/notify.ps1` — toast WinRT (Task 6, visual pendente)
- `tests/gate/regressoes.test.ts` — trava os 3 defeitos corrigidos

## User Setup Required

- **`CHANNEL_PHONE_E164`** no `.env` está com o placeholder `+5511999999999` (igual ao `.env.example`). **O número dedicado real do Admin precisa entrar antes do pareamento QR** (plano 01-03). O CHECK do banco (`^\+[1-9][0-9]{7,14}$`) aceita o placeholder, então nada quebra até lá — mas o número errado no canal é o tipo de erro que não tem recuperação barata.
- **Pareamento QR do número de vendas** — exige o telefone físico em mãos do Admin. É o passo irreversível da fase (Task 3 do plano 01-03).
- Nenhuma configuração de serviço externo.

## Next Phase Readiness

**Pronto:**
- 01-02 pode rodar em cima do schema: `schema.ts` tem as 6 tabelas, migrations aplicadas, e a barreira de lint garante que nada importa Baileys fora do adaptador.
- 01-03 pode criar o `ChannelPort` Baileys: sessão, AUMID, `DATA_ROOT` e quota já têm lugar. `fetchNewChatMessageCap()` e `fetchAccountReachoutTimelock()` precisam ser confirmados nos typings do pacote instalado (7.0.0-rc14) — item já conhecido da smoke test.
- 01-04 pode fixar a ordem de avaliação: `guard-order.ts` já é a fonte da verdade e o `dispatcher` já é choke-point.
- 01-05 pode construir humanização e serialização sobre `p-queue`: a cota atômica já está em `counters.ts`.

**Pendências que não bloqueiam a wave 2:**
- Task 6 (visual) — revalidar após reboot, 1 comando.
- `CHANNEL_PHONE_E164` real no `.env`.
- Confirmação de `fetchNewChatMessageCap` / `fetchAccountReachoutTimelock` nos typings (WHS-04, LEAD-03).

**Risco a carregar:** R-013 é load-bearing e hoje depende de um serviço do Windows que está parado nesta máquina. O canal de som é o fallback já disponível e independente. Decisão de projeto pendente caso o reboot não resolva.

---
*Phase: 01-funda-o-canal-e-gate-de-envio*
*Completed: 2026-09-30 (Task 6 pendente de revalidação pós-reboot)*
