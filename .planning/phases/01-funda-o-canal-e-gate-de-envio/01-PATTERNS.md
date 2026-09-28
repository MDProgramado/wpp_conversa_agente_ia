# Fase 1: Fundação, Canal e Gate de Envio — Mapa de Padrões

**Mapeado:** 2026-09-28
**Modo:** `mvp` (vertical slices) — a Fase 1 também produz `SKELETON.md` (Walking Skeleton)
**Arquivos classificados:** 61
**Análogos existentes no código:** 0 (projeto **greenfield** — verificado: não existe `src/`, `package.json`, `tsconfig.json` nem `.gitignore`)

> **Aviso de método.** Este projeto não tem `src/`. O trabalho normal do mapper ("ache o arquivo mais próximo e copie as convenções dele") **não se aplica**. O que este documento faz no lugar disso: **extrai os padrões prescritos** dos artefatos de decisão (RESEARCH.md, ARCHITECTURE.md, PITFALLS.md, ROADMAP.md, CONTEXT.md, `docs/10-anti-requisitos.md`) e os entrega como **árvore canônica de arquivos + identificadores concretos a carregar adiante**. Onde RESEARCH.md contém um trecho de código verificado nesta máquina, o trecho é reproduzido literalmente e referenciado.

---

## 1. Ativos Existentes e Como Mapeá-los

Não existem análogos de *código*. Existem **análogos de contrato e de comportamento**, todos versionados. O planner deve citá-los pelo path, nunca inventar convenção.

| Ativo existente | Papel para a Fase 1 | Quem consome | Como usar no plano |
|---|---|---|---|
| `docs/10-anti-requisitos.md` (887 linhas) | **Fonte canônica dos 12 guards.** Contém, para cada AR-001..AR-012: `Definição`, `Gatilhos de violação`, `Comportamento esperado`, `Exemplos`, `Detecção (regex)`, `Property test`, `Rastreabilidade`. E a tabela **§"Ordem de Avaliação no Gate"** (12 linhas, ordem fixa) | `src/domain/gate/guards/ar-0NN-*.ts` + `tests/gate/ar-0NN.test.ts` | Cada guard = 1 arquivo, copiando a seção `### Detecção` **verbatim** (os arrays `PRICE_PATTERNS`, `MEDIA_PATTERNS`, etc.) e o `Comportamento esperado` como a `action` do `PolicyDecision`. A §"Ordem de Avaliação no Gate" é a **ordem literal** de execução em `evaluate-policy.ts`. |
| `docs/01-requisitos-funcionais.md` | Texto canônico de R-001..R-067 | schema, guards, docs LGPD | Citar o R-ID no comentário de cada coluna/guard para rastreabilidade. **R-001 ≠ AR-001** — ver §6. |
| `.ruler/skills/whatsapp-baileys/SKILL.md` | Contrato comportamental da camada de canal (conexão local, sessão, QR, reconexão com backoff, 20–30/dia, janela 7–17h, mídia recebida → handoff) | `src/channel/baileys/*` | Fonte de verdade **de comportamento**, não de código. **PRÉ-REQUISITO:** ainda não distribuída. Rodar `npx ruler apply` → `.opencode/skills/` **antes** de qualquer task que dependa da skill. |
| `.ruler/skills/lgpd-optout/SKILL.md` | Contrato de base legal (legítimo interesse), registro de origem, opt-out irreversível, exclusão, teste de balanceamento | `docs/lgpd/*`, `lead-importer.ts` | Mesmo pré-requisito de distribuição. |
| `.ruler/skills/{handoff-humano,ia-conversa-consultiva,follow-up-cadencia,crm-pipeline}` | Fase 2/3 | — | **Não ler como tarefa da Fase 1.** Nenhuma task da Fase 1 deve depender delas. |
| `.ruler/skills/agents/{system-architect,backend-engineer,compliance-reviewer,qa-engineer,product-manager}.md` | Personas de execução | todos os planos | Distribuir junto com as skills. |
| `.planning/research/{ARCHITECTURE,PITFALLS,STACK}.md` | Arquitetura-alvo, anti-padrões, pins de versão | todos os planos | §Anti-Padrões 5, 6, 7 e §Padrões 1–10 são **prescrições**, não sugestões. |
| `main.py` (raiz) | **NÃO INTEGRAR.** É um gerador de checklist de crédito em `python-docx` ("Auto Equity PJ"), sem relação com WhatsApp, Node ou Postgres | **ninguém** | **Nenhuma task da Fase 1 toca, importa, executa ou "limpa" `main.py`.** Não mover para `scripts/`, não converter, não listar em `package.json`. É um arquivo órfão pré-existente. Se o planner precisar criar `scripts/`, ignore-o. |
| `opencode.json` | Config do tooling, **não** do app | tooling | Não é `package.json`. Não misturar. |

### 1.1 Pré-requisitos de execução (bloqueiam a Fase 1 se ignorados)

| # | Pré-requisito | Origem | Por que é bloqueante |
|---|---|---|---|
| P1 | `npx ruler apply` (distribui `.ruler/skills/` → `.opencode/skills/`) | CONTEXT §Reusable Assets | As skills `whatsapp-baileys` e `lgpd-optout` são a fonte de verdade comportamental; sem distribuir, um executor não as lê. |
| P2 | **Corrigir `AGENTS.md` §`GSD:stack-start`** (diz `6.7.24` / "Do not install 7.0.0-rc14" em 5 lugares) | RESEARCH §Armadilha 9, STATE.md linha 66/82 | `AGENTS.md` é lido por todo agente. Sem correção, um agente futuro reverte o pin e **WHS-04 e LEAD-03 ficam sem implementação** (a linha 6.7.x não tem `fetchNewChatMessageCap`/`fetchAccountReachoutTimelock`/tctoken). **É a única task que escreve fora de `src/`.** |
| P3 | Preflight Node 24 LTS (máquina tem `v22.14.0`) | STATE.md linha 68/81 | `typescript@7.0.2` / `drizzle-kit` / `vite` seguem a pinagem de 24. Instalar/verificar **antes** da primeira dependência. |
| P4 | Decisar **PostgreSQL 17.x vs 18.3** antes da primeira migração | RESEARCH §Armadilha 5 | A máquina tem 18.3 instalado e outros bancos (`auth`, `pizzaria_db`, `vidracaria`, `vidracaria_test`). Instalar/desinstalar Postgres quebra os outros. A leitura literal do STACK.md ("17.x **ou 18.x se já instalado**") autoriza 18. **Registrar a decisão no plano 01-01 antes da migration `0000`.** |
| P5 | Criar `C:\whatsapp_prospecao\{auth,backups,logs}` e verificar que **não** está dentro do OneDrive | D-01, Pitfall 9 item 7 | OneDrive sincroniza o auth state e os `.dump` (dados LGPD) para a nuvem sem criptografia — contradiz R-033. Files On-Demand pode devolver arquivo "online-only" no meio de uma escrita de credencial e corromper a sessão. |

---

## 2. Classificação de Arquivos

Taxonomia de papel: `domain/schema` · `domain/port` · `domain/policy-gate` · `adapter` · `application` · `infra` · `ops` · `test` · `docs/config` · `bootstrap`.

