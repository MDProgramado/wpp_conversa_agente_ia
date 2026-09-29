# AGENTS.md — Automação Local de WhatsApp

## Visão do Projeto
Sistema local de automação de conversas no WhatsApp para prospecção B2B e venda de serviços digitais (sites, sistemas, automações). O usuário envia a primeira mensagem manualmente; o bot assume a partir daí, conduz a conversa com IA externa (API), faz follow-up e aciona handoff humano em momentos críticos.

## Stack
- **Linguagem:** Node.js + TypeScript (preferencial) ou Python
- **Canal WhatsApp:** conexão não oficial inicial (Baileys/WPPConnect), com migração futura para API oficial
- **Banco:** PostgreSQL local
- **IA:** API externa de LLM (OpenAI, Gemini, Claude etc.)
- **Notificações:** locais (som + pop-up no Windows)
- **SO:** Windows

## Estrutura de Pastas
- `src/` — código-fonte
- `docs/` — especificação, requisitos, ADRs, anti-requisitos
- `.ruler/` — skills e personas (fonte de verdade)
- `.opencode/skills/` — skills distribuidas pelo Ruler
- `.planning/` — artefatos do GSD

## Regras Não Negociáveis
1. **NUNCA** negociar preço, proposta, orçamento ou condições comerciais. Gatilho: handoff imediato (R-012).
2. **NUNCA** agendar reunião sozinho. Apenas notificar o usuário (R-025).
3. **NUNCA** enviar mídia (imagem, PDF, áudio, vídeo). Apenas texto e links (R-037).
4. **NUNCA** contornar opt-out. Pedido de opt-out = bloqueio permanente (R-024).
5. **NUNCA** se identificar como IA/bot espontaneamente. Se o lead perguntar, silêncio total + handoff (R-057).
6. **NUNCA** responder fora da janela permitida (dias úteis, 7h–17h) (R-058).
7. **NUNCA** ultrapassar 20–30 mensagens/dia no número dedicado (R-023).
8. **NUNCA** processar mídia recebida. Apenas registrar e acionar handoff (R-038).
9. **NUNCA** enviar mensagem após handoff acionado, até o usuário assumir (R-066).
10. **SEMPRE** registrar origem do lead, base legal e finalidade (LGPD, R-064).

## Comandos
- `npm run dev` — desenvolvimento
- `npm run build` — build
- `npm test` — testes
- `npx ruler apply` — distribuir skills
- `npx get-shit-done-cc@latest --opencode --global` — instalar GSD

## Referências
- `docs/10-anti-requisitos.md` — comportamentos proibidos
- `docs/01-requisitos-funcionais.md` — R-001 a R-067
- `.ruler/skills/` — skills especializadas

<!-- GSD:project-start source:PROJECT.md -->
## Project

**Automação Local de WhatsApp para Prospecção B2B**

Sistema local (Windows) de automação de conversas no WhatsApp para prospecção B2B e venda de serviços digitais (sites, sistemas, automações, tudo que envolva programação). O fluxo é: o Admin envia a primeira mensagem manualmente ao lead → o sistema assume a conversa → uma API externa de LLM conduz a conversa de forma consultiva e humanizada → follow-ups programados disparam enquanto não há resposta → e nos momentos críticos (preço, agendamento, opt-out, irritação, dúvida complexa) o sistema faz handoff humano com notificação local e entra em silêncio total. O MVP é operado por uma única pessoa (o Admin) em um único número dedicado, com dados em PostgreSQL local.

**Core Value:** Quando o bot assume uma conversa, ele conduz com naturalidade suficiente para gerar reuniões agendadas sem nunca cruzar uma fronteira proibida (negociar preço, agendar sozinho, enviar mídia, contornar opt-out, revelar automação) — e para no instante exato em que o humano precisa assumir.

### Constraints

- **Anti-requisitos são invariantes absolutas**: os 12 anti-requisitos (AR-001 a AR-012) não podem ser relaxados, contornados nem "exceptions" de implementação. Falha de regra de segurança é falha do sistema, não motivo para negociar exceção.
- **Stack**: Node.js + TypeScript preferencial, ou Python — decisão adiada para a primeira fase de planejamento
- **Canal WhatsApp**: começar não oficial (Baileys/WPPConnect) com camada de conexão isolada em interface/adaptador; migração para API oficial é uma fase futura
- **SO**: Windows obrigatório (notificações nativas, PostgreSQL local, sessão WhatsApp)
- **Banco**: PostgreSQL local apenas, sem servidor externo
- **Integrações**: só 3 — API do caça-leads, API de LLM, WhatsApp local. Nenhuma outra nesta etapa
- **Volume**: 20 leads/dia e 20–30 mensagens/dia no número dedicado (trava dura, com fila para o próximo dia útil)
- **Janela operacional**: dias úteis, 7h–17h
- **Número**: exatamente um, dedicado a vendas
- **LGPD**: leads não têm opt-in explícito; base legal é legítimo interesse com registro de origem, finalidade e opt-out imediato
- **Segurança**: sem criptografia adicional nesta fase — risco aceito e documentado (R-033)
- **Idioma**: português do Brasil para toda a interface, prompts de IA e documentação
- **Objetivo do piloto**: 5 reuniões agendadas/mês e 30% de taxa de qualificação/mês, apurados mensalmente (R-061, R-062)
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->

> ## ⚠️ NOTA DE PIN — DECISÃO DO PROJETO (2026-09-28) — PREVALECE SOBRE TUDO ABAIXO
>
> **O pin exato do canal é `@whiskeysockets/baileys@7.0.0-rc14`, instalado com `--save-exact`.**
> A linha `6.7.x` é **pré-tctoken** e **não** expõe `fetchNewChatMessageCap()`,
> `fetchAccountReachoutTimelock()` nem o tratamento do erro 463 — sem essas três coisas, WHS-04
> (travas duras de cota e o 463 jamais retryado) e LEAD-03 (estado terminal `NUMERO_INVALIDO`)
> ficam **sem implementação**. Este é o motivo técnico; ver `docs/adr/001-pin-baileys-rc14.md`
> (ADR-001, imutável, com plano de rollback) e `01-PATTERNS.md` §2.1 (P2).
>
> Todo o material desta seção que ainda recomendar a linha `6.7.x`, tratar o RC pinado como
> "instável demais para um número insubstituível" ou dizer para instalar `latest` em vez do pin
> exato — está **desatualizado e não deve ser seguido**. A versão pinada **é** um RC; a linha que
> **não** deve ser usada é a `6.7.x`.

## Technology Stack

