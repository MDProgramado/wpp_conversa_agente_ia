# Resumo da Pesquisa de Projeto

**Projeto:** Automação Local de WhatsApp para Prospecção B2B
**Domínio:** Daemon local Windows (Node.js/TS) sobre canal WhatsApp não oficial + LLM externa + PostgreSQL local, com handoff humano obrigatório
**Pesquisado:** 2026-09-28
**Confiança geral:** ALTA (fontes primárias: repositório WhiskeySockets/Baileys, docs do PostgreSQL, ANPD, jurisprudência)

> Este resumo **sintetiza** e **reconcilia** os 4 artefatos. Onde eles divergem, a decisão reconciliada está marcada ⚠️ **RECONCILIAÇÃO** e é mandatória.
> Detalhes completos em `STACK.md`, `FEATURES.md`, `ARCHITECTURE.md`, `PITFALLS.md`.

---

## Resumo Executivo

Este é um **sistema local de um processo, com estado durável, onde o LLM é uma subrotina sem autoridade**. A pesquisa convergiu de forma independente, a partir de três dimensões, sobre a mesma arquitetura: máquina de estados no PostgreSQL, transições determinísticas em código, prompt *renderizado a partir* do estado (nunca o contrário), e um **único choke point de saída** — uma função pura `evaluatePolicy(state, now, intent)` que é a única autoridade sobre "esta mensagem pode sair?". Os 12 anti-requisitos não cabem em um prompt e não cabem em vários `if` espalhados: 6 deles (AR-005, AR-007, AR-008, AR-009, AR-010, AR-011) são **invariantes de estado** e precisam ser lidas do banco num gate único; os outros 6 (AR-001, AR-002, AR-003, AR-004, AR-006, AR-012) são invariantes de **conteúdo** e precisam de schema de saída + classificador de intent + regex sobre o texto gerado. Convenção não é arquitetura — a choke point só é verdadeira se uma regra de lint (`no-restricted-imports`) proibir qualquer chamada ao canal fora de `src/outbound/dispatcher.ts`. Stack: **Node.js 24 LTS + TypeScript 7 + Baileys + Drizzle/pg + Fastify + React (localhost, não Electron) + Vercel AI SDK 7 + pg-boss + pino**. Python está descartado (Baileys é TypeScript-only; AI SDK é TS-first; R-044 não pede Python).

**Três achados reescrevem requisitos existentes.** (1) **Erro 463 / Reach-out Time-lock** — o WhatsApp restringe contas que enviam para contatos sem Trusted Contact token; retry é proibido pelo próprio WhatsApp Web. Isso transforma **R-001 (primeira mensagem manual) na mitigação técnica primária do projeto**, não em boa prática de UX, e reframeia R-023: o orçamento real é **N contatos novos/dia** (consultável via `fetchNewChatMessageCap()`), não 20–30 mensagens/dia. (2) **R-019 está tecnicamente invalido**: enviar para número inexistente pode gerar *restrição de conta*, não erro de mensagem — `onWhatsApp()` volta para o escopo. (3) **O diretório de trabalho está dentro do OneDrive**: auth state do Baileys e dumps LGPD sincronizariam sem criptografia, contradizendo R-033 — estado e backup **precisam** viver fora da árvore OneDrive.

**⚠️ RECONCILIAÇÃO — versão do Baileys: fixar `7.0.0-rc14`, exato.** STACK.md recomendava `6.7.24` com o argumento "nunca instale RC". PITFALLS.md apresentou evidência primária que **anula** essa recomendação: diff direto da árvore do repositório mostra que a tag `v6.7.24` (165 arquivos) **não contém nenhum arquivo** de tctoken/reach-out, enquanto `v7.0.0-rc14` contém `src/Utils/tc-token-utils.ts`; `messages-send.ts` na 6.7.24 tem **zero** menções a `fetchAccountReachoutTimelock`/`fetchNewChatMessageCap`; as release notes do rc10 listam literalmente *"Full TC Token issuance"*, *"Reachout Timelock ... 463"* e *"463 handlers and safety-paths"*. Como 463 é a mitigação anti-ban primária do projeto, fixar 6.7.24 removeria do código o caminho de segurança crítico. **Decisão: `--save-exact @whiskeysockets/baileys@7.0.0-rc14`, com piso `>= 7.0.0-rc10`, lockfile commitado, aceitação consciente do RC por escrito e plano de rollback testado *dentro da linha 7*.** O argumento "evite RC" continua válido como regra geral e continua válido aqui: o `latest` **é** `7.0.0-rc14`, então `--save-exact` é obrigatório — mas a escolha entre RC e legado aqui **não é questão de estabilidade, é questão de funcionalidade**. Independentemente da versão, a normalização LID↔PN é requisito de Fase 1.

**Contexto de mercado que fecha o escopo.** Prospecção fria é **proibida na API oficial da Meta** (opt-in + template aprovado obrigatório — a LeadCNPJ documenta isso abertamente no próprio produto). O fluxo "humano manda a 1ª mensagem → bot assume" **só existe no canal não oficial**. Consequência: todo o conjunto conformável (template, opt-in real, quality rating monitorado pela Meta, broadcast) é **anti-feature, não backlog** — listar explicitamente para não ser "esquecido" como v2. E como R-061 exige ~30 dias de operação contínua com risco diário de ban em cada dia, **shadow mode (bot rascunha, nunca envia) é gate de P1**, não feature opcional: é o que valida qualidade de fala e guardrails sem consumir a janela de tolerância do número.

---

## Achados-Chave

### Stack Recomendada

Detalhe em `STACK.md`. Versões verificadas contra npm registry / GitHub API em 2026-09-28.

**Tecnologias centrais:**

