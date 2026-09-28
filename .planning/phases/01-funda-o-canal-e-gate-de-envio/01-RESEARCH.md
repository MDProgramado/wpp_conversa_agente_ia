# Phase 1: Fundação, Canal e Gate de Envio — Research

**Researched:** 2026-09-28
**Domain:** Canal WhatsApp não oficial (Baileys v7 rc), gate de envio determinístico, persistência PostgreSQL local, operação Windows
**Confidence:** HIGH (todas as afirmações marcadas `[VERIFIED]` foram reproduzidas nesta sessão; ver §Fontes)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

Todas as áreas foram auto-selecionadas e auto-resolvidas em modo `--auto`. **Estas decisões NÃO são reabertas pela pesquisa.**

#### Armazenamento fora do OneDrive (COMP-05) — D-01
Raiz única de dados do sistema em `C:\whatsapp_prospecao\` (fora da árvore OneDrive e fora do repo), com subpastas `auth\` (auth state do Baileys), `backups\` (pg_dump) e `logs\` (pino). O path vem de `.env` (`DATA_ROOT`), com esse default; nunca dentro de OneDrive/git. Backup versionado por data/hora em `backups\`; auth state **nunca** commitada nem incluída na rotação de logs.

#### Captura da 1ª mensagem manual (OPRE-01, CONV-01, R-001) — D-02
O trigger de "bot assume a conversa" é o evento de **mensagem de saída do próprio Admin** detectada via Baileys (`messages.upsert` com `key.fromMe` no chat do lead em estado relevante). Sem botão dedicado na Fase 1 (o painel só existe na Fase 3): a captura é o fato de o Admin ter enviado manualmente a 1ª mensagem no app do WhatsApp ligado ao número. O sistema registra isso no `last_processed_at` do lead e transiciona para o comportamento de assumir. R-001 permanece como **Guard 0 de admissão** (anterior à sequência AR-001..AR-012) + captura de `fromMe`: o bot **nunca** inicia o primeiro contato. R-001 é requisito próprio e não deve ser identificado com nenhum dos AR — ver §Guard 0.

#### Janela operacional na Fase 1 (WHS-01) — D-03
Janela de dias úteis 7h–17h implementada com calendário de **só dias úteis** na Fase 1 (dias de semana). Processamento de feriados brasileiros fica **adiado para a Fase 3** (FLUP-03).

#### Limites diários (R-023*/WHS-04) — D-04
Defaults configuráveis via `.env` (não hardcoded): **25 mensagens/dia** (meio do intervalo 20–30) e **20 leads/dia**. A Fase 1 lê `fetchNewChatMessageCap()` do Baileys como **terceira trava adicional** — o limite efetivo é sempre `min(limite_configurado, cap_lido)`. Erro **463 jamais é retryado**: suspende o contato frio e emite alerta; contadores em tabelas com `CHECK (count <= limite)` no schema.

#### Pureza e testabilidade do gate (CONV-14) — D-05
`evaluatePolicy` é função **pura**: recebe `(mensagem_candidata, snapshot_de_estado, config)` e devolve `{ permitido: boolean, motivo }`. Nada de I/O interno — o dispatcher injeta o snapshot (lido via `FOR UPDATE` na mesma transação do enfileiramento). Isso torna os 12 property tests (1 por AR) triviais e determinísticos. Config vem de `.env` + tabelas de cota, nunca hardcoded no gate.

#### Lint como barreira estrutural — D-06
Lint `no-restricted-imports` bloqueia importar `BaileysChannelAdapter`/`ChannelPort` fora do `Dispatcher`/`Adapters` — sem import, sem caminho alternativo de envio.

#### Notificação local na Fase 1 (NFRQ-04, NFRQ-06) — D-07
`notify.ps1` (PowerShell + WinRT ToastNotificationManager, sem dependência `node-notifier`) é o transporte de notificação da Fase 1, acionado via subprocess pelo app. **Smoke test obrigatório na máquina do Admin** dentro da Fase 1: validar Focus Assist, ExecutionPolicy e som. O chime Web Audio fica como redundância quando houver painel (Fase 3) — nota-se aqui, não se constrói agora.

#### Integração da API do caça-leads (LEAD-01) — D-08
A API do caça-leads **não está especificada** (schema, auth, rate limit — bloqueio registrado em STATE.md). A Fase 1 define o **port/interface** (`LeadSourcePort`: listar com filtros estado/cidade/região/nicho/nome-chave + importar) com um `FakeLeadSourceAdapter` de fixture para testes e um `HttpLeadSourceAdapter` esqueleto atrás de interface. O contrato real de HTTP fica bloqueado em pesquisa, não na arquitetura. AR-011 continua valendo na importação: lead só entra com origem, base legal e finalidade registradas.

#### Pin exato do Baileys
`@whiskeysockets/baileys@7.0.0-rc14` com `--save-exact` — nunca `latest`.

#### R-001 como guard, não UX
O bot **nunca** inicia o primeiro contato; R-001 é imposed como **Guard 0 (admissão)** — uma pre-condição *anterior* à sequência AR-001..AR-012 — combinado com a captura de `fromMe`. **R-001 NÃO é o AR-001:** `docs/10-anti-requisitos.md` define AR-001 como "Negociar preço, valor, desconto". São invariantes diferentes e nenhum mapeamento entre elas deve ser escrito. Ver §Guard 0.

#### Tenacidade anti-ban
O número é irreplaceable (R-059). Toda decisão de Fase 1 (dreno, buffer, cache, jitter) prioriza não queimar o número sobre velocidade.

### Deferred Ideas (OUT OF SCOPE — ignorar completamente)
- Feriados brasileiros no calendário — Fase 3 (`business-hours.ts`, FLUP-03). A Fase 1 faz só dias úteis.
- Chime Web Audio como redundância de notificação — Fase 3.
- Detecção de opt-out / mídia recebida / handoff — Fase 2 (requer matcher + LLM; COMP-01). A Fase 1 deixa o `optout_ledger`/guard prontos, a **detecção** não.
- Break-up message (FLUP-11 v2) e appeal de ban — Fase 4.
- Multiusuário operacional (R-029/R-030) — v2; a Fase 1 só deixa colunas nullable no schema (EQUP-02).
- A decomposição da caça-leads (schema HTTP real) — depositada em pesquisa/STATE.md, não arquitetura.
- Qualquer chamada a LLM/provedor de IA (Fase 2), scheduler/cadência de follow-up (Fase 3), painel web (Fase 3), dreno de R-007 (Fase 3).
</user_constraints>

<phase_requirements>
## Phase Requirements

23 requisitos. `Pesquisa que habilita` aponta a seção deste documento que dá a base de implementação.

| ID | Descrição | Pesquisa que habilita |
|----|-----------|-------------------------|
| **OPRE-01** | Admin envia manualmente a 1ª mensagem; bot NUNCA inicia contato (R-001) | §Como distinguir a 1ª mensagem manual (resolver ambiguidade `fromMe`); §Guard 1 |
| **LEAD-01** | Integra API do caça-leads (filtros estado/cidade/região/nicho/nome-chave) (R-017) | §`LeadSourcePort`; D-08; §Código: porta do caça-leads |
| **LEAD-02** | Usa só nome, telefone, endereço; contexto descoberto na conversa (R-018) | §`LeadSourcePort` — os 3 campos são o contrato do tipo |
| **LEAD-03** | Valida existência via `onWhatsApp()`; estado terminal `NUMERO_INVALIDO` sem quebrar a fila (R-019*) | §`onWhatsApp()` — assinatura real, semântica de "não existe", cache 7 dias |
| **LEAD-04** | Mantém todos os leads; sinaliza duplicidades; decisão manual (R-020) | §Schema: `leads` sem `ON DELETE`, unique em `phone_number`, `duplicate_of` |
| **WHS-01** | Nada automático fora de dias úteis 7h–17h (R-006) | §Guard 7 + código de janela pure, testável; `croner` verificado |
| **WHS-03** | Camada de conexão isolada em interface/adaptador (R-016) | §`ChannelPort` em E.164; §`FakeChannel`; §Diagrama |
| **WHS-04** | Travas duras: 20 leads/dia + `fetchNewChatMessageCap()` + 20–30 msg/dia; 463 **jamais** retryado (R-023*) | §463 — como *de fato* o 463 chega (não é rejeição do `sendMessage`); §Cap real; §`daily_counters` verificado |
| **WHS-05** | Um único número dedicado e exclusivo (R-059) | §Diagrama; §Código: `channel_accounts` single-row |
| **CONV-11** | Só texto e links; nunca mídia (R-037) | §Guard 4 + `capabilities()` sem `sendMedia`; §`noRestrictedImports` verificado |
| **CONV-13** | Humaniza: delays aleatórios, "digitando…", quebra de longas (R-067) | §`sendPresenceUpdate` por-JID verificado; §`p-queue` verificado; §Código: humanize |
| **CONV-14** | AR-001..AR-012 como invariantes via gate único + 1 property test por AR; nenhum caminho escapa (derivado) | §Os 12 guards; §Property tests (`@fast-check/vitest` verificado); §`biome.json` verificado; §Oráculo circular nos ARs |
| **INTR-01** | Só caça-leads + LLM + WhatsApp local (R-044) | §O que a Fase 1 **não** instala; §`biome.json` (bloqueia bullmq/ioredis/sentry/langchain) |
| **COMP-02** | Base sem opt-in com risco MUITO ALTO (R-063) | §Documentos LGPD versionados; §Guard 11 |
| **COMP-03** | Base legal legítimo interesse: origem, base legal, finalidade; opt-out imediato (R-064) | §Guard 11 + `optout_ledger` append-only verificado; trigger irreversível verificado |
| **COMP-04** | Sem criptografia adicional; risco aceito e documentado (R-033) | §D-01; §Segurança: o que a aceitação de risco **não** cobre (achado novo) |
| **COMP-05** | Auth state e backups fora do OneDrive/git | §D-01; §`.gitignore` |
| **NFRQ-01** | PostgreSQL local + script/migração de schema (R-031) | §Drizzle verificado ponta a ponta (`generate` → `.sql` → `migrate()` idempotente) |
| **NFRQ-02** | Backup manual local versionado, restaurável sem serviço externo (R-032) | §`pg_dump -Fc` / `pg_restore` **round-trip verificado** + verificação de contagem de linhas |
| **NFRQ-04** | Logs em arquivo + painel de erros + notificação local em falhas críticas (R-045) | §`notify.ps1` **executado com sucesso nesta máquina**; §`pino` redact |
| **NFRQ-06** | Roda em Windows (R-047) | §Disponibilidade de ambiente; §Launcher `.cmd` com `pg_ctl` (não `net start`) |
| **EQUP-01** | Usuário único; sem perfis/permissões (R-027) | §`channel_accounts`/`app_users` single-row |
| **EQUP-02** | Preparado para multiusuário: responsável, criado por, auditoria (R-028) | §Colunas nullable agora |
</phase_requirements>

## Resumo

A Fase 1 é greenfield e quase toda a sua incerteza técnica é **verificável agora** — foi verificada nesta sessão, nesta máquina, com o pacote exato que a fase vai instalar. Os seis pontos que bloqueiam o plano foram resolvidos com evidência: (1) `@whiskeysockets/baileys@7.0.0-rc14` é ESM puro e expõe `useMultiFileAuthState`, `makeWASocket`, `signalRepository.lidMapping`, `fetchNewChatMessageCap()` e `fetchAccountReachoutTimelock()` com as assinaturas que o desenho exige; (2) **o erro 463 não chega como rejeição do `sendMessage()`** — é tratado internamente no handler de ACK, o que muda a estratégia de detecção para leitura de sinais read-only; (3) **a 1ª mensagem manual do Admin é discriminável de forma exata** com `emitOwnEvents: false` + `key.fromMe`, fechando a ambiguidade de OPRE-01 sem heurística; (4) o `noRestrictedImports` do Biome 2.5.14 existe, é do grupo **`style`** (não `correctness`), e a exclusão do adaptador foi testada com sucesso; (5) o par `@fast-check/vitest` + Vitest 5 roda property tests reais com shrinking e seed reproduzível; (6) o `notify.ps1` WinRT **funcionou** nesta máquina, e o `pg_dump -Fc` → `pg_restore` fez round-trip com contagem de linhas conferida.

A pesquisa encontrou também **três riscos que não estavam registrados** e que precisam de decisão no plano ou correção: o `AGENTS.md` embute um `STACK.md` que **contradiz** a decisão do usuário (manda pinar `6.7.24` e diz "do not install rc14"); o PostgreSQL instalado na máquina é **18.3** e a sessão roda sem privilégio de administrador, o que torna `net start postgresql-x64-18` impossível no launcher; e o `pg_hba.conf` local tem **`trust` para `127.0.0.1` com `listen_addresses = '*'`**, o que contradiz a própria diretriz do projeto de "bind em 127.0.0.1" e amplia o risco aceito em R-033.

**Recomendação primária:** o gate é a espinha dorsal e deve ser a **primeira** coisa construída (função pura + 12 guards + 12 property tests, zero dependências de canal); o `ChannelPort` é a **segunda** (com `FakeChannel` antes do `BaileysChannelAdapter`, para que o gate possa ser testado contra um canal falso desde o primeiro commit); o schema Drizzle é o **terceiro** e fecha o ciclo com backup verificado. Nenhuma tarefa deve chamar `socket.sendMessage` diretamente — o lint é a prova mecânica disso.

## Mapa de Responsabilidade Arquitetural

| Capacidade | Tier primário | Tier secundário | Justificativa |
|---|---|---|---|
| Gate de envio `evaluatePolicy` | **Domínio** (função pura) | — | Sem I/O, sem `Date.now`, sem socket. É a única prova de que AR-001..AR-012 são invariantes. |
| Reserva transacional de outbox | **Banco** (`FOR UPDATE SKIP LOCKED`) | Domínio | A cota precisa ser decidida no mesmo `BEGIN` do enfileiramento, ou dois workers estouram R-023. |
| Cota diária (contadores) | **Banco** (`CHECK (count <= limite)`) | Domínio | O `CHECK` é a última linha de defesa; a tabela sobrevive a restart. |
| Irreversibilidade do opt-out | **Banco** (trigger `BEFORE UPDATE`) | — | Um `CHECK` não impede `UPDATE`; só um trigger impede. Verificado nesta sessão. |
| Envio de texto pelo WhatsApp | **Adaptador de canal** (`src/channel/baileys/`) | — | Único lugar que importa Baileys. `capabilities()` não expõe mídia. |
| Resolução LID↔PN | **Adaptador de canal** (`JidResolver`) | Banco (cache colunas `wa_jid`/`lid`) | `signalRepository.lidMapping` só existe dentro do adaptador; o resto do app só vê E.164. |
| Sessão/credenciais Baileys | **Adaptador + disco** (`C:\whatsapp_prospecao\auth\`) | — | Se a pasta sumir, o WhatsApp vê "dispositivo novo" = sinal de banimento. |
| Health/falhas críticas | **Aplicação** (pino + `notify.ps1`) | SO (PowerShell/WinRT) | O toast é melhor-esforço; o log é o registro confiável. |
| Migrações de schema | **Build/dev** (`drizzle-kit generate` → `.sql`) | Aplicação (`migrate()` no boot) | `.sql` revisável é requisito de R-031 e a base do backup. |
| Janela 7h–17h / cadência | **Domínio** (`business-hours.ts` puro) | Aplicação (`croner` só dispara o tick) | O cálculo é determinístico e testável; o cron é só o despertador. |
| Notificação local (som+pop-up) | **SO** (PowerShell 5.1 + WinRT) | — | Verificado: `pwsh` não existe nesta máquina; o script tem que ser 5.1. |
| Painel web / CRM operacional | **Fora da Fase 1** (Fase 3) | — | Explicitamente adiado. |

## Mapa de Responsabilidade de Segurança (ASVS)

| Categoria ASVS | Aplica | Controle padrão na Fase 1 |
|---|---|---|
| V2 Autenticação | **Não** | EQUP-01: usuário único. A "autenticação" do canal é o pareamento QR do Baileys, não sessão de app. |
| V3 Gerência de Sessão | Sim | `useMultiFileAuthState` em `DATA_ROOT\auth` fora do OneDrive/git; teardown gracioso no `SIGINT`/`SIGTERM` (kill abrupto corrompe a pasta = "novo dispositivo"). |
| V4 Controle de Acesso | Sim | Sem perfis (R-027), mas com colunas nullable (R-028) e `channel_accounts` single-row (WHS-05). Bind em `127.0.0.1` (ver §Achado de segurança). |
| V5 Validação de Entrada | **Sim** | `onWhatsApp()` antes de enfileirar (LEAD-03); guard AR-004 (tipo de mídia) no gate; `CHECK` em todo enum do schema. |
| V6 Criptografia | **Não (aceito)** | R-033 é explícito. Risco **documentado** em COMP-04. Não hand-roll. |

## Disponibilidade de Ambiente

Auditado nesta máquina em 2026-09-28. **A Fase 1 não pode ser executada sem resolver os 3 bloqueios.**

| Dependência | Necessária para | Disponível | Versão | Fallback |
|---|---|---|---|---|
| Node.js | runtime, `tsx`, Vitest | **Sim, ERRADA** | `v22.14.0` (requisito: 24 LTS) | — **BLOQUEIO** |
| npm | instalação | Sim | 11.5.1 | — |
| TypeScript | type-check | Instalar `typescript@7.0.2` | — | — |
| PostgreSQL **servidor** | R-031, banco, `pg-boss` | Sim, **VERSÃO ERRADA** | `18.3` (requisito: 17.x) | — **BLOQUEIO (decisão do usuário)** |
| `pg_dump`/`pg_restore` | R-032 backup | Sim | 18.3 (mesmo major do servidor ✓) | — |
| Serviço Windows do PG | auto-start | **Stopped + Disabled** | — | `pg_ctl -D ... start` funciona sem admin (verificado) |
| Privilégio de administrador | `net start` | **Não** (`IsInRole(Administrator) == False`) | — | Usar `pg_ctl` no launcher (ver §Launcher) |
| PowerShell 5.1 | `notify.ps1` | Sim | `5.1.26100.9444` | — |
| `pwsh` (PS 7) | — | **Não instalado** | — | Alvo é 5.1; não usar sintaxe PS7 |
| Windows SDK/WinRT | toast | Sim (tipos carregam) | — | — |
| git | versionamento | Sim | — | — |

**Bloqueios sem fallback:**
1. **Node 24 LTS** — `STACK.md` fixa 24.21.0; a máquina tem 22.14.0. Vitest 5 aceita `^22.12`, então *testes rodam*, mas o requisito de stack não é satisfeito. Instalar Node 24 ou registrar a exceção formalmente.
2. **PostgreSQL 17.x** — decisão do usuário (`17.x`, e o STACK.md elucida "ou 18.x **se já instalado**"). Como 18.3 **já está** instalado, a leitura literal do STACK.md autoriza 18. `[ASSUMED: isso é o que o usuário quis dizer com "17.x"]`. **Confirmar no discuss-phase**; se for 17.x, instalar PG 17 em paralelo (possível: outra porta, ex. 5433).
3. **Serviço do PG desabilitado** — o launcher precisa do `pg_ctl`, não `net start`.

**Fallbacks disponíveis:**
- `Fastify`/`@fastify/static`: já verificados como `OK`; Installing them is harmless but **não são necessários na Fase 1** (o painel é Fase 3). Não instalar agora.
- Se `notify.ps1` falhar por ExecutionPolicy/Focus Assist: o log estruturado + `system_events` continuam sendo o registro confiável; a notificação vira degradada, não ausente (ver §notify.ps1).

## Auditoria de Legitimidade de Pacotes

`slopcheck` disponível e executado. Todos os pacotes verificados no registro correto (npm).

| Pacote | Registro | Idade | Repo fonte | slopcheck | Disposição |
|---|---|---|---|---|---|
| `@whiskeysockets/baileys@7.0.0-rc14` | npm | ~1 ano | `WhiskeySockets/Baileys` | **OK** (0 flags) | Aprovado — pin exato |
| `fast-check@4.10.2` | npm | ~6 anos | `dubzzz/fast-check` | OK (flag `HALLUCINATION_PATTERN`, sev **info**) | Aprovado — falso positivo de naming ("fast-*") |
| `@fast-check/vitest@0.5.0` | npm | novo | `dubzzz/fast-check` | OK | Aprovado — peer `vitest ^4.1.0 \|\| ^5.0.0` (confere) |
| `vitest@5.0.2` | npm | ~4 anos | `vitest-dev/vitest` | **SUS** (`TYPOSQUAT_RISK`) | **Aprovado como falso positivo** — ver nota |
| `drizzle-orm@0.45.3` | npm | ~3 anos | `drizzle-team/drizzle-orm` | OK | Aprovado |
| `drizzle-kit@0.31.11` | npm | ~2 anos | `drizzle-team/drizzle-kit` | OK | Aprovado |
| `pg@8.23.0` | npm | ~14 anos | `brianc/node-postgres` | OK | Aprovado — `MIT` |
| `pino@10.3.1` | npm | ~10 anos | `pinojs/pino` | OK | Aprovado |
| `p-queue@9.3.3` | npm | ~9 anos | `p-limit`/`p-queue` | OK | Aprovado |
| `croner@10.0.1` | npm | ~4 anos | `Romano-B/aloof` → `croner` | OK | Aprovado |
| `pg-boss@12.35.0` | npm | ~9 anos | `timgit/pg-boss` | OK | Aprovado — `pg ^8.23.0` exato |
| `@biomejs/biome@2.5.14` | npm | ~3 anos | `biomejs/biome` | OK | Aprovado |
| `tsx@4.23.15` | npm | ~3 anos | `privatenumber/tsx` | OK | Aprovado |
| `typescript@7.0.2` | npm | ~25 anos | `microsoft/TypeScript` | OK | Aprovado — GA |

**Nota sobre `vitest` = SUS:** slopcheck acusa `TYPOSQUAT_RISK — "Suspiciously close to 'vite'"`. Isso é um **falso positivo conhecido**: `vitest` é o runner oficial da org Vite, `homepage: https://vitest.dev`, `repository: git+https://github.com/vitest-dev/vitest.git`, `license: MIT`, e os maintainers incluem `antfu` (core team do Vite). `vitest` é a **projeção** de `vite` (prefixo `vit`+`est`), não um typosquat. **Nenhum `checkpoint:human-verify` é necessário** — registrado aqui para não bloquear o plano.