## Executive Summary
## Recommended Stack
### Core Technologies
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Node.js** | **24.21.0 (LTS "Krypton")** | Runtime | Current is v26.10.0 (not LTS). Node 24 is the active LTS line and satisfies `ai@7`'s `engines: node >=22`. LTS matters here: Baileys is an unofficial protocol client and you want OS/runtime stability over bleeding-edge. **Do not use Node 26** — it is Current, not LTS, and a long-running always-on bot should not ride the cutting edge. |
| **TypeScript** | **7.0.2** (GA 2026-07-08) | Language | Go-native compiler, ~8-12x faster type-check, and now the npm `latest`. Safe for this project specifically because the codebase is pure `.ts`/`.tsx` with no Volar-ecosystem dependency (no Vue/Svelte/Astro/MDX). **This is a greenfield project, so the TS 6→7 migration tax is zero** — you adopt the final state on day one instead of inheriting debt. `typescript@7.0.2` ships the `tsc` binary directly; `tsgo` is gone. |
| **@whiskeysockets/baileys** | **7.0.0-rc14 — PIN EXACTLY** | WhatsApp multi-device WebSocket client | Pure TypeScript, no browser, ~50 MB RAM (vs 200-500 MB for Chromium), MIT license (vs WPPConnect's LGPL), 11.2k stars, repo pushed 2026-09-27. Windows-friendly: no Chromium to fight antivirus heuristics over. See §Version Pinning. **Confidence HIGH on library choice; HIGH on version-line choice (project decision — see the PIN note above and ADR-001).** |
| **PostgreSQL** | **17.x local** (or 18.x if already installed) | Persistence | Mandated by R-031. 17 is the mature stable line with the widest tooling compatibility. **Critical:** use the `pg_dump` binary from the *same* installation as the server, or `pg_dump` will fail on a major-version mismatch. |
| **drizzle-orm** + **drizzle-kit** | **0.45.3** / **0.31.11** | Typed SQL ORM + migrations | `latest` is a genuine stable release (unlike Prisma's). Type-safe schema that shares types with the UI and the LLM schemas. No query-engine binary (Prisma ships Rust engines that historically misbehave on Windows + OneDrive/sync folders). Migration story is plain `.sql` files — reviewable, auditable, and it satisfies R-031's "script/migração de schema". |
| **pg** | **8.23.0** | PostgreSQL driver | Drizzle's first-class `pg` peer (`pg: '>=8'`), and `pg-boss@12.35.0` depends on `pg ^8.23.0` — exact version alignment, no dedupe friction. |
| **ai** (Vercel AI SDK) | **7.0.118** | LLM provider abstraction + structured output | One interface across OpenAI/Anthropic/Google (R-009 names all three as options), plus `Output.object({ schema })` with Zod. **That structured-output primitive is the guardrail mechanism** — it converts the LLM from a text generator into a typed decision function. Requires `zod ^3.25.76 || ^4.1.8`. |
| **zod** | **4.6.5** | Runtime schema validation | Single validation layer for LLM output, HTTP boundaries, config, and DB row shapes. Required peer of the AI SDK. |
| **Fastify** | **5.12.5** | Local HTTP server (API + static SPA) | Serves the control panel and the REST API from one process on `127.0.0.1`. Fastify's JSON-Schema-first validation and `@fastify/static` remove the need for a separate static server. Powers the 127.0.0.1-bound prerequisite for secure-context Web Notifications. |
| **pg-boss** | **12.35.0** | Durable job queue on PostgreSQL | See §Job Scheduling. Durable across restarts (essential for R-007), singleton job execution (prevents double-sends — a ban risk), retry with backoff, and **zero new infrastructure** since the database already exists. Actively maintained (published 2026-09-26). |
| **pino** (+ **pino-pretty** dev) | **10.3.1** / **13.1.3** | Structured logging | Fastest JSON logger for Node, native TS types, `pino-roll` for rotation. Emits one line per event with the timestamp/severity/module/context fields R-045 demands. |
| **node-notifier** → **REJECTED** | — | — | See §Notifications. Last GitHub push **2024-06-24**, 129 open issues. Replaced by a first-party PowerShell + WinRT script. |
### Supporting Libraries
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **p-queue** | **9.3.3** | In-process concurrency limiter | Always. Wraps *every* outbound send to enforce R-067 humanization (randomized delays, typing simulation, long-message splitting) and to guarantee strictly serial per-lead delivery. This is the ban-rate safety valve. |
| **croner** | **10.0.1** | Cron expressions, zero dependencies | The in-process *tick* that wakes the poller and re-evaluates the 7h-17h window (R-006) and daily quota (R-023). Dependency-free and actively maintained (2026-08-31). |
| **React** | **19.3.0** | Control panel UI (R-046) | Lead list + chat + AI suggestions + history + action buttons, side by side. |
| **Vite** | **8.3.1** | Frontend build + dev server | Fast HMR, Rolldown-based. Vite type-checks through `tsc` with **no compiler-API dependency**, so it works with TypeScript 7 unchanged. |
| **Tailwind CSS** | **4.3.3** | Styling | Rapid iteration on a dense 4-pane layout without a component library dependency. |
| **@biomejs/biome** | **2.5.14** | Lint + format | **Deliberate choice over ESLint + typescript-eslint.** `typescript-eslint` calls the TypeScript compiler API, which TS 7 does not expose until 7.1 — it would force the awkward `@typescript/typescript6` alias shim. Biome is a single Rust binary with no TS API dependency, and it also formats. |
| **zod-to-json-schema** | **3.25.2** | Zod → JSON Schema | Only if you need to surface a schema to a non-AI-SDK consumer. The AI SDK converts Zod schemas natively, so you may not need it. |
| **dotenv** / native `.env` | — | Config | Use Node 22+'s built-in `--env-file` flag instead of a dependency where possible. |
| **pg** (types) | **@types/pg 8.23.1** | TS types for the driver | Keep in lockstep with `pg` itself. |
### Development Tools
| Tool | Purpose | Notes |
|------|---------|-------|
| **Vitest** | **5.0.2** | Unit + integration tests. Vite-native, so config is shared with the frontend. Prioritize tests on the **guard/gate layer** — that is where AR-001…AR-012 are enforced and where a regression is a compliance incident, not a bug. |
| **tsx** | **4.23.15** | Run TS directly in dev. `drizzle-kit` already depends on `tsx ^4.21`. |
| **Playwright** | **1.63.0** | E2E for the control panel. Optional; reserve for the phase that builds R-046 in full. |
| **Windows Task Scheduler** | Process supervision | **Do not use `pm2` on Windows** — its process-tree handling and log rotation are unreliable there. Register a task that runs on user logon and invokes a launcher `.cmd` that (a) checks PostgreSQL is up, (b) applies pending migrations, (c) starts the app. |
| **PowerShell + `pg_dump`** | Backup (R-032) | `pg_dump -Fc` to a timestamped folder, invoked by a manual script. `-Fc` (custom format) is compressed and restorable with `pg_restore`. Version-stamp the backup folder name with the server major version. |
## Installation
# --- Core runtime ---
# --- WhatsApp adapter (PIN EXACTLY — no caret, no tilde) ---
# --- Database ---
# --- LLM ---
# --- Server, queue, logging ---
# --- Dev toolchain ---
# NOTHING that shells out to a browser
# npm install puppeteer        # NO
# npm install whatsapp-web.js  # NO
# npm install venom-bot        # NO
# npm install @wppconnect-team/wppconnect  # NO (LGPL + Chromium)
# NOTHING that adds an infrastructure service
# npm install bullmq ioredis   # NO — BullMQ requires Redis (see §Alternatives)
# NOTHING that phones home
# npm install @sentry/node     # NO — violates local-only
## Version Pinning Strategy
| Package | `latest` tag | Stable line | What you install |
|---------|--------------|-------------|------------------|
| `@whiskeysockets/baileys` | `7.0.0-rc14` (RC) | `6.7.x` (dist-tag `legacy`, **NÃO usar**) | **`7.0.0-rc14`, `--save-exact`** |
| `prisma` | `8.0.0-rc.17` (RC) | `7.10.0` (dist-tag `prev`) | *not used — Drizzle instead* |
| `typescript` | `7.0.2` (GA) | `7.0.2` | `7.0.2`, `--save-exact` |
| `drizzle-orm` | `0.45.3` (stable) | `0.45.3` | `0.45.3` |
| `ai` | `7.0.118` (stable) | `7.0.118` | `7.0.118` |
## WhatsApp Layer: Baileys vs WPPConnect
### Maintenance reality (verified 2026-09-28 via GitHub API + npm registry)
| | Baileys | WPPConnect | whatsapp-web.js | Venom |
|---|---|---|---|---|
| Package | `@whiskeysockets/baileys` | `@wppconnect-team/wppconnect` | `whatsapp-web.js` | `venom-bot` |
| Architecture | WebSocket multi-device, **no browser** | Puppeteer + Chromium | Puppeteer + Chromium | Puppeteer + Chromium |
| Language | **TypeScript** | TypeScript | JavaScript | TypeScript |
| License | **MIT** | **LGPL-3.0-or-later** | Apache-2.0 | MIT |
| Stars | 11.2k | 3.5k | 22k | ~7k |
| Last npm publish | 2026-07-29 | (`@wppconnect/wa-js` 2026-08-14) | 2026-07-08 | **2024-11-23** |
| Last repo push | 2026-09-27 | **2026-09-28** | active | stale |
| RAM footprint | **~50 MB** | 200-500 MB (Chromium) | 200-500 MB | 200-500 MB |
| Built-in REST server | No | Yes (`wppconnect-server`) | No | No |
### Why Baileys wins for *this* project
### The honesty check: does Baileys reduce ban risk?
- **Behavior-based:** bans are driven by volume, frequency, reply ratio, report rate, and contact-graph distance (Wapisimo, 2026-03).
- **Protocol-fingerprint-based:** "Meta maintains a fingerprint database of known unofficial clients… this runs before any message is sent" and "random delays do not prevent bans because they only address Layer 3 signals" (Kraya, 2026-07). This source also claims typical lifespan of 2-8 weeks.
- R-023 (20-30 msgs/day hard cap) and R-006 (7h-17h weekday window) are not conservative settings to be relaxed. They are the primary control.
- R-001 (human sends the first contact) is the single highest-value ban mitigation available: a human-initiated conversation is the strongest legitimacy signal in the system.
- **R-007 is the sharpest edge.** Firing *every* overdue follow-up the moment the app opens is a burst of machine-cadence traffic to cold leads — precisely the pattern that gets flagged. **Recommend a bounded, rate-limited drain** (e.g. max N per boot with jittered spacing), and treat this as a research item, not an implementation detail.
- **R-059's risk rating (ALTO, "sem redundância") is correctly stated and should be treated as the project's dominant operational risk.** Plan for the number being lost: export the CRM to CSV continuously so a ban costs you the channel, not the pipeline.
### Version choice: `7.0.0-rc14` (pin do projeto) vs `6.7.x` (pré-tctoken) — and the LID trap
| | v6.7 | v7.0 |
|---|---|---|
| `Contact.id` | always a phone-number JID (`@s.whatsapp.net`) | **either LID or JID (preferred)** |
| New fields | — | `lid?`, `phoneNumber?` |
| `makeSignalRepository` returns | `SignalRepository` | `SignalRepositoryWithLIDStore` (adds `lidMapping`) |
| Session migration PN→LID | no | **automatic on connect** |
- Store `phone_number` (E.164, your business key), `wa_jid` (the raw `remoteJid`), and `lid` as **separate nullable columns** on `leads` and `conversations`.
- Never use `remoteJid` as a primary key or as a foreign key target.
- Add a `JidResolver` in the adapter that maps LID↔PN via Baileys' `lidMapping` store / `onWhatsApp()`, and log an explicit `jid_unresolved` event when it cannot.
- **Confidence: HIGH** that LID must be handled. **HIGH** that `7.0.0-rc14` is the right pin: the `6.7.x` line is pre-tctoken and exposes neither `fetchNewChatMessageCap()` nor `fetchAccountReachoutTimelock()` nor the 463 path, so WHS-04 and LEAD-03 would have no implementation (project decision, ADR-001). Revisit when 7.0.0 goes stable; the adapter design means the upgrade is contained.
## Node.js + TypeScript Scaffolding, and Why Not Python
| Factor | Node.js + TS | Python |
|---|---|---|
| WhatsApp layer | Baileys is TypeScript-only | Would need a subprocess/FFI bridge to reach Baileys, or `whatsmeow` (Go) via a second bridge process |
| LLM layer | Vercel AI SDK is TS-first; `Output.object()` structured output is native | LangChain/LlamaIndex add a large dep surface and their own competing state model |
| End-to-end types | Drizzle schema → API → React props, one type system | Pydantic/SQLAlchemy typing stops at the boundary; frontend is still TS |
| Control panel | One language, one toolchain, one `node_modules` | Two runtimes, two venv/node_modules, two sets of Windows path bugs |
| Requirement fit | Satisfies all of R-044 with zero extra runtimes | Adds a runtime no requirement asks for |
- Greenfield ⇒ adopt 7.0.2 now; there is no 5.x→6.x→7.x migration sequence to pay.
- Hard errors in TS 7: `baseUrl` and `target: es5`. Neither applies here — use relative imports and `target: es2023`.
- If you later need `typescript-eslint`, install `@typescript/typescript6` and use the npm-alias layout (`"@typescript/native": "npm:typescript@^7.0.2"`, `"typescript": "npm:@typescript/typescript6@^6.0.2"`). **Better: don't — use Biome and avoid the problem.**
## LLM Integration: The Control/Model Boundary
### Why flow control, limits, and handoff live in the application, not the prompt
### The pattern: LLM as a bounded, stateless decision function
- **Fail closed, always.** A Zod parse failure, a provider timeout, or a malformed response must produce *silence + local notification*, never a fallback free-text send. LLM failure must never become an unsanitized message to a lead.
- **The LLM carries no state.** Conversation memory is reconstructed from the `messages` table every call. This keeps the LLM swappable and makes the audit trail complete.
- **Keyword-only detection is not enough, keyword-only detection is not enough, but keyword detection must exist as a backstop.** The LLM is the primary detector for intent; a deterministic Portuguese keyword/regex list is the *secondary* net. If either fires, handoff. Additive detectors, never OR-negated.
- **Post-generation regex scan is mandatory.** Even with a clean `intent`, `replyText` can contain "R$ 3.500" or "50% de desconto". A currency/percentage/promo-term regex over the output is the cheapest possible AR-001/AR-042 enforcement and costs nothing.
### Guardrail layers (defense in depth)
| Layer | Mechanism | Enforces |
|---|---|---|
| L1 — Prompt | System prompt states the persona and prohibitions | Quality only. **Not a control.** |
| L2 — Typed output | `Output.object({ schema })` + Zod | Shape; impossible to send a free-form blob |
| L3 — Intent pre-gate | Deterministic intent → handoff mapping | R-012, R-056, R-065, AR-001, AR-003 |
| L4 — Content post-gate | Currency/percentage/promo/media regex over `replyText` | AR-001, AR-004, R-042 |
| L5 — Send gate | Window + daily quota + opt-out + handoff-state re-check | R-006, R-023, R-024, R-066 |
| L6 — Channel adapter | Rejects non-text payloads at the adapter boundary | R-037, AR-004 |
### Provider & model selection
| Task | Tier | Notes |
|---|---|---|
| Intent detection / handoff-trigger classification | cheap fast model | Runs on *every* inbound message; must be fast and cheap |
| Reply generation + status suggestion | stronger model | Runs less often; quality matters for the consultative tone |
| Copilot suggestions (R-014) | strongest model | Human reviews it; latency is acceptable |
## PostgreSQL Connection Layer
| Option | Verdict | Why |
|---|---|---|
| **Drizzle + pg** | ✅ **Use this** | Stable `latest`. Thin — it *is* SQL with types. Plain `.sql` migrations are reviewable and auditable. No query-engine binary. End-to-end types into the API and the React panel. First-class `pg` peer. |
| **Prisma 7.10.0** | ⚠️ Viable, not recommended | Works, but `prisma@latest` is `8.0.0-rc.17` — you must consciously pin `7.10.0`. Prisma ships Rust query engines that have historically had Windows + synced-folder (OneDrive) path and AV problems, and this project lives in a OneDrive directory. Its schema DSL also resists the `jsonb`/partial-index shapes a message-audit table wants. |
| **Raw `pg` + Kysely** | ⚠️ Also good | Kysely 0.29.6 is active and is a *pure* query builder (no ORM layer). If you want maximum SQL control and already know Kysely, this is a legitimate choice. It lacks Drizzle's migration CLI ergonomics. |
| **Raw `pg` alone** | ⚠️ For the adapter layer only | Use `pg` directly for the one thing where you want no abstraction: `pg-boss`'s own connection, and for `pg_dump` backup scripts. Everywhere else, Drizzle. |
| **`better-sqlite3` 13.0.3** | ❌ **Reject for the app** | Technically excellent and would have been the right call (single file, trivial backup, zero service) — **but R-031 explicitly mandates PostgreSQL local.** It is also the wrong choice for a reason beyond the requirement: `pg-boss` needs PostgreSQL, and SQLite cannot be shared by multiple processes without WAL locking pain. Do not use it even for a cache/queue. |
| **`postgres` (postgres.js) 3.4.9** | ❌ Reject | Fine library, but `pg-boss` depends on `pg ^8.23.0`. Mixing two drivers means two connection pools against one local Postgres for no benefit. |
- Single `pg.Pool` with `max: 5`. This is a single-user local app; a large pool is pure overhead.
- Connect over **TCP to `127.0.0.1`, not a Unix socket** (not available on Windows) and not a named pipe unless you have a specific reason.
- **Set `application_name: 'whatsapp_prospect'`** so `pg_stat_activity` is readable when the panel shows "PostgreSQL parado" (R-045).
- Run `drizzle-kit generate` to produce `.sql` files, then `migrate()` from the app on boot **before** anything else. This satisfies R-031 and makes the Task Scheduler launcher a single command.
- **Set `synchronous_commit` / keep a nightly `pg_dump -Fc`** for R-032.
- `messages` must be **append-only** (R-043 "histórico imutável"): no UPDATE/DELETE grants, plus a trigger that raises on mutation.
- `leads` needs a **partial unique index** for the daily quota (R-023): a `UNIQUE (lead_id, contact_date)` on the message table, or a `daily_counters` table keyed `(date, type)` with a `CHECK (count <= 30)`.
- `opt_out` (R-024) should be a **boolean column with a `CHECK` that no code path can unset**, not a status enum value that could be overwritten.
- `handoff_events` (R-012/R-065) should be a **separate table, not a column**, so the audit trail (R-022) is append-only and queryable.
- Tag R-028 (`responsible_user_id`, `created_by`) columns now even under R-027 (single user) — backfilling is a migration, adding later is also a migration, but adding now costs one nullable column.
## Windows Local UI
| Option | Verdict | Why |
|---|---|---|
| **Localhost web app (Fastify + React)** | ✅ **Use this** | Zero extra runtime. The browser is already installed and already has the right rendering, layout, scrolling, and input behavior. F5 refreshes. `127.0.0.1` is a **secure context**, so the Web Notifications API and clipboard work. R-032 backup is unaffected. Updating the UI is a page refresh, not an installer. |
| **Electron 44.4.5** | ⏳ Defer to a later phase | Works, but costs: a second Chromium (~200 MB RAM), `electron-builder` signing + installer on Windows, AV false positives on an unsigned binary, and a webview that duplicates what a browser tab already does. **The validated pattern is a thin wrapper**: serve the SPA from the same Node process, then add Electron later as a `BrowserWindow` pointing at `127.0.0.1:<port>` with no changes to the UI code. Keep `package.json` ready for it; do not build it now. |
| **TUI (Ink 7.1.1 / Textual)** | ❌ Reject for the panel | A TUI is a poor fit for four simultaneous rich panes with a scrolling message log, selectable message history, and inline "AI suggestion → edit → send" affordances. You'd hand-build layout primitives, lose copy/paste and text selection reliability, and spend longer than the web version. Ink *is* worth using for a **CLI control surface** (`npm run status`, `npm run leads`) — that is a different tool. |
| **Tauri 2** | ⏳ Possible later | Best resource profile if a desktop shell is ever required (~100-140 MB, uses the OS WebView). But it means a Rust toolchain on Windows — a new build dependency for a single-user pilot. Revisit only if R-047 ever demands a true standalone `.exe`. |
- Bind to **`127.0.0.1`, never `0.0.0.0`**. R-033 accepts "no encryption," but that is a statement about *data at rest*; binding to all interfaces would expose the whole lead database (LGPD) to the LAN. This is a free control — take it.
- Put a token in the URL/localStorage and check it on every request. Single user, but this stops a drive-by page or a browser extension from reading the CRM.
- Ship the built SPA as static assets from Fastify via `@fastify/static` — one process, one port, no CORS.
## Windows Notifications
- **Last GitHub push: 2024-06-24.** Over two years stale, 129 open issues.
- On Windows it does not call WinRT at all — it writes a `.ps1` to a temp file and spawns PowerShell, inheriting all of PowerShell's notification quirks and adding a temp-file lifecycle.
- It predates the Windows 10 1709+ requirement that toasts carry a registered **AppUserModelID**. Without one, the toast shows a generic app name or is silently dropped.
- 10.0.1's release was a maintenance bump, not a rewrite.
# notify.ps1 — params: -Title, -Message, -Sound, -Urgent
# sound: [System.Media.SystemSounds]::Exclamation.Play()  — or a bundled .wav via System.Media.SoundPlayer
## Job Scheduling & Queues
| Option | Verdict | Why |
|---|---|---|
| **pg-boss** | ✅ **Use this** | Durability is the whole point: a job scheduled for tomorrow survives a crash, a reboot, and a PC being off overnight. Provides **singleton execution** — a given job runs on one worker, which directly prevents the double-send pattern that gets numbers flagged. Retry with backoff, priority queues, and `singletonSeconds` for job coalescing. **Uses the PostgreSQL you already have — zero new infrastructure.** Actively maintained (published 2026-09-26); depends on `pg ^8.23.0`, exactly matching your driver. |
| **node-cron** 4.6.0 | ⚠️ Tick only | Purely in-memory: every job dies with the process, and it has no notion of "this job was due at 03:00 and the app was closed." Its catch-up semantics are wrong for this domain. **Use `croner` instead** (zero dependencies, actively maintained, timezone-aware) for the small number of periodic ticks you actually need. |
| **BullMQ** 6.3.9 | ❌ **Reject** | `peerDependencies` are `pg >=8.0.0` **AND `redis >=5.0.0` AND `ioredis >=5.0.0`**. It requires running a Redis server. R-044 caps integrations at three and the project is local-only; adding a Redis daemon is a fourth service to install, secure, back up, and keep alive — to solve a problem pg-boss solves with the database you are already running. |
| **`@temporalio/worker` 1.24.0** | ❌ Reject | Correct tool for distributed, long-running, exactly-once workflows. Enormous operational surface (history DB, workers, namespaces, task queues). For a 20-30 msg/day single-user pilot it is pure overhead. |
| **In-app scheduler / hand-rolled table poller** | ⚠️ Acceptable floor | A `scheduled_jobs` table polled every 30s is a legitimate MVP simplification and needs no extra dependency. But you must hand-roll locking (`SELECT ... FOR UPDATE SKIP LOCKED`), retry, and singleton semantics. **If you take this route, do it only for the first phase** and migrate to pg-boss before the daily-limit and handoff paths get complex. |
| **graphile-worker / pg-boss** | ✅ pg-boss | Both are Postgres-native. pg-boss has the richer feature set (singleton, priority, cron, throttling) and better current activity. |
## Logging & Error Monitoring
| Option | Verdict | Why |
|---|---|---|
| **pino + rotation** | ✅ **Use this** | Fastest JSON logger in Node, native TS, `pino-roll` for size/date rotation, and its `child()` scoping maps directly onto the R-045 fields (timestamp, severity, module, message, context). |
| **winston** 3.19.0 | ⚠️ Acceptable | Works, but slower, more configurable in ways you don't need, and its ecosystem has fragmented over the years. No reason to prefer it over pino here. |
| **`system_events` table + UI panel** | ✅ **Use this** for the error panel | R-045 asks for a "painel de erros." Building it as a first-class table (not a log-file tail) means errors are queryable, filterable, dismissible, and survive log rotation. This is the same UI you already build for R-046. |
| **Sentry / any cloud APM** | ❌ **Reject** | Violates "local only, no cloud." It would also ship lead conversation content to a third party — a direct LGPD problem under R-064. There is no self-hosted variant worth the operational cost here. |
| **`electron-log`** 5.4.4 | ❌ Reject | Only relevant if you adopt Electron. You're not, in the MVP. |
- **Never log message bodies at `info` level.** Log `message_id`, `lead_id`, `direction`, `char_count`, and a hash. Full bodies belong in the `messages` table, which is the auditable record R-043 requires and which you control.
- **Never log LLM request/response payloads wholesale.** Log `model`, `prompt_tokens`, `completion_tokens`, `latency_ms`, `zod_parse_ok`, and the *decision fields* — not the transcript. Prompt logging is how LGPD leaks happen.
- **Redact at the logger, not at the call site.** A pino `redact` config for `['req.headers.authorization', '*.phone', '*.body']` makes the safe path the default path. A developer who forgets to redact cannot leak, because the logger already did it for them.
- **Never log the Baileys auth folder.** Add `auth_info_baileys/` to `.gitignore` and to the log-rotation exclusion list. Losing that folder means WhatsApp sees a "new device," which is itself a ban signal.
| Failure | Detection |
|---|---|
| WhatsApp disconnected | Baileys `connection.update` → `connection: 'close'` (note `DisconnectReason.loggedOut` = terminal, notify loudly) |
| LLM API down | non-2xx / timeout / Zod parse failure after retry |
| PostgreSQL stopped | pool `'error'` event + a 2s connectivity probe on the cron tick |
| Banned | `DisconnectReason.forbidden` / `401` / `403` on the socket, or send failures clustering |
## Alternatives Considered
| Recommended | Alternative | When to Use the Alternative |
|---|---|---|
| Baileys 7.0.0-rc14 | **Baileys 6.7.x** (dist-tag `legacy`) | Only as a last resort, on total channel incapability — and then LEAD-03/WHS-04 **must** be revalidated, because that line is pre-tctoken and has no `fetchNewChatMessageCap`/`fetchAccountReachoutTimelock`/463 path. Rollback plan in ADR-001. |
| Baileys 7.0.0-rc14 | **WPPConnect** (`@wppconnect-team/wppconnect`) | When you need its built-in REST server and multi-session manager — i.e. R-048 multiplies into many numbers and you want language-agnostic HTTP access. Accept the LGPL and the Chromium cost at that point. |
| Baileys 7.0.0-rc14 | **whatsmeow** (Go) | If Baileys breaks unrecoverably and you need a different implementation of the same protocol. Requires a Go toolchain + a bridge process on Windows — a real cost, and it means TS types stop at the bridge. |
| Baileys 7.0.0-rc14 | **whatsapp-web.js** | Never, for this project. Same Chromium fragility as WPPConnect, but JavaScript and without the extra tooling. |
| Drizzle | **Prisma 7.10.0** | If you want a mature high-level ORM and already know it. Requires consciously avoiding `latest` (= `8.0.0-rc.17`) and accepting the query-engine binary on Windows. |
| Drizzle | **Kysely 0.29.6** | If you want a pure query builder with no ORM and are comfortable writing SQL. Slightly better for very complex queries; weaker migration CLI. |
| pg-boss | **Hand-rolled `scheduled_jobs` poller** | MVP-only, to avoid a queue dependency in the first phase. Migrate to pg-boss before the handoff and daily-limit paths grow. |
| pg-boss | **BullMQ 6.3.9** | Only if Redis is already on the machine for another reason. It is not, and adding it is a net negative under R-044. |
| PowerShell + WinRT | **BurntToast** PowerShell module | When you need `-Urgent` (Focus Assist bypass) and rich notification actions, and you accept the one-time `Install-Module` step. |
| PowerShell + WinRT | **Electron `Notification`** | Only if/when you adopt the Electron shell. It then becomes free — you already have the runtime. |
| Localhost web app | **Electron 44.4.5** | Later phase, when a true standalone window matters more than the memory/install cost. Build it as a thin `BrowserWindow` over the same server. |
| Localhost web app | **Tauri 2** | Later phase, if R-047 ever demands a signed standalone `.exe`. Accept the Rust toolchain. |
| `ai` (AI SDK 7) | **Raw `openai` / `@anthropic-ai/sdk` / `@google/genai`** | If you commit to exactly one provider forever. You don't — R-009 keeps the choice open, and the AI SDK's `Output.object` structured output saves real work. |
| `ai` (AI SDK 7) | **LangChain 1.5.14** | Never here. It is an agent framework that moves control flow into the model — the precise inverse of R-009. |
| Chromium in-process (Baileys v7's `makeWASocket`) | **Browser session** | Already resolved — no browser. |
## What NOT to Use
| Avoid | Why | Use Instead |
|---|---|---|
| **`@whiskeysockets/baileys@6.7.x`** / `latest` sem pin | A linha `6.7.x` é **pré-tctoken**: não expõe `fetchNewChatMessageCap()`, `fetchAccountReachoutTimelock()` nem o tratamento do erro 463. `latest` = `7.0.0-rc14`, que é exatamente o pin do projeto — mas `latest` continua sendo proibido porque a tag pode se mover. | `@whiskeysockets/baileys@7.0.0-rc14`, instalado com `--save-exact` |
| **`prisma@latest`** | `latest` = `8.0.0-rc.17`. Prisma's stable line is `7.10.0` under dist-tag `prev` — a deliberate dist-tag arrangement that makes a casual `npm i prisma` land on an RC. | `drizzle-orm@0.45.3` |
| **Puppeteer / any Chromium** (`puppeteer`, `whatsapp-web.js`, `venom-bot`, `@wppconnect-team/wppconnect`) | 200-500 MB RAM, Windows AV false positives, and breakage every time WhatsApp ships a web-client change. WPPConnect is additionally **LGPL-3.0-or-later** — copyleft on a commercial product. Baileys is MIT, no browser, ~50 MB. | Baileys protocol client |
| **BullMQ + Redis** | Adds a fourth service to install, secure, back up, and keep alive — violating the local-only, three-integration scope (R-044) — to solve a problem the existing PostgreSQL already solves. | `pg-boss@12.35.0` |
| **`node-notifier`** | Last GitHub push **2024-06-24**, 129 open issues. On Windows it shells out to a temp `.ps1` and predates the AppUserModelID requirement from Windows 10 1709+, causing silently dropped toasts. R-013 is load-bearing — it cannot depend on a 2-year-stale package. | First-party `notify.ps1` + WinRT `ToastNotificationManager`, plus a browser Web Audio chime as backup |
| **Sentry / any cloud APM** | Violates local-only operation **and** would exfiltrate LGPD-relevant conversation data to a third party (R-064). | `pino` → local files + `system_events` table → error panel in the React UI |
| **LangChain** | An agent framework whose core abstraction ("let the model drive control flow") is the inverse of R-009's "sistema local no controle de fluxo/limites/handoff." Large dep surface, competing state model, and it structurally encourages putting anti-requisites in prompts. | `ai@7` with `Output.object` + Zod, inside a hand-written deterministic state machine |
| **Prompt-enforced anti-requisites** | A prompt is a probabilistic request, not a control. The 12 anti-requisites are *invariants*; they must be unreachable by construction, not statistically unlikely. A single hallucinated price quote risks the irreplaceable number (R-059). | Deterministic pre-gates + intent mapping + content regex + send gate (see §LLM Integration) |
| **`better-sqlite3`** | Technically the best-engineered option here, and R-031 explicitly mandates PostgreSQL. Also incompatible with `pg-boss`, which needs Postgres. | PostgreSQL 17 + Drizzle |
| **Binding the server to `0.0.0.0`** | R-033 accepts no encryption at rest; it says nothing about the network. Binding to all interfaces exposes the entire LGPD-scoped lead database to the local network. | Bind to `127.0.0.1` + a session token check on every request |
| **Message bodies in log files** | Full transcripts in `logs/*.log` duplicate PII outside the auditable `messages` table and survive log deletion/retention policies. | Log IDs and counts; bodies live in `messages` only |
| **`pm2` on Windows** | Unreliable process-tree handling and log rotation on Windows. | Windows Task Scheduler + a launcher `.cmd` that checks Postgres, migrates, then starts |
| **Putting schedule follow-ups in `node-cron` alone** | In-memory: every job dies on restart, and there is no way to implement R-007's "fire what was missed while closed." | `pg-boss` durable jobs + `croner` for periodic ticks |
| **Electron in the MVP** | A second Chromium (~200 MB), code signing, installers, and AV false positives — to deliver what a browser tab on `127.0.0.1` already delivers for free. | Localhost web app now; Electron later as a thin `BrowserWindow` wrapper |
| **Treating R-007's overdue burst as a spec detail** | Firing every missed follow-up at app-open is machine-cadence burst traffic to cold leads — the pattern most associated with bans. | Bounded, jittered drain (research item for the roadmap) |
## Stack Patterns by Variant
- Switch the `WhatsAppPort` implementation only. The `Contact.id` / LID change lives entirely inside the adapter's `normalizeJid()`.
- Because the schema already stores `phone_number`, `wa_jid`, and `lid` separately (mandated in §LID trap), no data migration is required.
- Re-test the handoff and follow-up paths end-to-end before pointing the pilot number at it. **Confidence: MEDIUM.**
- The CRM must already be exportable to CSV at any moment — export continuously or on every status change, not only on backup. Losing the number should cost the channel, not the pipeline.
- `pg-boss` jobs referencing the dead `wa_jid` must fail into a `system_events` row, not spin. The Baileys `DisconnectReason.forbidden` path must be a terminal state, not a reconnect loop.
- **Consider a second spare SIM from day one** — not used, but available. This is cheap insurance against the project's dominant risk and is not "aquecimento automático" (R-039/R-040 are about volume, not spares).
- The `LlmPort` interface is one method: `decide(input): Promise<Decision>` where `Decision` is the Zod schema from §LLM Integration. Swapping providers touches one file.
- The offline bake-off harness (20-40 transcripts, pt-BR register scoring) is the gate. Do not swap providers on a hunch.
- Every table that references a conversation needs a `channel_account_id`. Add it now as a single-row table; adding it later to a live schema is a much harder migration.
- WPPConnect's multi-session REST server becomes materially more attractive at that point, and the LGPL question becomes real.
- `pg-boss` scales fine (add workers); `p-queue` becomes per-account.
- Task Scheduler with "Run whether user is logged on or not" plus a stored credential. Add a `SIGINT`/`SIGTERM` handler that closes the Baileys socket gracefully — an abrupt kill can corrupt `useMultiFileAuthState`, and a corrupted auth folder reads as a new device to WhatsApp.
## Version Compatibility
| Package A | Compatible With | Notes |
|---|---|---|
| `@whiskeysockets/baileys@7.0.0-rc14` | Node ≥ 22, ESM | Ships its own `useMultiFileAuthState`. **The `auth_info_baileys/` folder is the session — back it up separately from the DB and never commit it.** Requires `BufferJSON` replacer/reviver when serializing creds to JSON. |
| `@whiskeysockets/baileys@6.7.x` (legacy) | Node ≥ 20, ESM or CJS | **Do not install.** Pre-tctoken: no `fetchNewChatMessageCap`, no `fetchAccountReachoutTimelock`, no 463 path. WHS-04 and LEAD-03 would have no implementation. |
| `drizzle-orm@0.45.3` | `pg >=8`, `drizzle-kit@0.31.11` | `drizzle-kit` depends on `tsx ^4.21.0` + `esbuild ^0.25.4` (it does **not** use the TypeScript compiler API, so it is unaffected by TypeScript 7). |
| `pg-boss@12.35.0` | `pg ^8.23.0` | **Exact match** with the recommended driver — one `pg` in the tree, no dual-driver connection pools. `pg-boss` needs its own connection/pool, separate from the app's. |
| `pg@8.23.0` | `@types/pg@8.23.1` | Keep lockstep. |
| `ai@7.0.118` | `zod ^4.1.8`, Node ≥ 22 | Satisfied by `zod@4.6.5` and Node 24 LTS. Also pairs with `@ai-sdk/openai@4.0.78`, `@ai-sdk/anthropic@4.0.65`, `@ai-sdk/google@4.0.82` — all declare the same zod peer. |
| `typescript@7.0.2` | `vite@8.3.1`, `vitest@5.0.2`, `tsx@4.23.15` | All fine: none depend on the TypeScript compiler API. **Blockers would be** `typescript-eslint` (needs the `@typescript/typescript6` shim) and Volar-family tooling (Vue/Svelte/Astro/MDX) — none used. `baseUrl` and `target: es5` are hard errors; use relative imports and `target: es2023`. |
| `@biomejs/biome@2.5.14` | `typescript@7.0.2` | No TS API dependency — this is precisely why it is recommended over ESLint here. |
| `postgres@17.x` | `pg_dump` 17.x | `pg_dump` must be from the **same major version** as the server. Version-stamp backup filenames. |
| `fastify@5.12.5` | `@fastify/static` | Bind to `127.0.0.1` for the secure context required by Web Notifications. |
## Confidence Summary
| Recommendation | Confidence | Basis |
|---|---|---|
| Node.js 24 LTS over Node 26 | HIGH | `nodejs.org/dist/index.json` verified 2026-09-28 |
| TypeScript 7.0.2 for a pure-TS greenfield project | MEDIUM-HIGH | GA 2026-07-08; multiple sources confirm pure-TS is the supported case. New (~2.5 months old). |
| Baileys over WPPConnect | HIGH | GitHub API + npm verified: MIT vs LGPL, TS vs TS, 50 MB vs 200-500 MB |
| Baileys **7.0.0-rc14** (project pin) over the `6.7.x` legacy line | HIGH | Verified on the installed package: the 7.x typings expose `fetchNewChatMessageCap` and `fetchAccountReachoutTimelock` and the 463 path; the 6.7.x line does not, which would leave WHS-04 and LEAD-03 unimplemented. See ADR-001. |
| LID normalization required from day one | HIGH | Confirmed in Baileys source via Context7; open LID bugs present in the 6.7.x line too |
| Node.js + TypeScript over Python | HIGH | Baileys is TS-only; AI SDK is TS-first; R-044 needs no Python |
| LLM control in-app, not in prompts | HIGH | Architectural; follows directly from AR-001…AR-012 being invariants |
| `ai@7` over LangChain | HIGH | LangChain inverts R-009's control requirement |
| Drizzle over Prisma/raw pg | HIGH | Prisma `latest` is an RC; Drizzle's is stable; migration reviewability |
| `pg-boss` over BullMQ/node-cron | HIGH | `bullmq` peerDeps require Redis; R-044/local-only forbids a 4th service |
| Localhost web app over Electron/TUI | HIGH | R-046's dense multi-pane layout is a web layout; Electron is a deferrable wrapper |
| PowerShell+WinRT over `node-notifier` | **MEDIUM** | `node-notifier` staleness is verified fact; but Windows 11 toast suppression (Focus Assist, per-app settings) is inherently environment-dependent. **Needs a Phase 1 smoke test on the Admin's actual machine.** |
| Specific LLM provider (Claude/OpenAI) over Gemini for reply tone | **MEDIUM** | Single pt-BR field test, not a controlled benchmark. **Run the bake-off.** |
| pino + DB error panel over Sentry/winston | HIGH | Sentry violates local-only and exfiltrates LGPD data |
## Open Questions / Roadmap Flags
## Sources
- `/whiskeysockets/baileys` — `makeWASocket`, `useMultiFileAuthState`, `requestPairingCode`, connection lifecycle
- `/websites/ai-sdk_dev` — `generateObject` / `Output.object` structured output, `stopWhen` + tool calling interaction
- `/websites/baileys_wiki` — library discovery, corroborating snippets
- `npm view @whiskeysockets/baileys dist-tags time license` → `latest: 7.0.0-rc14`, `legacy:` a 6.7.x line, both published 2026-07-29; MIT
- `npm view prisma dist-tags` → `latest: 8.0.0-rc.17`, `prev: 7.10.0`
- `npm view typescript dist-tags time` → `latest: 7.0.2` (2026-07-08), `6.0.3` (2026-04-16)
- `npm view drizzle-orm dist-tags.latest` → `0.45.3` (stable, no RC in `latest`)
- `npm view bullmq peerDependencies` → requires `pg >=8.0.0` **AND `redis >=5.0.0` AND `ioredis >=5.0.0`**
- `npm view pg-boss@12.35.0 dependencies` → `pg: ^8.23.0`; `time.modified` 2026-09-26
- `npm view ai@7.0.118` → `zod ^3.25.76 || ^4.1.8`, `engines.node >=22`
- `npm view @wppconnect-team/wppconnect license` → `LGPL-3.0-or-later`; `@wppconnect/wa-js` → `Apache-2.0`
- `npm view venom-bot time.modified` → 2024-11-23 (effectively unmaintained)
- `nodejs.org/dist/index.json` → current v26.10.0, LTS Krypton v24.21.0
- `WhiskeySockets/Baileys` → 11,174 stars, 333 open issues, pushed 2026-09-27; releases a 6.7.x line and `v7.0.0-rc14` same day
- `wppconnect-team/*` → 8 repos pushed on 2026-09-28; org maintains **forks of `baileys` and `whatsmeow`**
- `mikaelbr/node-notifier` → **last push 2024-06-24**, 5,843 stars, **129 open issues**
- `WhiskeySockets/Baileys` LID issue search → open LID-migration bugs on the current line (proto3 `required` fields, `status@broadcast` ack 479, MESSAGE_EDIT empty `key.id`, GCM decrypt failure in LID-migrated chats)
- `devblogs.microsoft.com/typescript/announcing-typescript-native-previews/` — Corsa/Strada, migration posture
- `github.com/microsoft/typescript-go` README — feature-parity table (Program creation → done; Language service → in progress; API → not ready until 7.1)
- `developers.facebook.com/docs/whatsapp/overview/policy-enforcement/` — enforcement ladder: warning → 1/3/5/7/30-day blocks → account lock → permanent disablement
- `ai-sdk.dev/docs/ai-sdk-core/generating-structured-data` — `Output.object` + Zod
- `github.com/Windos/BurntToast` — `-Urgent` breaks through Focus Assist
- `github.com/xan105/node-powertoast` — the PowerShell/WinRT approach and its caveats
- *Best Open Source WhatsApp Libraries (2026 Guide)*, whatsapp.checkleaked.cc, 2026-06-21 — **MEDIUM**; explicitly corrects the "protocol clients are safer" myth
- *Open source WhatsApp API: the 2026 landscape*, wasphere.com, 2026-07-19 — **MEDIUM**; WPPConnect as "the library everything is built on" ecosystem position
- *Baileys vs WPPConnect: Biblioteca Ideal para Automação WhatsApp*, todasolucao.com.br — **LOW**; SEO content, corroborated only where it overlaps the above
- *WhatsApp unofficial API ban risk*, wapisimo.dev, 2026-03-23 — **LOW** (vendor blog, explicitly arguing against the ban-risk narrative Meta resellers promote; directionally useful, self-interested)
- *WhatsApp Automation Ban Risk India 2026*, kraya-ai.com, 2026-07-20 — **LOW**; the 4-layer protocol-fingerprinting model and the "2-8 weeks" lifespan claim are **unverified** and directly contradict the behavior-based sources
- *WhatsApp Terms of Service: What Really Gets a Number Banned*, marcusbarboza.com.br — **MEDIUM**; the 5.1M June-2026 India ban figure and >95% automation attribution are attributed to WhatsApp's own monthly report but were **not verified against Meta directly**
- *WhatsApp AI Agents in 2026*, whale.co.il, 2026 — **MEDIUM**; notes the Business Solution Terms (modified 2026-03-06) AI-provider clause and its **Brazil/EEA carve-out** — relevant to R-064, does not legitimize unofficial clients
- *TypeScript 7.0 Is GA*, igortrnko.com, 2026-07-30 — **MEDIUM**; the `baseUrl`/`target: es5` hard errors and the `@typescript/typescript6` shim
- *pt-BR LLM field comparison*, negociodautomatico.com.br, 2026-05-30 — **LOW**; single-operator test, but the Gemini-formality finding matches R-010's concern
- *Baileys vs Cloud API 2026*, osky.dj, 2026-06-01 — **LOW**; the "v6.x is the active fork in 2026" claim is **contradicted** by the npm registry data above and should be disregarded
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