- **Node.js 24 LTS** (`24.21.0`) — runtime estável; **não** usar Node 26 (Current, não LTS) para um bot always-on
- **TypeScript 7.0.2** (GA) — greenfield, portanto a "dívida" de migração 6→7 é zero; type-check 8–12x mais rápido
- **@whiskeysockets/baileys `7.0.0-rc14`** (⚠️ reconciliado) — cliente de protocolo sem Chromium (~50 MB vs 200–500 MB), MIT vs LGPL do WPPConnect, TypeScript-native, evento assíncrono limpo que mapeia na porta `ChannelPort`
- **PostgreSQL 17.x + drizzle-orm 0.45.3 + pg 8.23.0** — `latest` do Drizzle é release estável real (o do Prisma é `8.0.0-rc.17`, armadilha equivalente); migrações em `.sql` revisáveis; sem binário de query engine (Prisma tem histórico de problema em Windows + pastas sincronizadas)
- **ai (Vercel AI SDK 7.0.118) + zod 4.6.5** — `Output.object({ schema })` converte o LLM de gerador de texto em função de decisão tipada; **LangChain rejeitado** (seu framework move controle de fluxo para o modelo — o inverso exato de R-009)
- **Fastify 5.12.5 + React 19 + Vite 8 + Tailwind 4** — painel denso multi-pane é layout web; bind em `127.0.0.1` (contexto seguro p/ Web Notifications); **SSE**, não WebSocket (reconexão automática); **Electron diferido** para pós-MVP como `BrowserWindow` fino
- **pg-boss 12.35.0 + croner 10 + p-queue 9** — fila durável no Postgres que já existe (BullMQ exigiria Redis = 4º serviço, proibido por R-044); singleton prev double-send; **gates vivem no caminho de envio, nunca no scheduler**
- **pino 10** — redaction no logger (não no call site); corpo de mensagem **nunca** vai para log (LGPD)
- **`notify.ps1` + WinRT próprio** — `node-notifier` **rejeitado** (último push 2024-06-24, 129 issues, não usa WinRT, toasts sem AppUserModelID caem silenciosamente); R-013 é load-bearing, não pode depender de pacote de 2 anos

**Não usar:** qualquer Chromium (puppeteer/whatsapp-web.js/venom/WPPConnect), BullMQ+Redis, Sentry (viola local-only e exfiltra LGPD), `pm2` no Windows, `prisma@latest`, `node-notifier`, `better-sqlite3` (R-031 manda Postgres; e `pg-boss` exige Postgres).

**O bug de segurança:** `v7.0.0-rc12` corrigiu **GHSA-qvv5-jq5g-4cgg**. Fixar numa versão "mais estável e antiga" é escolher vulnerabilidade — argumento adicional contra a linha `legacy`.

### Features Esperadas

Detalhe em `FEATURES.md` (escrita em pt-BR).

**Table stakes (não podem faltar no MVP):**
- Canal Baileys + QR pairing + watchdog de desconexão
- **Assumir conversa após 1ª mensagem manual** (R-001/R-002) — inversão do mercado, mas table stake funcional
- Conversa conduzida por LLM com memória (curta + média, resumo progressivo) — R-008/R-011
- Humanização de envio: delays + digitando + quebra de mensagem (R-067)
- Follow-up com cadência, máx 4 toques (R-003..R-005)
- Trava de limite diário + janela de envio (R-006/R-023) — *e agora também trava de contatos novos*
- Pipeline de status com histórico imutável (R-021/R-022/R-043)
- Busca, filtros, tags, notas, timeline de atividades (R-043)
- Handoff humano com notificação (R-012/R-013) — handoff como **fronteira projetada**, não escalonamento
- Detecção de opt-out + registro de origem/base legal/finalidade (R-024/R-064)
- Logs + notificação de falha crítica (R-045)
- Persistência + backup (R-031/R-032)
- **Kill switch global** ⚠️ GAP — R-046 só tem pausa por conversa; falta pausa global independente do app
- **Nenhum envio sem ação explícita do Admin** em modo manual/copiloto (AR-010/R-014)

**Differentiators (o produto em si):**
- **Guardrails como invariantes de runtime, não como prompt** — nenhum concorrente lista "o bot está PROIBIDO de falar de preço" como restrição verificada
- **Contato sempre iniciado por humano** — assinatura do produto (inverte a categoria inteira)
- **Modo silêncio total** — nenhum concorrente tem "não responder" como feature
- **Trilha de auditoria das decisões da IA** (não só de ações humanas)
- **Shadow mode / simulação** ⚠️ *recomendação da pesquisa* — validar sem tocar no número
- **Camada de canal isolada** (R-016) — valor de fase futura, não de MVP
- **BANT-lite de 2 critérios** (verba + decisão), validação híbrida (R-051/R-052)
- **Local-first** — dado sai do PC só para a API de LLM
- **Baixo volume como posição, não limitação**
- **Painel único** com modo exibido em tempo real (R-046)
- **Filtro de compliance local com notificação** — síntese de *intent* permitida, síntese de *valor* nunca

**Anti-features (20+, nunca construir — listar explicitamente para não virarem backlog):**
disparo em massa/broadcast · auto first-contact · envio de mídia · processamento de mídia recebida · negociação de preço · agendamento autônomo · Google Calendar/e-mail/planilhas/Telegram/CRM externo · omnichannel · multi-número/rotação de chips · aquecimento automático · ~~validação de existência de número~~ **(AGORA VOLTA PRO SCOPE — ver R-019 abaixo)** · dedup automático · lead scoring/enriquecimento CNPJ · relatórios avançados · financeiro avançado · multiusuário · WhatsApp Payments · gestão de templates · respostas automáticas de ausência · qualquer ação do bot após handoff · construtor visual n8n-style · **impersonação profunda** (clonar voz, fabricar biografia do Admin — nova anti-feature, com base em Air Canada 2024 e OLG Hamm 2026)

**Diferir (v2+):** copiloto pós-handoff completo · confirmação/lembrete pós-agendamento (R-026) · painel dividido completo · break-up no follow-up final *(decisão aberta — ver abaixo)* · apuração mensal R-061/R-062 · migração para API oficial (R-016) · analytics (R-035) · financeiro (R-036) · multiusuário (R-028..R-030) · documento de teste de balanceamento LGPD versionado · RIPD

### Abordagem de Arquitetura

Detalhe em `ARCHITECTURE.md`. **Hexagonal com FSM no Postgres e choke point único.** O canal WhatsApp é adaptador, mas Baileys vaza vocabulário próprio (`@jid`, `@s.whatsapp.net`, `@lid`, `messageStubParameters`, `append`/`notify`) — a porta é declarada em **E.164 + vocabulário de negócio**, senão R-016 vira reescrita.

**Componentes maiores:**