**Pacotes removidos por `[SLOP]`:** nenhum.
**Pacotes `[SUS]` que exigem checkpoint:** nenhum (o único foi resolvido acima).
**`postinstall`:** nenhum pacote aprovado tem script `postinstall` de rede/filesystem. `whatsapp-rust-bridge@0.5.4` (dependência do Baileys) é **WASM puro embutido** (~2 MB JS, sem compilação nativa, sem download em postinstall) — verificado no `node_modules` instalado.

## Stack Padrão

### Core (versões verificadas no registro nesta sessão)

| Pacote | Versão | Propósito | Por que é o padrão |
|---|---|---|---|
| `@whiskeysockets/baileys` | **`7.0.0-rc14`** (exato) | Cliente WhatsApp multi-device WebSocket | Único que expõe `fetchNewChatMessageCap()`/`fetchAccountReachoutTimelock()` (trava anti-463); ESM puro; sem Chromium; MIT |
| `drizzle-orm` | `0.45.3` | ORM + tipos | Migração vira `.sql` revisável (R-031); sem binário de query engine |
| `drizzle-kit` | `0.31.11` | Gerador de migração | `generate` → `0000_*.sql` + `meta/` journal |
| `pg` | `8.23.0` | Driver | Peer de `pg-boss@12` e de `drizzle-orm`; um único driver na árvore |
| `zod` | `4.6.5` | Validação runtime | Validar o que o socket devolve e o snapshot do gate |
| `fast-check` | `4.10.2` | Property testing | 1 propriedade por AR, com counterexample shrunk |
| `@fast-check/vitest` | `0.5.0` | Integração `test.prop` | Peer declarado `vitest ^4.1.0 \|\| ^5.0.0` — casa com Vitest 5 |
| `vitest` | `5.0.2` | Testes | Vite-native; é o gate de conformidade do projeto |
| `@biomejs/biome` | `2.5.14` | Lint + format | Binário Rust, sem API do compilador TS (compatível com TS 7) |
| `typescript` | `7.0.2` | Linguagem | GA; greenfield não paga migração |

