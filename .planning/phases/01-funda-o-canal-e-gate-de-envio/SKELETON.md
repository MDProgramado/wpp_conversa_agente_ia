# SKELETON — Fase 01: Fundar o Canal e o Gate de Envio

> Decisões de arquitetura registradas por este documento. Planes subsequentes (Fases 02+) constroem
> sobre estas decisões **sem renegociá-las**.

## 1. What This Establishes

O esqueleto prova o corte vertical mais fino possível, ponta a ponta, antes de qualquer Bot/IA:

> O Admin executa `scripts/launch.cmd` num duplo clique. O PostgreSQL local sobe **sem privilégio
> administrativo**, aplica as migrações `.sql` versionadas, grava e relê a linha da conta do número
> dedicado, monta o socket Baileys, emite o par de código **exatamente uma vez**, e um dispatcher
> envia um único texto de teste **apenas se `evaluatePolicy` devolver `action: 'send'`** — negando
> explicitamente quando `firstContactByHuman = false`. Tudo fica em log estruturado com PII redigida,
> numa raiz de dados fora do OneDrive.

**Contrato de conformidade do esqueleto:** o único caminho para o canal é `dispatcher.ts`, e ele chama
`evaluatePolicy` como última etapa antes de `ChannelPort.sendText()`. A negação é gravada em
`blocked_attempts`; a liberação grava `messages` + atualiza `daily_counters` na mesma transação. Não
existe caminho alternativo, atalho, `switch` de bypass ou worker que alcance `sendText()` sem passar
pelo gate.

### Por que o esqueleto é este e não outro

O grafo de decisões desta fase pende para o **pior** dos dois lados. O modo de falha perigoso não é
"a IA respondeu errado" — é **"o bot mandou algo que não devia"**. Um esqueleto que terminasse em
`message sent = true` quando o gate nega é pior do que não ter esqueleto. Por isso o esqueleto da
Fase 01 é centrado no **gate e na deque**, não no send-path feliz: o send-path feliz é o que vem
depois, quando já existe um negador testado.

| Componente | Decisão do esqueleto | Alternativa rejeitada |
|---|---|---|
| **Runtime** | Node.js 24 LTS. Ambiente atual está em `v22.14.0` → preflight `[BLOCKING]` antes de qualquer `npm install`. | Node 26 (Current, não-LTS); `npx`/runtime ephemeral. |
| **Linguagem** | TypeScript `7.0.2`, `target: "es2023"`, imports relativos, **sem `baseUrl`** (erro duro no TS 7). | `baseUrl`; `target: es5`; alias de paths. |
| **Banco** | PostgreSQL **18.3** local, schema `whatsapp_prospect`, Drizzle ORM `0.45.3` + `pg` `8.23.0`, `Pool` com `max: 5` e `application_name: 'whatsapp_prospect'`. `pg_dump` do **mesmo** major (18) — mismatch de major quebra o `pg_dump`. | `better-sqlite3` (exigência R-031 + incompatível com semântica de fila); Prisma `latest` (RC `8.0.0-rc.17`); `postgres.js` (driver duplicado). |
| **Canal** | `@whiskeysockets/baileys` **`7.0.0-rc14`**, `--save-exact`, sem `^`/`~`/`latest`. RC escolhido deliberadamente: a linha `6.7.x` é pré-tctoken e **não expõe `fetchNewChatMessageCap()`** nem o tratamento de erro **463**, sem os quais WHS-04 e LEAD-03 ficam sem implementação. | `6.7.24` (dist-tag `legacy`, sem cap/463); `whatsapp-web.js`/`venom-bot` (JS, Chromium, manutenção abandonada); `@wppconnect-team/wppconnect` (Chromium + **LGPL-3.0-or-later**, copyleft num produto comercial). |
| **Estado de sessão** | `auth_info_baileys/` no **`DATA_ROOT`** (`C:\whatsapp_prospecao\auth`). `.gitignore` **e** `.rulerignore`. A pasta **nunca** é commitada, nunca é logada, tem backup separado do banco. | `auth/` dentro do repo; `Session-baileys/` no OneDrive. |
| **Fila de envio** | Tabela `outbox` no próprio PostgreSQL, com `idempotency_key` UNIQUE e índice parcial `WHERE status = 'pending'`. Reserva com `FOR UPDATE SKIP LOCKED`. `pg-boss` fica **fora** da Fase 1 (chega na Fase 02, junto com a cadência). | `pg-boss` na Fase 1 (dependência sem consumidor); `node-cron` (in-memory, perde job ao fechar); BullMQ (exige Redis — 4º serviço, viola o escopo de 3 integrações). |
| **Orquestração de boot** | `scripts/launch.cmd` + registro no Agendador de Tarefas do Windows (`Run whether user is logged on or not`). **Nunca `net start` / `Start-Service`** — os serviços PostgreSQL estão em estado de manual e exigem elevação. | `pm2` (process-tree e log rotation não confiáveis no Windows); `net start` (quebra em contexto não-elevado). |
| **Qualidade** | Biome `2.5.14` como **barreira de lint** no commit 1: `noRestrictedImports` proibindo Chromium, BullMQ/Redis, Sentry, LangChain, `node-notifier`, `better-sqlite3` fora de `src/channel/**`. `rules.preset` (não `rules.recommended`, depreciado). | ESLint + typescript-eslint (depende da API do compilador TS, indisponível até o 7.1); `@typescript/typescript6` shim. |
| **Segredos / config** | `.env` **não** versionado, carregado por `dotenv` a partir de `DATA_ROOT`; `config.local.json` (ponteiros de webhook) também ignorado. `.env.example` versionado. | Segredos em `config.json` versionado (401/403 do Baileys com sessão vazia). |
| **Notificação** | `scripts/notify.ps1` de primeira parte (WinRT `ToastNotificationManager` + `AppUserModelID` registrado + som). `node-notifier` está **proibido** por lint: último push em 2024-06-24, sem `AppUserModelID`, escreve `.ps1` temporário. | `node-notifier`; Electron; `BurntToast` (módulo com passo de instalação). |
| **UI** | **Nenhuma.** Fase 01 não constrói painel web, React, Vite nem Fastify. A interação humana do esqueleto é o **toast do Windows** e, no `01-03`, a **leitura do QR** do par de código. | Painel web (Fase 04/05); Electron (2º Chromium, assinatura, falso positivo de AV). |