1. **`ChannelPort`** — interface em E.164: `connect/disconnect/status/sendText/sendPresence/fetchSince/capabilities`. `capabilities()` deve existir **desde a Fase 1** (a Cloud API não tem presence nem backfill; R-067 precisa degradar)
2. **`Ingestion` + `EventBus`** — dedup por chave idempotente, **watermark** por conversa, `append` (histórico) persiste mas **não publica**. `messages.upsert` é bufferizado no boot (`event-buffer.ts` + timeout de 20s) — sem watermark, o primeiro boot responde a mensagens de dias atrás
3. **`Orchestrator` (FSM autoritativa)** — estado no Postgres; `resolveNextState(prev, hint, sinaisLocais)` com invariantes absolutas **antes** da hint do LLM; `allowedTransitions` por estado
4. **`PolicyGate`** — **função pura**, sem I/O, sem `Date.now()`, sem rede. A única autoridade sobre "pode enviar?". Um arquivo por AR em `core/outbound/guards/`
5. **`Outbox` + `Dispatcher`** — cota decrementada + linha de outbox na **mesma transação**; `idempotency_key = sha256(conversationId+turnId)` UNIQUE; humanização; único consumidor de `ChannelPort.sendText`
6. **`LlmPort`** — renderiza prompt a partir do estado, valida envelope com Zod, mascara PII. **Nunca** vê o objeto de envio
7. **`HandoffService` + `NotifyPort` + `HealthMonitor`** — handoff é **estado gravado**, não callback; `mode_changes` append-only; sem auto-retomada por timeout
8. **`Scheduler`** — tick 30s, `SELECT ... FOR UPDATE SKIP LOCKED`, lease, reconciliador. **Nunca** envia; cria `SendIntent`
9. **`ApiHttp` (painel)** — REST para comandos + SSE para eventos; `Host` header validado (anti DNS-rebinding); token por request

**Schema (decisões que não se voltam atrás):** E.164 é a identidade (nunca `jid` como PK); `state` e `engagement_mode` **separados**; `optout_ledger` append-only em vez de coluna boolean; `messages` append-only com `CHECK (kind IN ('text','link'))`; `NUMERIC` para custo; `timestamptz` em tudo (horário de verão brasileiro quebra naive); `CHECK` em todo enum; sem `updated_at` em log; `llm_runs` separado de `messages` (custo existe sem mensagem); `channel_account_id` já na tabela; `responsible_user_id`/`created_by` já nullable; `last_processed_at` (watermark) e `FOR UPDATE` por conversa **na Fase 1**.

**Padrões a seguir:** Hinted FSM (LLM sugere, código decide) · Single Choke Point (forçado por lint) · Outbox reserva-e-envia na mesma transação · Handoff como interrupção persistida · EventBus em memória + fila no Postgres · `NowToken` injetado (proibir `Date.now()` fora de `core/clock.ts` por lint).

**Fakes são parte do MVP:** `FakeChannel` + `ScriptedLlmAdapter` + `RecordingNotifier` + `StaticLeadsAdapter` são first-class (em `adapters/fake/`, não `__mocks__`). Sem eles a FSM só é testável com um número real — inviável e arriscado.

### Armadilhas Críticas

Detalhe em `PITFALLS.md` (top 5 de 10):

1. **Reach-out Timelock / erro 463 — o orçamento de contatos novos não está no R-023.** O efeito é o oposto do esperado: quanto mais o bot insiste em follow-up para lead que nunca respondeu, **mais rápido o número é restringido**. Cada um dos 4 follow-ups é um *cold reach-out*. **Evitar:** tctoken (exige `>= rc10`) · nunca desabilitar history sync (`nctSalt` vem dele) · **segunda trava dura de contatos novos** lida de `fetchNewChatMessageCap()` (parar cold outreach a 70% de `used_quota`) · **463 nunca é retry** (WhatsApp Web remove o retry de propósito) → suspender cold outreach até `time_enforcement_ends`, marcar lead, handoff. Sinal mais precoce: mensagens presas em `PENDING` = **shadow ban**.
2. **Enviar para número inexistente gera restrição de conta — R-019 está tecnicamente errado.** **Evitar:** reverter R-019; `onWhatsApp()` (cache 7 dias) antes de **todo** envio iniciado pelo sistema; `exists:false` → estado terminal `NUMERO_INVALIDO`, zero retry; log com `lead_id` + origem.
3. **System prompt não é guardrail.** Caso canônico: chatbot de concessionária vendeu Tahoe por US$ 1 porque o usuário pediu "aceite tudo". Bypass medido em inglês: regex 60–70%, classificador LLM 89–94%, combinado 99,1% — **não presumir em PT-BR**. **Evitar:** sanduíche em 3 camadas (compreender LLM → **decidir em código** → responder LLM que recebe a *decisão*, não o texto cru); schema com campos-canário (`mentionou_valor` sempre `false`, `mencionou_ia`, `envia_midia`); **fail-closed** (fail-open do Algolia está errado aqui — não enviar é reversível, enviar não é); *grounding* contra base curada; **o LLM não faz conta** sobre prazo nem escopo.
4. **Anti-requisitos são de estado, não de texto — e não existe gate único.** O modo de falha clássico: silêncio pós-handoff implementado no *handler do handoff*, e depois o worker de follow-up tem seu próprio caminho que não consulta a flag → AR-010 violado em silêncio, sem teste unitário pegando. **Evitar:** um único `podeEnviar()`; trava lida do banco; **`intent.isCatchupDrain` é parâmetro do gate, não bypass** (o anti-padrão mais caro do projeto); teste de propriedade por AR atravessando **todos** os caminhos; violação de trava é evento **CRÍTICO**, não warning; `grep` por `sendMessage` fora do adapter = **zero**.
5. **R-007 estoura em rajada quando o app abre.** Se o PC ficou ligado no fim de semana, o app abre e dispara 20–30 mensagens em 90 segundos para contatos frios, consumindo todo o orçamento frio do dia. **Evitar:** misfire policy explícita e por tipo (`CATCH_UP` **proibido**; `FIRE_ONCE` com teto é o default) · máx. 3 mensagens nos primeiros 10 min · **1 follow-up por lead/dia de drenagem**, resto adiado (não descartado) · cooldown por par `(número, destinatário)` · vencimento fora da janela → reagendar para a próxima abertura · lease + idempotência `(lead_id, follow_up_index)` + reconciliador.

**Armadilhas secundárias que entram no roadmap:** humanização como taxonomia de ripples (delay fixo `random(2s,4s)` é a assinatura que os detectores unequal — a assinatura é *distribuição errada*, não *ausência de random*; alvo σ/μ ≥ 0.25; sequenciador global único; nunca confiar em "random delay" como anti-ban) · LGPD como flag no banco (falta Encarregado — **ANPD fiscalizou 20 empresas em dez/2024 exatamente por isso** — falta teste de balanceamento de 3 fases, falta canal de titular, exclusão não alcança backup) · backup nunca testado (`psql` continua após erro por padrão → usar `-X -1`; `pg_dump` version-specific; auth state do Baileys **não** é backup do Postgres — empacotar juntos) · **auth state e LGPD dentro do OneDrive**.

