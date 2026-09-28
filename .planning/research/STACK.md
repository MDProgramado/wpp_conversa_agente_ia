# Stack Research

**Domain:** Local Windows automation for WhatsApp B2B prospecting (unofficial channel + external LLM + local PostgreSQL)
**Project:** Automação Local de WhatsApp para Prospecção B2B
**Researched:** 2026-09-28
**Overall confidence:** MEDIUM-HIGH (all versions verified against npm registry / GitHub API / Context7 on 2026-09-28)

---

## Executive Summary

The standard 2026 stack for this shape of system is **Node.js 24 LTS + TypeScript 7 + Baileys 6.7.24 (pinned, NOT the `latest` tag) + Drizzle ORM on PostgreSQL + Fastify serving a React SPA on 127.0.0.1 + Vercel AI SDK 7 + pg-boss + pino**.

Three findings from this research overturn intuitive defaults and should drive the roadmap:

1. **`npm install @whiskeysockets/baileys` installs a release candidate.** The `latest` dist-tag is `7.0.0-rc14`. The 7.x line entered RC in September 2025 and has not shipped stable in ~13 months. The `legacy` dist-tag (`6.7.24`) is still receiving backports — `6.7.24` and `7.0.0-rc14` were published on the *same day* (2026-07-29). For a system whose single number is a single point of catastrophic failure (R-059, risk ALTO), pin `6.7.24` exactly.
2. **The same trap exists in Prisma.** `prisma@latest` is `8.0.0-rc.17`; the stable line is `7.10.0` (dist-tag `prev`). This is the main reason to pick **Drizzle** over Prisma — Drizzle's `latest` (`0.45.3`) is a real stable release.
3. **Baileys 7.0 changes the contact identity model: `Contact.id` may now be a LID (`@lid`) instead of a phone-number JID (`@s.whatsapp.net`).** This project keys every lead by phone number, so LID↔PN normalization is a **Phase 1 requirement, not a migration concern** — regardless of which major version you pin, because LID-related bugs are open in the 6.7.x line too.

**The single most important architectural decision in this document is the LLM boundary** (see §LLM Integration). All 12 anti-requisites (AR-001…AR-012) are absolute invariants. A prompt is not a control. The LLM must be modeled as an *untrusted, bounded, stateless subroutine* that returns a Zod-validated decision object; every rule, limit, and gate must be evaluated in deterministic application code before a byte reaches `sendMessage`.

