# Phase 1: Fundação, Canal e Gate de Envio - Context

**Gathered:** 2026-09-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Fundação durável e o canal isolado antes de qualquer fiação de LLM (invariante de ordem nº1 da pesquisa). A Fase 1 entrega:

1. **Estado durável no PostgreSQL local** — schema Drizzle (migrações `.sql` revisáveis) com `engagement_mode`, FSM `state`, `last_processed_at` (watermark), `FOR UPDATE` por conversa, `CHECK` em todo enum, `optout_ledger` append-only, `idempotency_key` UNIQUE, campos multiusuário nullable (R-028) e travas de cota com `CHECK`.
2. **Canal WhatsApp isolado** — `ChannelPort` em E.164, `FakeChannel` (testes) + `BaileysChannelAdapter` (pin exato `7.0.0-rc14`, `capabilities()` declarando apenas texto/links, `JidResolver` LID↔PN em colunas separadas), buffer de boot `AwaitingInitialSync`, `onWhatsApp()` com cache 7 dias, reconnect com teardown + backoff, singleton; auth state fora do OneDrive.
3. **Gate único de envio `evaluatePolicy`** — função pura + 12 guards (1:1 com AR-001..AR-012) + 12 property tests + lint `no-restricted-imports` bloqueando chamadas ao canal fora do dispatcher; `Outbox`+`Dispatcher`+`humanize.ts`+sequenciador global e cooldown por par; travas duras (contadores 20–30 msg/dia, 20 leads/dia, `fetchNewChatMessageCap`, handler 463 sem retry); kill switch global; `HealthMonitor`+`pino`+`notify.ps1`; backup `pg_dump -Fc` restaurado; launcher `.cmd` (checa Postgres → migra → sobe).

**Não pertence à Fase 1:** qualquer chamada a LLM/provedor de IA (Fase 2), scheduler/cadência de follow-up (Fase 3), painel web (Fase 3), dreno de R-007 (Fase 3). A Fase 1 apenas **instrumenta** a mecânica — o comportamento observável desses requisitos nasce nas fases posteriores.

Requisitos escopados (23): OPRE-01, LEAD-01, LEAD-02, LEAD-03, LEAD-04, WHS-01, WHS-03, WHS-04, WHS-05, CONV-11, CONV-13, CONV-14, INTR-01, COMP-02, COMP-03, COMP-04, COMP-05, NFRQ-01, NFRQ-02, NFRQ-04, NFRQ-06, EQUP-01, EQUP-02.
</domain>

<decisions>
## Implementation Decisions

Todas as áreas foram auto-selecionadas e auto-resolvidas em modo `--auto`: escolheu-se a opção recomendada em cada uma. Rastreabilidade das alternativas em `01-DISCUSSION-LOG.md`.