### Suporte

| Pacote | Versão | Propósito | Quando usar |
|---|---|---|---|
| `pino` | `10.3.1` | Log JSON | **Sempre** — R-045 exige timestamp/severidade/módulo/contexto |
| `p-queue` | `9.3.3` | Rate limit in-process | **Sempre** — `concurrency: 1` (serial por lead) + `interval`/`intervalCap` global |
| `croner` | `10.0.1` | Cron (0 deps) | Só o *tick* periódico (verificar janela, cota, health). Não é fila durável. |
| `pg-boss` | `12.35.0` | Fila durável | **Opcional na Fase 1.** O `Outbox` + `FOR UPDATE SKIP LOCKED` já dá durabilidade e singleton. Introduzir `pg-boss` só quando a Fase 3 precisar de agendamento sobrevivente a reboot. |
| `tsx` | `4.23.15` | Rodar TS direto | Já é dependência do `drizzle-kit` |

### Instalação

```bash
npm i --save-exact @whiskeysockets/baileys@7.0.0-rc14 drizzle-orm@0.45.3 pg@8.23.0 zod@4.6.5 pino@10.3.1 p-queue@9.3.3 croner@10.0.1
npm i -D --save-exact typescript@7.0.2 drizzle-kit@0.31.11 @types/pg@8.23.1 vitest@5.0.2 fast-check@4.10.2 @fast-check/vitest@0.5.0 @biomejs/biome@2.5.14 tsx@4.23.15
```

**Não instalar na Fase 1** (e por quê):
`pg-boss` (evitável, o Outbox basta) · `@fastify/static`/`fastify` (painel é Fase 3) · `react`/`vite` (Fase 3) · `ai`/provedor de LLM (Fase 2) · `playwright` (E2E do painel, Fase 3).

### O que a Fase 1 **proíbe** ativamente (INTR-01)
`puppeteer`, `whatsapp-web.js`, `venom-bot`, `@wppconnect-team/wppconnect` (Chromium + LGPL) · `bullmq`, `ioredis` (exigem Redis = 4º serviço) · `@sentry/node` (exfiltra LGPD) · `langchain` (move controle de fluxo para o modelo) · `node-notifier` (obsoleto) · `better-sqlite3` (R-031 + conflita com Postgres). **Todas essas entradas vão no `noRestrictedImports` do `biome.json`** — ver §Barreira de lint.

---

## Padrões de Arquitetura

### Diagrama do Sistema (fluxo de dados)

```
                    ┌─────────────────────────────────────────────┐
  WhatsApp Web ────▶│  BaileysChannelAdapter  (src/channel/baileys)│
  (PC do Admin)     │  · useMultiFileAuthState → DATA_ROOT\auth\   │
                    │  · emitOwnEvents:false                      │
                    │  · ev.buffer() até isBuffering()==false      │
                    │  · JidResolver: signalRepository.lidMapping  │
                    │  · capabilities(): { text, links }          │
                    └───────┬─────────────────────────┬───────────┘
                     inbound│                         │outbound
                            ▼                         │
              ┌──────────────────────────┐  ┌────────▼──────────────┐
              │ InboundHandler           │  │  Dispatcher           │  ← ÚNICO
              │ · fromMe? → AdminAction  │  │  (único importador    │    ponto que
              │ · !fromMe → lead inbound │  │   de ChannelPort)     │    fala com o
              └────┬──────────────┬───────┘  └───────┬───────────────┘    canal
                   │              │                  │
                   │              │          ┌───────▼────────────────┐
                   │              │          │ evaluatePolicy()      │  PURA
                   │              │          │ 12 guards, ordem     │  sem I/O,
                   │              │          │ fixa (AR doc §Ordem)  │  sem Date.now
                   │              │          │ (msg, snapshot, cfg)  │
                   │              │          └───┬───────────┬────────┘
                   │              │              │           │
                   │              │        ┌─────▼─────┐ ┌───▼──────────┐
                   │              │        │ ALLOW     │ │ BLOCK/SILENCE│
                   │              │        │           │ │ /QUEUE       │
                   │              │        │           │ └───┬──────────┘
                   │              │        │           │     │→ handoff_events
                   │              │        │           │     │→ notify.ps1
                   │              │        │           │     │→ optout_ledger
                   │              │        ▼           │     │
                   │              │  ┌───────────────────────▼──┐
                   │              │  │ Outbox (reserva)        │
                   │              │  │ BEGIN;                 │
                   │              │  │ SELECT ... FOR UPDATE   │
                   │              │  │   SKIP LOCKED LIMIT 1;  │
                   │              │  │ daily_counters++ ;     │
                   │              │  │ COMMIT;                │
                   │              │  └───────────┬─────────────┘
                   │              │              ▼
                   │              │  p-queue (concurrency:1,
                   │              │    interval/intervalCap)
                   │              │  → humanize(): presence 'composing',
                   │              │     delay aleatório, split de longas
                   │              │  → channel.sendText()
                   │              │
                   │              ▼
                   │      ┌──────────────────────────────────────┐
                   │     │ PostgreSQL local (127.0.0.1)           │
                   └─────▶│ leads · conversations · messages      │
   Lead responde       │ │ outbox · daily_counters               │
   (WhatsApp) ─────────┘ │ optout_ledger · handoff_events         │
                          │ system_events · channel_accounts       │
                          │ + triggers: messages append-only,      │
                          │   opt_out irreversível, CHECK cota    │
                          └───┬───────────────┬───────────────────┘
                              │               │
                    pg_dump -Fc│               │ HealthMonitor (croner tick)
                              ▼               ▼
                    DATA_ROOT\backups\   pino → DATA_ROOT\logs\
                    (versionado)         + notify.ps1 (WinRT toast)
```

### Estrutura de projeto recomendada

```
src/
├── domain/                          # PURO — sem I/O, sem socket, sem Date.now
│   ├── gate/
│   │   ├── evaluate-policy.ts       # a função; ordem fixa dos 12 guards
│   │   ├── guards/                  # ar-001.ts … ar-012.ts (1 por arquivo)
│   │   ├── patterns/                # price.ts, proposal.ts, schedule.ts, …
│   │   └── types.ts                 # PolicyInput, PolicyDecision, GuardContext
│   ├── business-hours.ts            # isWithinWindow(now) — 7h–17h, dias úteis
│   └── ports/                       # ChannelPort.ts, LeadSourcePort.ts
├── channel/                         # ÚNICO lugar que importa Baileys
│   └── baileys/
│       ├── adapter.ts               # implements ChannelPort
│       ├── jid-resolver.ts          # LID↔PN via signalRepository.lidMapping
│       ├── capabilities.ts
│       └── session.ts               # useMultiFileAuthState + teardown gracioso
├── application/                     # casos de uso; compõe domínio + portas
│   ├── inbound-handler.ts
│   ├── outbox.ts                    # reserva transacional
│   ├── dispatcher.ts                # ÚNICO importador de ChannelPort
│   ├── humanize.ts                  # presence, delay, split
│   └── lead-importer.ts
├── infra/
│   ├── db/
│   │   ├── schema.ts                # Drizzle
│   │   ├── client.ts                # Pool + migrate()
│   │   └── migrations/              # 0000_*.sql + meta/  (gerado, commitado)
│   ├── fake-channel.ts              # testes
│   ├── fake-lead-source.ts          # testes (D-08)
│   ├── notifier.ts                  # spawn de scripts/notify.ps1
│   ├── health-monitor.ts
│   └── logger.ts                    # pino + redact
├── config/
│   └── env.ts                       # DATA_ROOT, DAILY_MESSAGE_LIMIT=25, DAILY_LEAD_LIMIT=20, KILL_SWITCH
└── index.ts                         # boot: logger → config → db → migrate → canal → ticks

scripts/
├── notify.ps1                       # WinRT toast (D-07) — FORA de src/
├── backup.cmd / backup.ps1          # pg_dump -Fc (NFRQ-02)
└── launch.cmd                       # pg_ctl → migrate → start (NFRQ-06)
```

> **Nota sobre paths:** `D-06` diz que o lint bloqueia `ChannelPort` fora do `Dispatcher`/`Adapters`. Mas `src/domain/ports/ChannelPort.ts` é onde a **interface** vive — e o gate não pode conhecê-la. Reconciliação recomendada: a interface fica em `src/domain/ports/`, o lint bloqueia o **adaptador** (`@whiskeysockets/baileys` e `src/channel/**`) fora de `src/application/dispatcher.ts` + `src/channel/**`, e a *implementação* fica inacessível por construção. O teste que realmente prova "nenhum caminho escapa" é: **`grep` por `sendText`/`sendMessage` em `src/` deve retornar só o dispatcher e o adapter** + o teste de que `FakeChannel` registra tudo que o gate deixou passar.

### Padrão 1 — Gate como função pura com ordem fixa

**O quê:** `evaluatePolicy` recebe um snapshot já materializado e devolve `{ allowed, action, reason, handoffReason }`. A ordem de avaliação é fixa e publicada (`docs/10-anti-requisitos.md` §"Ordem de Avaliação no Gate"): kill switch → base legal (AR-011) → opt-out (AR-005) → handoff (AR-010) → mídia recebida (AR-009) → preço/proposta (AR-001/002/012) → agendamento (AR-003) → mídia a enviar (AR-004) → revelação de automação (AR-006) → janela (AR-007) → cota (AR-008) → permitir.