| Arquivo | Papel | Fluxo de dados | Lê (consumidores) | Escreve / Produz | Análogo |
|---|---|---|---|---|---|
| `package.json` | docs/config | — | tooling, npm | pins exatos de 14 pacotes | **prescrito** (RESEARCH §Instalação) |
| `tsconfig.json` | docs/config | — | `tsc`, `tsx`, IDE | `target: es2023`, `module: nodenext`, **sem `baseUrl`** | **prescrito** (STACK §TS7) |
| `biome.json` | docs/config | — | `biome lint` / `biome format` | barreira de import (D-06) | **prescrito** (RESEARCH §Barreira de lint — config **verificada**) |
| `drizzle.config.ts` | docs/config | — | `drizzle-kit generate` | pasta de migrations `.sql` | **prescrito** |
| `.env.example` | docs/config | — | devs | placeholders de `DATA_ROOT`/limites | **prescrito** (RESEARCH §`.env`) |
| `.gitignore` | docs/config | — | git | exclui `auth/`, `*.dump`, `DATA_ROOT/` | **prescrito** (RESEARCH §`.gitignore`) |
| `src/index.ts` | bootstrap | boot | — | ordem de boot: logger → env → db+migrate → canal → ticks | **prescrito** (RESEARCH §Padrão 10) |
| `src/config/env.ts` | domain/schema | — | todo o app | `DATA_ROOT`, `DAILY_MESSAGE_LIMIT=25`, `DAILY_LEAD_LIMIT=20`, `WINDOW_START_HOUR=7`, `WINDOW_END_HOUR=17`, `KILL_SWITCH`, `CHANNEL_PHONE_E164`, `DATABASE_URL` | **prescrito** (D-04) |
| `src/domain/gate/types.ts` | domain/schema | — | gate, dispatcher, 12 guards, 12 property tests | `PolicyInput`, `PolicyDecision`, `GuardContext`, `ConversationState`, `MessageKind`, `HandoffReason` | **prescrito** (RESEARCH §Padrão 1 — assinatura reconciliada) |
| `src/domain/gate/evaluate-policy.ts` | domain/policy-gate | **função pura** (sem I/O) | dispatcher, 12 property tests | `{ allowed, action, reason, handoffReason }` | **prescrito** (Padrão 1 + §"Ordem de Avaliação no Gate") |
| `src/domain/gate/guard-0-r001.ts` | domain/policy-gate | função pura | `evaluate-policy.ts`, `r-001.test.ts` | `block` + `r001_sem_primeiro_contato_humano` | **prescrito** (RESEARCH §Guard 0) |
| `src/domain/gate/guards/ar-001-price.ts` … `ar-012-*.ts` (**12 arquivos**) | domain/policy-gate | função pura | `evaluate-policy.ts`, 1 property test cada | `{ action, reason }` por AR | **prescrito** — 1:1 com `docs/10-anti-requisitos.md` |
| `src/domain/gate/patterns/price.ts`, `proposal.ts`, `schedule.ts`, `media.ts`, `automation-disclosure.ts` | domain/schema | — | os guards correspondentes | arrays de regex | **prescrito** — texto canônico de `docs/10-anti-requisitos.md` §"Detecção (regex)" |
| `src/domain/gate/kill-switch.ts` | infra | leitura de config | `evaluate-policy.ts` | `boolean` do `.env` + override em memória | **prescrito** (ordem 1 da tabela) |
| `src/domain/business-hours.ts` | domain/policy-gate | função pura | guard AR-007, property test | `isWithinWindow(now)` | **prescrito** (`docs/10-anti-requisitos.md` §AR-007 "Detecção") |
| `src/domain/ports/ChannelPort.ts` | domain/port | interface | dispatcher, `fake-channel`, `baileys/adapter` | a **única** fronteira de canal (R-016) | **prescrito** (RESEARCH §Padrão 3) |
| `src/domain/ports/LeadSourcePort.ts` | domain/port | interface | `lead-importer.ts` | contrato do caça-leads (D-08) | **prescrito** (D-08) |
| `src/domain/ports/NotifyPort.ts` | domain/port | interface | `health-monitor.ts`, `notifier.ts` | `notify(title, message, opts)` | **prescrito** (D-07) |
| `src/domain/ports/ClockPort.ts` | domain/port | interface | gate, humanize, business-hours, dispatcher | `NowToken` = `Date` injetado | **prescrito** (ARCHITECTURE §Padrão 6) |
| `src/channel/baileys/capabilities.ts` | adapter | — | `adapter.ts`, guard AR-004 | `{ text: true, links: true }` — **sem `sendMedia`** | **prescrito** (WHS-03) |
| `src/channel/baileys/session.ts` | adapter | session I/O | `adapter.ts` | `useMultiFileAuthState(DATA_ROOT\auth)`, teardown em `SIGINT`/`SIGTERM` | **prescrito** (RESEARCH §Padrão 8) |
| `src/channel/baileys/jid-resolver.ts` | adapter | LID↔PN | `adapter.ts`, `inbound-handler.ts` | resolve `@lid` ↔ E.164 via `sock.signalRepository.lidMapping` | **prescrito** (RESEARCH §Padrão 4) |
| `src/channel/baileys/signals.ts` | adapter | read-only | `health-monitor.ts`, `dispatcher.ts` | `readNewChatCap()`, `readReachoutTimeLock()` | **prescrito** (RESEARCH §Padrão 6) |
| `src/channel/baileys/adapter.ts` | adapter | stream + request | `dispatcher.ts`, `inbound-handler.ts` (via `ChannelPort`) | único arquivo que importa `@whiskeysockets/baileys` | **prescrito** (RESEARCH §Estrutura) |
| `src/application/event-bus.ts` | application | event-driven (in-memory) | inbound-handler, health-monitor, dispatcher | fan-out tipado, sem persistência | **prescrito** (ARCHITECTURE §Padrão 5) |
| `src/application/inbound-handler.ts` | application | event-driven | `baileys/adapter` (via handlers) | dedup, watermark `last_processed_at`, `append` vs `notify`, discriminação `fromMe` | **prescrito** (RESEARCH §Padrão 7 + ARCHITECTURE §Anti-Padrão 5) |
| `src/application/outbox.ts` | application | CRUD transacional | dispatcher, croner tick | reserva `FOR UPDATE SKIP LOCKED` + consome cota no **mesmo** `BEGIN` | **prescrito** (RESEARCH §Padrão 2 — SQL verificado) |
| `src/application/dispatcher.ts` | application | event-driven | tick do `outbox` | **único** importador de `ChannelPort`; chama `evaluatePolicy` antes de enfileirar | **prescrito** (D-06, ARCHITECTURE §Padrão 2) |
| `src/application/humanize.ts` | application | transform | `dispatcher.ts` | presence `composing`, delay gaussiano, split de longas, `sendImmediate` bypass nomeado | **prescrito** (RESEARCH §Padrão 9 + PITFALLS §6) |
| `src/application/lead-importer.ts` | application | batch/CRUD | CLI / script; Fase 3 painel | grava `leads` com origem+base legal+finalidade (AR-011), sinaliza `duplicate_of` | **prescrito** (D-08, LEAD-02, LEAD-04) |
| `src/infra/db/schema.ts` | domain/schema | — | todo o app | 12 tabelas Drizzle + `CHECK` em todo enum | **prescrito** (ARCHITECTURE §Forma do Schema) |
| `src/infra/db/client.ts` | infra | I/O | `index.ts` | `Pool` (`max: 5`, `application_name`) + `migrate()` no boot | **prescrito** — código **verificado** (RESEARCH §Migração Drizzle) |
| `src/infra/db/migrations/0000_*.sql` + `meta/` | domain/schema | — | `migrate()` | `.sql` revisável (NFRQ-01), `drizzle-kit generate` | **prescrito** — `.sql` **gerado**, commitado; **`push` proibido** |
| `src/infra/db/queries/snapshot.ts` | infra | I/O | `dispatcher.ts` | materializa `PolicyInput.snapshot` sob `SELECT ... FOR UPDATE` | **prescrito** (D-05) |
| `src/infra/db/queries/counters.ts` | infra | I/O | `outbox.ts` | `INSERT … ON CONFLICT DO UPDATE … WHERE count < $limite` | **prescrito** (RESEARCH §Padrão 2) |
| `src/infra/fake-channel.ts` | infra | I/O (memória) | **todos** os testes | implementa `ChannelPort` em memória; **replica a semântica de array vazio de `onWhatsApp()`** | **prescrito** (RESEARCH §Padrão 3, §Armadilha 3) |
| `src/infra/fake-lead-source.ts` | infra | I/O (memória) | testes do importador | fixture do caça-leads (D-08) | **prescrito** |
| `src/infra/logger.ts` | infra | stream | todo o app | pino + `redact: ['*.body','*.phone','req.headers.authorization']` → `DATA_ROOT\logs\` | **prescrito** (NFRQ-04) |
| `src/infra/notifier.ts` | infra | subprocess | `health-monitor.ts` | `spawn('powershell.exe', ['-NoProfile','-ExecutionPolicy','Bypass','-File', ...])` | **prescrito** — spawn verificado (RESEARCH §notify.ps1) |
| `src/infra/health-monitor.ts` | infra | event-driven + polling | croner tick, `baileys/signals` | 3 sinais read-only + alertas; **nenhum retry, nenhum flush** | **prescrito** (RESEARCH §Padrão 6) |
| `scripts/notify.ps1` | ops | subprocess | `notifier.ts` | WinRT toast + `SystemSounds` (PS **5.1**) | **prescrito** — **executado com sucesso nesta máquina** |
| `scripts/backup.ps1` | ops | I/O (disco) | manual | `pg_dump -Fc` versionado por data/hora | **prescrito** — round-trip verificado |
| `scripts/launch.cmd` | ops | boot | Windows Task Scheduler | `pg_isready` → `pg_ctl start` → `node src/index.ts` | **prescrito** (RESEARCH §Padrão 10) |
| `tests/gate/fixtures.ts` | test | — | 12 property tests | `baseSnapshot` (estado "tudo permitido") | **prescrito** (RESEARCH §Property tests) |
| `tests/gate/ar-001.test.ts` … `ar-012.test.ts` (**12 arquivos**) | test | — | CI | 1 property test por AR, `test.prop` + `expect` do `vitest` | **prescrito** — armadilha do `expect` documentada |
| `tests/gate/r-001.test.ts` | test | — | CI | property test **separado** do Guard 0 | **prescrito** (RESEARCH §Guard 0) |
| `tests/gate/kill-switch.test.ts` | test | — | CI | ordem 1 da tabela | derivado |
| `tests/domain/business-hours.test.ts` | test | — | CI | cobertura de dia útil × hora × fuso | derivado (A7 do RESEARCH) |
| `tests/application/outbox.test.ts` | test | — | CI | 2 workers concorrentes não estouram a cota | derivado de RESEARCH §Padrão 2 |
| `tests/application/dispatcher-choke-point.test.ts` | test | — | CI | `FakeChannel` registra **exatamente** o que o gate deixou passar | derivado (nota de paths em RESEARCH §Estrutura) |
| `tests/application/inbound-fromme.test.ts` | test | — | CI | `fromMe` + `emitOwnEvents:false` ⇒ `AdminAction`; envio do dispatcher **não** gera `AdminAction` | derivado (RESEARCH §Padrão 7 + Armadilha 2) |
| `tests/lint/choke-point.grep.test.ts` | test | — | CI | `grep sendText|sendMessage src/` retorna **só** dispatcher + adapter | derivado (nota de paths em RESEARCH §Estrutura) |
| `docs/lgpd/encarregado-dpo.md` | docs | — | ANPD, titular | Encarregado nomeado + substituto + canal publicado | **prescrito** (COMP-02, PITFALLS §7) |
| `docs/lgpd/teste-balanceamento.md` | docs | — | ANPD | 3 fases: finalidade, necessidade, balanceamento, salvaguardas | **prescrito** (COMP-02/03) |
| `docs/lgpd/retencao-e-eliminacao.md` | docs | — | ANPD | prazo de retenção + eliminação **incluindo backup** | **prescrito** (PITFALLS §7 item 4) |
| `docs/lgpd/canal-do-titular.md` | docs | — | titular | canal que funciona em < 48h | **prescrito** (COMP-02) |
| `docs/adr/001-pin-baileys-rc14.md` | docs | — | futuros agentes | por que `7.0.0-rc14` e não `6.7.24` (immutable) | derivado de P2 / Armadilha 9 |

**Cobertura:** 61 arquivos classificados · **0** com análogo de código (greenfield) · **61** com padrão prescrito nos artefatos de pesquisa.

---

## 3. Árvore Canônica da Fase 1

> Esta é a entrega principal deste documento. É o alvo do `SKELETON.md` e o layout contra o qual o planner distribui as tasks dos 3 planos do ROADMAP (01-01 fundação/compliance, 01-02 canal/ingestão, 01-03 gate/operação).

```
/
├─ .env.example                    # D-04: DATA_ROOT, limites 25/20, janela 7/17, KILL_SWITCH
├─ .gitignore                      # auth/, *.dump, DATA_ROOT/, whatsapp_prospecao/
├─ biome.json                      # D-06: noRestrictedImports (grupo style, preset)
├─ drizzle.config.ts
├─ package.json                    # todos os pins --save-exact
├─ tsconfig.json                   # target es2023, sem baseUrl
│
├─ src/
│  ├─ index.ts                     # boot: logger → env → db+migrate → canal → ticks
│  │
│  ├─ config/
│  │  └─ env.ts                    # zod-validado; DATA_ROOT default C:\whatsapp_prospecao
│  │
│  ├─ domain/                      # PURO — sem I/O, sem socket, sem Date.now()
│  │  ├─ business-hours.ts         # isWithinWindow(now) — 7h–17h, só dias úteis
│  │  ├─ gate/
│  │  │  ├─ types.ts               # PolicyInput, PolicyDecision, ConversationState, MessageKind
│  │  │  ├─ evaluate-policy.ts     # ORDEM FIXA dos 12 guards + Guard 0
│  │  │  ├─ guard-0-r001.ts        # admissão por primeiro contato humano
│  │  │  ├─ kill-switch.ts
│  │  │  ├─ patterns/              # regex extraídas de docs/10-anti-requisitos.md
│  │  │  │  ├─ price.ts            # PRICE_PATTERNS  (AR-001, AR-012)
│  │  │  │  ├─ proposal.ts         # PROPOSAL_PATTERNS (AR-002)
│  │  │  │  ├─ schedule.ts         # SCHEDULE_PATTERNS (AR-003)
│  │  │  │  ├─ media.ts            # MEDIA_PATTERNS (AR-004, AR-009)
│  │  │  │  └─ automation-disclosure.ts  # AR-006
│  │  │  └─ guards/                # 1 arquivo por AR — 12 invariantes nomeadas
│  │  │     ├─ ar-001-price.ts
│  │  │     ├─ ar-002-proposal.ts
│  │  │     ├─ ar-003-schedule.ts
│  │  │     ├─ ar-004-send-media.ts
│  │  │     ├─ ar-005-opt-out.ts
│  │  │     ├─ ar-006-automation-disclosure.ts
│  │  │     ├─ ar-007-window.ts
│  │  │     ├─ ar-008-daily-cap.ts
│  │  │     ├─ ar-009-received-media.ts
│  │  │     ├─ ar-010-post-handoff-silence.ts
│  │  │     ├─ ar-011-legal-basis.ts
│  │  │     └─ ar-012-price-as-objection.ts
│  │  └─ ports/                    # interfaces — a fronteira de R-016
│  │     ├─ ChannelPort.ts         # E.164. NÃO jid.
│  │     ├─ LeadSourcePort.ts
│  │     ├─ NotifyPort.ts
│  │     └─ ClockPort.ts           # NowToken
│  │
│  ├─ channel/                     # ÚNICO lugar que importa @whiskeysockets/baileys
│  │  └─ baileys/
│  │     ├─ adapter.ts             # implements ChannelPort · emitOwnEvents: false
│  │     ├─ session.ts             # useMultiFileAuthState + teardown gracioso
│  │     ├─ jid-resolver.ts        # LID ↔ PN via signalRepository.lidMapping
│  │     ├─ capabilities.ts        # { text: true, links: true } — sem sendMedia
│  │     └─ signals.ts             # fetchNewChatMessageCap / fetchAccountReachoutTimelock
│  │
│  ├─ application/                 # casos de uso; compõe domínio + portas
│  │  ├─ event-bus.ts              # EventEmitter tipado, em memória
│  │  ├─ inbound-handler.ts        # dedup + watermark + fromMe
│  │  ├─ lead-importer.ts          # AR-011 na criação; duplicate_of sinalizado
│  │  ├─ outbox.ts                 # reserva transacional
│  │  ├─ dispatcher.ts             # ÚNICO importador de ChannelPort
│  │  └─ humanize.ts               # presence + delay + split; sendImmediate nomeado
│  │
│  └─ infra/
│     ├─ db/
│     │  ├─ schema.ts              # Drizzle
│     │  ├─ client.ts              # Pool + migrate()
│     │  ├─ queries/
│     │  │  ├─ snapshot.ts         # materializa PolicyInput.snapshot sob FOR UPDATE
│     │  │  └─ counters.ts         # INSERT … ON CONFLICT … WHERE count < $limite
│     │  └─ migrations/            # 0000_*.sql + meta/  (GERADO, COMMITADO)
│     ├─ fake-channel.ts           # 1ª classe, não __mocks__
│     ├─ fake-lead-source.ts
│     ├─ logger.ts                 # pino + redact
│     ├─ notifier.ts               # spawn de scripts/notify.ps1
│     └─ health-monitor.ts         # croner tick; 3 sinais; nenhum retry
│
├─ scripts/                        # FORA de src/ — tooling de SO, não código de domínio
│  ├─ notify.ps1                   # PS 5.1 + WinRT  (D-07)
│  ├─ backup.ps1                   # pg_dump -Fc  (NFRQ-02)
│  └─ launch.cmd                   # pg_isready → pg_ctl → node  (NFRQ-01/06)
│
├─ tests/
│  ├─ gate/
│  │  ├─ fixtures.ts               # baseSnapshot
│  │  ├─ ar-001.test.ts … ar-012.test.ts   (12 arquivos)
│  │  ├─ r-001.test.ts             # Guard 0 — SEPARADO dos 12
│  │  └─ kill-switch.test.ts
│  ├─ domain/
│  │  └─ business-hours.test.ts
│  ├─ application/
│  │  ├─ outbox.test.ts
│  │  ├─ dispatcher-choke-point.test.ts
│  │  └─ inbound-fromme.test.ts
│  └─ lint/
│     └─ choke-point.grep.test.ts
│
└─ docs/
   ├─ adr/001-pin-baileys-rc14.md   # imutável — impede reversão do pin
   └─ lgpd/
      ├─ encarregado-dpo.md
      ├─ teste-balanceamento.md
      ├─ retencao-e-eliminacao.md
      └─ canal-do-titular.md