### Armazenamento fora do OneDrive (COMP-05)
- **D-01:** Raiz única de dados do sistema em `C:\whatsapp_prospecao\` (fora da árvore OneDrive e fora do repo), com subpastas `auth\` (auth state do Baileys), `backups\` (pg_dump) e `logs\` (pino). O path vem de `.env` (`DATA_ROOT`), com esse default; nunca dentro de OneDrive/git. Backup versionado por data/hora em `backups\`; auth state **nunca** commitada nem incluída na rotação de logs.

### Captura da 1ª mensagem manual (OPRE-01, CONV-01, R-001)
- **D-02:** O trigger de "bot assume a conversa" é o evento de **mensagem de saída do próprio Admin** detectada via Baileys (`messages.upsert` com `key.fromMe` no chat do lead em estado relevante). Sem botão dedicado na Fase 1 (o painel só existe na Fase 3): a captura é o fato de o Admin ter enviado manualmente a 1ª mensagem no app do WhatsApp ligado ao número. O sistema registra isso no `last_processed_at` do lead e transiciona para o comportamento de assumir (aguardando resposta do lead ou follow-up). R-001 permanece como guard no gate (AR-001): o bot **nunca** inicia o primeiro contato.

### Janela operacional na Fase 1 (WHS-01)
- **D-03:** Janela de dias úteis 7h–17h implementada com calendário de **só dias úteis** na Fase 1 (dias de semana). Processamento de feriados brasileiros (`business-hours.ts` com feriados BR) fica **adiado para a Fase 3** (FLUP-03) — a Fase 1 entrega a mecânica de janela/teste, a Fase 3 enriquece o calendário.

### Limites diários (R-023*/WHS-04)
- **D-04:** Defaults configuráveis via `.env` (não hardcoded): **25 mensagens/dia** (meio do intervalo 20–30) e **20 leads/dia**. Além disso, a Fase 1 lê `fetchNewChatMessageCap()` do Baileys como **terceira trava adicional** — o limite efetivo é sempre `min(limite_configurado, cap_lido)`. Erro **463 jamais é retryado**: suspende o contato frio e emite alerta; contadores em tabelas com `CHECK (count <= limite)` no schema.

### Pureza e testabilidade do gate (CONV-14)
- **D-05:** `evaluatePolicy` é função **pura**: recebe `(mensagem_candidata, snapshot_de_estado, config)` e devolve `{ permitido: boolean, motivo }`. Nada de I/O interno — o dispatcher injeta o snapshot (lido via `FOR UPDATE` na mesma transação do enfileiramento). Isso torna os 12 property tests (1 por AR) triviais e determinísticos. Config vem de `.env` + tabelas de cota, nunca hardcoded no gate.
- **D-06:** Lint `no-restricted-imports` bloqueia importar `BaileysChannelAdapter`/`ChannelPort` fora do `Dispatcher`/`Adapters` — sem import, sem caminho alternativo de envio.

### Notificação local na Fase 1 (NFRQ-04, NFRQ-06)
- **D-07:** `notify.ps1` (PowerShell + WinRT ToastNotificationManager, sem dependência `node-notifier`) é o transporte de notificação da Fase 1, acionado via subprocess pelo app. **Smoke test obrigatório na máquina do Admin** dentro da Fase 1: validar Focus Assist, ExecutionPolicy e som (inclusive em RDP/áudio). O chime Web Audio fica como redundância quando houver painel (Fase 3) — nota-se aqui, não se constrói agora.

### Integração da API do caça-leads (LEAD-01)
- **D-08:** A API do caça-leads **não está especificada** (schema, auth, rate limit — bloqueio registrado em STATE.md). A Fase 1 define o **port/interface** (`LeadSourcePort`: listar com filtros estado/cidade/região/nicho/nome-chave + importar) com um `FakeLeadSourceAdapter` de fixture para testes e um `HttpLeadSourceAdapter` esqueleto atrás de interface. O contrato real de HTTP fica bloqueado em pesquisa, não na arquitetura. AR-011 continua valendo na importação: lead só entra com origem, base legal e finalidade registradas.

### O que a Fase 1 NÃO decide (adiado com consciência)
- Provedor de LLM, prompts, shadow mode, handoff, detecção de opt-out → **Fase 2**.
- Scheduler/cadência, dreno de R-007, painel, CRM operacional, feriados BR → **Fase 3**.
- Break-up message, appeal de ban, multiusuário operacional → **Fase 4/v2** (ver `<deferred>`).

### Implicações do gate (não pertencem à Fase 1)
- A Fase 1 constrói o gate para **todo** o tráfego de saída futuro (IA na Fase 2, follow-up na Fase 3) — o gate não conhece a origem da mensagem; qualquer chamador passa por `evaluatePolicy`. Isso é o que torna os 12 AR invariantes estruturais e não "prompts".
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap & Requisitos
- `.planning/ROADMAP.md` §Phase 1 — Goal, Success Criteria (5), escopo de requisitos, sketches dos 3 plans (01-01 fundação/compliance, 01-02 canal/ingestão, 01-03 gate/operação) e Notas de Cobertura (divisão mecânica/comportamento, R-001 transversal).
- `.planning/REQUIREMENTS.md` — Os 23 REQ-IDs da Fase 1 + Traceability. OPRE-01, LEAD-01..04, WHS-01/03/04/05, CONV-11/13/14, INTR-01, COMP-02..05, NFRQ-01/02/04/06, EQUP-01/02.
- `docs/01-requisitos-funcionais.md` — Documento-fonte (R-001..R-067, 13 módulos). Fonte primária dos textos completos; contém as contradições conhecidas (R-004×R-005, R-058 inexistente) que o roadmap já reconciliou.
- `docs/10-anti-requisitos.md` — AR-001..AR-012. Base dos 12 guards do gate (CONV-14).

### Decisões de projeto
- `.planning/PROJECT.md` ## Key Decisions — R-019* reaberto (onWhatsApp), R-023* 2ª trava, R-007 FIRE_ONCE, Baileys rc14 pin, stack Node 24/TS7/Biome/Drizzle/pg-boss, OneDrive fora, shadow como gate, cold prospecting anti-feature.
- `.planning/STATE.md` — Bloqueio "API do caça-leads não especificada" e smoke test Windows pendente na Fase 1.

### Pesquisa técnica (fontes da Fase 1)
- `.planning/research/ARCHITECTURE.md` — Padrões: FSM hintada, Single Choke Point (gate único), Outbox com reserva no mesmo `FOR UPDATE`, EventBus memória + fila Postgres, relógio injetado (`NowToken`), buffer de boot do Baileys (Anti-Padrão 5), forma do schema (migração da linha ¥462 em diante), reconnect com teardown (Anti-Padrão 7).
- `.planning/research/PITFALLS.md` — Pitfalls 1 (463/reach-out time-lock), 2 (R-019: enviar a número inexistente restringe conta), 4 (AR são de estado → gate único), 7 (LGPD: teste de balanceamento, canal do titular, Encarregado), 9 (backup nunca testado + auth state fora do backup), 10 (npm i baileys instala RC; pin exato; bump ↔ banimento). Pitfall-to-Phase Mapping.
- `.planning/research/STACK.md` — Versões pin exato: `@whiskeysockets/baileys@7.0.0-rc14`, Node 24 LTS, TS 7.0.2, Drizzle 0.45.3/kit 0.31.11, `pg` 8.23.0, pg-boss 12.35.0, pino 10.3.1, Biome 2.5.14, Vitest 5. §Version Pinning, §LID trap (colunas `wa_jid` + `lid`, `JidResolver`).

### Skills do projeto (fonte de verdade comportamental)
- `.ruler/skills/whatsapp-baileys/SKILL.md` — Conexão local, sessão, QR, reconexão com backoff, fila 20–30/dia, janela dias úteis 7h–17h, mídia recebida → handoff (não processa).
- `.ruler/skills/lgpd-optout/SKILL.md` — Base legal legítimo interesse, registro de origem, opt-out irreversível, exclusão, teste de balanceamento.
- `AGENTS.md` — Regras Não Negociáveis (R-001, sem preço/agendamento/mídia/opt-out/IA-espontânea, 7–17h, 20–30/dia, handoff nos gatilhos críticos, LGPD).

### Não há SPEC.md
Nenhum `01-SPEC.md` existe — requisitos não são locked por SPEC; vale o que está em REQUIREMENTS.md + Fase 1 do ROADMAP.
</canonical_refs>

<code_context>
## Existing Code Insights

Projeto **greenfield** — não há `src/`. Os únicos ativos existentes:

### Reusable Assets
- `.ruler/skills/` (7 skills + 5 agentes) — fonte de verdade comportamental; `whatsapp-baileys` e `lgpd-optout` definem contratos que a Fase 1 implementa. Distribuível via `npx ruler apply` → `.opencode/skills/` (ainda não distribuído — ver integração).
- `docs/01-requisitos-funcionais.md` + `docs/10-anti-requisitos.md` — base canônica dos requisitos/AR.
- `main.py` — **não relacionado** (checklist de crédito `python-docx`, "Auto Equity"); deve ser ignorado, não integrado.

### Established Patterns
- Nenhum padrão de código (greenfield). Padrões **prescritos pela pesquisa** a adotar na Fase 1: port/adaptador (`ChannelPort`), `FakeChannel` para testes, outbox transacional, FSM hintada, gate puro, relógio injetado.

### Integration Points
- `ChannelPort` é o único ponto de integração com o WhatsApp na Fase 1 (futuro: adaptador API oficial atrás da mesma interface).
- `LeadSourcePort` é o único ponto de integração com o caça-leads (bloqueado por spec, ver D-08).
- HealthMonitor (pino) + `notify.ps1` — único ponto de notificação local.
- Launcher `.cmd` (Windows Task Scheduler) é o ponto de entrada de processo; `drizzle-kit generate` → `.sql` → migrate no boot.
</code_context>

<specifics>
## Specific Ideas

- **Pin exato do Baileys:** `@whiskeysockets/baileys@7.0.0-rc14` com `--save-exact` — nunca `latest` (instala RC por padrão; 6.7.x não tem tctoken/463/quota APIs).
- **R-001 como guard, não UX:** o ROADMAP/CLI não decide "UX de primeira mensagem"; a Fase 1 o impõe no gate (AR-001) + captura de `fromMe`.
- **Tenacidade anti-ban:** o número é irreplaceable (R-059). Toda decisão de Fase 1 (dreno, buffer, cache, jitter) prioriza não queimar o número sobre velocidade.
</specifics>

<deferred>
## Deferred Ideas

- **Feriados brasileiros no calendário** — Fase 3 (`business-hours.ts`, FLUP-03). A Fase 1 faz só dias úteis.
- **Chime Web Audio como redundância de notificação** — Fase 3 (quando existir painel).
- **Detecção de opt-out / mídia recebida / handoff** — Fase 2 (requer matcher + LLM; COMP-01). A Fase 1 deixa o `optout_ledger`/guard prontos, a **detecção** não.
- **Break-up message (FLUP-11 v2)** e **appeal de ban** — Fase 4, decididos com dado do piloto.
- **Multiusuário operacional (R-029/R-030)** — v2; a Fase 1 só deixa colunas nullable no schema (EQUP-02).
- A decomposição da caça-leads (schema HTTP real) — depositada em pesquisa/STATE.md, não arquitetura.
</deferred>

---

*Phase: 1-Fundação, Canal e Gate de Envio*
*Context gathered: 2026-09-28*