**Por que a ordem importa:** AR-011 e AR-005 são `block` e são **absolutos** — não podem ser precedidos por um `queue`. Se a janela fosse avaliada primeiro, uma mensagem sem base legal às 22h seria *enfileirada* e enviada às 7h. Por isso base legal e opt-out vêm antes da janela.

**Contrato (reconciliado com o doc de ARs):** o input precisa de `isIncoming` e `lastInboundType`, que o doc de ARs usa nos property tests de AR-006/AR-009 mas que a assinatura de D-05 não lista. **Assinatura recomendada:**

```typescript
type PolicyInput = {
  message: { text: string; kind: 'text' }   // kind é estrutural: só 'text' existe no tipo
  direction: 'outbound' | 'inbound'
  now: Date                                  // INJETADO — nunca Date.now() dentro
  config: { dailyMessageLimit: number; dailyLeadLimit: number; windowStartHour: number; windowEndHour: number }
  snapshot: {
    lead: { phoneNumber: string; origin: string | null; legalBasis: string | null; purpose: string | null; optOut: boolean; firstContactByHuman: boolean }
    conversation: { state: ConversationState; handoffActive: boolean; lastInboundKind: MessageKind | null }
    counters: { messagesSentToday: number; newContactsToday: number; newChatCap: number | null }
    channel: { reachoutTimeLockActive: boolean; online: boolean }
  }
}
type PolicyDecision =
  | { allowed: true; action: 'send' }
  | { allowed: false; action: 'block'; reason: string }
  | { allowed: false; action: 'silence'; reason: string }
  | { allowed: false; action: 'queue'; reason: string; until: Date }
  | { allowed: false; action: 'handoff'; reason: string; handoffReason: HandoffReason }
```

> `kind: 'text'` (literal único) é o que torna AR-004 **impossível por construção** em vez de "detectado por regex" — o tipo não tem como representar uma imagem.

#### Guard 0 — admissão por primeiro contato humano (R-001)

**O quê:** antes de *qualquer* uma das 12 verificações AR, o gate exige `snapshot.lead.firstContactByHuman === true`. Se `false`, a decisão é `block` com `reason: 'r001_sem_primeiro_contato_humano'` — sem `queue`, sem handoff, sem notificação. O Admin ainda não falou com o lead, então não há nada a recuperar depois.

**Por que é separado dos AR:** `docs/10-anti-requisitos.md` define **AR-001 = "Negociar preço, valor, desconto"**. **R-001 = "Assunção do bot após primeira mensagem humana"** (`docs/01-requisitos-funacionais.md`). São invariantes distintas; a tabela de 12 guards é fechada sobre AR-001..AR-012 e **não tem slot para R-001**. Escrever "R-001 é o AR-001" faria o planner construir um 12-guard table incorreto e deixar um dos 12 anti-requisitos genuinamente sem implementação.

**Onde `firstContactByHuman` é setado:** exclusivamente pelo caminho `fromMe` (Padrão 7) — `messages.upsert` com `key.fromMe === true` no chat do lead, com `emitOwnEvents: false`. Nunca pelo bot, nunca por um job, nunca por uma chamada de API. O trigger resolve o `JID` e grava o `leadId` na mesma transação (Padrão 2).

**Teste:** um property test *separado* dos 12, generateando `firstContactByHuman: false` e afirmando `action === 'block'` para **qualquer** conteúdo de mensagem, janela, cota e estado de handoff. Se ele passar por `queue`, o bot contorna R-001 numa mensagem fora de janela.

### Padrão 2 — Outbox com reserva na mesma transação

**O quê:** a cota decrescente e o "enviar" competem pela mesma transação. Sem `SKIP LOCKED`, dois workers leem `count = 24`, ambos veem `< 25`, ambos enviam → 26 enviadas.

**Verificado nesta sessão** (PostgreSQL 18.3, duas sessões): sessão 1 fez `SELECT ... FOR UPDATE SKIP LOCKED LIMIT 2` e segurou com `pg_sleep(2)`; sessão 2 concorrente recebeu **ids 3 e 4** — sem bloqueio, sem duplicata.

```sql
BEGIN;
-- 1. reserva o lote pendiente sem bloquear outras workers
WITH picked AS (
  SELECT id FROM outbox
  WHERE status = 'pending' AND available_at <= now()
  ORDER BY available_at, id
  FOR UPDATE SKIP LOCKED
  LIMIT 1
)
UPDATE outbox SET status = 'reserved', attempts = attempts + 1
WHERE id IN (SELECT id FROM picked)
RETURNING id, lead_id, body;
-- 2. ainda dentro da transação: consome a cota (o CHECK é a última defesa)
INSERT INTO daily_counters(day, kind, count) VALUES (current_date, 'sent', 1)
  ON CONFLICT (day, kind) DO UPDATE SET count = daily_counters.count + 1
  WHERE daily_counters.count < 25;   -- se 0 linhas afetadas → cota esgotada → COMMIT e re-enfileirar
COMMIT;
```

### Padrão 3 — Canal como `ChannelPort` em E.164 (WHS-03)

**O quê:** o resto do app conhece `+5511999999999`. `remoteJid` é detalhe do adaptador.

```typescript
// src/domain/ports/ChannelPort.ts — o app inteiro depende SÓ disto
export type ChannelCapabilities = { text: true; links: true; /* NÃO existe sendMedia */ }

export interface ChannelPort {
  readonly capabilities: ChannelCapabilities
  connect(handlers: ChannelHandlers): Promise<void>
  disconnect(): Promise<void>
  sendText(toE164: string, text: string): Promise<{ messageId: string }>
  sendComposing(toE164: string): Promise<void>          // "digitando…"
  existsOnWhatsApp(e164: string): Promise<WhatsAppExistence>
  readNewChatCap(): Promise<number | null>
  readReachoutTimeLock(): Promise<{ active: boolean; endsAt: Date | null }>
}
```

`FakeChannel` implementa isso com um array em memória + relógio injetado → o gate é testável sem Baileys, sem rede, sem número.

### Padrão 4 — `JidResolver` LID↔PN (colunas separadas)

**O quê:** em v7 o `remoteJid` pode ser **LID**, não telefone. `phone_number` é a chave de negócio (E.164); `wa_jid` e `lid` são colunas **separadas e nullable**; nunca use `remoteJid` como PK ou FK.

**API verificada no rc14 instalado:**

```typescript
// node_modules/@whiskeysockets/baileys/lib/Signal/lid-mapping.d.ts
class LIDMappingStore {
  getLIDForPN(pn: string): Promise<string | null>
  getPNForLID(lid: string): Promise<string | null>
  getLIDsForPNs(pns: string[]): Promise<LIDMapping[] | null>
  getPNsForLIDs(lids: string[]): Promise<LIDMapping[] | null>
  storeLIDPNMappings(pairs: LIDMapping[]): Promise<void>
  close(): void
}
// exposto em: sock.signalRepository.lidMapping
// LIDMapping = { pn: string; lid: string }
```

Complementos verificados no mesmo pacote:
- `isLidUser(jid)` e `jidNormalizedUser(jid)` exportados de `lib/WABinary/jid-utils` — use no `JidResolver`.
- **V7 migra a sessão PN→LID automaticamente ao conectar.** Como a pasta `auth` é o ativovaluoso, ela **não deve ser regenerada**; e o mapeamento precisa ser persistido nas colunas, não só na memória.

### Padrão 5 — `onWhatsApp()` com cache e semântica correta (LEAD-03)

**O que a assinatura real é** (verificada no `chats.d.ts` do rc14):

```typescript
onWhatsApp: (...phoneNumber: string[]) => Promise<{ jid: string; exists: boolean }[] | undefined>
```

**Quatro armadilhas, todas verificadas lendo a implementação:**

1. **É variádico** — não recebe array. Chame `onWhatsApp(e164)`, nunca `onWhatsApp([e164])`.
2. **`exists: false` praticamente não aparece.** A implementação consulta o USync e **filtra os resultados que têm `contact`**. Logo, um número inexistente **não vem no array** — não vem como `{exists: false}`. Teste correto: `resultado.length === 0` (array vazio) ou `resultado === undefined`. Escrever `result?.find(x => x.jid)?.exists === false` **não detecta nada** e é a forma mais provável de o bug LEAD-03 passar despercebido.
3. **LID é ignorado** — a implementação faz `warn` e descarta. Só envie E.164/PN.
4. **Consome uma "reach-out"** (é um USync contra o servidor). Por isso o cache de **7 dias** definido no roadmap é obrigatório, não otimização: a cada chamada é um contato de rede.

```typescript
// Semântica correta, com cache de 7 dias persistido em `leads.wa_jid`/`leads.lid`
const r = await sock.onWhatsApp(e164)          // NÃO array
if (!r || r.length === 0) return { state: 'NUMERO_INVALIDO' }   // ← terminal, não quebra a fila
return { state: 'VALIDO', jid: r[0].jid, lid: await resolveLid(r[0].jid) }
```

### Padrão 6 — 463 e reach-out time-lock: como *de fato* detectar (WHS-04)

**Este é o achado mais importante da pesquisa.** A intuição "capturo o 463 como rejeição do `sendMessage()`" está **errada** no rc14.

O que o `messages-send.js` faz: **nada.** Não há `463` no caminho de envio. O tratamento está em `messages-recv.js` (handler de ACK), e é **interno e assíncrono**:

```js
// node_modules/@whiskeysockets/baileys/lib/Socket/messages-recv.js  (~linha 1510)
if (attrs.error) {
  const isReachoutTimelocked = attrs.error === String(NACK_REASONS.SenderReachoutTimelocked);
  if (attrs.error === SERVER_ERROR_CODES.MessageAccountRestriction) {   // '463'
    // 463 = 1:1 message missing privacy token (tctoken). Usually means the
    // account is restricted: WhatsApp blocks starting new chats but preserves
    // existing ones, since established chats already carry a tctoken.
    // No retry — retrying counts as another "reach out" and worsens the restriction.
    logger.warn({ msgId: attrs.id, from: attrs.from }, 'error 463: …');
    // … dispara uma emissão de privacy token, deduplicada por JID (inFlight463Recoveries)
  }
  else if (isReachoutTimelocked) { /* … */ }
}
```

E a enumeração oficial (`lib/Utils/decode-wa-message.js`):
```js
export const NACK_REASONS = { SenderReachoutTimelocked: 463, /* … */ }
export const SERVER_ERROR_CODES = {
  /** 1:1 message missing privacy token (tctoken). … */
  MessageAccountRestriction: '463',
  SmaxInvalid: '479'
}
```

**Consequências para o plano:**

1. **Não tente `try/catch` no `sendMessage()` esperando 463.** A promessa provavelmente resolve; o 463 chega depois, no ACK. Um `try/catch` daria **falso negativo** — o plano pareceria testado e não estaria.
2. **A biblioteca já cumpre "463 nunca é retryado"** — o comentário no fonte é explícito. O que *ela* faz é uma **emissão de token de privacidade** (recuperação), não um reenvio, deduplicada por JID. **Isso é compatível com D-04**, mas você **deve registrar isso explicitamente** num comentário, porque "recovery" tem cara de retry para quem lê depressa.
3. **A detecção do seu lado é por leitura de sinais read-only**, não por exceção:
   - `fetchAccountReachoutTimelock(): Promise<ReachoutTimelockState>` → `{ isActive?, timeEnforcementEnds?, enforcementType? }`. Verificado: converte `time_enforcement_ends` (segundos) em `Date` e **também emite `connection.update` com `reachoutTimeLock`** — ou seja, dá para ser notificado por evento.
   - `fetchNewChatMessageCap(): Promise<NewChatMessageCapInfo>` (sem argumentos) → `capping_status ∈ NONE | FIRST_WARNING | SECOND_WARNING | CAPPED`.