**Answering the framing question directly: Node.js + TypeScript, not Python.** Baileys is TypeScript-only, the Vercel AI SDK is TypeScript-first, and Drizzle gives end-to-end type safety from DB schema to UI. Python would add a second runtime, a second type system, and an FFI/IPC bridge to reach the WhatsApp layer — for zero benefit, since none of the three permitted integrations (R-044) require Python. **Confidence: HIGH.**

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Node.js** | **24.21.0 (LTS "Krypton")** | Runtime | Current is v26.10.0 (not LTS). Node 24 is the active LTS line and satisfies `ai@7`'s `engines: node >=22`. LTS matters here: Baileys is an unofficial protocol client and you want OS/runtime stability over bleeding-edge. **Do not use Node 26** — it is Current, not LTS, and a long-running always-on bot should not ride the cutting edge. |
| **TypeScript** | **7.0.2** (GA 2026-07-08) | Language | Go-native compiler, ~8-12x faster type-check, and now the npm `latest`. Safe for this project specifically because the codebase is pure `.ts`/`.tsx` with no Volar-ecosystem dependency (no Vue/Svelte/Astro/MDX). **This is a greenfield project, so the TS 6→7 migration tax is zero** — you adopt the final state on day one instead of inheriting debt. `typescript@7.0.2` ships the `tsc` binary directly; `tsgo` is gone. |
| **@whiskeysockets/baileys** | **6.7.24 — PIN EXACTLY** | WhatsApp multi-device WebSocket client | Pure TypeScript, no browser, ~50 MB RAM (vs 200-500 MB for Chromium), MIT license (vs WPPConnect's LGPL), 11.2k stars, repo pushed 2026-09-27. Windows-friendly: no Chromium to fight antivirus heuristics over. See §Version Pinning. **Confidence HIGH on library choice; MEDIUM on version-line choice.** |
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

---

## Installation

```bash
# --- Core runtime ---
node --version          # must be v24.x LTS
npm --version

# --- WhatsApp adapter (PIN EXACTLY — no caret, no tilde) ---
npm install --save-exact @whiskeysockets/baileys@6.7.24

# --- Database ---
npm install --save-exact pg@8.23.0
npm install --save-exact drizzle-orm@0.45.3
npm install -D --save-exact drizzle-kit@0.31.11 @types/pg@8.23.1

# --- LLM ---
npm install --save-exact ai@7.0.118 zod@4.6.5
npm install --save-exact @ai-sdk/openai@4.0.78     # or @ai-sdk/anthropic@4.0.65 / @ai-sdk/google@4.0.82

# --- Server, queue, logging ---
npm install --save-exact fastify@5.12.5 @fastify/static pino@10.3.1
npm install --save-exact pg-boss@12.35.0 p-queue@9.3.3 croner@10.0.1

# --- Dev toolchain ---
npm install -D --save-exact typescript@7.0.2 vite@8.3.1 @vitejs/plugin-react@6.1.1
npm install -D --save-exact @biomejs/biome@2.5.14 vitest@5.0.2 tsx@4.23.15 pino-pretty@13.1.3
npm install -D --save-exact tailwindcss@4.3.3 @types/react @types/node@26.6.3
```

**Anti-installation — what you must NOT add:**

```bash
# NOTHING that shells out to a browser
# npm install puppeteer        # NO
# npm install whatsapp-web.js  # NO
# npm install venom-bot        # NO
# npm install @wppconnect-team/wppconnect  # NO (LGPL + Chromium)

# NOTHING that adds an infrastructure service
# npm install bullmq ioredis   # NO — BullMQ requires Redis (see §Alternatives)

# NOTHING that phones home
# npm install @sentry/node     # NO — violates local-only
```

---

## Version Pinning Strategy

This is the highest-leverage decision in the whole stack, because **two of the three most important dependencies publish release candidates to their `latest` tag**.

| Package | `latest` tag | Stable line | What you install |
|---------|--------------|-------------|------------------|
| `@whiskeysockets/baileys` | `7.0.0-rc14` (RC) | `6.7.24` (dist-tag `legacy`) | **`6.7.24`, `--save-exact`** |
| `prisma` | `8.0.0-rc.17` (RC) | `7.10.0` (dist-tag `prev`) | *not used — Drizzle instead* |
| `typescript` | `7.0.2` (GA) | `7.0.2` | `7.0.2`, `--save-exact` |
| `drizzle-orm` | `0.45.3` (stable) | `0.45.3` | `0.45.3` |
| `ai` | `7.0.118` (stable) | `7.0.118` | `7.0.118` |

**Rules:**
1. `--save-exact` (no `^`, no `~`) for `@whiskeysockets/baileys`, `ai`, and `typescript`. Baileys in particular: a WhatsApp protocol change can require a same-day patch, and a floating range will silently pull an RC into a production session.
2. **Check the dist-tag before every dependency bump.** `npm view <pkg> dist-tags` is a 5-second check that prevents installing an RC.
3. Baileys upgrades are a **scheduled maintenance event**, not a `npm update` side effect. Read the release notes, then re-pair if the auth format changed.
4. **Track Baileys as an external watch item.** R-059 makes the number irreplaceable. Subscribe to `WhiskeySockets/Baileys` releases and check it weekly during the pilot.

---

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

**Both are alive.** This is not a "pick the survivor" situation. WPPConnect is in fact shipping *more* frequently (its org pushed 8 repos on the day I checked, and it now maintains **forks of both Baileys and whatsmeow** — a deliberate hedge that also tells you the team considers the protocol-client approach the strategic core).

### Why Baileys wins for *this* project

1. **Windows, no Chromium (decisive).** R-047 mandates Windows. A Puppeteer-driven Chromium on Windows is a persistent operational tax: antivirus false positives, ~400 MB RAM, browser-update-triggered breakage, and a second Chromium instance on a machine that also runs Baileys, PostgreSQL, and the panel. Baileys is a WebSocket client with no browser at all.
2. **License.** You run an agency (R-048) and will likely distribute this internally. Baileys is MIT. WPPConnect is LGPL-3.0-or-later — copyleft obligations on a closed commercial product are a legal review item you do not need.
3. **TypeScript-native.** The riskiest code in this system is the WhatsApp layer. Having it type-checked against the same `Lead`/`Message` types as the rest of the app is worth more than WPPConnect's ergonomic `sendText()`.
4. **The adapter boundary is cleaner.** R-016 requires a swappable connection layer. Baileys gives you a well-defined async event surface (`connection.update`, `messages.upsert`, `creds.update`, `sendMessage`) that maps cleanly onto a port/adapter interface. WPPConnect's REST server would tempt you into an HTTP hop you don't need.
5. **Venom is effectively dead** (last publish 2024-11-23). `whatsapp-web.js` is the gentlest learning curve but is JavaScript, and it is the *same* fragility profile as WPPConnect with none of WPPConnect's extra features.

### The honesty check: does Baileys reduce ban risk?

**No — and this is the most important correction in this document.** Research surfaced a persistent and widely-repeated myth that protocol-based clients (Baileys) are "safer" than browser-based ones. Multiple 2026 sources converge on the opposite: **architecture affects resource footprint and feature-parity speed, not ban immunity.** Meta detects unofficial clients across *all* approaches.

The sources further disagree on the *mechanism*:
- **Behavior-based:** bans are driven by volume, frequency, reply ratio, report rate, and contact-graph distance (Wapisimo, 2026-03).
- **Protocol-fingerprint-based:** "Meta maintains a fingerprint database of known unofficial clients… this runs before any message is sent" and "random delays do not prevent bans because they only address Layer 3 signals" (Kraya, 2026-07). This source also claims typical lifespan of 2-8 weeks.

**These two positions are not reconcilable from public evidence, and I could not verify either against Meta documentation.** What is *not* in dispute across every source: unofficial clients violate the WhatsApp Business Terms; bans land **without warning**; appeal success on a first violation is reported at 30-40% and drops sharply on repeat; and **the ban attaches to the phone number, not the tool** — switching libraries does not save a flagged number.

Scale of the problem (India monthly report, June 2026): **5.1M accounts banned in one month, 1.37M blocked proactively before any user report**, with >95% of bans attributed to unauthorized automated or bulk messaging.

**Implication for this project's design — and it vindicates the requirements you already wrote:**
- R-023 (20-30 msgs/day hard cap) and R-006 (7h-17h weekday window) are not conservative settings to be relaxed. They are the primary control.
- R-001 (human sends the first contact) is the single highest-value ban mitigation available: a human-initiated conversation is the strongest legitimacy signal in the system.
- **R-007 is the sharpest edge.** Firing *every* overdue follow-up the moment the app opens is a burst of machine-cadence traffic to cold leads — precisely the pattern that gets flagged. **Recommend a bounded, rate-limited drain** (e.g. max N per boot with jittered spacing), and treat this as a research item, not an implementation detail.
- **R-059's risk rating (ALTO, "sem redundância") is correctly stated and should be treated as the project's dominant operational risk.** Plan for the number being lost: export the CRM to CSV continuously so a ban costs you the channel, not the pipeline.

### Version choice: `6.7.24` vs `7.0.0-rc14` — and the LID trap

Baileys 7.0 carries a **fundamental breaking change to contact identity** (verified from the Baileys source via Context7):

| | v6.7 | v7.0 |
|---|---|---|
| `Contact.id` | always a phone-number JID (`@s.whatsapp.net`) | **either LID or JID (preferred)** |
| New fields | — | `lid?`, `phoneNumber?` |
| `makeSignalRepository` returns | `SignalRepository` | `SignalRepositoryWithLIDStore` (adds `lidMapping`) |
| Session migration PN→LID | no | **automatic on connect** |

WhatsApp's LID (Linked ID) is a privacy-preserving identifier that hides a user's real phone number. The Meta Cloud API is moving to LID too, so LID awareness is *eventually* required regardless.

**Recommendation: pin `6.7.24`, but build LID normalization from day one.** Rationale: the 6.7.x line is not LID-free — a GitHub search returns **open LID-migration bugs on the current line**, including *"Media retry (updateMediaMessage) fails GCM decrypt for media in LID-migrated chats"*, *"status@broadcast always rejected with ack error=479 on LID-migrated accounts"*, and *"messages.update for MESSAGE_EDIT has empty key.id when chat uses LID addressing mode."* If you assume JID is always a phone number, you will write a bug now and discover it as an unexplained mismatch during the pilot.

**Concrete requirement (Phase 1):**
- Store `phone_number` (E.164, your business key), `wa_jid` (the raw `remoteJid`), and `lid` as **separate nullable columns** on `leads` and `conversations`.
- Never use `remoteJid` as a primary key or as a foreign key target.
- Add a `JidResolver` in the adapter that maps LID↔PN via Baileys' `lidMapping` store / `onWhatsApp()`, and log an explicit `jid_unresolved` event when it cannot.
- **Confidence: HIGH** that LID must be handled. **MEDIUM** that `6.7.24` is the right pin versus `7.0.0-rc14` — both are defensible; `6.7.24` wins on the "never ship an RC to an irreplaceable number" rule. Revisit when 7.0.0 goes stable; the adapter design means the upgrade is contained.

---

## Node.js + TypeScript Scaffolding, and Why Not Python

**Verdict: Node.js + TypeScript. Confidence: HIGH.**

| Factor | Node.js + TS | Python |
|---|---|---|
| WhatsApp layer | Baileys is TypeScript-only | Would need a subprocess/FFI bridge to reach Baileys, or `whatsmeow` (Go) via a second bridge process |
| LLM layer | Vercel AI SDK is TS-first; `Output.object()` structured output is native | LangChain/LlamaIndex add a large dep surface and their own competing state model |
| End-to-end types | Drizzle schema → API → React props, one type system | Pydantic/SQLAlchemy typing stops at the boundary; frontend is still TS |
| Control panel | One language, one toolchain, one `node_modules` | Two runtimes, two venv/node_modules, two sets of Windows path bugs |
| Requirement fit | Satisfies all of R-044 with zero extra runtimes | Adds a runtime no requirement asks for |

**The only credible Python argument** is that the WhatsApp ecosystem has a stronger Go lineage (`whatsmeow`), making a Go sidecar attractive. That is not Python's advantage — and a Go sidecar on Windows means a compiler toolchain plus a second process. Reject.

**Scaffolding recommendation:** do **not** adopt a framework scaffold (`create-next.js`, NestJS, Adonis). Next.js is a server-framework mismatch for a local daemon that must own the process lifetime; NestJS brings a DI container and decorator-heavy modules that fight the "deterministic state machine, thin adapters" architecture this project needs. **Start from an explicit `package.json` with a `src/` layout** and only the packages listed above.

**TypeScript 7.0.2 specifics for this project:**
- Greenfield ⇒ adopt 7.0.2 now; there is no 5.x→6.x→7.x migration sequence to pay.
- Hard errors in TS 7: `baseUrl` and `target: es5`. Neither applies here — use relative imports and `target: es2023`.
- If you later need `typescript-eslint`, install `@typescript/typescript6` and use the npm-alias layout (`"@typescript/native": "npm:typescript@^7.0.2"`, `"typescript": "npm:@typescript/typescript6@^6.0.2"`). **Better: don't — use Biome and avoid the problem.**

---

## LLM Integration: The Control/Model Boundary

This is the section the roadmap must treat as load-bearing.

### Why flow control, limits, and handoff live in the application, not the prompt

R-009 says it directly ("sistema local no controle de fluxo/limites/handoff"), and it is correct for five independent reasons:

1. **A prompt is not a control.** Prompt compliance is probabilistic. "Never negotiate price" in a system prompt is a *request*. A `if (intent === 'price_request') triggerHandoff()` branch is a *guarantee*. AR-001/AR-012 are invariants — they must be structurally impossible to violate, not statistically unlikely to violate.
2. **The failure mode is asymmetric.** A false negative on "never quote a price" costs a lead and, cumulatively, the number (R-059). A false positive just interrupts a conversation the Admin can resume. The gate must be *adversarially biased toward handoff*.
3. **Auditable.** R-022 demands auditable status transitions, and R-043 demands immutable history. A `handoff_events` table with `trigger`, `detector`, `evidence`, `timestamp` satisfies both. A prompt leaves no trace.
4. **Testable.** A deterministic gate is a unit test. "The LLM usually remembers not to quote prices" is not a test — it is a vibe. Vitest can prove AR-001; it cannot prove a prompt.
5. **Recoverable.** If the LLM provider is down (R-045 lists "API de IA fora" as a critical failure), deterministic rules keep the handoff/opt-out/safety layer fully operational. With control in the prompt, the whole system degrades at once.

### The pattern: LLM as a bounded, stateless decision function

```
inbound message
      │
      ▼
┌──────────────────────────────────────────────────────────────┐
│ DETERMINISTIC PRE-GATE  (runs BEFORE any LLM call)          │
│  · lead opted out?            → SILENCE (AR-005, R-024)     │
│  · handoff active?            → SILENCE (AR-010, R-066)     │
│  · media received?            → register + handoff (R-038)  │
│  · outside 7h-17h / weekend? → queue, no send (R-006)       │
│  · daily quota exhausted?     → queue for next biz day(R-023)│
└──────────────────────────────────────────────────────────────┘
      │  (only if all gates pass)
      ▼
┌──────────────────────────────────────────────────────────────┐
│ LLM CALL  (ai@7 + Output.object + Zod) — returns a DECISION  │
│  { intent, handoffRequired, handoffReason,                    │
│    suggestedStatus, qualification, replyText, parts[] }      │
└──────────────────────────────────────────────────────────────┘
      │  Zod-parse failure → RETRY once → then FAIL CLOSED (silence + notify)
      ▼
┌──────────────────────────────────────────────────────────────┐
│ DETERMINISTIC POST-GATE  (the anti-requisite enforcement)    │
│  · handoffRequired → handoff_events + notify + SILENCE       │
│  · intent is price/proposal/budget  → handoff (R-012/AR-001) │
│  · intent is schedule-meeting      → handoff (R-012/AR-003)  │
│  · intent is "are you a bot/AI"   → handoff + SILENCE(R-056) │
│  · intent is opt-out/report/threat → handoff + SILENCE(R-065)│
│  · replyText contains a price/    → strip-or-handoff          │
│    currency/percentage pattern      (deterministic regex)     │
│  · replyText contains media/       → reject (AR-004, R-037)   │
│    attachment markers                                         │
│  · parts[] length > 1 and any     → block (R-037)            │
│    part is not text                                     │      │
│  · all pass → enqueue via p-queue (R-067 humanization)      │
└──────────────────────────────────────────────────────────────┘
```

**Key design points:**
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

Every layer is a unit-testable function. **The test suite should be organized by anti-requisite, not by module** — one describe block per AR-001…AR-012.

### Provider & model selection

**Library: Vercel AI SDK 7 (`ai` 7.0.118).** It gives one interface across all three providers R-009 names, so provider choice is a config value, not an architectural commitment.

**Why not LangChain (1.5.14):** LangChain is an *agent framework*, and its central abstraction is "let the model decide the control flow." This project needs the exact opposite — a deterministic state machine with the LLM as a bounded subroutine. LangChain would add a large dependency surface and a competing state model, and it actively encourages moving rules out of the app (which is R-009's prohibition). For a single-turn structured-output call plus optional tool use, the AI SDK is the correct altitude. **Confidence: HIGH.**

**Two-tier model strategy** (all providers expose a cheap/fast tier — a 20-30 msg/day budget makes this nearly free):

| Task | Tier | Notes |
|---|---|---|
| Intent detection / handoff-trigger classification | cheap fast model | Runs on *every* inbound message; must be fast and cheap |
| Reply generation + status suggestion | stronger model | Runs less often; quality matters for the consultative tone |
| Copilot suggestions (R-014) | strongest model | Human reviews it; latency is acceptable |

**Provider recommendation: start with Anthropic (Claude) or OpenAI for reply generation; keep Gemini Flash as the cheap tier.** Evidence for pt-BR conversational register: a 2026 pt-BR field test reported ChatGPT/GPT-5.5 as "Excelente — acerta registros" for WhatsApp BR, while Gemini "tende a formalidade" — notably producing "Olá, será um prazer!", which no Brazilian WhatsApp user says. That is exactly the robotic-register failure R-010/R-067 exist to prevent.

**Confidence: MEDIUM on the specific provider.** This is a *bake-off* decision, not a research conclusion — benchmark rankings do not measure Brazilian WhatsApp B2B sales register. **Build an offline evaluation harness (20-40 real transcript snippets, score tone/registro/handoff-accuracy) and run it before Phase 4.** Do not hard-code a provider assumption into the roadmap.

**Cost reality check:** at 20-30 messages/day, roughly 2k tokens per turn, total spend is on the order of a few USD/month on any mid-tier model. Cost is not a selection criterion here; **latency and pt-BR register are.** Do not let cost drive the choice.

**LGPD note (R-009 "minimização de dados sensíveis"):** the lead-hunter API returns only name, phone, and address (R-018). Send **none** of it to the LLM. The model needs conversation content, not PII. Strip/replace identifiers before the API call, and log that you did.

---

## PostgreSQL Connection Layer

**Recommendation: `drizzle-orm` 0.45.3 + `pg` 8.23.0 + `drizzle-kit` 0.31.11. Confidence: HIGH.**

| Option | Verdict | Why |
|---|---|---|
| **Drizzle + pg** | ✅ **Use this** | Stable `latest`. Thin — it *is* SQL with types. Plain `.sql` migrations are reviewable and auditable. No query-engine binary. End-to-end types into the API and the React panel. First-class `pg` peer. |
| **Prisma 7.10.0** | ⚠️ Viable, not recommended | Works, but `prisma@latest` is `8.0.0-rc.17` — you must consciously pin `7.10.0`. Prisma ships Rust query engines that have historically had Windows + synced-folder (OneDrive) path and AV problems, and this project lives in a OneDrive directory. Its schema DSL also resists the `jsonb`/partial-index shapes a message-audit table wants. |
| **Raw `pg` + Kysely** | ⚠️ Also good | Kysely 0.29.6 is active and is a *pure* query builder (no ORM layer). If you want maximum SQL control and already know Kysely, this is a legitimate choice. It lacks Drizzle's migration CLI ergonomics. |
| **Raw `pg` alone** | ⚠️ For the adapter layer only | Use `pg` directly for the one thing where you want no abstraction: `pg-boss`'s own connection, and for `pg_dump` backup scripts. Everywhere else, Drizzle. |
| **`better-sqlite3` 13.0.3** | ❌ **Reject for the app** | Technically excellent and would have been the right call (single file, trivial backup, zero service) — **but R-031 explicitly mandates PostgreSQL local.** It is also the wrong choice for a reason beyond the requirement: `pg-boss` needs PostgreSQL, and SQLite cannot be shared by multiple processes without WAL locking pain. Do not use it even for a cache/queue. |
| **`postgres` (postgres.js) 3.4.9** | ❌ Reject | Fine library, but `pg-boss` depends on `pg ^8.23.0`. Mixing two drivers means two connection pools against one local Postgres for no benefit. |

**Concrete connection guidance:**
- Single `pg.Pool` with `max: 5`. This is a single-user local app; a large pool is pure overhead.
- Connect over **TCP to `127.0.0.1`, not a Unix socket** (not available on Windows) and not a named pipe unless you have a specific reason.
- **Set `application_name: 'whatsapp_prospect'`** so `pg_stat_activity` is readable when the panel shows "PostgreSQL parado" (R-045).
- Run `drizzle-kit generate` to produce `.sql` files, then `migrate()` from the app on boot **before** anything else. This satisfies R-031 and makes the Task Scheduler launcher a single command.
- **Set `synchronous_commit` / keep a nightly `pg_dump -Fc`** for R-032.

**Schema notes for the specific requirements:**
- `messages` must be **append-only** (R-043 "histórico imutável"): no UPDATE/DELETE grants, plus a trigger that raises on mutation.
- `leads` needs a **partial unique index** for the daily quota (R-023): a `UNIQUE (lead_id, contact_date)` on the message table, or a `daily_counters` table keyed `(date, type)` with a `CHECK (count <= 30)`.
- `opt_out` (R-024) should be a **boolean column with a `CHECK` that no code path can unset**, not a status enum value that could be overwritten.
- `handoff_events` (R-012/R-065) should be a **separate table, not a column**, so the audit trail (R-022) is append-only and queryable.
- Tag R-028 (`responsible_user_id`, `created_by`) columns now even under R-027 (single user) — backfilling is a migration, adding later is also a migration, but adding now costs one nullable column.

---

## Windows Local UI

**Recommendation: a Fastify server on `127.0.0.1` serving a Vite-built React SPA, opened in the default browser (or a PWA). NO Electron in the MVP. Confidence: HIGH.**

R-046 needs: lead list + chat + AI suggestions + history + action buttons, with live mode display. That is a **dense multi-pane web layout** — exactly what the web platform is good at.

| Option | Verdict | Why |
|---|---|---|
| **Localhost web app (Fastify + React)** | ✅ **Use this** | Zero extra runtime. The browser is already installed and already has the right rendering, layout, scrolling, and input behavior. F5 refreshes. `127.0.0.1` is a **secure context**, so the Web Notifications API and clipboard work. R-032 backup is unaffected. Updating the UI is a page refresh, not an installer. |
| **Electron 44.4.5** | ⏳ Defer to a later phase | Works, but costs: a second Chromium (~200 MB RAM), `electron-builder` signing + installer on Windows, AV false positives on an unsigned binary, and a webview that duplicates what a browser tab already does. **The validated pattern is a thin wrapper**: serve the SPA from the same Node process, then add Electron later as a `BrowserWindow` pointing at `127.0.0.1:<port>` with no changes to the UI code. Keep `package.json` ready for it; do not build it now. |
| **TUI (Ink 7.1.1 / Textual)** | ❌ Reject for the panel | A TUI is a poor fit for four simultaneous rich panes with a scrolling message log, selectable message history, and inline "AI suggestion → edit → send" affordances. You'd hand-build layout primitives, lose copy/paste and text selection reliability, and spend longer than the web version. Ink *is* worth using for a **CLI control surface** (`npm run status`, `npm run leads`) — that is a different tool. |
| **Tauri 2** | ⏳ Possible later | Best resource profile if a desktop shell is ever required (~100-140 MB, uses the OS WebView). But it means a Rust toolchain on Windows — a new build dependency for a single-user pilot. Revisit only if R-047 ever demands a true standalone `.exe`. |

**Real-time updates: SSE, not WebSocket.** R-046 needs the panel to *receive* pushes (mode changes, new inbound messages, handoffs, AI suggestions, error panel refresh). That is one-directional. SSE over `EventSource` gets **automatic reconnection** built in — critical when the server restarts or the Admin closes and reopens the tab. WebSocket requires hand-rolled heartbeat + backoff for no benefit here. Use `ws` only if a future phase needs client→server streaming of large payloads.

**Practical details:**
- Bind to **`127.0.0.1`, never `0.0.0.0`**. R-033 accepts "no encryption," but that is a statement about *data at rest*; binding to all interfaces would expose the whole lead database (LGPD) to the LAN. This is a free control — take it.
- Put a token in the URL/localStorage and check it on every request. Single user, but this stops a drive-by page or a browser extension from reading the CRM.
- Ship the built SPA as static assets from Fastify via `@fastify/static` — one process, one port, no CORS.

---

## Windows Notifications

**Recommendation: a first-party `notify.ps1` calling the WinRT `Windows.UI.Notifications.ToastNotificationManager` API, invoked from Node with `child_process`. `node-notifier` explicitly rejected. Confidence: MEDIUM — this is the highest-uncertainty item in the document and needs a Phase 1 smoke test.**

R-013 (handoff notification: sound + popup identifying lead, reason, quick action) and R-045 (critical-failure notification) are **load-bearing**. If notifications silently fail, handoffs are missed, the bot appears to run unattended, and the Admin goes days without responding to a price request. This is not a nice-to-have.

**Why not `node-notifier` 10.0.1 (the reflexive choice):**
- **Last GitHub push: 2024-06-24.** Over two years stale, 129 open issues.
- On Windows it does not call WinRT at all — it writes a `.ps1` to a temp file and spawns PowerShell, inheriting all of PowerShell's notification quirks and adding a temp-file lifecycle.
- It predates the Windows 10 1709+ requirement that toasts carry a registered **AppUserModelID**. Without one, the toast shows a generic app name or is silently dropped.
- 10.0.1's release was a maintenance bump, not a rewrite.

**Why not `BurntToast`** (the popular PowerShell module): it is powerful (`-Urgent` breaks through Focus Assist — genuinely valuable here), but it is an **external dependency install** (`Install-Module BurntToast`, current-user scope, PSGallery trust prompt) and the project docs note it is itself not recently updated. For a system that must work on a fresh Windows machine in five minutes, "needs a module installed" is a real cost. **Keep it as an optional enhancement, not a prerequisite.**

**Why write our own:** the direct WinRT path is ~50 lines of PowerShell with **zero external dependencies** (`powershell.exe` ships with Windows):

```powershell
# notify.ps1 — params: -Title, -Message, -Sound, -Urgent
[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom, ContentType = WindowsRuntime] | Out-Null
[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("WhatsApp Prospeccao").Show($toast)
# sound: [System.Media.SystemSounds]::Exclamation.Play()  — or a bundled .wav via System.Media.SoundPlayer
```

Node calls it with:
```ts
spawn('powershell.exe',
  ['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File', script, '-Title', t, '-Message', m],
  { windowsHide: true });
```

**`windowsHide: true` and `-NonInteractive` are mandatory** — without them, every handoff flashes a black console window over the Admin's screen. This is the most common bug in this pattern.

**Secondary belt-and-braces sound:** a **Web Audio API chime in the browser tab** from the SSE stream. It costs 15 lines, needs no Windows permission, and guarantees an audible cue even if the OS toast is suppressed. Because you already need the browser open for the panel, this is free redundancy.

**Known failure modes to smoke-test in Phase 1 (this is why confidence is MEDIUM):**
1. **Focus Assist / Do Not Disturb** silently suppresses toasts. Mitigation: the BurntToast `-Urgent` equivalent (WinRT `ToastScenario.Urgent`) breaks through it, and the browser chime covers the gap.
2. **Notification settings per-app** — the AppUserModelID must be registered in the Start Menu. Verify with `Get-StartApps | Where-Object {$_.Name -like '*Prospeccao*'}`.
3. **ExecutionPolicy** — a corporate/strict policy may block `-File`. `-ExecutionPolicy Bypass` on a per-invocation basis normally works; if not, fall back to the browser chime + a visible in-panel banner.

---

## Job Scheduling & Queues

**Recommendation: `pg-boss` 12.35.0 for durable scheduling + `croner` 10.0.1 for the in-process tick + `p-queue` 9.3.3 for outbound serialization. Confidence: HIGH.**

Requirements in play: follow-ups at 1h/1d/3d/7d (R-004/R-005), a hard daily cap with next-business-day spillover (R-023), and — critically — **R-007: follow-ups overdue while the app was closed must fire on next open, even outside the 7h-17h window.**

| Option | Verdict | Why |
|---|---|---|
| **pg-boss** | ✅ **Use this** | Durability is the whole point: a job scheduled for tomorrow survives a crash, a reboot, and a PC being off overnight. Provides **singleton execution** — a given job runs on one worker, which directly prevents the double-send pattern that gets numbers flagged. Retry with backoff, priority queues, and `singletonSeconds` for job coalescing. **Uses the PostgreSQL you already have — zero new infrastructure.** Actively maintained (published 2026-09-26); depends on `pg ^8.23.0`, exactly matching your driver. |
| **node-cron** 4.6.0 | ⚠️ Tick only | Purely in-memory: every job dies with the process, and it has no notion of "this job was due at 03:00 and the app was closed." Its catch-up semantics are wrong for this domain. **Use `croner` instead** (zero dependencies, actively maintained, timezone-aware) for the small number of periodic ticks you actually need. |
| **BullMQ** 6.3.9 | ❌ **Reject** | `peerDependencies` are `pg >=8.0.0` **AND `redis >=5.0.0` AND `ioredis >=5.0.0`**. It requires running a Redis server. R-044 caps integrations at three and the project is local-only; adding a Redis daemon is a fourth service to install, secure, back up, and keep alive — to solve a problem pg-boss solves with the database you are already running. |
| **`@temporalio/worker` 1.24.0** | ❌ Reject | Correct tool for distributed, long-running, exactly-once workflows. Enormous operational surface (history DB, workers, namespaces, task queues). For a 20-30 msg/day single-user pilot it is pure overhead. |
| **In-app scheduler / hand-rolled table poller** | ⚠️ Acceptable floor | A `scheduled_jobs` table polled every 30s is a legitimate MVP simplification and needs no extra dependency. But you must hand-roll locking (`SELECT ... FOR UPDATE SKIP LOCKED`), retry, and singleton semantics. **If you take this route, do it only for the first phase** and migrate to pg-boss before the daily-limit and handoff paths get complex. |
| **graphile-worker / pg-boss** | ✅ pg-boss | Both are Postgres-native. pg-boss has the richer feature set (singleton, priority, cron, throttling) and better current activity. |

**Critical design point: gates live in the send path, not the scheduler.**
`pg-boss` decides *when* a message is due. It must **never** decide *whether* it may be sent. Every job handler begins by re-checking, in this order: opt-out → handoff state → media flag → 7h-17h weekday window (with the R-007 boot-time exception) → daily quota. This ordering is a shared function used by the follow-up handler, the confirmation/reminder handler (R-026), and any manual trigger. **One function, three callers, no drift.** A scheduler that enforces limits is a scheduler that will eventually send outside the window during an incident.

**R-007 bounded drain (research item, not settled):** firing every overdue follow-up at once on boot is machine-cadence burst traffic to cold leads. Recommend draining with a cap (e.g. 5 per boot) and jittered spacing through `p-queue`, and logging which ones were deferred. Flag for the roadmap.

---

## Logging & Error Monitoring

**Recommendation: `pino` 10.3.1 with `pino-roll` rotation → local files; the "error panel" is a `system_events` table surfaced in the same React UI. No external service. Confidence: HIGH.**

| Option | Verdict | Why |
|---|---|---|
| **pino + rotation** | ✅ **Use this** | Fastest JSON logger in Node, native TS, `pino-roll` for size/date rotation, and its `child()` scoping maps directly onto the R-045 fields (timestamp, severity, module, message, context). |
| **winston** 3.19.0 | ⚠️ Acceptable | Works, but slower, more configurable in ways you don't need, and its ecosystem has fragmented over the years. No reason to prefer it over pino here. |
| **`system_events` table + UI panel** | ✅ **Use this** for the error panel | R-045 asks for a "painel de erros." Building it as a first-class table (not a log-file tail) means errors are queryable, filterable, dismissible, and survive log rotation. This is the same UI you already build for R-046. |
| **Sentry / any cloud APM** | ❌ **Reject** | Violates "local only, no cloud." It would also ship lead conversation content to a third party — a direct LGPD problem under R-064. There is no self-hosted variant worth the operational cost here. |
| **`electron-log`** 5.4.4 | ❌ Reject | Only relevant if you adopt Electron. You're not, in the MVP. |

**The LGPD constraint on logging (this is the part people get wrong):**
- **Never log message bodies at `info` level.** Log `message_id`, `lead_id`, `direction`, `char_count`, and a hash. Full bodies belong in the `messages` table, which is the auditable record R-043 requires and which you control.
- **Never log LLM request/response payloads wholesale.** Log `model`, `prompt_tokens`, `completion_tokens`, `latency_ms`, `zod_parse_ok`, and the *decision fields* — not the transcript. Prompt logging is how LGPD leaks happen.
- **Redact at the logger, not at the call site.** A pino `redact` config for `['req.headers.authorization', '*.phone', '*.body']` makes the safe path the default path. A developer who forgets to redact cannot leak, because the logger already did it for them.
- **Never log the Baileys auth folder.** Add `auth_info_baileys/` to `.gitignore` and to the log-rotation exclusion list. Losing that folder means WhatsApp sees a "new device," which is itself a ban signal.

**R-045 critical-failure mapping** — each of these must produce both a `system_events` row and a local notification:
| Failure | Detection |
|---|---|
| WhatsApp disconnected | Baileys `connection.update` → `connection: 'close'` (note `DisconnectReason.loggedOut` = terminal, notify loudly) |
| LLM API down | non-2xx / timeout / Zod parse failure after retry |
| PostgreSQL stopped | pool `'error'` event + a 2s connectivity probe on the cron tick |
| Banned | `DisconnectReason.forbidden` / `401` / `403` on the socket, or send failures clustering |

---

## Alternatives Considered

| Recommended | Alternative | When to Use the Alternative |
|---|---|---|
| Baileys 6.7.24 | **Baileys 7.0.0-rc14** | Once 7.0.0 ships stable *and* you have a spare SIM to test the LID migration on. Never in the pilot — R-059 makes the number irreplaceable. |
| Baileys 6.7.24 | **WPPConnect** (`@wppconnect-team/wppconnect`) | When you need its built-in REST server and multi-session manager — i.e. R-048 multiplies into many numbers and you want language-agnostic HTTP access. Accept the LGPL and the Chromium cost at that point. |
| Baileys 6.7.24 | **whatsmeow** (Go) | If Baileys breaks unrecoverably and you need a different implementation of the same protocol. Requires a Go toolchain + a bridge process on Windows — a real cost, and it means TS types stop at the bridge. |
| Baileys 6.7.24 | **whatsapp-web.js** | Never, for this project. Same Chromium fragility as WPPConnect, but JavaScript and without the extra tooling. |
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

---

## What NOT to Use

| Avoid | Why | Use Instead |
|---|---|---|
| **`@whiskeysockets/baileys@latest`** | `latest` = `7.0.0-rc14`, a release candidate that has been RC since Sept 2025. The 7.x line carries a **breaking change to contact identity (LID)** and no migration guide is published at the URL the repo points to (`whiskey.so/migrate-latest` → 404). | `@whiskeysockets/baileys@6.7.24`, installed with `--save-exact` |
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

---

## Stack Patterns by Variant

**If you adopt Baileys 7.0.0 once it is stable (or a `whatsmeow` bridge):**
- Switch the `WhatsAppPort` implementation only. The `Contact.id` / LID change lives entirely inside the adapter's `normalizeJid()`.
- Because the schema already stores `phone_number`, `wa_jid`, and `lid` separately (mandated in §LID trap), no data migration is required.
- Re-test the handoff and follow-up paths end-to-end before pointing the pilot number at it. **Confidence: MEDIUM.**

**If the WhatsApp number is banned (R-059's ALTO risk realized):**
- The CRM must already be exportable to CSV at any moment — export continuously or on every status change, not only on backup. Losing the number should cost the channel, not the pipeline.
- `pg-boss` jobs referencing the dead `wa_jid` must fail into a `system_events` row, not spin. The Baileys `DisconnectReason.forbidden` path must be a terminal state, not a reconnect loop.
- **Consider a second spare SIM from day one** — not used, but available. This is cheap insurance against the project's dominant risk and is not "aquecimento automático" (R-039/R-040 are about volume, not spares).

**If the LLM provider changes (R-009 keeps this open):**
- The `LlmPort` interface is one method: `decide(input): Promise<Decision>` where `Decision` is the Zod schema from §LLM Integration. Swapping providers touches one file.
- The offline bake-off harness (20-40 transcripts, pt-BR register scoring) is the gate. Do not swap providers on a hunch.

**If the pilot graduates to multiple numbers (R-048/R-028):**
- Every table that references a conversation needs a `channel_account_id`. Add it now as a single-row table; adding it later to a live schema is a much harder migration.
- WPPConnect's multi-session REST server becomes materially more attractive at that point, and the LGPL question becomes real.
- `pg-boss` scales fine (add workers); `p-queue` becomes per-account.

**If you need to run headless/always-on on Windows:**
- Task Scheduler with "Run whether user is logged on or not" plus a stored credential. Add a `SIGINT`/`SIGTERM` handler that closes the Baileys socket gracefully — an abrupt kill can corrupt `useMultiFileAuthState`, and a corrupted auth folder reads as a new device to WhatsApp.

---

## Version Compatibility

| Package A | Compatible With | Notes |
|---|---|---|
| `@whiskeysockets/baileys@6.7.24` | Node ≥ 20, ESM or CJS | Ships its own `useMultiFileAuthState`. **The `auth_info_baileys/` folder is the session — back it up separately from the DB and never commit it.** Requires `BufferJSON` replacer/reviver when serializing creds to JSON. |
| `@whiskeysockets/baileys@7.0.0-rc14` | — | **Do not install.** `Contact.id` may be LID; `makeSignalRepository` signature changed; migration URL is 404. |
| `drizzle-orm@0.45.3` | `pg >=8`, `drizzle-kit@0.31.11` | `drizzle-kit` depends on `tsx ^4.21.0` + `esbuild ^0.25.4` (it does **not** use the TypeScript compiler API, so it is unaffected by TypeScript 7). |
| `pg-boss@12.35.0` | `pg ^8.23.0` | **Exact match** with the recommended driver — one `pg` in the tree, no dual-driver connection pools. `pg-boss` needs its own connection/pool, separate from the app's. |
| `pg@8.23.0` | `@types/pg@8.23.1` | Keep lockstep. |
| `ai@7.0.118` | `zod ^4.1.8`, Node ≥ 22 | Satisfied by `zod@4.6.5` and Node 24 LTS. Also pairs with `@ai-sdk/openai@4.0.78`, `@ai-sdk/anthropic@4.0.65`, `@ai-sdk/google@4.0.82` — all declare the same zod peer. |
| `typescript@7.0.2` | `vite@8.3.1`, `vitest@5.0.2`, `tsx@4.23.15` | All fine: none depend on the TypeScript compiler API. **Blockers would be** `typescript-eslint` (needs the `@typescript/typescript6` shim) and Volar-family tooling (Vue/Svelte/Astro/MDX) — none used. `baseUrl` and `target: es5` are hard errors; use relative imports and `target: es2023`. |
| `@biomejs/biome@2.5.14` | `typescript@7.0.2` | No TS API dependency — this is precisely why it is recommended over ESLint here. |
| `postgres@17.x` | `pg_dump` 17.x | `pg_dump` must be from the **same major version** as the server. Version-stamp backup filenames. |
| `fastify@5.12.5` | `@fastify/static` | Bind to `127.0.0.1` for the secure context required by Web Notifications. |

---

## Confidence Summary

| Recommendation | Confidence | Basis |
|---|---|---|
| Node.js 24 LTS over Node 26 | HIGH | `nodejs.org/dist/index.json` verified 2026-09-28 |
| TypeScript 7.0.2 for a pure-TS greenfield project | MEDIUM-HIGH | GA 2026-07-08; multiple sources confirm pure-TS is the supported case. New (~2.5 months old). |
| Baileys over WPPConnect | HIGH | GitHub API + npm verified: MIT vs LGPL, TS vs TS, 50 MB vs 200-500 MB |
| Baileys **6.7.24** over `latest` RC | MEDIUM | RC-stability argument is strong and verifiable; but 7.x has had 13 months of RC and may be the more *fixed* branch. Both are defensible. |
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

---

## Open Questions / Roadmap Flags

1. **R-007 burst behavior is unresolved and is a ban-risk item, not an implementation detail.** Firing every missed follow-up on boot is machine-cadence burst traffic. Recommend a bounded, jittered drain. Needs a decision before the follow-up phase is planned.
2. **Migration to the official Cloud API is not a pure adapter swap.** On the official platform, free-form replies are only allowed inside a 24-hour customer service window; business-initiated messages outside it need **pre-approved templates**. R-003/R-004 (follow-ups with no inbound message) and R-026 (pre-meeting reminders) therefore need template equivalents. **The adapter boundary is necessary but not sufficient** — flag this to whoever plans the migration phase.
3. **The pt-BR tone bake-off is unresolved.** No public benchmark measures Brazilian WhatsApp B2B sales register. Build the harness; do not assume.
4. **WhatsApp notification reliability on the Admin's specific Windows machine is unverified.** Test Focus Assist, per-app notification settings, and ExecutionPolicy in Phase 1. Have the browser-chime fallback ready from day one.
5. **Ban mechanism is genuinely disputed in the sources** (behavior-based vs protocol-fingerprint-based) and could not be resolved from public evidence. This affects how much effort to invest in humanization (R-067) versus number hygiene. Treat humanization as mandatory regardless — it is cheap and also improves tone.
6. **WPPConnect's forks of Baileys and whatsmeow** are a strategic hedge by that team. Worth a periodic look: if WPPConnect's Baileys fork becomes the more reliably patched one, it is a drop-in swap *within the same adapter* — but note the license change (MIT → LGPL) at that point.

---

## Sources

**Context7 (authoritative, fetched 2026-09-28)**
- `/whiskeysockets/baileys` — `makeWASocket`, `useMultiFileAuthState`, `requestPairingCode`, connection lifecycle
- `/websites/ai-sdk_dev` — `generateObject` / `Output.object` structured output, `stopWhen` + tool calling interaction
- `/websites/baileys_wiki` — library discovery, corroborating snippets

**npm registry (verified directly, 2026-09-28)**
- `npm view @whiskeysockets/baileys dist-tags time license` → `latest: 7.0.0-rc14`, `legacy: 6.7.24`, both published 2026-07-29; MIT
- `npm view prisma dist-tags` → `latest: 8.0.0-rc.17`, `prev: 7.10.0`
- `npm view typescript dist-tags time` → `latest: 7.0.2` (2026-07-08), `6.0.3` (2026-04-16)
- `npm view drizzle-orm dist-tags.latest` → `0.45.3` (stable, no RC in `latest`)
- `npm view bullmq peerDependencies` → requires `pg >=8.0.0` **AND `redis >=5.0.0` AND `ioredis >=5.0.0`**
- `npm view pg-boss@12.35.0 dependencies` → `pg: ^8.23.0`; `time.modified` 2026-09-26
- `npm view ai@7.0.118` → `zod ^3.25.76 || ^4.1.8`, `engines.node >=22`
- `npm view @wppconnect-team/wppconnect license` → `LGPL-3.0-or-later`; `@wppconnect/wa-js` → `Apache-2.0`
- `npm view venom-bot time.modified` → 2024-11-23 (effectively unmaintained)
- `nodejs.org/dist/index.json` → current v26.10.0, LTS Krypton v24.21.0

**GitHub API (verified 2026-09-28)**
- `WhiskeySockets/Baileys` → 11,174 stars, 333 open issues, pushed 2026-09-27; releases `v6.7.24` and `v7.0.0-rc14` same day
- `wppconnect-team/*` → 8 repos pushed on 2026-09-28; org maintains **forks of `baileys` and `whatsmeow`**
- `mikaelbr/node-notifier` → **last push 2024-06-24**, 5,843 stars, **129 open issues**
- `WhiskeySockets/Baileys` LID issue search → open LID-migration bugs on the current line (proto3 `required` fields, `status@broadcast` ack 479, MESSAGE_EDIT empty `key.id`, GCM decrypt failure in LID-migrated chats)

**Official documentation (fetched 2026-09-28)**
- `devblogs.microsoft.com/typescript/announcing-typescript-native-previews/` — Corsa/Strada, migration posture
- `github.com/microsoft/typescript-go` README — feature-parity table (Program creation → done; Language service → in progress; API → not ready until 7.1)
- `developers.facebook.com/docs/whatsapp/overview/policy-enforcement/` — enforcement ladder: warning → 1/3/5/7/30-day blocks → account lock → permanent disablement
- `ai-sdk.dev/docs/ai-sdk-core/generating-structured-data` — `Output.object` + Zod
- `github.com/Windos/BurntToast` — `-Urgent` breaks through Focus Assist
- `github.com/xan105/node-powertoast` — the PowerShell/WinRT approach and its caveats

**Community/industry sources (varied confidence — cited for the ban-risk landscape, which is genuinely contested)**
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

**Explicitly NOT relied upon:** the contents of `whiskey.so/migrate-latest` (404 as of 2026-09-28 — the URL the Baileys README itself points to, which is itself a signal about 7.x's readiness).

---

*Stack research for: Automação Local de WhatsApp para Prospecção B2B*
*Researched: 2026-09-28*
*All versions verified against npm registry, GitHub API, and Context7 on the research date.*