### Achados Transversais (surfaced from synthesis)

| # | Achado | Confiança | Consequência para o roadmap |
|---|---|---|---|
| 1 | **Erro 463 / Reach-out Time-lock**: mensagem para contato sem TC token → 463; retry proibido pelo WhatsApp Web | **HIGH** (issues #2441, #2707, #2698, #1992; PRs #2339, #2446, #2438; release notes rc10) | **R-001 vira mitigação técnica primária**; **R-023 precisa de 2ª trava** (contatos novos/dia); 463 = parada definitiva, nunca retry |
| 2 | **R-019 tecnicamente invalido** | **MEDIUM-HIGH** | `onWhatsApp()` volta ao escopo; estado terminal `NUMERO_INVALIDO`; ADR obrigatório para que uma "melhoria" futura não reintroduza |
| 3 | **Anti-requisitos são invariantes de estado** | **HIGH** | Um único gate mecanicamente forçado (lint `no-restricted-imports`), lido do banco; 1 property test por AR |
| 4 | **LLM é gerador de dica, não dono de estado** | **HIGH** | Envelope JSON com `nextStateHint` aceito **só** se constar em `allowedTransitions`; guardas locais vencem a hint |
| 5 | **OneDrive é o working directory** | **HIGH** | Auth state + backups **fora** da árvore OneDrive e fora do git; contradiz R-033; Files On-Demand pode corromper sessão |
| 6 | **Shadow mode como gate de P1** | **MEDIUM-HIGH** | R-061 exige ~30 dias com risco diário; shadow mode é o que valida sem consumir a tolerância do número |
| 7 | **Realidade de mercado: prospecção fria é proibida na API oficial** | **HIGH** (Business Messaging Policy + LeadCNPJ documentando) | O fluxo do projeto **só existe no canal não oficial**; todo o conjunto conformável é **anti-feature**, não v2 |
| 8 | **Mensagem de break-up é decisão aberta** | **MEDIUM** | R-005 encerra em "sem resposta" sem break-up, mas o mercado BR reporta break-up como o toque de **maior taxa de resposta absoluta** (LeadCNPJ). **Não mudar o requisito** — registrar como questão aberta na Fase 4 com dado do piloto |

**Mudanças em requisitos que a pesquisa exige:**

| Requisito | Mudança | Origem |
|---|---|---|
| **R-019** | **Reverter** — sai de Out of Scope, volta a Active. `onWhatsApp()` antes de todo envio iniciado pelo sistema; `NUMERO_INVALIDO` terminal | PITFALLS 2 + ARCHITECTURE AP6 |
| **R-023** | **Acrescentar** 2ª trava dura: limite de **contatos novos/dia** via `fetchNewChatMessageCap()`, parar cold outreach a 70% de `used_quota` | PITFALLS 1 |
| **R-007** | **Acrescentar**: misfire policy `FIRE_ONCE` com teto, 1 follow-up/lead/dia de drenagem, cooldown por par. Registrar como ADR | PITFALLS 8 + STACK open questions |
| **R-016** | Reforçar: normalização **LID↔PN é requisito de Fase 1** (não migração futura); `capabilities()` desde a Fase 1 | STACK + ARCHITECTURE |
| **Novos requisitos** | Detecção de não-resposta (R-003 é cego sem ela) · texto da 1ª mensagem do Admin como contexto do bot (R-002/R-008) · kill switch global · shadow mode · reach-out budget lock · `NUMERO_INVALIDO` · remap "reagendar/cancelar" → handoff (R-026 × R-025) | FEATURES gaps §1,2,5,9 |
| **Defeitos de doc** | `01-requisitos-funcionais.md`: R-004 lista cadência até 15d mas R-005 diz que 15d NÃO executa (já resolvido no PROJECT.md, não no doc) · AR-007 referencia R-058 que não existe no doc | FEATURES gaps §7,8 |

---

## Implicações para o Roadmap

Baseado na pesquisa, estrutura de fase sugerida. **4 fases, granularidade grosseira** (decisão já registrada no PROJECT.md). A ordem é derivada das arestas de dependência reais, não de conveniência.

### Fase 1 — Fundação, Canal e Gate de Envio

**Rationale:** Sem estado durável não existe fonte de verdade. Sem `ChannelPort` + `FakeChannel` não existe teste sem número real. **E o `PolicyGate` vem antes do LLM — sem exceção.** A ordem invertida produz um sistema que funciona e envia mensagens sem gate, e alguém passa dias de uso antes de a trava existir. Esta fase é onde vivem os 4 pitfalls CRÍTICOS de fundação (463, R-019, gate único, OneDrive) — não adiáveis.

**Entrega:**
- Schema + migrations Drizzle (`leads`, `conversations`, `messages`, `optout_ledger`, `outbox`, `scheduled_tasks`, `event_log`, `mode_changes`, `handoff_events`, `blocked_attempts`, `llm_runs`, `daily_counters`, `settings`, `api_keys`) — com `engagement_mode`, `state`, `last_processed_at` (watermark), `FOR UPDATE` por conversa e `CHECK` em todo enum **já na primeira migration**
- `ChannelPort` em E.164 + `FakeChannel` + `BaileysChannelAdapter` (Baileys `7.0.0-rc14` exato) — `capabilities()`, `normalizeJid()`, `JidResolver` LID↔PN, colunas separadas `phone_number`/`wa_jid`/`lid`, nunca `remoteJid` como PK/FK
- `Ingestion` + `EventBus` + watermark + `append`/`notify` distinction + estado `hydration` no boot
- **`PolicyGate` puro + 12 arquivos de guard + 12 property tests** + lint `no-restricted-imports` (choke point) + lint proibindo `Date.now` fora de `core/clock.ts`
- `Outbox` (reserva-e-envia na mesma transação) + `Dispatcher` + `humanize.ts` + **sequenciador global único** + cooldown por par
- **Reach-out budget lock** — `fetchAccountReachoutTimelock()` + `fetchNewChatMessageCap()`, 2ª trava dura, handler de 463 sem retry
- `onWhatsApp()` com cache 7 dias + estado terminal `NUMERO_INVALIDO`
- Reconnect com teardown + guard monotônico de attempt + backoff exponencial com teto (nunca `connect()` sem derrubar o socket)
- Fila durável com lease + idempotência + reconciliador
- **Kill switch global**
- Backup `pg_dump -Fc` versionado + **auth state no mesmo pacote** + **restauração testada com contagem de linhas** + destino fora do OneDrive e fora de `C:\Program Files`
- **Documentos LGPD** (custo zero, exposição se omitidos é alta e *já fiscalizada*): Encarregado nomeado com substituto + canal publicado + **teste de balanceamento de 3 fases versionado**
- `HealthMonitor` mínimo (desconexão, 463/timelock, Postgres, LLM) + `pino` + `system_events` + `notify.ps1` (WinRT) + smoke test de notificação na máquina do Admin
- Task Scheduler + launcher `.cmd` (checa Postgres → migra → sobe); `SIGINT`/`SIGTERM` fechando socket graceful
- `pg-boss` para a fila durável (ou tabela própria se a fase ficar grande demais — mas sem Redis)

**Atende (FEATURES):** conexão Baileys + QR + watchdog · limite/janela como trava · humanização · opt-out + LGPD · kill switch · persistência + backup · logs + falha crítica
**Evita (PITFALLS):** 1 (463 + budget), 2 (R-019), 4 (gate único), 9 (backup + OneDrive), 10 (versão RC), 7-parcial (documentos LGPD), 8-parcial (fila durável), 6-parcial (sequenciador/cooldown)

---

### Fase 2 — IA, Handoff e Shadow Mode

**Rationale:** O LLM só entra **depois** do gate existir. E o primeiro uso é com `ScriptedLlmAdapter` (envelope fixo), não com um modelo real. Handoff é **o produto** — sem ele o "automático total" (R-034) é inseguro. Shadow mode entra aqui como a passagem de Fase 2 → Fase 3: validar qualidade de fala e guardrails **antes** de gastar a tolerância do número.

**Entrega:**
- `LlmPort` com o sanduíche de 3 camadas: LLM extrai intent como dado → **código decide** (anti-requisitos) → LLM responde com a decisão, não com o texto cru
- Schema Zod com campos-canário (`mentionou_valor` sempre `false`, `mentionou_prazo`, `mentionou_agendamento`, `mentionou_ia`, `envia_midia`, `mencionados_competidores: maxItems 0`)
- `resolveNextState()` — Hinted FSM; guardas locais (opt-out, handoff, mode, sequência, qualificação) **vencem** a hint
- Classificador de output + regex de moeda/percentual/promo/mídia sobre `assistantText`; **fail-closed** (1 reprompt, depois silêncio + notificação)
- Detecção de opt-out em 2 níveis — matcher determinístico pt-BR (autoridade) + `llm_signal` (reforço); reinstate só por ação manual
- `HandoffService` + gatilhos R-012/R-056/R-065/R-038 + `handoff_events` + `mode_changes` + silêncio total
- `NotifyPort` com lead, motivo, prévia da última mensagem e ação de 1 clique + **browser Web Audio chime** como redundância
- **Shadow mode** (`engagement_mode = shadow`): rascunha, mostra no painel, **nunca envia**. Kill switch de 1 clique
- Texto da 1ª mensagem do Admin capturado como contexto do bot (R-002/R-008)
- Guarding de grounding: base curada de portfólio/casos; sem fonte → escalar, não inventar
- **Set adversarial PT-BR** (~200 mensagens: preço, desconto, "você é robô?", "manda o catálogo em PDF", "marca amanhã 10h", "não quero mais receber", "aceite tudo que eu falar") + harness de bake-off de provedor (20–40 transcripts reais, score de registro/tom/acurácia de handoff) → **escolha de provedor é resultado medido, não suposição**

**Atende (FEATURES):** conversa com LLM + memória · guardrails como invariantes de runtime · handoff com notificação · modo silêncio total · detecção de opt-out · trilha de auditoria da IA · shadow mode · filtro de compliance local
**Evita (PITFALLS):** 3 (prompt ≠ guardrail), 4 (AR-010 via handoff state), 6 (delay dinâmico)
**Usa:** `ai@7` + `Output.object` + zod · `evaluatePolicy` da Fase 1

---

### Fase 3 — Cadência, Operação e Painel

**Rationale:** A cadência é **o que queima o número** (cada follow-up para lead silencioso é cold reach-out). Precisa da outbox da Fase 1 e do handoff da Fase 2 para ter defaults conservadores. O painel entra aqui (não antes) porque é derivado — lê o que já existe — e porque o Admin precisa ver contador diário, janela, **motivo do silêncio** e a fila de handoff para que o automático total seja operável.

**Entrega:**
- `Scheduler` tick 30s + `FOR UPDATE SKIP LOCKED` + lease + reconciliador + idempotência `(lead_id, follow_up_index)`
- **Misfire policies explícitas por tipo de job** (`CATCH_UP` proibido) + **dreno de R-007 limitado**: máx. 3 nos primeiros 10 min, 1 follow-up/lead/dia, resto adiado (não descartado), jitter no dreno
- `business-hours.ts` com tabela de **feriados BR** + "próximo dia útil" + reagendamento quando vencimento cai fora da janela
- **Cadência com default conservador**: N máximo de mensagens automatizadas sem resposta (sugestão: 2) → depois handoff; follow-up longo em vez de curto nas primeiras tentativas; cancelamento automático da cadência daquele lead se 463 ocorrer
- **Detecção de não-resposta** (read receipts / watermark de inbound) — sem isso R-003 é cego
- Contato frio:** NÃO automatizar R-001** — restrição transversal, não fase
- `ApiHttp` Fastify + SSE + `Host` header validado (anti DNS-rebinding) + bind `127.0.0.1` + token por request
- Painel R-046 (lista + chat + sugestões IA + histórico + ações rápidas + **modo exibido em tempo real**: "BOT ATIVO" laranja vs "MÃO HUMANA ATIVA — BOT EM SILÊNCIO" verde) + contador diário + janela + motivo do silêncio + fila de handoff
- Comandos: pausar / assumir / devolver / copilot / **kill switch global**
- CRM mínimo: busca, filtros, tags, notas, timeline, pipeline com motivos de "Perdido" enumerados
- `HealthMonitor` completo + painel de erros (`system_events`)
- Migração `01-requisitos-funcionais.md` (R-004/R-005, referência R-058) + ADRs (R-019 revertido, R-007 drain, `isCatchupDrain` como parâmetro)

**Atende (FEATURES):** follow-up com cadência · pipeline de status + histórico · busca/filtros/tags/notas/tarefas · painel único · status automático por IA auditável com override · filler de compliance
**Evita (PITFALLS):** 5 (follow-up frio), 8 (rajada de R-007), 1-parcial (calibração de cadência vs budget)
**Implementa:** `core/schedule/*`, `api/*`, `core/crm/*`

---

### Fase 4 — Piloto, Calibração e Apuração

**Rationale:** R-061 (5 reuniões/mês, 30% qualificação/mês) e R-062 (apuração mensal) exigem ~30 dias de operação contínua com risco diário de ban. É a fase de **medição**, não de construção — e é onde as questões abertas do roadmap são respondidas com dado, não com opinião.

**Entrega:**
- Piloto real no número dedicado, com **shadow mode como comparação** (rascunhos do bot vs o que seria enviado)
- Cadência recalibrada com o dado do piloto (tempo mediano até primeira resposta, taxa de resposta por toque) — os intervalos 1h/1d/3d/7d **não** devem ser fixados antes disso
- **Decisão sobre break-up** no follow-up final (dado do piloto vs mercado BR) — hoje R-005 encerra sem break-up
- Copiloto pós-handoff completo (R-014) — gatilho: primeiro handoff de preço mal atendido
- Confirmação/lembrete pós-agendamento (R-026) — gatilho: taxa de no-show incomoda
- Apuração mensal R-061/R-062 em dashboard mínimo (sem analytics avançado — 20–30 msg/dia produz número com falsa precisão)
- Documento de teste de balanceamento LGPD revisado + resposta a titular em < 48h medida
- **Plano de appeal preparado antecipadamente** (janela de 30 dias, material: registro de origem, opt-outs, template da 1ª mensagem, frequência) — o custo de um ban permanente é o canal, e a recuperação é o gargalo
- Considerar **SIM descartável desde o dia 1** como seguro contra R-059 (não é "aquecimento automático", é redundância física proibida por R-059 — registrar a tensão)

**Atende (FEATURES):** copiloto pós-handoff · confirmação/lembrete · apuração mensal · break-up (decisão)
**Evita (PITFALLS):** recovery de ban (appeal preparado antes de precisar), 5 (calibração com dado real)

---

### Racional da Ordenação

- **`PolicyGate` (Fase 1) antes de `LlmPort` (Fase 2). Sem exceção.** É a invariante de ordem nº1 da arquitetura. A ordem invertida produz um sistema que envia sem gate.
- **`engagement_mode`, `state` e `optout_ledger` no schema da Fase 1**, muito antes do handoff da Fase 2. Retrofitar modo em todas as tabelas é reescrita.
- **`FakeChannel` e `ScriptedLlmAdapter` nas Fases 1 e 2.** Sem eles, os testes das Fases 2–3 exigem um número real e uma chave de API paga.
- **`last_processed_at` (watermark) e `FOR UPDATE` por conversa na Fase 1.** Sem o campo, o watermark não tem contra o que filtrar; concorrência por conversa é a pior classe de bug para depurar.
- **R-001 nunca é automatizado.** Não é uma fase — é restrição transversal. O achado do 463 transforma isso de convenção em requisito técnico de segurança do número.
- **Agrupamento por risco, não por camada técnica.** Os 4 pitfalls CRÍTICOS (463, R-019, gate único, OneDrive) são todos de fundação — jogá-los para fases posteriores é o erro mais caro possível.
- **Painel por último porque é derivado.** Ele lê estado que já existe; sua ausência não bloqueia nada, sua presença prematura não ajuda.

### Research Flags

Fases que provavelmente **precisam** de pesquisa adicional no planejamento:

- **Fase 2 (IA e Handoff):** ⚠️ **SIM — incerteza real.** (a) Escolha de provedor de LLM é um **bake-off**, não conclusão de pesquisa — nenhum benchmark público mede registro de vendas B2B em WhatsApp pt-BR. (b) As taxas de bypass de guardrail (60–70% / 89–94%) são de provider e **idioma inglês** — precisam ser medidas em PT-BR com o set adversarial de ~200 mensagens. (c) Comportamento de `wa.me`/links curtos no filtro de spam da Meta não foi verificado em fonte primária — relevante porque o projeto envia links (R-037 permite texto e links).
- **Fase 3 (Cadência):** ⚠️ **SIM, mas não agora.** A pesquisa adicional aqui é **precoce** — os intervalos concretos só devem ser fixados após ~30 dias de dado real do piloto. O que precisa é a tabela de feriados BR e a definição de produto do "próximo dia útil".
- **Fase 4 (Piloto):** ⚠️ **SIM.** Procedimento de appeal/recuperação de ban (janela de 30 dias e canal de email para Business) vem de fontes secundárias — **confirmar antes de depender**. E os pré-requisitos de onboarding da WhatsApp Business Platform para a futura migração R-016 **não foram pesquisados**.
- **Fase 1 (Fundação):** ⚠️ **PARCIAL.** Nenhuma pesquisa de arquitetura adicional necessária — docs do Baileys, investigação do 463, APIs de quota e documentação do PostgreSQL cobrem tudo. Mas precisa de **validação empírica na máquina real**: notificação Windows com Focus Assist / per-app settings / ExecutionPolicy, e o teste de que `fetchAccountReachoutTimelock` existe no typings do pacote instalado.
- **Integração caça-leads (dentro da Fase 1):** ⚠️ **SIM.** A API do caça-leads **não está especificada** — schema, auth, rate limit. Bloqueia a integração, não a arquitetura. O gate (AR-011) exige `legal_registered_at` preenchido **na criação** do lead, então a forma do insert precisa ser decidida antes.

Fases com padrões padrão (pular research-phase):

- **Fase 1 (parte estrutural):** hexagonal, outbox, FSM durável, `SKIP LOCKED`, misfire policies, consent ledger, `pg_dump` em Windows — todos com documentação primária e múltiplas fontes convergentes. Skip research.
- **Fase 2 (parte de arquitetura):** schema de saída estruturada, guardrails em 3 camadas, fail-closed, Hinted FSM — literatura e issue tracker bem documentados. O que precisa é **medição**, não pesquisa.
- **Fase 3 (parte de painel):** Fastify + SSE + React multi-pane é padrão maduro. Skip research.

---

## Avaliação de Confiança

| Área | Confiança | Notas |
|------|-----------|-------|
| **Stack** | **ALTA** | Versões verificadas contra npm registry, GitHub API e Context7 em 2026-09-28. ⚠️ A recomendação de versão do Baileys foi **corrigida** por evidência posterior (PITFALLS) — ver reconciliação. Confiança MEDIUM apenas no provedor de LLM (bake-off, não pesquisa) e MEDIUM nas notificações Windows (ambiente-dependente) |
| **Features** | **ALTA** (políticas/tecnologia) / **MÉDIA** (diferenciação/posicionamento) | Fontes de política são oficiais (Business Messaging Policy, ANPD, WhatsApp Business Terms). As evidências de mercado são sites de marketing — usadas para identificar padrões, não para decidir números. A caracterização de mercado (canal não oficial vs oficial) é **HIGH** e está documentada na fonte primária do próprio concorrente |
| **Architecture** | **ALTA** | Fontes primárias: código-fonte do Baileys (`event-buffer.ts`, `Socket/chats.ts`, `Types/State.ts`), issue tracker de produção, PRs com mapeamento de protocolo, padrões de hexagonal/FSM/checkpointing. Confirmação independente entre `STACK.md` e `ARCHITECTURE.md` sobre a choke point e a fronteira LLM |
| **Pitfalls** | **MÉDIA-ALTA → ALTA no core** | O achado do 463 foi **verificado por diff direto da árvore do repositório entre tags** (não inferido) e por release notes — isso é ausência/presença de código, o nível mais alto de evidência. MEDIUM-HIGH em "número inválido → restrição de conta" (forte relato #2441, sem doc oficial da Meta — vale teste empírico). MEDIUM nas taxas de bypass de guardrail (provider/idioma específicos) |

**Confiança geral: ALTA** — com três exceções honestas: (1) **mecanismo de banimento é genuinamente disputado** nas fontes (comportamental vs fingerprint de protocolo) e não foi resolvido; isso afeta quanto investir em humanização (R-067) vs higiene de número — tratar humanização como obrigatória de qualquer forma, porque é barato e melhora o tom. (2) **qualidade da evidência anti-ban é comunitária, não oficial** — a Meta não publica limiares. (3) **força da evidência de guardrail é em inglês** — precisa de medição PT-BR antes de ir a campo.

### Lacunas a Resolver

Lacunas que a pesquisa **não** cobriu e que precisam de endereçamento explícito:

- **API do caça-leads não especificada** (schema, auth, rate limit) — bloqueia R-017/R-018; resolver antes da integração na Fase 1
- **Feriados e horários BR não modelados** — `business-hours.ts` precisa da tabela; "próximo dia útil" depende disso
- **Diretório de estado e backup fora do OneDrive: decisão concreta pendente.** Definir o path (ex.: `C:\whatsapp_prospecao\`) e mover `auth_state/`, `backups/` e `.env` para lá; `.gitignore` explícito para dumps e auth state
- **Notificação Windows na máquina do Admin não verificada** — smoke test de Fase 1 (app em foco/minimizado, Focus Assist, Windows bloqueado, ExecutionPolicy, som em RDP)
- **Custo e latência reais de um LLM pt-BR com structured output** — medir na Fase 2; `llm_runs.cost_usd` fica com TODO explícito até o provedor ser escolhido
- **Volume de tokens por turno** — estimável, não verificável sem implementar; medir na Fase 2
- **Procedimento de appeal de ban** (janela de 30 dias, canal de email) — fontes secundárias; confirmar antes de depender; preparar material antecipadamente
- **Comportamento de `wa.me`/links curtos no filtro de spam da Meta** — não verificado em fonte primária
- **Pré-requisitos de onboarding da WhatsApp Business Platform** (display name, 2FA, verificação de negócio, cobrança, template) — **não pesquisado**; flag para a fase de migração R-016
- **Estrutura de custo da API de LLM** — `llm_runs.cost_usd` e o dashboard de custo (R-035, v2+) dependem
- **Estratégia de migração de sessão Baileys → Cloud API** (histórico, IDs de mensagem) — `capabilities()` é o ponto de extensão, mas a estratégia não foi pesquisada
- **Taxa real de banimento por volume no Brasil** — não é público; tratar qualquer número como anedótico
- **Onboarding da migração R-016 não é um simples swap de adapter** — na API oficial, mensagens fora da janela de 24h exigem template aprovado; R-003/R-004/R-026 precisam de equivalentes em template. Flag explícito para quem planejar a fase de migração

**Riscos do projeto que nenhuma feature mitiga:** R-059 (número único, sem redundância) é o risco dominante e é aceito e documentado. O que *pode* ser feito: shadow mode, kill switch, notificação de desconexão, **exportação contínua do CRM para CSV** (um ban custa o canal, não o pipeline), e material de appeal preparado.

---

## Fontes

### Primárias (confiança ALTA)

**WhatsApp / Baileys — comportamento de banimento e reach-out**
- WhiskeySockets/Baileys **#2441** — investigação do 463 / Reach-out Time-lock (`WAWebFetchReachoutTimelockJobQuery`, tctoken ausente contado como reach-out). **Fonte mais importante de toda a pesquisa.**
- **#2707** — TC token / 463 causando bans (ciclo de vida de 28 dias) · **#2698** — 463 em warm contacts, mensagens presas em `PENDING` como sinal de shadow ban · **#1992** — cstoken/nctSalt ausente · **#1983** (progressão 24h→48h→permanente) · **#1850** (burst de respostas) · **#1245** (`Stream Errored (conflict)` por reconnect sem teardown) · **#1869**, **#1901**, **#2075**, **#1248** (429) · discussão **#1944** (maintainer: "Missing contextInfo doesn't cause ban" — não perseguir sinal falso)
- **PR #2339** (ciclo de vida completo de tctoken; commit **"Remove 463 retry"** — *"This PR does not retry 463. It prevents it, exactly like WA Web does"*) · **PR #2446** (`WAWebReachoutTimelockUtils.canSendMsgWhileTimelocked()`) · **PR #2438** (`cstoken = HMAC-SHA256(nctSalt, recipientLid)`; `nctSalt` chega por history sync)
- Releases **rc10** (2026-05-06: *"Full TC Token issuance..."*, *"Reachout Timelock ... 463"*, *"463 handlers and safety-paths"*) · **rc12** (corrige **GHSA-qvv5-jq5g-4cgg**) · rc11/rc13/rc14
- **Diff de árvore entre tags (2026-09-28):** `v6.7.24` → 165 arquivos, **zero** matches `tctoken|tc-token|reachout|cstoken|nctsalt`; `v7.0.0-rc14` → `src/Utils/tc-token-utils.ts` + teste. `v6.7.24/src/Socket/messages-send.ts` → **0** ocorrências de `ReachoutTimelock`/`fetchNewChatMessageCap`
- **npm registry:** `latest: 7.0.0-rc14`, `legacy: 6.7.24` (ambos publicados 2026-07-29); não existe v7 estável
- Código-fonte: `src/Utils/event-buffer.ts` (`BUFFERABLE_EVENT`, buffer/flush), `src/Socket/chats.ts` (`AwaitingInitialSync`, timeout 20s), `src/Types/State.ts` (`ReachoutTimelockState`, `NewChatMessageCapInfo`), `BaileysEventMap`

**LGPD / ANPD**
- Guia Orientativo: Legítimo Interesse (fev/2024) — teste de balanceamento em 3 fases
- ANPD fiscaliza **20 empresas por falta de Encarregado e canal** (13/12/2024) · Resolução CD/ANPD nº 18/2024 · "Até o momento, todos os processos sancionadores conducts pela ANPD, sem exceção, foram instaurados em decorrência de postura não colaborativa"
- Despacho Decisório nº 27/2026/CGS/SFI — ByteDance, **R$ 153.769.671,33** em 5 multas + ordem de eliminação · ANPD virou Agência Reguladora (Lei nº 15.352/2026); 21 empresas encaminhadas à sanção no 1º semestre de 2026; Mapa de Temas Prioritários 2026-2027 inclui IA

**PostgreSQL / Windows**
- SQL Dump docs — `pg_dump` version-specific; restaurar exige owners existentes; `psql` **continua após erro**; `-1/--single-transaction`; `-F c` · Wiki: Automated Backup on Windows (`%APPDATA%` não inicializado no Task Scheduler → `pgpass` não lido) · SO: `Access is Denied` = filesystem, não Postgres

**Jurisprudência sobre chatbot liability**
- **Moffatt v. Air Canada**, 2024 BCCRT 149 — chatbot não é entidade separada · **OLG Hamm**, 12/05/2026, 4 UKl 3/25 (Aesthetify)

**Política do WhatsApp**
- Business Messaging Policy · Messaging Guidelines · Business Terms — opt-in obrigatório, template aprovado para iniciar, automação só dentro da janela de 24h com escalonamento humano

**Stack / npm / GitHub**
- npm registry + GitHub API (2026-09-28): `prisma latest: 8.0.0-rc.17` / `prev: 7.10.0` · `typescript latest: 7.0.2` (GA 2026-07-08) · `drizzle-orm 0.45.3` (estável) · `bullmq peerDeps` exigem `pg` **AND** `redis` **AND** `ioredis` · `pg-boss@12.35.0` → `pg: ^8.23.0` · `ai@7.0.118` → `zod ^3.25.76 || ^4.1.8`, `engines.node >=22` · `@wppconnect/wa-js` LGPL-3.0-or later · `venom-bot` último publish 2024-11-23 · `node-notifier` último push 2024-06-24, 129 issues · nodejs.org/dist → current v26.10.0, LTS v24.21.0
- Context7: `/whiskeysockets/baileys`, `/websites/ai-sdk_dev`, `/websites/baileys_wiki`

### Secundárias (confiança MÉDIA)

- **Mercado BR:** LeadCNPJ (documenta que a API oficial **não autoriza** prospecção fria; cadência BR Dia 0/3/7/14 com break-up; "acima de 4 vira assédio") · BotConversa, AiSensy, Wati, ChatFlux, Clickmassa, Zappy, SocialHub, ZAPFire, ProspectaMax, LEAD AI, Redrive, AvisaApp
- **Humanização/detecção de bot:** ACM 2018 e JAMS 2022 (atraso **dinâmico** > estático) · ASONAM 2019 (IMD consistente é a assinatura de automação, KS p=1.93e-19) · arXiv 2510.02374 (σ de latência: humano > 0, script ≈ 0)
- **Guardrails:** kalviumlabs.ai (*"System prompts are not guardrails"*; bypass 60–70% / 89–94% / 99,1% combinado — **idioma/provider específicos**) · Algolia Agent Studio (**fail-open rejeitado** neste projeto) · ymeadows (20% de erro em 34 cotações assistidas por IA)
- **Misfire/scheduler:** Designing a Distributed Job Scheduler That Actually Works (`SKIP`/`FIRE_ONCE`/`CATCH_UP`; *"recovery becomes a self-inflicted thundering herd"*); The Augmented Dev (`SKIP LOCKED`, lease, at-least-once → handlers idempotentes); The Reconciler Pattern
- **Arquitetura:** Cockburn (Hexagonal), AWS Ports & Adapters · loom · Thinker/SMAG (arXiv 2503.21036) · XState (statecharts, `allowedTransitions`) · AI Engineering Playbook — Orchestration
- **CRM B2B:** PipeRun, Pipely, Mia CRM, Zopkit, CRM Whats Pro, TatvaCRM · Salesforce BANT vs MEDDICC

### Terciárias (confiança BAIXA — necessitam validação)

- wasphere.com (2026-07) — "Open source WhatsApp API: the 2026 landscape" (MEDIUM, mas posição de ecossistema da WPPConnect é verificável)
- wapisimo.dev (2026-03) — vendor blog, auto-interessado
- **kraya-ai.com (2026-07)** — modelo de fingerprinting de protocolo de 4 camadas, lifespan de 2–8 semanas. **NÃO usado** — contradito pelas fontes comportamentais e não verificável
- marcusbarboza.com.br — 5,1M de contas banidas na Índia em junho/2026, atribuído ao relatório mensal do WhatsApp mas **não verificado contra a Meta**
- negociodautomatico.com.br (2026-05) — teste único de LLM pt-BR (Gemini produz formalidade incompatível com WhatsApp BR). Única base do achado de registro — origem da recomendação de bake-off
- todasolucao.com.br, osky.dj — SEO; a afirmação "v6.x é a fork ativa em 2026" é **contradita** pelos dados do npm e foi descartada
- **Números de aquecimento ("250/dia, 4 semanas")** — de marketing de ferramenta. **Não usar como regra**
- **WhatsApp `typing…` ~5s** — observação de comunidade, sem fonte primária. Ordem de grandeza, não constante de engenharia

---

*Síntese concluída: 2026-09-28*
*Fontes primárias: WhiskeySockets/Baileys (issues #2441, #2707, #2698, #1992, #1983, #1850, #1245, #1869, #1901, #2075, #1248, disc. #1944; PRs #2339, #2446, #2438; releases rc10–rc14; diff de árvore v6.7.24 vs v7.0.0-rc14), documentação ANPD, PostgreSQL Docs, npm registry/GitHub API, e jurisprudência sobre chatbot liability.*
*Pronto para roadmap: sim — com ⚠️ 3 decisões de requisito a refletir no PROJECT.md antes de criar fases (R-019 revertido, 2ª trava de contatos novos em R-023, R-007 com dreno limitado).*