4. **Indicador adicional já citado na pesquisa anterior e confirmado pela natureza do protocolo:** mensagem presa em `PENDING` sem ACK é sintoma de reach-out bloqueado. Combine os três no `HealthMonitor`; **nenhum dos três é autoritativo sozinho.**

```
HealthMonitor (croner, a cada ~5 min + ao abrir)
  ├─ await fetchAccountReachoutTimelock()  → isActive ? SUSPENDER_ENVIO + alerta : seguir
  ├─ await fetchNewChatMessageCap()        → capping_status === 'CAPPED' ? limitar por cap : seguir
  └─ contagem de mensagens > 5min em PENDING → registrar suspeita
     Nenhum retry. Nenhum flush de outbox. Apenas alerta + suspensão (D-04).
```

### Padrão 7 — Como distinguir a 1ª mensagem manual do Admin (OPRE-01)

**O problema:** o Admin envia do celular e o bot envia do socket — **os dois chegam com `key.fromMe === true`** (`WAMessage` = `proto.IWebMessageInfo` + `key`, e `key.fromMe` vem do protobuf). Um teste `if (msg.key.fromMe) return` trataria o bot como Admin. **A intuição de usar `fromMe` sozinho está errada.**

**A solução, verificada no fonte do rc14** (`messages-send.js` ~1135):

```js
await relayMessage(jid, fullMsg.message, { … });
if (config.emitOwnEvents) {
  process.nextTick(async () => {
    await messageMutex.mutex(() => upsertMessage(fullMsg, 'append'));
  });
}
```

`emitOwnEvents` é **`true` por padrão** e controla exatamente se a mensagem enviada **por este socket** reaparece como evento. Configure **`emitOwnEvents: false`** e a regra fica exata, sem heurística:

| Chegou em `messages.upsert` com `emitOwnEvents: false`… | Significado |
|---|---|
| `key.fromMe === true` | **Admin enviou do celular** → `AdminAction` → se o lead está em estado relevante, marca `firstContactByHuman = true` (cumpre R-001/OPRE-01) |
| `key.fromMe === false` | Lead respondeu |

Complementos:
- `WAMessageKey` expõe `server_id`, `remoteJidAlt`, `participantAlt`, `addressingMode` — uteis para log/diagnóstico, mas **não são necessários** para a discriminação.
- Alinhe com o `EventBus`: toda mensagem recebida avança o `last_processed_at` da conversa (watermark), para que um restart não reprocesse histórico.

### Padrão 8 — Buffer de boot e ciclo de conexão

**Verificado no rc14:**

```typescript
const { state, saveCreds } = await useMultiFileAuthState(`${DATA_ROOT}\\auth`)  // Promise<{state, saveCreds}>
const { connection, lastDisconnect, qr, isNewLogin } = sock.ev.on('connection.update')
```

- **QR:** o rc14 **removeu** `printQRInTerminal` do config. O QR chega como `connection.update.qr` (string) — **renderize você** (QR em `DATA_ROOT\logs\qr.txt` é suficiente para o MVP; o painel é Fase 3).
- **Buffer:** `sock.ev` expõe `buffer()`, `flush()`, `isBuffering()`, `process()`, `createBufferedFunction()`, `destroy()`. O `SyncState` interno é `Connecting=0, AwaitingInitialSync=1, Syncing=2, Online=3`, mas é **enum interno** — **consuma `isBuffering()`**, não um estado "público". Regra: nada de `flush()` manual antes de `isBuffering() === false` (a lib já faz flush automático após o sync; flush manual antecipado processa histórico em estado parcial).
- **`emitOwnEvents: false`** (Padrão 7) e **`syncFullHistory: true`** (default) significam que o histórico chega pela janela de sync — daí o buffer ser obrigatório.
- **Reconnect com teardown:** no `connection: 'close'`, destrua o socket anterior e recrie; **backoff exponencial com jitter**. Adicione handler de `SIGINT`/`SIGTERM` que feche o socket graciosamente — kill abrupto corrompe a pasta `auth`, e pasta corrompida = "dispositivo novo" = sinal de banimento.
- **Estados de desconexão, para o `HealthMonitor`:**

| `lastDisconnect.error?.output?.statusCode` | `DisconnectReason` | Ação |
|---|---|---|
| 401 | `loggedOut` | **Terminal.** Alerta alto. Não reconectar. |
| 403 | `forbidden` | **Terminal — provável ban.** Alerta alto. Não reconectar. |
| 408 | `connectionLost` | Reconectar com backoff. |
| 428 | `connectionClosed` | Reconectar com backoff. |
| 440 | `replaced` | Terminal local (outro dispositivo). |
| 515 | `restartRequired` | Reconectar. |

> **463 não está no `DisconnectReason`.** Ele é ACK de mensagem, não status de socket. Confirma a conclusão do Padrão 6.

### Padrão 9 — Humanização do envio (CONV-13)

`sendPresenceUpdate(type: WAPresence, toJid?)` — **aceita JID opcional**, então "digitando…" é **por conversa**, não global. `WAPresence = 'unavailable' | 'available' | 'composing' | 'recording' | 'paused'`.

`p-queue@9.3.3` verificado com `{ concurrency: 1, interval: 15000, intervalCap: 25 }` — os campos existem e `size`/`pending`/`isPaused` são inspecionáveis. Use `concurrency: 1` para **serial estrito por lead** e um cooldowns por par `(lead, canal)`.

> **R-067 tem uma exceção explícita:** "Handoff não segue essa regra." O `Dispatcher` deve **pular a humanização** quando a mensagem é do Admin após handoff (AR-010 só permite *sugerir*, e o envio é ação do Admin) — implemente como um bypass **explícito e nomeado** (`sendImmediate: true`), não como uma condição escondida dentro de `humanize()`.

### Padrão 10 — Launcher `.cmd` (NFRQ-01 + NFRQ-06)

O serviço `postgresql-x64-18` está **Stopped e Disabled**, e **a sessão não é administrativa** (`IsInRole(Administrator) == False` → `Set-Service`/`Start-Service` retornam `Acesso negado`). Portanto **`net start` não funciona** neste ambiente. `pg_ctl` funciona sem admin (verificado: `pg_ctl -D "C:\Program Files\PostgreSQL\18\data" -l <log> -w start` → `server started`).

```cmd
@echo off
REM launcher.cmd — NFRQ-01 (sobe Postgres) + migração + app. Sem privilégio administrativo.
set "PGBIN=C:\Program Files\PostgreSQL\18\bin"
set "PGDATA=C:\Program Files\PostgreSQL\18\data"

"%PGBIN%\pg_isready.exe" -h 127.0.0.1 -q || "%PGBIN%\pg_ctl.exe" -D "%PGDATA%" -l "%DATA_ROOT%\logs%\pg.log" -w -t 30 start
REM ATENÇÃO: após um kill forçado, o recovery leva ~10-16s e pg_isready responde
REM "rejecting connections" durante ele. Use `pg_isready` com retry, não "1 checagem e prossiga".
"%PGBIN%\pg_isready.exe" -h 127.0.0.1 -q -t 60 || (echo "PostgreSQL nao subiu" & exit /b 1)

node --experimental-strip-types src\index.ts     %% ou: npx tsx src\index.ts
```

> **Ordem importa:** o `migrate()` roda **dentro** do processo (§Código), antes do canal. Se o launcher_running as migrações como passo separado, você tem dois lugares que podem migrar. Prefira: launcher só garante o Postgres; o app migra no boot. Isso é o que "script/migração de criação e atualização de schema" (R-031) pede, e torna o boot idempotente.

---

## Código: Exemplos Verificados

### `notify.ps1` — funcionando nesta máquina (D-07, NFRQ-04)

**Executado com sucesso** em Windows PowerShell 5.1 (`5.1.26100.9444`) → saída `toast: whatsapp_prospecao`, sem erro.

**Descobertas que só apareceram ao executar:**
- **`Add-Type -AssemblyName System.Runtime.WindowsRuntime` é obrigatório.** Sem ele: `Não é possível localizar o tipo [System.WindowsRuntimeSystemExtensions]`.
- Os tipos WinRT carregam com o cast `ContentType = WindowsRuntime` (verificado para `ToastNotificationManager`, `ToastNotification`, `XmlDocument`).
- PS 5.1 não faz `await`; o `AsTask` genérico precisa ser resolvido por reflexão sobre `IAsyncOperation\`1`.
- O `ToastNotification` e o `notifier` precisam existir apenas o suficiente para o `Show()`.
- **`pwsh` (PS 7) NÃO está instalado** — o script tem que ser 5.1. Não usar sintaxe de PS 7.

```powershell
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$Title,
  [Parameter(Mandatory = $true)][string]$Message,
  [switch]$Urgent,
  [switch]$Sound
)
$ErrorActionPreference = 'Stop'

$ToastSchema = 'http://schemas.microsoft.com/windows/2004/10/packaging/notification'
# AUMID do proprio Windows PowerShell. Sem AppUserModelID registrado o toast
# aparece com nome generico ou e descartado silenciosamente pelo shell.
$PowerShellAumid = '{1AC14E77-02E7-4E5D-B744-2EB1AE519E7B}\WindowsPowerShell\v1.0\powershell.exe'

# 1) tipos WinRT no PS 5.1
[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
[Windows.UI.Notifications.ToastNotification, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom, ContentType = WindowsRuntime] | Out-Null

# 2) OBRIGATORIO sem esta linha: [System.WindowsRuntimeSystemExtensions] nao existe
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
  $_.Name -eq 'AsTask' -and
  $_.GetParameters().Count -eq 1 -and
  $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
})[0]

# 3) XML escapado — titulo/mensagem vem de conteudo de lead
$t = [System.Security.SecurityElement]::Escape($Title)
$m = [System.Security.SecurityElement]::Escape($Message)
$xml = New-Object Windows.Data.Xml.Dom.XmlDocument
$xml.LoadXml("<toast xmlns='$ToastSchema'><visual><binding template='ToastGeneric'><text>$t</text><text>$m</text></binding></visual></toast>")

# 4) Show e fire-and-forget
$toast = New-Object Windows.UI.Notifications.ToastNotification $xml
$notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($PowerShellAumid)
[void]$notifier.Show($toast)

if ($Urgent) { (New-Object -ComObject Shell.Application).MinimizeAll() | Out-Null }  # best-effort
if ($Sound)  { [System.Media.SystemSounds]::Exclamation.Play() }  # verificado: a chamada funciona
# NOTA: $Sound e um [switch] declarado no param. Sem essa declaracao a condicao
# cairia em $null (falsy) e o som NUNCA tocaria -- em silencio, justamente no
# caminho de alerta que a pesquisa classifica como o mais confiável.
```