```

### 3.1 Mapa plano → árvore (do ROADMAP, sem alterar o escopo)

| Plan do ROADMAP | Arquivos que ele cria |
|---|---|
| **01-01 Fundação de dados e compliance** | `package.json`, `tsconfig.json`, `biome.json`, `drizzle.config.ts`, `.env.example`, `.gitignore`, `src/config/env.ts`, `src/infra/db/{schema,client}.ts`, `src/infra/db/migrations/`, `src/domain/gate/types.ts` (só os enums), `docs/lgpd/*`, `docs/adr/001-*`, **+ P2** (corrigir `AGENTS.md`) |
| **01-02 Canal e ingestão** | `src/domain/ports/{ChannelPort,LeadSourcePort,NotifyPort,ClockPort}.ts`, `src/channel/baileys/*` (5), `src/infra/{fake-channel,fake-lead-source}.ts`, `src/application/{event-bus,inbound-handler,lead-importer}.ts`, `src/infra/db/queries/snapshot.ts` |
| **01-03 Gate de envio e operação** | `src/domain/gate/{evaluate-policy,guard-0-r001,kill-switch}.ts`, `src/domain/gate/guards/*` (12), `src/domain/gate/patterns/*` (5), `src/domain/business-hours.ts`, `src/application/{outbox,dispatcher,humanize}.ts`, `src/infra/db/queries/counters.ts`, `src/infra/{logger,notifier,health-monitor}.ts`, `src/index.ts`, `scripts/*` (3), `tests/**`, `tests/lint/choke-point.grep.test.ts` |

> **Ordem de construção não negociável** (ARCHITECTURE §"Invariantes de ordem"): o gate (`evaluate-policy.ts`) é a **primeira** coisa construída, porque pode ser testado com `zero` dependência de canal. O `ChannelPort` vem **segundo** (com `FakeChannel` **antes** do `BaileysChannelAdapter`, para que o gate seja testável contra um canal falso desde o primeiro commit). O schema Drizzle é o **terceiro** e fecha o ciclo com o backup verificado. Isso contradiz a ordem numérica dos planos: **a task do gate no 01-03 não espera o canal, e o canal no 01-02 não espera o gate.** O planner deve explicitar essa sobreposição como tasks paralelas, não como espera.

---

## 4. Padrões Prescritos — Trechos Concretos a Carregar Adiante

Todos os trechos abaixo vêm de RESEARCH.md, salvo indicação. São **verificados** (executados nesta máquina) onde marcado.

### 4.1 `biome.json` — a barreira de lint (D-06, CONV-14) — **VERIFICADO, 4 fixtures executadas**

**Três achados que quebram o config se ignorados:**
1. `noRestrictedImports` é do grupo **`style`**, não `correctness`. Em `correctness` o Biome sai com `Biome exited because the configuration resulted in errors`.
2. `rules.recommended` está **depreciado** em 2.5.14 e **quebra o config**. Usar `"preset": "recommended"` (ou rodar `npx biome migrate --write`).
3. O override precisa **re-declarar a regra** com o mesmo mapa. **Não basta virar a regra inteira para `off`** no override — senão `puppeteer`/`bullmq` passam a ser permitidos *dentro* do adaptador. O mapa do override **omite a chave `@whiskeysockets/baileys`** e mantém todas as outras.

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
              // MESMO mapa, SEM a chave "@whiskeysockets/baileys".
              // -> puppeteer/bullmq/etc. continuam proibidos AQUI DENTRO.
              "options": { "paths": { /* …todos os outros, menos o Baileys… */ } }
            }
          }
        }
      }
    }
  ]
}
```

**Resultado verificado:** `src/gate/policy.ts` sem import de canal → limpo · `src/channel/leak.ts` com `import makeWASocket` → `× Importe o canal so via …` · `src/channel/baileys/ok.ts` → limpo · `src/channel/baileys/stillbad.ts` com `import puppeteer` → `× Proibido (Chromium). AR-002.`

> **Nota de escopo (D-06 × onde a interface vive).** D-06 diz "bloqueia `ChannelPort` fora do Dispatcher/Adapters". Mas a **interface** mora em `src/domain/ports/ChannelPort.ts` e o gate não pode conhecê-la. **Reconciliação (RESEARCH §Estrutura):** a interface fica em `src/domain/ports/`; o lint bloqueia o **adaptador** (`@whiskeysockets/baileys` e `src/channel/**`) fora de `src/channel/**`. O teste que **realmente prova** que nenhum caminho escapa não é o lint, é o par: (a) `tests/lint/choke-point.grep.test.ts` — `grep sendText|sendMessage src/` retorna **só** `dispatcher.ts` e `adapter.ts`; (b) `tests/application/dispatcher-choke-point.test.ts` — `FakeChannel` registra **exatamente** o que o gate deixou passar.

> **Regra de `Date.now`/relogio injetado (ARCHITECTURE §Padrão 6):** a pesquisa **não verificou** qual regra do Biome 2.5.14 faz isso (a formulação original é de ESLint). **Não inventar.** O clock injetado é garantido por: `now: Date` no `PolicyInput` + relógio injetado no `FakeChannel` + o grep acima estendido a `Date.now`. Tratar a regra de lint do relógio como **hardening opcional**, não como task obrigatória.

### 4.2 `src/domain/gate/types.ts` — o contrato do gate (D-05) — assinatura reconciliada

D-05 dá `(mensagem_candidata, snapshot_de_estado, config)`. `docs/10-anti-requisitos.md` §"Ordem de Avaliação" exige ainda `isIncoming`/`lastInboundType`. **Assinatura reconciliada (RESEARCH §Padrão 1):**

```typescript
export type MessageKind = 'text' | 'link' | 'image' | 'audio' | 'video' | 'document' | 'pdf'

export type PolicyInput = {
  message: { text: string; kind: MessageKind }
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

export type PolicyDecision =
  | { allowed: true;  action: 'send' }
  | { allowed: false; action: 'block';   reason: string }
  | { allowed: false; action: 'silence'; reason: string }
  | { allowed: false; action: 'queue';   reason: string; until: Date }
  | { allowed: false; action: 'handoff'; reason: string; handoffReason: HandoffReason }
```

> **Por que `MessageKind` inclui mídia se a mensagem de saída "só é texto"?** Porque o gate é **fail-closed na fronteira**: aceitar o valor amplo permite que o property test de AR-004 injete `kind: 'image'` e exija `block`, e que o guard exista de fato. O *call site* estreita: `ChannelPort.sendText` só recebe `kind: 'text'`, e `ChannelCapabilities` não declara nenhum método de mídia. Belt **and** braces. Se o gate só aceitasse `'text'`, AR-004 seria impossível de testar e o guard vira código morto.

### 4.3 `src/domain/gate/evaluate-policy.ts` — ordem fixa

**A ordem vem literalmente de `docs/10-anti-requisitos.md` §"Ordem de Avaliação no Gate":**

| Ordem | Verificação | Ação | AR / R |
|---|---|---|---|
| 0 | *Guard 0* — primeiro contato humano | `block` | **R-001** (não é AR nenhum) |
| 1 | Kill switch ativo | `block` | — |
| 2 | Base legal | `block` | AR-011 |
| 3 | Opt-out | `block` | AR-005 |
| 4 | Handoff ativo | `silence` | AR-010 |
| 5 | Mídia recebida | `handoff` | AR-009 |
| 6 | Preço/proposta | `handoff` | AR-001, AR-002, AR-012 |
| 7 | Agendamento | `handoff` | AR-003 |
| 8 | Mídia a enviar | `block` | AR-004 |
| 9 | Revelação de automação | `silence` | AR-006 |
| 10 | Janela de envio | `queue` | AR-007 |
| 11 | Limite diário | `queue` | AR-008 |
| 12 | Permitir envio | `send` | — |

> **Por que a ordem é load-bearing:** AR-011 e AR-005 são `block` **absolutos** e não podem ser precedidos por um `queue`. Se a janela (10) fosse avaliada antes, uma mensagem sem base legal às 22h seria *enfileirada* e enviada às 7h. Base legal e opt-out vêm antes da janela por isso.
>
> **O Gate 0 é anterior a tudo** e é **anterior à sequência AR** (RESEARCH §Guard 0). Se `firstContactByHuman === false`, a decisão é `block` com `reason: 'r001_sem_primeiro_contato_humano'` — **sem `queue`, sem handoff, sem notificação**. O Admin ainda não falou com o lead; não há nada a recuperar depois. `firstContactByHuman` é setado **exclusivamente** pelo caminho `fromMe` (RESEARCH §Padrão 7) — nunca pelo bot, nunca por um job, nunca por API.

### 4.4 `src/domain/gate/patterns/*` — regex verificadas em `docs/10-anti-requisitos.md`

Copiar **verbatim** da §"Detecção (regex)" do doc. AR-001 (linhas 61–69):

```typescript
export const PRICE_PATTERNS = [
  /\b(preço|valor|custo|investimento|orçamento|proposta)\b/i,
  /R\$\s?\d+/i,
  /\b\d+\s?(reais|mil|k)\b/i,
  /\b(desconto|promoção|condição especial)\b/i,
  /\b(quanto (custa|fica|sai|é|vale))\b/i,
  /\b(me (manda|envia|passa) (uma )?(proposta|orçamento|valor))\b/i,
  /\b(faixa de (preço|valor))\b/i,
]
```

AR-004 (linhas 259–266):

```typescript
export const MEDIA_PATTERNS = [
  /\b(segue (em )?anexo|em anexo|anexado)\b/i,
  /\b(vou (enviar|mandar) (o |a )?(pdf|imagem|vídeo|áudio|arquivo|documento))\b/i,
]

// Verificação estrutural (o adapter não expõe sendMedia)
export function containsMedia(message: { kind: MessageKind }): boolean {
  return message.kind !== 'text'
}
```

AR-007 (linhas 474–481) — **a janela é uma função pura, e o guarda de `direction`/`now` é o mesmo arquivo:**

```typescript
export function isWithinWindow(now: Date): boolean {
  const day = now.getDay()          // 0 = domingo, 6 = sábado
  const hour = now.getHours()
  const isWeekday = day >= 1 && day <= 5
  const isWithinHours = hour >= 7 && hour < 17
  return isWeekday && isWithinHours
}
```

> ⚠️ **A7 (premissa de risco médio):** `fc.date()` do fast-check produz datas em **UTC**, e a janela deve ser avaliada no fuso de São Paulo. Um property test de AR-007 pode passar/falhar **por fuso, não por lógica**. O oráculo do teste deve ser uma **reimplementação independente em `America/Sao_Paulo`**, nunca chamar `isWithinWindow` de produção. E `now.getHours()` acima usa o fuso **do processo** — o processo precisa rodar com `TZ=America/Sao_Paulo` (ou o gate normalizar explicitamente). Escolher **uma** das duas e registrar a escolha.

### 4.5 `tests/gate/ar-008.test.ts` — a forma do property test — **VERIFICADO com Vitest 5 + `@fast-check/vitest@0.5.0`**

> **Armadilha que quebra silenciosamente:** `@fast-check/vitest` exporta `test`, `it` e `fc` — **não exporta `expect`**. `import { test, fc, expect } from '@fast-check/vitest'` dá `TypeError: expect is not a function`, e a suíte **parece** estar testando. `expect` vem de `vitest`.

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

O `seed` é impresso no relatório de falha — **fixar em CI** para reprodutibilidade.

**Substituição do oráculo (os exemplos de `docs/10-anti-requisitos.md` são circulares):** o doc escreve `if (containsPrice(msg)) { … }` onde `containsPrice` é **a mesma função** que o gate usa — isso passa mesmo com o gate quebrado. Oráculos não-circulares por classe de AR:

| AR | Arbitrário | Oráculo (independente do código de produção) |
|---|---|---|
| AR-001 / 002 / 003 / 006 / 012 | `fc.constantFrom(...frases dos docs...)` **+** `fc.string()` para garantir ausência de falso positivo | o `action` do gate; opcionalmente um oráculo escrito à mão |
| AR-004 / 009 | `fc.constantFrom('audio','image','pdf','video','document')` | o `action` do gate (sólido) |
| AR-005 / 010 / 011 | `fc.record({...})` / `fc.constantFrom` para o estado | o `action` do gate (sólido) |
| AR-007 | `fc.date({ min, max })` cobrindo o intervalo inteiro | `isWithinWindow` **reimplementado no teste** a partir das regras, em `America/Sao_Paulo` |

### 4.6 `src/domain/ports/ChannelPort.ts` — a fronteira de R-016

```typescript
export type ChannelCapabilities = { text: true; links: true; /* NÃO existe sendMedia */ }