## 2. Data Layout

```
C:\whatsapp_prospecao\            ← DATA_ROOT (NUNCA dentro do OneDrive, NUNCA reponto)
├── auth\                         ← auth_info_baileys\  (a sessão É o número — backup separado)
│   └── creds.json
├── backups\                      ← pg_dump -Fc, carimbado com o major do servidor
│   └── 2026-09-28T14-05-11Z_pg18\
│       └── dump.dump
└── logs\                         ← pino app.log, pg.log, notifications.log, audit.log

<repo>/                           ← só código, docs e .sql versionados
├── .env                          ← NÃO versionado
├── .env.example                  ← versionado (8 chaves)
├── scripts\                      ← launch.cmd, notify.ps1, backup.ps1, pg-hba-apply.ps1
└── src\infra\db\migrations\      ← versionado (inclusive meta/)
```

**Invariante:** a árvore do repositório vive sob OneDrive. O `DATA_ROOT` não. Se `DATA_ROOT`
resolver para dentro de um caminho com atributo `ReparsePoint` (OneDrive), o boot **aborta** com
`DATA_ROOT_ON_ONEDRIVE` — uma pasta sincronizada do auth é o vetor de corrupção do
`useMultiFileAuthState`, e um `ReparsePoint` checkado custa zero.

## 3. Schema Tables (subsets)

| Tabela | Onde nasce | Papel |
|---|---|---|
| `channel_accounts` | `01-01` | Linha única: o número dedicado (WHS-05). `phone_e164` com CHECK de E.164. |
| `leads` | `01-01` | Lead com `phone_number` / `wa_jid` / `lid` **separados**; `opt_out` boolean; `first_contact_by_human`; origem + base legal (R-064). |
| `conversations` | `01-01` | Estado + `engagement_mode` + `last_processed_at` (watermark) + `handoff_active` + `reachout_timelock_until`. |
| `messages` | `01-01` | **Append-only** (trigger). `kind` CHECK `('text','link')` (CONV-11/AR-004). `idempotency_key` UNIQUE. |
| `outbox` | `01-01` | Fila durável de saída. `idempotency_key` UNIQUE. Índice parcial `WHERE status='pending'`. |
| `daily_counters` | `01-01` | PK `(day, kind)`, `kind ∈ ('sent','new_contacts')`, **CHECK `count <= 30`** = teto físico. 25 é o operacional, no `WHERE` do `ON CONFLICT`. |
| `app_users` | `01-01` | Linha única do Admin (EQUP-01) + colunas nullable multi-usuário (R-028). |
| `optout_ledger` | `01-01` | **Append-only**, irreversível, sem coluna "ativo" (COMP-03). |
| `handoff_events`, `mode_changes`, `blocked_attempts`, `status_history`, `event_log` | `01-01` | Trilha de auditoria append-only. |
| `scheduled_tasks`, `settings` | `01-01` | Cadência (consumida na Fase 02) + config. |

**Sem `ON DELETE CASCADE` em `leads`.** LEAD-04: nada é apagado. A eliminação é evento
(`optout_ledger` + `erasure_request`), não remoção de linha.

## 4. The Gate Contract

O gate é **função pura de decisão**: `evaluatePolicy(input) → Decision`. Ele **não** envia nada, não
consulta o banco e não tem efeito colateral. Quem detecta e quem bloqueia é o chamador; o gate só
julgou com o snapshot que recebeu. Ordem fixa e imutável (docs/10-anti-requisitos.md):