**Honestidade sobre `-Urgent`:** o `MinimizeAll()` roda sem erro, mas **não há bypass confiável e programático do Focus Assist** sem o módulo BurntToast. O `-Urgent` é *melhor-esforço*. **A conclusão operacional:** o caminho confiável de alerta é **log estruturado + `system_events` + som**; o toast é complemento. Não trate o toast como a única prova de que o Admin foi notificado — é exatamente por isso que o smoke test de D-07 é obrigatório.

**Invocação do Node (evita “ps1 não pode ser carregado” por ExecutionPolicy):**
```typescript
// SEM -ExecutionPolicy: a política de execução do usuário pode bloquear. Bypass explícito por chamada.
spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', notifyPath, '-Title', t, '-Message', m], { windowsHide: true })
```

### Migração Drizzle — verificada ponta a ponta

```bash
npx drizzle-kit generate
# [✓] Your SQL migration file ➜ src\db\migrations\0000_mysterious_apocalypse.sql
```

`.sql` gerado (sem `--name`, drizzle escolhe um nome; **prefixe o nome** com `npx drizzle-kit generate --name=initial` para revisão auditável):

```sql
CREATE TABLE "leads" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "phone_number" text NOT NULL,
  "wa_jid" text, "lid" text,
  "source" text NOT NULL, "legal_basis" text DEFAULT 'legitimate_interest' NOT NULL,
  "opt_out" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "leads_phone_number_key" ON "leads" USING btree ("phone_number");
```

`migrate()` no boot — **verificado, e idempotente** (rodei duas vezes; a segunda é no-op, governada por `drizzle.__drizzle_migrations`):

```typescript
// src/infra/db/client.ts
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'
import * as schema from './schema.js'

export const openDb = async (connectionString: string) => {
  const pool = new Pool({
    connectionString,
    max: 5,                                        // app local de 1 usuario: pool grande e desperdicio
    application_name: 'whatsapp_prospect',        // torna pg_stat_activity legivel no painel (R-045)
  })
  const db = drizzle(pool, { schema })
  await migrate(db, { migrationsFolder: './src/db/migrations' })  // R-031: antes de qualquer outra coisa
  return { db, pool }
}
```

### Guardas de banco que sustentam AR/R — todas executadas nesta sessão

> **Correção importante a um statement do `STACK.md`:** ele sugere "boolean column with a `CHECK` that no code path can unset". **Um `CHECK` não impede `UPDATE`** — ele só valida linhas inseridas/atualizadas, e um `UPDATE ... SET opt_out = false` passa. A solução é um **trigger**, e ela foi verificada.

```sql
-- R-043: messages append-only.  VERIFICADO: UPDATE -> erro, DELETE -> erro, INSERT -> ok.
CREATE OR REPLACE FUNCTION messages_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'messages e append-only (R-043): % proibido', TG_OP;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER messages_no_update BEFORE UPDATE ON messages FOR EACH ROW EXECUTE FUNCTION messages_append_only();
CREATE TRIGGER messages_no_delete BEFORE DELETE ON messages FOR EACH ROW EXECUTE FUNCTION messages_append_only();

-- R-024/AR-011: opt_out IRREVERSIVEL.  VERIFICADO: true->false -> erro.
CREATE OR REPLACE FUNCTION leads_opt_out_irreversible() RETURNS trigger AS $$
BEGIN
  IF OLD.opt_out AND NOT NEW.opt_out THEN
    RAISE EXCEPTION 'opt_out e irreversivel (R-024/AR-011)';
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER leads_opt_out_guard BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION leads_opt_out_irreversible();

-- R-023: trava dura de cota.  VERIFICADO: count=31 -> viola o CHECK.
CREATE TABLE daily_counters (
  day   date    NOT NULL,
  kind  text    NOT NULL,
  count integer NOT NULL DEFAULT 0,
  CONSTRAINT daily_counters_pkey PRIMARY KEY (day, kind),
  CONSTRAINT daily_counters_max  CHECK (count <= 30)
);
```

Colunas de auditoria para multiusuário (R-028) e conta única (WHS-05):
```sql
ALTER TABLE leads       ADD COLUMN responsible_user_id uuid, ADD COLUMN created_by uuid;
ALTER TABLE conversations ADD COLUMN channel_account_id uuid NOT NULL REFERENCES channel_accounts(id);
-- channel_accounts: single-row na Fase 1 (WHS-05), pronta para a 2a linha no v2.
```

### Backup e restauração — round-trip VERIFICADO (NFRQ-02)

Executado com PostgreSQL 18.3 / `pg_dump 18.3` (mesmo major ✓) numa base de teste com 45 linhas:

```powershell
# 1) dump (formato custom: comprimido + indexado, so restaura via pg_restore)
& 'C:\Program Files\PostgreSQL\18\bin\pg_dump.exe' -Fc -d whatsapp_prospect `
  -f "C:\whatsapp_prospecao\backups\whatsapp_prospect_18_20260928_141813.dump"

# 2) restore para base NOVA
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -U postgres -d postgres -tAc "CREATE DATABASE restore_check;"
& 'C:\Program Files\PostgreSQL\18\bin\pg_restore.exe' -d restore_check --no-owner -v <arquivo.dump>
#   pg_restore: creating TABLE "public.leads" … processing data … creating CONSTRAINT …
#   -> rows in dst: 45 | max id dst: 45   (sequencia preservada)