export type WhatsAppExistence =
  | { state: 'VALIDO'; jid: string; lid: string | null }
  | { state: 'NUMERO_INVALIDO' }

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

O resto do app conhece `+5511999999999`. `remoteJid` é detalhe do adaptador — **nunca** como PK ou FK (em v7 pode ser LID). `FakeChannel` implementa isso com array em memória + relógio injetado.

### 4.7 `src/application/outbox.ts` — reserva transacional (Padrão 2) — **SQL executado com 2 sessões concorrentes**

Sem `SKIP LOCKED`, dois workers leem `count = 24`, ambos veem `< 25`, ambos enviam → 26 enviadas.

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

> **Nota de schema (reconciliação necessária — ver §6.2):** o `25` aqui é **bind parameter**, não literal. O `CHECK` no schema é o **teto físico** (30, intervalo de R-023); o **limite configurável** (25, D-04) vive no `WHERE`. Um `CHECK` estático não consegue ler `.env`.

### 4.8 `src/infra/db/client.ts` — pool + migrate no boot — **VERIFICADO, executado 2× (idempotente)**

```typescript
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
  await migrate(db, { migrationsFolder: './src/infra/db/migrations' })  // R-031: antes de qualquer outra coisa
  return { db, pool }
}
```

> ⚠️ **Divergência de path a corrigir:** o código verificado no RESEARCH usa `migrationsFolder: './src/db/migrations'` e o output do `drizzle-kit generate` foi `src\db\migrations\0000_*.sql`. A árvore canônica deste documento usa `src/infra/db/migrations/`. **O planner deve fixar UM path e propagá-lo em `drizzle.config.ts`, `client.ts` e `.gitignore`.** Recomendação: `src/infra/db/migrations/` (consistente com `client.ts` estar em `src/infra/db/`).
>
> **`drizzle-kit push` é PROIBIDO** (ROADMAP + RESEARCH §Padrões a Evitar). Sempre `npx drizzle-kit generate --name=initial` → `.sql` versionado → `migrate()` no boot. O prefixo `--name` é para revisão auditável (o drizzle escolhe nome aleatório sem ele).