```
kill-switch → base legal (R-064) → opt-out (R-024/AR-006) → handoff (R-012/AR-005)
→ mídia recebida (R-038/AR-004) → preço/proposta (R-011/AR-001) → agendamento (R-025/AR-002)
→ mídia de saída (R-037/AR-004) → revelação de automação (R-057/AR-011) → janela (R-006/AR-010)
→ limite diário (R-023/AR-003) → Guard 0 R-001 → permitir
```

`Guard 0 / R-001` fica **fora** de AR-001..AR-012: `AR-001` é "negociar preço, valor, desconto"
(preço); `R-001` é "a primeira mensagem foi humana" (canal). São eixos ortogonais — um lead pode ter
comprado antes e ainda assim ser novo para o bot. Por isso `firstContactByHuman` é um campo do
snapshot, alimentado **exclusivamente** por evento Admin com `key.fromMe === true`, e nunca pela fila,
pela API REST nem por job.

Cada guarda é um módulo isolado com **exatamente um** `evaluate` exportado. Não há `arLogic`
monolítico: 12 arquivos de 20–60 linhas cada, com testes por arquivo.

## 5. Human Checkpoints

Três behaviours **não podem** ser automatizados porque dependem do hardware e do software da máquina do
Admin. Os planos marca cada um como `autonomous: false`:

1. **Toast do Windows** (`01-01` task 6) — depende de Focus Assist, ExecutionPolicy e saída de áudio
   da máquina real. Smoke test obrigatório.
2. **Pareamento QR do número dedicado** (`01-03` task 3) — exige o telefone físico na mão e produz um
   `auth_info_baileys` que **não pode** ser regenerado. Precisa de validação explícita de
   `emitOwnEvents` (A4), porque `key.fromMe` é a única origem autorizada para `firstContactByHuman`.
3. **Backup e restauração** (`01-05` task 3) — `pg_dump -Fc` seguido de `pg_restore` com contagem de
   linhas conferida. O valor do backup só é conhecido **depois** de executado, porque a tabela
   `messages` nasce vazia e ganha linhas ao longo do piloto.

## 6. Verification

```bash
node --version                                                   # deve ser v24.x.x, nunca v22.x
npx biome check .                                                # deve sair 0
npm test                                                         # deve sair 0
cmd //c scripts\\launch.cmd                                      # deve subir o stack inteiro
psql -d whatsapp_prospect -tAc "select count(*) from leads"      # leitura real
psql -d whatsapp_prospect -tAc "select count(*) from channel_accounts"  # deve ser 1
```

Pós-execução:

```bash
node node_modules/@whiskeysockets/baileys/lib/Utils/../../package.json > /dev/null  # sanidade
grep -rn "fetchNewChatMessageCap" node_modules/@whiskeysockets/baileys/lib/Types/*.d.ts
grep -rn "fetchAccountReachoutTimelock" node_modules/@whiskeysockets/baileys/lib/Types/*.d.ts
grep -n '"version"' node_modules/@whiskeysockets/baileys/package.json   # deve ser 7.0.0-rc14
```

O `fetchNewChatMessageCap` e o `fetchAccountReachoutTimelock` **tem de existir** nos typings do pacote
instalado. Se não existirem, o pin está errado e LEAD-03/WHS-04 não têm implementação — parar e
revisar o ADR-001.

## 7. Deferred

Fora do esqueleto, por escopo explícito da Fase 01:

- **Chamada a LLM / `Bot IA` / `AI suggest`** — Fase 02. A `LlmPort` não é criada aqui; o `dispatcher`
  recebe texto de teste, não de modelo.
- **`Detecção Automática de Opt-out`, cadência e follow-up** — Fase 02. `scheduled_tasks` é criada
  vazia; nada popula.
- **Painel web / CRM / Fastify / React** — Fase 04/05. A Fase 01 não tem servidor HTTP exceto a ponte
  opcional de `LeadSourcePort`.
- **Feriados brasileiros** — decisão do usuário: não é Natal. Janela é **dias úteis, 7h–17h, sem
  calendário de feriados**.
- **Tokenedor de sessão expira → reconexão silenciosa** — Fase 02.

## 8. Established Here — Referenced From

- `01-02-PLAN.md` consome: as 6 tabelas, `client.ts`, `migrationsFolder`, padrão de `.env`.
- `01-03-PLAN.md` consome: `ChannelPort`, `schema.ts` (`leads`, `conversations`), `migrationsFolder`,
  o fato de que `src/channel/` é o único lugar que importa Baileys, e o pin exato `7.0.0-rc14`.
- `01-04-PLAN.md` consome: `evaluate-policy.ts`, `types.ts`, `dispatcher.ts`, `outbox`, o mapa de
  `biome.json`, e as 13 tabelas com os triggers de append-only e de irreversibilidade de `opt_out`.
- `01-05-PLAN.md` consome: `scripts/notify.ps1`, `outbox`, `dispatcher.ts`, `daily_counters`,
  `channel_accounts`, o `GUARD_ORDER` de 13 invariantes e o tratamento de 463 sem retry.

Fases futuras citam este arquivo, não os resumos de plano, para decisões arquiteturais.