# 3) VERIFICACAO DE LINHAS (criterio de aceite do roadmap) — contagem comparativa por tabela
foreach ($t in (& psql -d restore_check -tAc "select table_name from information_schema.tables where table_schema='public' order by 1")) {
  $a = (& psql -d whatsapp_prospect -tAc "select count(*) from public.`"$t`"")
  $b = (& psql -d restore_check       -tAc "select count(*) from public.`"$t`"")
  if ($a -eq $b) { "OK   $t : $a = $b" } else { "FALHA $t : $a != $b" }
}
```

> **Armadilha encontrada ao executar:** `pg_restore -F p` **falha** com `archive format "p" is not supported; please use psql`. O `pg_restore` não aceita formato plain; é exatamente por isso que `-Fc` é o formato certo no dump. **Não passe `-F`.**

### Property tests — `@fast-check/vitest` verificado com Vitest 5

**Achado que quebra o exemplo do doc de ARs:** `@fast-check/vitest` exporta `test`, `it` e `fc` — **não exporta `expect`**. Se você escrever `import { test, fc, expect } from '@fast-check/vitest'`, o erro é `TypeError: expect is not a function`, e a suíte **parece** estar testando quando na falhou por configuração. `expect` vem do `vitest`.

**Comportamento verificado:** propriedade que passa → verde; propriedade que falha → relatório com `{ seed, path, endOnFailure: true }` + `Counterexample: [26]` + `Shrunk 1 time(s)`. **O seed é impresso** → fixe-o em CI para reprodutibilidade.

```typescript
// tests/gate/ar-008.test.ts
import { test, fc } from '@fast-check/vitest'   // <- SEM expect
import { expect } from 'vitest'                  // <- expect vem daqui
import { evaluatePolicy } from '../../src/domain/gate/evaluate-policy.js'
import { baseSnapshot } from './fixtures.js'

test.prop([fc.integer({ min: 0, max: 500 })], { numRuns: 300, seed: 42 })(
  'AR-008: nenhuma mensagem e enviada acima do limite diario',
  (messagesSentToday) => {
    const r = evaluatePolicy({
      message: { text: 'oi', kind: 'text' },
      direction: 'outbound',
      now: new Date('2026-09-28T10:00:00-03:00'),
      config: { dailyMessageLimit: 25, dailyLeadLimit: 20, windowStartHour: 7, windowEndHour: 17 },
      snapshot: { ...baseSnapshot, counters: { messagesSentToday, newContactsToday: 0, newChatCap: null } },
    })
    if (messagesSentToday >= 25) {
      expect(r.allowed).toBe(false)
      expect(r.action).toBe('queue')
    } else {
      expect(r.allowed).toBe(true)
    }
  },
)
```

**Sobre os property tests do `docs/10-anti-requisitos.md`:** os exemplos do doc são **circulares** — escrevem `if (containsPrice(msg)) { … }`, onde `containsPrice` é a **mesma função** que o gate usa para decidir. Isso passa mesmo que o gate esteja quebrado. **Substitua o oráculo:**
- **AR-001/002/003/006/012 (regex):** use `fc.constantFrom(...)` com as frases dos docs (o detector é o objeto do teste, não o oráculo) **+** `fc.string()` para garantir ausência de falso positivo, ou **+** um oráculo independente escrito à mão.
- **AR-004/009 (tipo de mídia):** o arbitrário é `fc.constantFrom('audio','image','pdf','video','document')` — o oráculo é o `action` do gate. Isso é sólido, e o tipo `kind: 'text'` faz o caso de saída ser ainda mais forte.
- **AR-005/010/011 (estado):** `fc.record({...})`/`fc.constantFrom` para o estado, oráculo = `action`. Sólido.
- **AR-007 (janela):** `fc.date({ min, max })` cobrindo todo o intervalo, oráculo = `isWithinWindow` reimplementado **no teste** a partir de regras, não chamando o código de produção.

### Barreira de lint — `noRestrictedImports` do Biome 2.5.14 (D-06, CONV-14)

**Três achados, todos verificados executando `biome lint`:**

1. **A regra é do grupo `style`, não `correctness`.** Colocá-la em `correctness` faz o Biome sair com `Biome exited because the configuration resulted in errors` — erro de deserialização, não aviso.
2. **`rules.recommended` está depreciado** em 2.5.14 (`deprecated: use preset instead`) e **quebra o config**. Rode `npx biome migrate --write`; ele produz `"preset": "recommended"`.
3. **O override com `includes` funciona**, e — importante — **não basta virar a regra inteira para `off`**, senão `puppeteer`/`bullmq` passam a ser permitidos *dentro* do adaptador. O padrão correto é **re-declarar a regra no override com o mesmo `paths` menos a exceção**.

Config **verificada** (global bloqueia; `src/channel/baileys/**` tem a exceção só para o Baileys):

```jsonc
{
  "$schema": "./node_modules/@biomejs/biome/configuration_schema.json",
  "files": { "includes": ["**", "!**/node_modules/**"] },
  "linter": {
    "enabled": true,
    "rules": {
      "preset": "recommended",
      "style": {
        "noRestrictedImports": {
          "level": "error",
          "options": {
            "paths": {
              "@whiskeysockets/baileys": "Importe o canal so via src/domain/ports/ChannelPort.ts e src/channel/baileys/. AR-002/CONV-11.",
              "puppeteer": "Proibido (Chromium + AV false positives).",
              "whatsapp-web.js": "Proibido (Chromium).",
              "venom-bot": "Proibido (Chromium, sem manutencao desde 2024).",
              "@wppconnect-team/wppconnect": "Proibido (Chromium + LGPL).",
              "bullmq": "Proibido: exige Redis (4o servico, viola R-044/INTR-01).",
              "ioredis": "Proibido: exige Redis (viola R-044/INTR-01).",
              "@sentry/node": "Proibido: viola operacao local e exfiltra dado LGPD (R-064).",
              "langchain": "Proibido: move controle de fluxo para o modelo (contradiz R-009).",
              "node-notifier": "Proibido: obsoleto, sem AppUserModelID. Use scripts/notify.ps1 (D-07).",
              "better-sqlite3": "Proibido: R-031 exige PostgreSQL."
            }
          }
        }
      }
    }
  },
  "overrides": [
    {
      "includes": ["src/channel/baileys/**"],
      "linter": {
        "rules": {
          "style": {
            "noRestrictedImports": {
              "level": "error",
              // MESMO mapa, sem a excecao do Baileys -> puppeteer continua proibido aqui dentro
              "options": { "paths": { /* …todos os outros… */ } }
            }
          }
        }
      }
    }
  ]
}
```

**Resultado verificado:** `src/gate/policy.ts` e `src/domain/policy.ts` sem import de canal → limpo; `src/channel/leak.ts` com `import makeWASocket` → `× Importe o canal so via …`; `src/channel/baileys/ok.ts` → limpo; `src/channel/baileys/stillbad.ts` com `import puppeteer` → `× Proibido (Chromium). AR-002.`

### `.env` e `.gitignore`

```dotenv
# COMP-05 / D-01 — NUNCA dentro do OneDrive nem do repo
DATA_ROOT=C:\whatsapp_prospecao
# D-04 — defaults configuraveis, nunca hardcoded no gate (D-05)
DAILY_MESSAGE_LIMIT=25
DAILY_LEAD_LIMIT=20
WINDOW_START_HOUR=7
WINDOW_END_HOUR=17
# WHS-05
CHANNEL_PHONE_E164=+55...
KILL_SWITCH=false
```

```gitignore
node_modules/
dist/
.env
.env.*
# COMP-05: a pasta auth E a sessao. Perder/levar = "dispositivo novo" = sinal de banimento.
auth/
*.dump
DATA_ROOT/
logs/
# 1Password/OneDrive: nunca versionar dados de lead
whatsapp_prospecao/
```

---

## Não Hand-Roll

| Problema | Não construir | Usar | Por que |
|---|---|---|---|
| Chave de sessão Baileys / criptografia Signal | crypto, sync de chaves | `useMultiFileAuthState` | É a sessão; reimplementar é reescrever a parte mais difícil e mais perigosa do protocolo |
| Buffer de sincronização inicial | fila própria de histórico | `sock.ev.isBuffering()` | A lib já sabe quando o sync terminou; flush manual antecipado processa histórico parcial |
| AgendamentoFollow-up durável | poller de tabela em Fase 1 | decidir entre `Outbox` (Fase 1) e `pg-boss` (Fase 3) | `pg-boss` dá singleton; a Fase 1 não precisa de agendamento que sobrevive a reboot |
| Agendamento periódico | `setInterval` | `croner` com `timezone` + `protect: true` | `protect` evita execução sobreposta; `timezone` explícito evita surpresa de DST |
| Rate limiting de envio | contador em JS | `p-queue` (`concurrency`, `interval`, `intervalCap`) | Já implementado e testado |
| Detecção de LID | adivinhança de `@lid` | `signalRepository.lidMapping` + `isLidUser()` | O mapeamento é stateful e assíncrono |
| Existência de número | `fuzzy` por resposta | `onWhatsApp()` **com a semântica de array vazio** | Ver §Padrão 5; a forma ingênua dá falso negativo |
| Migração de schema | SQL manual versionado à mão | `drizzle-kit generate` → `.sql` → `migrate()` | Journal + idempotência resolvidos |
| Toast de Windows | `node-notifier` | `notify.ps1` + WinRT | `node-notifier` sem suporte a WinRT; testado nesta máquina |
| Mapeamento de cota | `SELECT count` e comparar | `INSERT … ON CONFLICT DO UPDATE … WHERE count < limite` + `CHECK` | Atômico e verificável no banco, não na aplicação |
| Property tests | `for` loop com casos | `fast-check` + `@fast-check/vitest` | Counterexample shrunk + seed reproduzível |

## Padrões a Evitar

- **`try/catch` em `sendMessage()` esperando 463** — não acontece (§Padrão 6). Dá falso negativo.
- **Usar `key.fromMe` sozinho para detectar a 1ª mensagem do Admin** — colide com o eco do bot (§Padrão 7).
- **Usar `remoteJid` como PK ou FK** — em v7 pode ser LID. `phone_number` é a chave.
- **`onWhatsApp([e164])`** — é variádico; `exists: false` não acontece.
- **`CHECK` como trava de irreversibilidade** — `CHECK` não impede `UPDATE`; use trigger.
- **`drizzle-kit push`** — o roadmap proíbe; `.sql` revisável é R-031.
- **`net start postgresql-*` no launcher** — exige admin; a sessão não tem (§Padrão 10).
- **`-F p` no `pg_restore`** — não suportado.
- **Assumir `SyncState` público** — é enum interno; use `isBuffering()`.
- **`printQRInTerminal`** — removido no v7.
- **Uma checagem de `pg_isready` e seguir** — após kill, o recovery leva ~10-16s e responde "rejecting connections".
- **Corpo de mensagem em log de nível `info`** — PII duplicada fora da tabela auditável. Logue id, direção, `char_count`, hash.
- **`pg-boss` na Fase 1** — o Outbox + `SKIP LOCKED` já cobre; adicionar agora é um serviço a mais sem benefício.

## Armadilhas Comuns (detalhadas)

### Armadilha 1 — O 463 não é uma exceção de `sendMessage()`
**O que dá errado:** planejar `catch` no envio e descobrir, em produção, que o envio "deu certo" e a mensagem nunca saiu.
**Por quê:** o 463 é ACK assíncrono tratado em `messages-recv.js`; o `messages-send.js` não conhece o código.
**Como evitar:** detecção por `fetchAccountReachoutTimelock()` + `fetchNewChatMessageCap()` no `HealthMonitor` (§Padrão 6).
**Sinais:** `PENDING` sem ACK; `capping_status` subindo; `isActive` do time-lock.

### Armadilha 2 — `fromMe` não distingue Admin de bot
**O que dá errado:** o bot se trata como Admin, marca `firstContactByHuman = true` na própria mensagem, e AR-001 vira decorativo.
**Como evitar:** `emitOwnEvents: false` (§Padrão 7) + teste explícito de que um envio do dispatcher **não** produz `AdminAction`.
**Sinais:** leads entrando em "assumido" sem o Admin ter mandado nada.

### Armadilha 3 — `exists: false` nunca vem do `onWhatsApp()`
**O que dá errado:** LEAD-03 implementado, testado com mock, e em produção todo número inexistente "existe".
**Como evitar:** testar `length === 0 || undefined`; escrever o teste **contra a implementação real** (o `FakeChannel` precisa replicar a semântica de array vazio, não "sempre retorna um objeto").

### Armadilha 4 — `CHECK` não protege `opt_out`
**Já detalhado.** Trigger, verificado.

### Armadilha 5 — Postgres 18 instalado, requisito 17.x
**O que dá errado:** instalar/desinstalar Postgres durante a fase e quebrar os outros bancos da máquina (`auth`, `pizzaria_db`, `vidracaria`, `vidracaria_test` estão presentes).
**Como evitar:** **decidir explicitamente 17 vs 18 antes de escrever a primeira migração.** Se 18, `pg_dump`/`pg_restore` 18.3 casam e está tudo certo. Se 17, instalar lado a lado em outra porta e usar `DATABASE_URL` com a porta explícita.
**Signais:** `pg_dump: error: server version mismatch`.

### Armadilha 6 — Launcher sem privilégio administrativo
**Já detalhado** (`pg_ctl`, retry no `pg_isready`).

### Armadilha 7 — Config do Biome que **não carrega**
`recommended` depreciado → `preset`. `noRestrictedImports` em `correctness` → erro de deserialização. Ambos verificados.

### Armadilha 8 — Toast não é caminho confiável
Focus Assist e "notificações por aplicativo" podem engolir o toast em qualquer máquina. O smoke test de D-07 existe por isso. O confiável é **log + `system_events` + som**.

### Armadilha 9 — `AGENTS.md` contradiz a decisão do usuário
**Achado não registrado.** O bloco `<!-- GSD:stack-start source:research/STACK.md -->` em `AGENTS.md` diz, em **5 lugares** (linhas 81, 130, 266, 284, 316): pinar `6.7.24`, e **"Do not install 7.0.0-rc14"** / "**`@whiskeysockets/baileys@7.0.0-rc14` | — | **Do not install.**"**. A decisão do usuário (`PROJECT.md` §Key Decisions, `01-CONTEXT.md` §Specific Ideas) é **`7.0.0-rc14` exato**. Como o `AGENTS.md` é lido por todo agente seguinte, **a Fase 1 precisa corrigir esse bloco** ou um agente futuro vai "corrigir" o pin de volta e quebrar LEAD-03/WHS-04 (o 6.7.x não tem as APIs de tctoken/463/cota — é literalmente o motivo da decisão).

### Armadilha 10 — `pg_hba.conf` com `trust` e `listen_addresses = '*'`
**Achado novo, relevante para COMP-04.** Na máquina: `listen_addresses = '*'` e `host all all 127.0.0.1/32 trust` (mais `local all all trust`). Efeito prático: **qualquer processo local — e qualquer usuário do Windows — obtém superuser sem senha no banco que contém os dados de lead sob LGPD.** Isso é **mais amplo** do que o R-033 aceitou ("sem criptografia adicional; confiança no controle de acesso do PC"). *Higiene recomendada na Fase 1:* `listen_addresses = 'localhost'` e trocar a regra `127.0.0.1` para `scram-sha-256` com senha em `.env`. É uma tarefa pequena e deixa COMP-04 honesto.

---

## Estado da Arte

| Abordagem antiga | Abordagem atual | Quando mudou | Impacto |
|---|---|---|---|
| `whatsapp-web.js` / Puppeteer | Baileys (WebSocket, sem navegador) | ~2022 | 200-500 MB → ~50 MB; sem o antivírus do Windows brigando com Chromium |
| `printQRInTerminal: true` | `connection.update.qr` + render próprio | v7 (rc) | `printQRInTerminal` **removido**; o QR precisa ser renderizado pelo app |
| `remoteJid` = telefone | `remoteJid` pode ser LID; PN em `phoneNumber` | v7 | Obrigatório `JidResolver` + colunas separadas, **ou** o histórico do lead fica órfão |
| Capturar 463 como exceção de envio | ACK assíncrono + leitura de `reachoutTimeLock`/`newChatCap` | v7 | O desenho de detecção muda por completo |
| `exists: false` do `onWhatsApp()` | ausência no array (filtro de `contact`) | v7 | Forma do teste e do tratamento muda |
| `opt_out` como `CHECK` | trigger `BEFORE UPDATE` | sempre foi necessário | Irreversibilidade real em vez de aspiracional |
| `net start` no launcher | `pg_ctl` + `pg_isready` com retry | 제약 de privilégio | Funciona sem admin |
| `node-notifier` | `notify.ps1` + WinRT | imposto no STACK | AUMID obrigatório; testado nesta máquina |
| `pg_dump -Fc` nunca testado | round-trip verificado com contagem de linhas | NFRQ-02 hoje | Backup deixou de ser teatro |
| `fc.assert()` cru | `@fast-check/vitest` `test.prop` + `expect` do vitest | v3/v4 | Counterexample shrunk + seed no output |

**Depreciado/obsoleto (não usar):** `printQRInTerminal` · `puppeteer` e derivados · `prisma@latest` (= `8.0.0-rc.17`) · `node-notifier` · `pg_restore -F p` · Biome `rules.recommended` · `prisma` (R-031 + Windows/OneDrive).

## Registro de Premissas

| # | Afirmação | Seção | Risco se errada |
|---|---|---|---|
| A1 | `7.0.0-rc14` e não `6.7.24` é a decisão travada, apesar de `AGENTS.md` dizer o contrário | Armadilha 9 | **Alto** — um agente futuro reverte o pin e LEAD-03/WHS-04 ficam sem as APIs de cota/463 |
| A2 | PostgreSQL 18.3 é aceitável dado que o STACK.md diz "17.x **ou 18.x se já instalado**" | Armadilha 5 | **Alto** — se o usuário quis 17.x estrito, há migração de dados e de `pg_dump` no meio do caminho |
| A3 | `docs/10-anti-requisitos.md` §"Ordem de Avaliação" é a ordem correta (base legal/opt-out antes de janela) | Padrão 1 | Médio — inverter a ordem transforma um `block` absoluto em `queue` |
| A4 | `emitOwnEvents: false` é seguro para o caso de uso (histórico da conversa) | Padrão 7 | **Alto** — se `emitOwnEvents` também governar algo além do eco de saída, mensagens próprias podem não ser persistidas. **Validar com um teste de integração real no smoke test, não assumir** |
| A5 | `-Urgent` é melhor-esforço e o caminho confiável é log+som | `notify.ps1` | Baixo — degrada, não quebra; já desenhado assim |
| A6 | A Fase 1 não precisa de `pg-boss` | Stack | Baixo — `pg-boss` adicionável depois sem mudar o Outbox |
| A7 | `fc.date()` do fast-check produz datas em UTC, e a janela deve ser avaliada no fuso de São Paulo | Property tests | Médio — um property test de AR-007 pode passar/falhar por fuso, não por lógica |
| A8 | `graphql`/React/painel fora da Fase 1 | Estrutura | Baixo — D-08 e o roadmap já adiadam explicitamente |

## Perguntas em Aberto

1. **PostgreSQL 17.x ou 18.x?**
   - O que sabemos: 18.3 está instalado, serviço parado, sem admin; `pg_dump 18.3` casa com o servidor; o STACK.md autoriza 18 "se já instalado"; a decisão do usuário na CONTEXT diz 17.x.
   - O que está unclear: se "17.x" era um alvo de stack ou uma decisão firme de versão.
   - Recomendação: **confirmar no discuss-phase antes da primeira migração.** Se 18, nenhuma trabalho extra. Se 17, instalar lado a lado (porta 5433) e apontar `DATABASE_URL`.

2. **`emitOwnEvents: false` perde alguma mensagem legítima?**
   - O que sabemos: controla o `upsertMessage` de mensagens enviadas pelo próprio socket (`messages-send.js` ~1135). Histórico chega pelo sync da sessão.
   - O que está unclear: se há algum outro efeito colateral.
   - Recomendação: **tarefa explícita de verificação** no smoke test: enviar pelo dispatcher e confirmar que a linha aparece em `messages` (persistida pelo app) e **não** gera `AdminAction`.

3. **O estado de health do canal é exposto o bastante para o painel da Fase 3?**
   - O que sabemos: `connection.update` traz `reachoutTimeLock`; `ev.isBuffering()` dá o sync; `fetchAccountReachoutTimelock()` é explícito.
   - Recomendação: definir agora um `ChannelHealth` serializável (online, buffering, reachout, cap) em `system_events`, para a Fase 3 só ler.

4. **A semântica "array vazio" do `onWhatsApp()` se aplica a grupos?**
   - O que sabemos: o filtro é por `contact`; a lead list é de 1:1 (Fase 1, sem grupos).
   - Recomendação: nenhuma ação; apenas não generalizar o port para grupos na Fase 1.

5. **`crsier` vs `pg-boss` no limite?**
   - Recomendação: decidir na Fase 3, com dado do piloto. `Outbox` cobre a Fase 1.

## Segurança

### Padrões de ameaça para esta stack

| Padrão | STRIDE | Mitigação padrão na Fase 1 |
|---|---|---|
| Envio por caminho sem gate | Tampering / Repudiation | `emitOwnEvents:false` + `noRestrictedImports` + teste "só o dispatcher chama o canal" |
| LLM alucina preço (Fase 2) | Tampering | Gate **antes** do `LlmPort` (invariante nº1); regex de moeda no `replyText`; AR-001/012 fail-closed |
| Vazamento do banco de leads | Information disclosure | `listen_addresses='localhost'`, `scram-sha-256` (Armadilha 10), `DATABASE_URL` só em `.env` |
| Perda/divulgação da pasta `auth` | Spoofing / Elevation | Fora do OneDrive+git; `.gitignore`; `pg_dump` **não** inclui `auth`; teardown gracioso |
| PII em log | Information disclosure | pino `redact: ['*.body','*.phone','req.headers.authorization']`; corpos só em `messages` |
| Toast como falsa sensação de alerta | Repudiation | Smoke test de D-07; log + `system_events` como registro confiável |
| TOCTOU na cota | Tampering | `INSERT … ON CONFLICT DO UPDATE … WHERE count < limite` + `CHECK` na mesma transação |
| Duplicidade de envio em fila | Tampering | `idempotency_key` UNIQUE + `FOR UPDATE SKIP LOCKED` + singleton |
| Injeção via conteúdo de lead no toast | Tampering | `[System.Security.SecurityElement]::Escape` em título/mensagem (§verify) |

### Risco dominante

**R-059 (número único, sem redundância).** A mitigação primária não é técnica: R-001 (primeiro contato humano), janela 7h–17h, cota 20–30/dia, 463 sem retry. Plano recomendado: **segundo SIM de reserva desde o dia 1** — não é "aquecimento automático" (R-039/R-040 são sobre volume), é seguro de canal. Registrar em STATE.md.

## Fontes

### Primárias (HIGH — verificadas nesta sessão, 2026-09-28)
- `node_modules/@whiskeysockets/baileys@7.0.0-rc14` (instalado com `--save-exact` em `C:\Users\11\AppData\Local\Temp\opencode\baileys-probe`) — **fonte autoritativa**. Lidos: `lib/Socket/messages-send.js` (~1115-1145, `emitOwnEvents`), `lib/Socket/messages-recv.js` (~1500-1550, handler 463), `lib/Utils/decode-wa-message.js` (25-80, `NACK_REASONS`/`SERVER_ERROR_CODES`), `lib/Socket/chats.d.ts` (`onWhatsApp`, `sendPresenceUpdate`), `lib/Signal/lid-mapping.d.ts` (`LIDMappingStore`), `lib/Types/Auth.d.ts` (`LIDMapping`), `lib/Types/Chat.d.ts` (`WAPresence`), `lib/Utils/chat-utils.d.ts`, `lib/Defaults/index.d.ts` + execução de `DEFAULT_CONNECTION_CONFIG` (version/browser/countryCode/emiteOwnEvents/syncFullHistory), `package.json` (`type: module`, sem `exports` → `lib/index.js`), `onWhatsApp` (implementação), `fetchNewChatMessageCap`, `fetchAccountReachoutTimelock`, `use-multi-file-auth-state.d.ts`, `event-buffer`, `disconnect-reason`.
- `node_modules/@biomejs/biome/configuration_schema.json` (2.5.14) + **execução real** de `biome lint` com 4 fixtures de import — §Barreira de lint.
- `node_modules/@fast-check/vitest@0.5.0` — `peerDependencies: { vitest: '^4.1.0 || ^5.0.0' }`, `lib/vitest-fast-check.d.ts` + `.js` (API `test.prop`, ausência de `expect`) + **execução real** de 2 propriedades.
- PostgreSQL 18.3 + `pg_dump`/`pg_restore` 18.3 — **round-trip executado** (45 linhas, sequência preservada, contagem comparativa), triggers de append-only/opt-out/`CHECK` de cota **executados**, `FOR UPDATE SKIP LOCKED` **executado com 2 sessões concorrentes**, `drizzle-kit generate` + `migrate()` **executados 2×** (idempotente), `drizzle.__drizzle_migrations` inspecionado.
- Windows PowerShell 5.1.26100.9444 — **`notify.ps1` executado com sucesso**; `Add-Type -AssemblyName System.Runtime.WindowsRuntime` necessário; tipos WinRT carregam; `SystemSounds` funciona; `pwsh` ausente.
- `croner@10.0.1` e `p-queue@9.3.3` — **execução real** com `timezone`/`protect` e `{concurrency, interval, intervalCap}`.
- `slopcheck` 16 pacotes npm + `npm view` para metadata (versões, licença, repo, maintainers).

### Secundárias (MEDIUM)
- `.planning/research/{ARCHITECTURE,PITFALLS,STACK}.md`, `.planning/{PROJECT,STATE,ROADMAP,REQUIREMENTS}.md`, `01-CONTEXT.md`, `01-DISCUSSION-LOG.md`, `docs/01-requisitos-funcionais.md` (lido integral), `docs/10-anti-requisitos.md` (lido integral), `AGENTS.md` (lido integral), os 6 `SKILL.md` de `.ruler/skills/`.
- `nodejs.org/dist/index.json` (via STACK.md) → 24.21.0 LTS.

### Terciárias (LOW — sinalizados)
- Nenhuma afirmação do documento depende de fonte web LOW. As fontes de risco de banimento (wapisimo, kraya, osky.dj) do STACK.md **foram deliberadamente não usadas** aqui: nenhuma decisão de código desta fase depende delas, e duas se contradizem. `[ASSUMED: o comportamento de banimento em campo se materialize como o STACK.md descreve]`.

## Metadados

**Confiança por área:**

| Área | Nível | Razão |
|---|---|---|
| API Baileys 7 rc14 | **HIGH** | Lido do `.d.ts`/`.js` do pacote exato instalado; assinaturas confirmadas no fonte, não de memória |
| Semântica do 463 | **HIGH** | Handler lido no fonte + enumerações oficiais; conclusão oposta à intuição, sustentada por código |
| Discriminação 1ª mensagem do Admin | **HIGH** | `emitOwnEvents` lido no fonte; **mas** o efeito colateral (A4) precisa de teste de integração |
| Barreira de lint | **HIGH** | Schema do 2.5.14 + 4 fixtures executados, incluindo o caso "regra desligada no override" |
| Property testing | **HIGH** | Instalado e executado; a armadilha do `expect` foi encontrada empiricamente |
| Migração de schema | **HIGH** | `generate` → `.sql` → `migrate()` executado, idempotência confirmada |
| Guardas de banco | **HIGH** | 3 triggers/`CHECK` executados com sucesso e falha esperada observada |
| Backup/restauração | **HIGH** | Round-trip real com contagem de linhas |
| Notificação local | **MEDIUM-HIGH** | Script executado com sucesso; limitações do Focus Assist são inerentes ao ambiente (D-07 já prevê smoke test) |
| Ambiente/versões | **HIGH** para o detectado, **LOW** para o desejado | A máquina diverge do requisito em Node e Postgres; ver A2 e §Disponibilidade |
| Comportamento de banimento em campo | **LOW** | Deliberadamente fora da base de código da fase |

**Data da pesquisa:** 2026-09-28
**Válido até:** 2026-11-27 (stack estável). **Rever antes:** se `7.0.0-rc14` sair do RC, se o requisito de Postgres mudar, ou se a decisão de Node 24 for revista.