### 4.9 Guardas de banco — todas **executadas nesta sessão**

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

-- R-028 / WHS-05
ALTER TABLE leads         ADD COLUMN responsible_user_id uuid, ADD COLUMN created_by uuid;
ALTER TABLE conversations ADD COLUMN channel_account_id uuid NOT NULL REFERENCES channel_accounts(id);
-- channel_accounts: single-row na Fase 1 (WHS-05), pronta para a 2a linha no v2.
```

> **Correção obrigatória a um statement do STACK.md:** ele sugere "boolean column with a `CHECK` that no code path can unset". **Um `CHECK` não impede `UPDATE`** — `UPDATE ... SET opt_out = false` passa. A solução é um **trigger**, e ela foi verificada.
>
> Onde ficam esses DDL? `drizzle-kit generate` só produz o que o schema Drizzle declara. **Triggers e funções** precisam de um `.sql` de migração escrito à mão (ou `drizzle-kit generate --custom`). Isso é compatível com R-031 ("script/migração de criação e atualização de schema") e mantém `.sql` revisável. O planner deve criar `0001_guards.sql` como migração custom, ou declarar isso explicitamente como a 2ª migration.

### 4.10 `scripts/notify.ps1` — **executado com sucesso nesta máquina** (PS `5.1.26100.9444` → saída `toast: whatsapp_prospecao`)

**Descobertas que só apareceram ao executar — as três primeiras são fatais se omitidas:**
- **`Add-Type -AssemblyName System.Runtime.WindowsRuntime` é obrigatório.** Sem: `Não é possível localizar o tipo [System.WindowsRuntimeSystemExtensions]`.
- `pwsh` (PS 7) **NÃO está instalado**. Alvo é **5.1**. Não usar sintaxe de PS 7.
- `ToastNotificationManager` e `ToastNotification` só carregam com `ContentType = WindowsRuntime`.
- **A variável `$Sound` precisa ser declarada `[switch]` no `param`.** Sem a declaração, a condição cai em `$null` (falsy) e **o som NUNCA toca** — em silêncio, justamente no caminho de alerta mais confiável.

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
```

**Invocação do Node** (evita "ps1 não pode ser carregado" por ExecutionPolicy):

```typescript
spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', notifyPath, '-Title', t, '-Message', m], { windowsHide: true })
```

> **Honestidade operacional:** `-Urgent` roda sem erro mas **não há bypass confiável de Focus Assist** sem o módulo BurntToast. O caminho confiável de alerta é **log estruturado + `system_events` + som**; o toast é complemento. Daí o smoke test de D-07 ser obrigatório na máquina do Admin (Focus Assist, ExecutionPolicy, som, inclusive em RDP).

### 4.11 `scripts/backup.ps1` — round-trip **VERIFICADO** (45 linhas, sequência preservada)

```powershell
# 1) dump (formato custom: comprimido + indexado, so restaura via pg_restore)
& 'C:\Program Files\PostgreSQL\18\bin\pg_dump.exe' -Fc -d whatsapp_prospect `
  -f "C:\whatsapp_prospecao\backups\whatsapp_prospect_18_20260928_141813.dump"

# 2) restore para base NOVA
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -U postgres -d postgres -tAc "CREATE DATABASE restore_check;"
& 'C:\Program Files\PostgreSQL\18\bin\pg_restore.exe' -d restore_check --no-owner -v <arquivo.dump>
#   -> rows in dst: 45 | max id dst: 45   (sequencia preservada)

# 3) VERIFICACAO DE LINHAS (criterio de aceite do roadmap)
foreach ($t in (& psql -d restore_check -tAc "select table_name from information_schema.tables where table_schema='public' order by 1")) {
  $a = (& psql -d whatsapp_prospect -tAc "select count(*) from public.`"$t`"")
  $b = (& psql -d restore_check       -tAc "select count(*) from public.`"$t`"")
  if ($a -eq $b) { "OK   $t : $a = $b" } else { "FALHA $t : $a != $b" }
}
```

**Armadilhas a não repetir:** `pg_restore -F p` **falha** com `archive format "p" is not supported; please use psql` — **não passe `-F`**; `-Fc` é o formato certo. Versão do PG no nome do arquivo (`_18_`), senão um upgrade torna o histórico inútil silenciosamente. O `auth state` **não** está no `pg_dump` e **deve** ser empacotado **junto**, com a mesma timestamp (Pitfall 9 item 2).

### 4.12 `scripts/launch.cmd` — sem privilégio administrativo

O serviço `postgresql-x64-18` está **Stopped e Disabled**, e a sessão **não é administrativa** (`IsInRole(Administrator) == False`). **`net start` não funciona.** `pg_ctl` funciona sem admin (verificado).

```cmd
@echo off
REM launcher.cmd — NFRQ-01 (sobe Postgres) + migração + app. Sem privilégio administrativo.
set "PGBIN=C:\Program Files\PostgreSQL\18\bin"
set "PGDATA=C:\Program Files\PostgreSQL\18\data"

"%PGBIN%\pg_isready.exe" -h 127.0.0.1 -q || "%PGBIN%\pg_ctl.exe" -D "%PGDATA%" -l "%DATA_ROOT%\logs%\pg.log" -w -t 30 start
REM ATENÇÃO: após um kill forçado, o recovery leva ~10-16s e pg_isready responde
REM "rejecting connections" durante ele. Use `pg_isready` com retry, não "1 checagem e prossiga".
"%PGBIN%\pg_isready.exe" -h 127.0.0.1 -q -t 60 || (echo "PostgreSQL nao subiu" & exit /b 1)

node --experimental-strip-types src\index.ts     %% ou: npx tsx src/index.ts
```

> **Ordem importa:** o `migrate()` roda **dentro** do processo, antes do canal. O launcher **só** garante o Postgres. Se o launcher também migrasse, haveria dois lugares que podem migrar. É isso que torna o boot idempotente (R-031).

### 4.13 `.env.example` e `.gitignore` — **VERIFICADO**

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
# R-031
DATABASE_URL=postgres://...@127.0.0.1:5432/whatsapp_prospect
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

### 4.14 `.ruler/skills/whatsapp-baileys/SKILL.md` e `lgpd-optout` — como usar

São **contratos de comportamento**, não código. O padrão de leitura para quem implementa:
- `whatsapp-baileys` → `src/channel/baileys/{session,adapter,signals}.ts` e `src/application/humanize.ts`
- `lgpd-optout` → `src/application/lead-importer.ts` (registro de origem na criação) e `docs/lgpd/*`

**Pré-requisito P1:** `npx ruler apply` distribui `.ruler/skills/` → `.opencode/skills/`. Se um task depender da skill e ela não estiver distribuída, a task herda comportamento de memória do agente, não do contrato. **Incluir P1 como task explícita no plano 01-01.**

---

## 5. Padrões Compartilhados (aplicam-se a vários arquivos)

### 5.1 Relógio injetado (`NowToken`) — `src/domain/ports/ClockPort.ts`

**Nenhuma** lógica de janela, cota ou cadência chama `Date.now()` ou `new Date()`. O tempo é lido **uma vez** no topo do tick e injetado. Por quê: a lógica de janela 7h–17h + dias úteis é onde mora a maior parte dos bugs; com relógio injetado ela é 100% testável com datas fixas, e reexecutar um dia é reproduzível.

**Aplicar em:** `evaluate-policy.ts` (campo `now`), `business-hours.ts`, `humanize.ts` (delays), `outbox.ts` (`available_at`), `dispatcher.ts`.

**Forçamento mecânico disponível hoje:** o `FakeChannel` recebe um relógio injetado; o `tests/lint/choke-point.grep.test.ts` pode ser estendido para `Date.now|new Date\(\)` fora de `src/infra/clock.ts`. A regra de lint do relógio **não foi verificada no Biome 2.5.14** — tratá-la como hardening, não como task.

### 5.2 Trilha de auditoria de negativa do gate

Toda vez que o gate **nega** (independentemente de `block`/`silence`/`queue`/`handoff`), gravar uma linha em `blocked_attempts (conversation_id, reason, intent, ts)`. É a trilha de auditoria mais valiosa do sistema (ARCHITECTURE §Forma do Schema) e a evidência de diligência para a LGPD (PITFALLS §2 item 4). Custo zero; sem ela, um `block` é invisível.

### 5.3 Corpos de mensagem fora do log

**Nunca** logar corpo de mensagem em nível `info`. Logar `message_id`, `lead_id`, `direction`, `char_count` e um hash. Corpos completos vivem **só** na tabela `messages`, que é o registro auditável (R-043). **Redact no logger, não no call site** — um dev que esquecer de redactar não vaza, porque o logger já fez:

```typescript
redact: { paths: ['*.body', '*.phone', 'req.headers.authorization'], censor: '[redacted]' }
```

### 5.4 `capabilities()` sem mídia + `CHECK (kind IN ('text','link'))`

CONV-11 é garantido em **três** lugares independentes: (a) `ChannelCapabilities` não declara nenhum método de mídia; (b) `CHECK (kind IN ('text','link'))` no schema de `messages`; (c) guard AR-004 no gate. Se qualquer um for removido, os outros seguram.

### 5.5 Fail-closed em toda fronteira

Se o gate não puder validar, **não envia**. Custo de não enviar é um delay; custo de enviar é irreversível. Isso vale para: falha de `onWhatsApp()` (vai para `NUMERO_INVALIDO`, terminal, sem retry), falha de leitura de cap (usa o menor dos limites conhecidos), falha de reachout-timelock (suspende).

### 5.6 463: leitura de sinais, nunca `try/catch` no envio

O tratamento está em `messages-recv.js` (handler de ACK), **interno e assíncrono** — `messages-send.js` não conhece o código. Um `try/catch` no `sendMessage()` esperando 463 dá **falso negativo**: o plano pareceria testado e não estaria. A detecção é por **leitura de sinais read-only**:

```typescript
HealthMonitor (croner, a cada ~5 min + ao abrir)
  ├─ await fetchAccountReachoutTimelock()  → isActive ? SUSPENDER_ENVIO + alerta : seguir
  ├─ await fetchNewChatMessageCap()        → capping_status === 'CAPPED' ? limitar por cap : seguir
  └─ contagem de mensagens > 5min em PENDING → registrar suspeita
     Nenhum retry. Nenhum flush de outbox. Apenas alerta + suspensão (D-04).
```

> **A biblioteca já cumpre "463 nunca é retryado"** — o comentário no fonte é explícito. O que ela faz é uma **emissão de token de privacidade** (recuperação), **não um reenvio**, deduplicada por JID. Isso é compatível com D-04, mas **deve ser registrado explicitamente em comentário**, porque "recovery" tem cara de retry para quem lê depressa.

---

## 6. Decisões de Reconciliação (o planner **não** pode decidir sozinho)

### 6.1 R-001 ≠ AR-001 — dois invariantes distintos, fora da tabela de 12

`docs/10-anti-requisitos.md` define **AR-001 = "Negociar preço, valor, desconto"**. **R-001 = "Assunção do bot após primeira mensagem humana"** (`docs/01-requisitos-funcionais.md`). A tabela de 12 guards é **fechada sobre AR-001..AR-012 e não tem slot para R-001**. Escrever "R-001 é o AR-001" faria o planner construir uma tabela de 12 guards incorreta **e** deixaria um dos 12 anti-requisitos genuinamente sem implementação.

**Resolução:** `guard-0-r001.ts` **fora** de `guards/`, avaliado **antes** da sequência AR, com `r-001.test.ts` **separado** dos 12. 13 invariantes, 13 testes.

### 6.2 Limite configurável (25) vs `CHECK` estático (30)

D-04 diz "defaults configuráveis via `.env` (não hardcoded)" e "contadores em tabelas com `CHECK (count <= limite)`". **Um `CHECK` em DDL é estático e não lê `.env`.** Resolução de duas camadas:
- `CHECK (count <= 30)` no schema = **teto físico**, o limite superior duro de R-023. Não muda.
- `WHERE daily_counters.count < $limite` no `INSERT … ON CONFLICT` = **limite operacional**, bind parameter vindo do `config/env.ts`. Muda sem migration.
- Limite efetivo de envio = **`min(config.dailyMessageLimit, cap_lido, CHECK-teto não atingido)****.

O planner deve escrever isso no comentário da migration e no README de operação, senão alguém "conserta" o `CHECK` para 25 e quebra a configurabilidade.

### 6.3 `exists: false` do `onWhatsApp()` **praticamente nunca vem** — LEAD-03

A implementação consulta o USync e **filtra os resultados que têm `contact`**. Número inexistente **não vem no array** — não vem como `{exists: false}`. Escrever `result?.find(x => x.jid)?.exists === false` **não detecta nada**.

```typescript
// Semântica correta, com cache de 7 dias persistido em leads.wa_jid / leads.lid
const r = await sock.onWhatsApp(e164)          // NÃO array — é variádico
if (!r || r.length === 0) return { state: 'NUMERO_INVALIDO' }   // ← terminal, não quebra a fila
return { state: 'VALIDO', jid: r[0].jid, lid: await resolveLid(r[0].jid) }
```

**O `FakeChannel` precisa replicar exatamente essa semântica** (array vazio), não "sempre retorna um objeto". Testar contra o fake que mente é a Armadilha 3 inteira.

Cache de **7 dias** é obrigatório, não otimização: cada chamada é um USync contra o servidor, ou seja, um contato de rede.

### 6.4 `fromMe` sozinho **não** distingue Admin de bot

O Admin envia do celular e o bot envia do socket — **os dois chegam com `key.fromMe === true`**. A solução verificada no fonte: **`emitOwnEvents: false`** (default é `true`).

| Chegou em `messages.upsert` com `emitOwnEvents: false`… | Significado |
|---|---|
| `key.fromMe === true` | **Admin enviou do celular** → `AdminAction` → marca `firstContactByHuman = true` |
| `key.fromMe === false` | Lead respondeu |

**Teste obrigatório (`inbound-fromme.test.ts`):** um envio do dispatcher **não** pode produzir `AdminAction`. Sem esse teste, o bot marca o próprio `firstContactByHuman` e AR-001 vira decorativo (Armadilha 2).

> **Premissa A4 (risco ALTO, não validada):** `emitOwnEvents: false` controla o `upsertMessage` de mensagens enviadas pelo próprio socket. Se houver outro efeito colateral, mensagens próprias podem não ser persistidas. **Validar no smoke test:** enviar pelo dispatcher e confirmar que a linha **aparece** em `messages` (persistida pelo app) e **não** gera `AdminAction`.

### 6.5 `onWhatsApp()` consome reach-out — R-019 foi revertido

R-019 (original) dizia "validação é responsabilidade do caça-leads". A pesquisa **invalida** isso: enviar para número não registrado pode disparar **restrição de nível de conta** (463), não erro de destinatário. Por isso `onWhatsApp()` **volta** ao escopo (LEAD-03) **com cache de 7 dias**, e o número inexistente vai para estado terminal `NUMERO_INVALIDO`.

**Consequência operacional:** a verificação acontece **antes de todo envio iniciado pelo sistema**, e uma validação negativa é **definitiva e nunca é retentada**. Registrar em log toda validação negativa com `lead_id` e origem.

### 6.6 Buffer de boot + watermark

`sock.ev` expõe `buffer()`, `flush()`, `isBuffering()`, `process()`. `SyncState` interno é `Connecting=0, AwaitingInitialSync=1, Syncing=2, Online=3`, mas é **enum interno** — **consuma `isBuffering()`**, não um estado "público". Regra: **nada de `flush()` manual** antes de `isBuffering() === false`.

```
if (upsert.type === 'append' || msg.messageTimestamp <= conv.last_processed_at) {
  await messageRepo.append(raw)   // histórico, para o CRM
  return                           // ← sem publicação no bus
}
eventBus.emit('message.received', normalized)
```

`syncFullHistory: true` (default) + `emitOwnEvents: false` significam que o histórico chega pela janela de sync — daí o buffer ser obrigatório. **Nunca desabilitar history sync** (é onde o `nctSalt`, base do `cstoken`, é capturado — sem ele o 463 volta).

### 6.7 Reconnect com teardown e guard monotônico

No `connection: 'close'`, **destrua o socket anterior** antes de recriar; **backoff exponencial com jitter**. Adicione handler de `SIGINT`/`SIGTERM` que fecha o socket graciosamente — kill abrupto corrompe a pasta `auth`, e pasta corrompida = "dispositivo novo" = sinal de banimento.

Padrão: `attemptId` incremental; todo callback captura o id e retorna cedo se `id !== currentAttemptId`.

| `lastDisconnect.error?.output?.statusCode` | `DisconnectReason` | Ação |
|---|---|---|
| 401 | `loggedOut` | **Terminal.** Alerta alto. Não reconectar. |
| 403 | `forbidden` | **Terminal — provável ban.** Alerta alto. Não reconectar. |
| 408 | `connectionLost` | Reconectar com backoff. |
| 428 | `connectionClosed` | Reconectar com backoff. |
| 440 | `replaced` | Terminal local (outro dispositivo). |
| 515 | `restartRequired` | Reconectar. |

**463 não está no `DisconnectReason`** — é ACK de mensagem, não status de socket.

### 6.8 Humanização: `sendImmediate` nomeado, não condição escondida

R-067 tem uma exceção explícita: *"Handoff não segue essa regra."* O `Dispatcher` deve **pular** a humanização quando a mensagem é do Admin após handoff (AR-010 só permite *sugerir*; o envio é ação do Admin). Implementar como bypass **explícito e nomeado** (`sendImmediate: true`), **não** como condição escondida dentro de `humanize()`.

`sendPresenceUpdate(type: WAPresence, toJid?)` — **aceita JID opcional**, então "digitando…" é **por conversa**, não global. `WAPresence = 'unavailable' | 'available' | 'composing' | 'recording' | 'paused'`.

`p-queue@9.3.3` verificado com `{ concurrency: 1, interval: 15000, intervalCap: 25 }`; `size`/`pending`/`isPaused` são inspecionáveis. `concurrency: 1` = **serial estrito**; mais um **sequenciador global** e um **cooldown por par `(lead, canal)`** (PITFALLS §6).

> **Proibido:** delay uniforme `random(2000, 4000)` (produz distribuição uniforme — precisamente a assinatura que detectores de bot desigualam). Usar delay **dinâmico** proporcional ao tamanho, com **jitter gaussiano** (σ ≥ 25% da média), e **logar o delay real** para auditar a distribuição.

### 6.9 `pg_hba.conf` com `trust` — achado de segurança relevante para COMP-04

Na máquina: `listen_addresses = '*'` e `host all all 127.0.0.1/32 trust`. Efeito prático: **qualquer processo local — e qualquer usuário do Windows — obtém superuser sem senha no banco que contém os dados de lead sob LGPD.** Isso é **mais amplo** do que R-033 aceitou ("sem criptografia adicional; confiança no controle de acesso do PC").

**Higiene recomendada na Fase 1 (tarefa pequena, deixa COMP-04 honesto):** `listen_addresses = 'localhost'` e trocar a regra `127.0.0.1` para `scram-sha-256` com senha em `.env`. Registrar como item do plano 01-01.

---

## 7. Padrões a Evitar (checklist de negative scope para o planner)

Cada um destes **não** deve aparecer em nenhuma task da Fase 1.

| Padrão proibido | Por quê | Onde está documentado |
|---|---|---|
| `try/catch` em `sendMessage()` esperando 463 | Não acontece; dá falso negativo | RESEARCH §Padrão 6 / §Armadilha 1 |
| `key.fromMe` sozinho para detectar a 1ª mensagem do Admin | Colide com o eco do bot | RESEARCH §Padrão 7 / §Armadilha 2 |
| `onWhatsApp([e164])` (array) | É **variádico**: `onWhatsApp(e164)` | RESEARCH §Padrão 5 |
| Checar `exists === false` | `exists: false` nunca vem; testar `length === 0 \|\| undefined` | RESEARCH §Armadilha 3 |
| `remoteJid` como PK ou FK | Em v7 pode ser LID; `phone_number` é a chave | RESEARCH §Padrão 4 |
| `CHECK` como trava de irreversibilidade de `opt_out` | `CHECK` não impede `UPDATE`; usar **trigger** | RESEARCH §Armadilha 4 |
| `drizzle-kit push` | `.sql` revisável é exigência de R-031 | RESEARCH §Padrões a Evitar |
| `net start postgresql-*` no launcher | Exige admin; a sessão não tem | RESEARCH §Padrão 10 |
| `pg_restore -F p` | Formato plain não suportado | RESEARCH §Backup |
| Assumir `SyncState` público | É enum interno; usar `isBuffering()` | RESEARCH §Anti-Padrão 5 |
| `printQRInTerminal` | **Removido** no v7; renderizar `connection.update.qr` | RESEARCH §Padrão 8 |
| Uma checagem de `pg_isready` e seguir | Após kill, recovery leva ~10–16s | RESEARCH §Padrão 10 |
| Corpo de mensagem em log de nível `info` | PII duplicada fora da tabela auditável | RESEARCH §Padrões a Evitar |
| `pg-boss` na Fase 1 | O `Outbox` + `SKIP LOCKED` já cobre | RESEARCH §Stack |
| `node-notifier` | Último push 2024-06-24, sem AppUserModelID; usar `scripts/notify.ps1` | RESEARCH §notify.ps1 |
| Corrigir o pin do Baileys para `6.7.24` | A linha 6.7.x não tem tctoken/463/APIs de quota | RESEARCH §Armadilha 9 · **tarefa P2** |
| Instalar/desinstalar PostgreSQL na máquina | Quebra `auth`, `pizzaria_db`, `vidracaria`, `vidracaria_test` | RESEARCH §Armadilha 5 |
| Tocar, importar ou "limpar" `main.py` | Arquivo órfão não relacionado (checklist de crédito `python-docx`) | §1 deste documento |
| Escrever "R-001 é o AR-001" | São invariantes distintos; quebra a tabela de 12 | §6.1 deste documento |

---

## 8. Walking Skeleton — Subconjunto Mínimo Absoluto

> O planner constrói **isto primeiro**, em **um único plan** de bootstrap, antes de qualquer um dos 3 planos do roadmap. É o caminho mais fino que ainda executa de verdade ponta a ponta. **UI hint da Fase 1 = `no`**: a "interação de UI" do skeleton é o **QR** (renderizado em arquivo) e o **toast de notificação** — o painel é Fase 3.

**Critério de aceitação do skeleton (uma frase):** `scripts/launch.cmd` sobe o Postgres, o processo aplica as migrations `.sql`, abre a sessão Baileys em `DATA_ROOT\auth`, escreve o QR em `DATA_ROOT\logs\qr.txt`, e um `dispatcher` envia **um** texto de teste **apenas** se `evaluatePolicy` permitir — tudo registrado em log, com backup `pg_dump -Fc` já gerado e verificado.

### 12 arquivos (+ 1 directório gerado)

| # | Caminho | Papel | Por que é o mínimo |
|---|---|---|---|
| 1 | `package.json` | docs/config | pins exatos; sem ele nada instala |
| 2 | `tsconfig.json` | docs/config | `target: es2023`, sem `baseUrl` (erro duro no TS 7) |
| 3 | `biome.json` | docs/config | a barreira de lint **precisa existir desde o commit 1**, senão o gate cresce sem rede |
| 4 | `.env.example` | docs/config | `DATA_ROOT` + limites |
| 5 | `.gitignore` | docs/config | impede commit de `auth/` |
| 6 | `drizzle.config.ts` | docs/config | `generate` → `.sql` |
| 7 | `src/config/env.ts` | domain/schema | `DATA_ROOT` resolvido |
| 8 | `src/infra/db/schema.ts` | domain/schema | **subconjunto mínimo:** `leads`, `conversations`, `messages`, `outbox`, `daily_counters`, `channel_accounts` (o resto das 12 tabelas entra no plan 01-01 completo) |
| 9 | `src/infra/db/client.ts` | infra | `openDb` + `migrate()` — **é o que faz o "one real DB read/write"** |
| 10 | `src/infra/logger.ts` | infra | pino + `redact` → `DATA_ROOT\logs\` |
| 11 | `src/index.ts` | bootstrap | boot: logger → env → db+migrate → canal → tick |
| 12 | `scripts/launch.cmd` | ops | **dev deployment**: `pg_isready` → `pg_ctl` → `node src/index.ts` |

**+ gerado:** `src/infra/db/migrations/0000_*.sql` + `meta/`.

### Extensão mínima do skeleton (o segundo passo, ainda antes dos 3 planos)

| # | Caminho | Papel |
|---|---|---|
| 13 | `src/domain/gate/types.ts` + `evaluate-policy.ts` | o gate puro (13 invariantes) |
| 14 | `src/domain/ports/ChannelPort.ts` | a fronteira |
| 15 | `src/infra/fake-channel.ts` | o canal falso — **sem ele nada é testável** |
| 16 | `src/application/dispatcher.ts` | o **único** importador de `ChannelPort` |
| 17 | `src/infra/db/queries/{snapshot,counters}.ts` | snapshot + cota |
| 18 | `scripts/notify.ps1` + `src/infra/notifier.ts` | a única superfície de UI do skeleton |
| 19 | `src/channel/baileys/{session,capabilities,adapter}.ts` | troca o `FakeChannel` pelo canal real |
| 20 | `tests/gate/{fixtures,ar-008,r-001}.test.ts` | 1 slice vertical de prova: o formato do property test fica travado cedo |

### O que **não** entra no skeleton

`src/channel/baileys/{jid-resolver,signals}.ts` (podem vir com o plano 01-02) · os 12 `guards/*.ts` completos (o `evaluate-policy.ts` roda com Guard 0 + AR-007 + AR-008 no skeleton; os outros 10 entram no 01-03) · `humanize.ts`, `outbox.ts`, `health-monitor.ts`, `lead-importer.ts`, `event-bus.ts`, `inbound-handler.ts` · `fake-lead-source.ts` · `docs/lgpd/*` · `tests/` além dos 3 arquivos de prova.

### Ordem de execução do skeleton

1. **P3 (Node 24) e P4 (decisão 17 vs 18) antes de tudo** — são pré-requisitos, não tasks.
2. `package.json` + `tsconfig.json` + `biome.json` + `.gitignore` + `.env.example` → `npm i --save-exact` e `npx biome check` verde.
3. `drizzle.config.ts` + `schema.ts` (subconjunto) + `client.ts` → `npx drizzle-kit generate --name=initial` → `migrate()` roda **2×** para provar idempotência.
4. `env.ts` + `logger.ts` + `index.ts` + `launch.cmd` → boot real, log real, banco migrado.
5. Gate (13–16) + `FakeChannel` → property tests verdes, **sem Baileys**.
6. `scripts/notify.ps1` → **smoke test na máquina do Admin** (Focus Assist, ExecutionPolicy, som, RDP).
7. `src/channel/baileys/*` → QR em `DATA_ROOT\logs\qr.txt` → parear o número real.
8. `scripts/backup.ps1` → `pg_dump -Fc` + `pg_restore` com **contagem de linhas conferida**.

---

## 9. Arquivos Sem Padrão Prescrito (usar judgment, não invenção)

| Situação | Arquivos | Orientação |
|---|---|---|
| **Sem código de produção verificado** | `src/application/event-bus.ts`, `src/domain/ports/{NotifyPort,ClockPort,LeadSourcePort}.ts`, `src/infra/health-monitor.ts`, `src/application/lead-importer.ts`, `src/infra/fake-lead-source.ts` | A **assinatura** de `ChannelPort` está verificada; as demais são inferidas de ARCHITECTURE §Componentes. Manter o porte mínimo: o `EventBus` é um `EventEmitter` tipado sem reentrega; o `NotifyPort` tem um método; o `LeadSourcePort` tem `list(filters)` + `import()`. **Não** construir abstração que a Fase 2/3 vai precisar reescrever. |
| **Bloco de schema ambíguo** | `daily_counters` (AR: `day,kind,count` vs `day,number_e164,sent,leads_contacted`) | RESEARCH §Padrão 2 e §Guardas de banco usam `(day, kind, count)` — **adotar essa** (mais simples, casa com `INSERT … ON CONFLICT (day, kind)`). A variante do ARCHITECTURE §Forma do Schema existe para o v2 multiusuário; **não** antecipar. Registrar a escolha. |
| **`pg-boss` opcional** | — | RESEARCH: **não instalar na Fase 1.** O `Outbox` + `FOR UPDATE SKIP LOCKED` dá durabilidade e singleton. Decidir `croner` vs `pg-boss` na **Fase 3** (pergunta aberta 5 do RESEARCH). |
| **Regra de lint do relógio** | `biome.json` | **Não verificada** no Biome 2.5.14. Forçar via `NowToken` + grep test, não via regra inventada. |
| **Documentos LGPD** | `docs/lgpd/*` | Pitfall 7 §"Como evitar" dá o conteúdo exato de cada um. Não são código — mas são **obrigatórios na Fase 1** e são a forma mais barata de fechar exposição já fiscalizada pela ANPD. |

---

## 10. Metadados

**Escopo de busca de análogos:** `src/`, `package.json`, `tsconfig.json`, `biome.json` — **nenhum existe** (greenfield verificado em 2026-09-28).
**Artefatos lidos:** `01-CONTEXT.md` (127 l.), `01-RESEARCH.md` (1090 l.), `.planning/research/ARCHITECTURE.md` (1049 l.), `.planning/research/PITFALLS.md`, `.planning/ROADMAP.md`, `.planning/STATE.md`, `docs/10-anti-requisitos.md` (887 l., seções AR-001/004/007 + §"Ordem de Avaliação no Gate"), `.ruler/skills/*/SKILL.md` (frontmatter), `main.py` (25 primeiras linhas), `opencode.json`, `.planning/config.json`.
**Cobertura:** 61 arquivos classificados · 0 com análogo de código · 61 com padrão prescrito · 5 pré-requisitos de execução (P1–P5) · 9 decisões de reconciliação (§6) · 18 padrões proibidos (§7).
**Data da extração:** 2026-09-28
**Válido até:** 2026-11-27 (stack estável), ou antes se `7.0.0-rc14` sair do RC, se o requisito de Postgres mudar, ou se a decisão de Node 24 for revista.

---

*Mapeado por: gsd-pattern-mapper · Fase 1 — Fundação, Canal e Gate de Envio · 2026-09-28*
