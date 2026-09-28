# Arquitetura — Automação Local de WhatsApp para Prospecção B2B

**Domínio:** Sistema local (Windows) de automação de conversas com LLM sob controle determinístico, com handoff humano obrigatório
**Pesquisado:** 2026-09-28
**Confiança:** ALTA (fontes primárias + código-fonte do Baileys + issue tracker de produção)
**Modo:** Ecosystem / Architecture dimension

---

## Resumo Executivo

A arquitetura de referência para este domínio converge em três conclusões, todas confirmadas por fontes independentes:

1. **O LLM é um gerador de texto e um extrator de sinais — nunca o dono do estado.** A máquina de estados (FSM) vive no Postgres local; as transições são código determinístico; o LLM devolve um envelope JSON validado contra schema. A transição *sugerida* pelo LLM é apenas uma **dica** que o orquestrador aceita somente se constar em `allowedTransitions` do estado atual. Isso é diferente do padrão mais comum na literatura (LangGraph, SMAG/Thinker, loom), onde a LLM conduz a transição — variação que aqui é proibida, porque 12 anti-requisitos invariantes (AR-001 a AR-012) não podem depender de probabilidade.

2. **Existe exatamente UM caminho de saída, e ele é forçado mecanicamente — impossível de contornar.** Trava de janela (R-006), cota diária (R-023), opt-out (R-024/AR-005), silêncio pós-handoff (AR-010) e base legal (AR-011) são avaliados por uma função pura `evaluatePolicy(state, now, intent)` localizada em um único ponto do código. Isso só é verdade se for *forçada* por regra de lint que proíbe qualquer chamada direta ao canal fora de `src/outbound/`. Convenção não é arquitetura.

3. **O canal WhatsApp é um adaptador, mas o Baileys vaza seu próprio vocabulário para fora se a porta for mal desenhada.** O `jid`, o sufixo `@s.whatsapp.net`, o `@lid`, os `messageStubParameters` e a distinção `append`/`notify` são conceitos do Baileys, não do WhatsApp. A porta deve ser declarada em E.164 e vocabulário de negócio; caso contrário, R-016 (migração para API oficial) vira reescrita.

**Achado de maior impacto operacional (verificado em issue tracker de produção do Baileys):** o erro **463 / Reach-out Time-lock** — que restringe temporariamente a conta e é a causa declarada de banimentos de bots — ocorre ao enviar para contatos sem **Trusted Contact (TC) token**. Isso transforma **R-001** (o Admin envia a 1ª mensagem manualmente do celular) de "boa prática de UX" em **a mitigação técnica primária do projeto**. Nenhuma ordem de fases pode colocar a automação de 1º contato antes da mensagem manual. Detalhes em §Achados Críticos.

---

## Arquitetura Padrão

### Visão Geral do Sistema

```
┌──────────────────────────────────────────────────────────────────────────┐
│  SUPERFÍCIE LOCAL (Windows)                                               │
│  ┌────────────────────────┐              ┌────────────────────────────┐  │
│  │ Painel de Controle     │              │ Notificador Nativo         │  │
│  │ (localhost:PORT)       │              │ (som + pop-up Windows)     │  │
│  │ lista+chat+sugestões   │              │                            │  │
│  └───────┬────────────────┘              └────────────▲───────────────┘  │
│          │ HTTP (comandos) / SSE (eventos)              │                │
└──────────┼───────────────────────────────────────────┼────────────────┘
           │                                            │
┌──────────▼────────────────────────────────────────────┼────────────────┐
│  NÚCLEO — PROCESSO NODE ÚNICO (sem broker externo, sem Redis)             │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  1. CAMADA DE ENTRADA (primary adapters)                          │  │
│  │  ┌──────────────┐   ┌──────────────┐   ┌────────────────────────┐  │  │
│  │  │ Ingestion    │   │ HTTP/SSE API │   │ Command Handlers       │  │  │
│  │  │ (dedup,      │   │ (painel)     │   │ (pausar/assumir/       │  │  │
│  │  │  watermark)  │   │              │   │  devolver/copilot)     │  │  │
│  │  └──────┬───────┘   └──────┬───────┘   └───────────┬────────────┘  │  │
│  └─────────┼──────────────────┼───────────────────────┼───────────────┘  │
│            ▼                  ▼                       ▼                  │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  2. BUS DE EVENTOS EM MEMÓRIA (EventEmitter tipado, assíncrono)     │  │
│  │     message.received · connection.changed · schedule.due ·         │  │
│  │     handoff.triggered · command.modeChanged                        │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│            │                                                               │
│            ▼                                                               │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  3. ORQUESTRADOR — FSM AUTHORITATIVA (estado no Postgres)          │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │  │
│  │  │ Guardas      │  │ Motor de     │  │ Redutores de transição  │  │  │
│  │  │ determiníst. │─▶│ Transições   │─▶│ (efeitos colaterais)    │  │  │
│  │  └──────────────┘  └──────────────┘  └────────────┬─────────────┘  │  │
│  └──────────────────────────────────────────────────────┼──────────────┘  │
│                                                         │                 │
│            ┌────────────────────────────────────────────┤                 │
│            ▼ (só se a guarda permitir)                 │                 │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  4. CAMADA LLM — Adaptador de texto (secundário, substituível)      │  │
│  │  Prompt É RENDERIZADO A PARTIR do estado (nunca o contrário)         │  │
│  │  Saída: envelope JSON { assistantText, signals, nextStateHint,      │  │
│  │          qualificationFlags, redaction }                            │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                        │                                                  │
│                        ▼                                                  │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  5. SAFETY GATE  ◄── CHOKE POINT ÚNICO E OBRIGATÓRIO (AR-001..012) │  │
│  │  evaluatePolicy(conversation, now, intent) → {allow, reason}       │  │
│  │  ├─ opt-out/ledger LGPD      ├─ modo (bot/human/copilot/pausado)   │  │
│  │  ├─ janela 7h-17h úteis      ├─ tipo (texto+link, nunca mídia)    │  │
│  │  ├─ cota 20-30/dia           ├─ base legal registrada (R-064)     │  │
│  │  ├─ timelock/463/banimento   └─ limite da sequência (4, R-005)     │  │
│  └────────────────────────────────┬───────────────────────────────────┘  │
│                                   ▼ allow                               │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  6. OUTBOX + DESPACHANTE (reserva-e-envia, SKIP LOCKED, 30s tick)  │  │
│  │  humanização: delays aleatórios, "digitando…", quebra de mensagens  │  │
│  └────────────────────────────────┬───────────────────────────────────┘  │
│                                   ▼                                       │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  7. ADAPTADOR DE CANAL (porta) ── Baileys | Cloud API | Fake       │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  8. PERSISTÊNCIA — PostgreSQL local (única fonte de verdade)         │  │
│  │  leads · conversations · messages · events · outbox · tasks ·       │  │
│  │  optout_ledger · status_history · notes · suggestions · llm_runs ·  │  │
│  │  settings · daily_counters                                          │  │
│  └────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
```

### Fronteiras de Componentes

| Componente | Responsabilidade (o que PERTENCE a ele) | Comunica com | Proibido de |
|---|---|---|---|
| **ChannelPort** (`core/ports/channel.ts`) | Declarar a interface do WhatsApp em E.164 + vocabulário de negócio. `connect`, `disconnect`, `status`, `sendText`, `sendPresence`, `fetchSince`, `capabilities` | BaileysAdapter, CloudApiAdapter, FakeChannel | Importar Baileys, WPPConnect ou qualquer SDK |
| **Ingestion** | Receber evento bruto do adaptador → normalizar → deduplicar por chave idempotente → aplicar *watermark* de histórico → publicar `message.received` | ChannelPort, EventBus, MessageRepo | Gerar texto, consultar LLM, decidir estado |
| **EventBus** | Barramento tipado em memória. Fan-out. Sem persistência, sem reentrega | Todos os consumidores | Filtrar lógica de negócio |
| **Orchestrator (FSM)** | Dono do estado. Recebe evento, lê estado persistido, avalia guardas, aplica transição, emite efeitos. Persiste estado + evento no mesmo `commit` | EventBus, LlmPort, Outbox, ConversationRepo, EventStore | Enviar mensagem diretamente |
| **PolicyGate** | Função PURA. Única autoridade sobre "pode enviar?". Sem I/O, sem `Date.now()`, sem rede | Outbox (a chama), StateSnapshot (recebe) | Escrever no banco, chamar LLM, chamar canal |
| **LlmPort** | Renderizar prompt a partir do estado, chamar API externa, validar envelope contra schema Zod, mascarar dados sensíveis (R-009) | Orchestrator, PromptRenderer, Redactor | Decidir transição, enviar mensagem |
| **Outbox / Dispatcher** | Reservar cota + inserir linha de outbox em transação única, humanizar, enviar, marcar `sent`/`failed`, reagendar | PolicyGate, ChannelPort, TaskRepo | Burlar PolicyGate |
| **Scheduler / Dispatcher de tarefas** | Tick de 30s, `SELECT ... FOR UPDATE SKIP LOCKED`, calcular "próximo dia útil", mover follow-up vencido para outbox (R-007) | TaskRepo, Outbox, EventBus | Enviar sem passar pelo Outbox |
| **HandoffService** | Avaliar gatilhos (R-012/R-065), gravar `engagement_mode`, notificar, criar sugestão de copiloto se R-014 | EventBus, NotifyPort, ConversationRepo, LlmPort | Enviar mensagem de transição (R-057/R-066) |
| **NotifyPort** | Som + pop-up nativo do Windows | HandoffService, HealthMonitor | Acessar regra de negócio |
| **HealthMonitor** | Observar `connection.update` (desconexão, `reachoutTimeLock`), `message-capping.update`, health do Postgres, ping do LLM → notificar (R-045) | ChannelPort, NotifyPort, EventBus | Silenciar falhas |
| **ApiHttp (painel)** | REST para comandos + SSE para eventos em tempo real (R-046) | CommandHandlers, QueryRepo, EventBus | Contornar Orchestrator/PolicyGate para enviar |
| **CrmQuery** | Projeções de leitura: pipeline, busca, tags, notas, tarefas, histórico imutável (R-021/R-043) | Postgres (somente leitura) | Escrever |
| **PromoSourcesPort** | API do caça-leads (R-017). Retorna nome, telefone, endereço | LeadsService | Validar existência do número (R-019) |

### Adapters Secundários (Substituíveis)

| Porta | Implementação MVP | Alternativa futura | Fake p/ teste |
|---|---|---|---|
| `ChannelPort` | `BaileysChannelAdapter` | `CloudApiChannelAdapter` (R-016) | `FakeChannel` (em memória, scriptável) |
| `LlmPort` | `OpenAiLlmAdapter` | `GeminiLlmAdapter`, `ClaudeLlmAdapter` | `ScriptedLlmAdapter` (envelopes fixos) |
| `NotifyPort` | `WindowsNotifier` (node-notifier) | — | `RecordingNotifier` |
| `PromoSourcesPort` | `LeadApiAdapter` | — | `StaticLeadsAdapter` |
| `JobQueuePort` | `PgJobQueue` (tabela própria) | pg-boss | `InMemoryQueue` |

> **Os fakes são parte do MVP, não opcionais.** Sem `FakeChannel` + `ScriptedLlmAdapter`, a FSM só pode ser testada com um número real de WhatsApp — o que é inviável e arriscado. Esta é a decisão de des-risco mais importante do projeto.

---

## Padrões Arquiteturais

### Padrão 1: FSM com Transição Sugerida, Nunca Aceita (Hinted FSM)

**O que:** O LLM produz texto **e** sugere um próximo estado. A transição de estado é decidida por código determinístico que **rejeita** qualquer sugestão fora da tabela `allowedTransitions` do estado atual.

**Por que aqui e não em LangGraph/SMAG/loom:** todas essas referências (HIGH confidence) deixam a LLM conduzir a transição — o LLM decide "o que fazer a seguir". Aqui, um "o que fazer a seguir" errado é uma violação de AR-001 (negociar preço) ou AR-010 (agir após handoff). A sugestão do LLM é **informação de entrada**, não autoridade.

**Quando usar:** sempre. É o núcleo do sistema.

**Trade-offs:** custa uma chamada extra de LLM por turno se a extração de sinais for separada. **Mitigação:** uma única chamada que faz as duas coisas (extrair sinais + gerar texto no mesmo envelope JSON). Custa mais tokens de saída e menos latência.

```typescript
// core/orchestrator/transitions.ts — SEMPRE determinístico, NUNCA LLM-chosen
type State = 'novo' | 'aquecimento' | 'qualificando' | 'aquecido'
         | 'awaiting_human' | 'human' | 'copilot' | 'pausado' | 'encerrado'

const ALLOWED: Record<State, State[]> = {
  novo:          ['aquecimento', 'qualificando', 'awaiting_human', 'encerrado'],
  aquecimento:   ['qualificando', 'awaiting_human', 'encerrado'],
  qualificando:  ['aquecimento', 'aquecido', 'awaiting_human', 'encerrado'],
  aquecido:      ['qualificando', 'awaiting_human', 'encerrado'],
  // Estados terminais por ação: NENHUMA transição de saída automática.
  awaiting_human: ['human', 'copilot', 'pausado', 'encerrado'],
  human:         ['copilot', 'pausado', 'encerrado'],
  copilot:       ['human', 'pausado', 'encerrado'],
  pausado:       ['human', 'copilot', 'encerrado'],
  encerrado:     [],
}

// Guardas locais — NUNCA delegar ao LLM (AR-001, AR-005, AR-010)
function resolveNextState(prev: State, hint: string, ctx: LocalSignals): State {
  // 1. Invariantes absolutas têm precedência sobre tudo, inclusive sobre a hint.
  if (ctx.optOutLedger.active)          return 'encerrado'      // AR-005
  if (ctx.handoffTriggered)             return 'awaiting_human'  // AR-010
  if (ctx.engagementMode !== 'bot_active') return prev          // silêncio total
  if (ctx.sequenceExhausted)            return 'encerrado'      // R-005
  if (ctx.qualifiedVerba && ctx.qualifiedDecision)
                                            return 'aquecido'    // R-051
  // 2. Só então a sugestão do LLM, validada contra a tabela.
  if (ALLOWED[prev].includes(hint as State)) return hint as State
  return prev
}
```

**O contrato com o LLM (envelope):**

```typescript
// core/ports/llm.ts
interface TurnEnvelope {
  assistantText: string                          // vai pro gate de segurança
  nextStateHint: string                          // SUGESTÃO. Validada, nunca obedecida
  qualification: { verba: 0|1|2|null; decisionPower: 0|1|2|null }  // R-051/R-052
  signals: { pricingAsked: boolean; schedulingIntent: boolean
             botSuspicion: boolean; irritation: boolean
             optOutIntent: boolean; mediaReceived: boolean }         // R-012/R-065
  redaction: string[]                             // o que foi mascarado (R-009)
}
```

**Contrapartida obrigatória (o ponto que a maioria dos sistemas erra):** `assistantText` **nunca** chega ao canal sem passar pelo `PolicyGate`. O LLM não tem, em hipótese alguma, uma referência ao objeto de envio.

---

### Padrão 2: Ponto de Estrangulamento Único de Segurança (Single Choke Point)

**O que:** uma função pura é a única autoridade sobre "esta mensagem pode sair?". Nenhum outro código chama `ChannelPort.sendText`.

**Quando usar:** sempre. É a razão pela qual 12 anti-requisitos são garantíveis.

**Como tornar isso mecânico e não convencional:**

```typescript
// eslint.config.js — a choke point só é verdade se o lint a fizer
{
  files: ['src/**/*.ts'],
  ignores: ['src/adapters/channel/**', 'src/outbound/dispatcher.ts'],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [{
        group: ['**/adapters/channel/**', '**/ports/channel'],
        message: 'Envio só via Outbound/PolicyGate. Ver core/outbound/README.md',
      }],
    }],
  },
}
```

**A função pura (sem `Date.now()`, sem I/O — recebe `now`):**

```typescript
// core/outbound/policy-gate.ts — FUNÇÃO PURA. Testável sem DB, rede ou WhatsApp.
type Verdict = { allow: true; catchup: boolean }
              | { allow: false; reason: BlockReason }

function evaluatePolicy(snap: ConversationSnapshot, now: Date, intent: SendIntent): Verdict {
  // AR-005 — opt-out. Ledger, nunca coluna booleana.
  if (snap.optOutActive)            return deny('OPTOUT',         'R-024/AR-005')
  // AR-011 — base legal registrada antes de qualquer contato
  if (!snap.legalBasis?.registered)  return deny('NO_LEGAL_BASIS', 'R-064/AR-011')
  // AR-010 — silêncio total após handoff. Lê do banco, nunca de variável local.
  if (snap.engagementMode !== 'bot_active')
                                   return deny('HANDOFF_SILENT',  'R-066/AR-010')
  // AR-004/AR-009 — só texto e links
  if (intent.kind !== 'text')       return deny('MEDIA_FORBIDDEN','R-037/AR-004')
  // AR-007/AR-008 — janela e cota
  if (!isBusinessHours(now, snap.tz)) {
    // ÚNICA exceção: R-007. É um PARÂMETRO da intenção, não um bypass.
    return intent.isCatchupDrain
      ? { allow: true, catchup: true }
      : deny('OUTSIDE_WINDOW', 'R-006/AR-007')
  }
  if (snap.messagesSentToday >= snap.dailyCap)
      return deny('DAILY_QUOTA',       'R-023/AR-008')
  if (snap.reachoutTimelockActive)   return deny('ACCOUNT_TIMELOCKED', '463 banimento')
  if (snap.followUpIndex > 4)        return deny('SEQUENCE_EXHAUSTED', 'R-005')
  return { allow: true, catchup: false }
}
```

**O detalhe que decide se R-007 sobrevive:** o "follow-up vencido dispara quando o app abre" (R-007) é modelado como `intent.isCatchupDrain = true`, avaliado **dentro** do gate, não como um segundo caminho de saída que pula o gate. O risco documentado em R-007 é ALTO ("disparo em rajada pode causar banimento"). Um segundo caminho de saída seria um buraco não-LGPD, não-janela, não-cota. Este é o anti-padrão mais caro deste projeto.

---

### Padrão 3: Outbox com Reserva-e-Envia na Mesma Transação

**O que:** a cota diária é decrementada e a linha de outbox é inserida **na mesma transação** que grava a mensagem. Sem isso, um crash entre "decrementar cota" e "inserir na fila" vaza cota; o inverso duplica envio.

**Fontes:** o padrão "co-committed ledger" (escrita do ledger dentro da mesma transação que o efeito que deduplica) é o mecanismo de crash-safety de referencia em sistemas de FSM duráveis (MEDIUM-HIGH confidence).

```sql
-- Uma transação. Tudo ou nada.
BEGIN;
  -- trava pessimista na conversa: serializa decisões concorrentes do dispatcher
  SELECT engagement_mode, daily_cap FROM conversations WHERE id = $1 FOR UPDATE;

  INSERT INTO outbox (conversation_id, origin, idempotency_key, body, parts, scheduled_for)
  VALUES ($1, $2, $3, $4, $5, $6);

  UPDATE conversations SET messages_sent_today = messages_sent_today + 1 WHERE id = $1;
  UPDATE daily_counters SET sent = sent + 1 WHERE day = current_date AND number = $7;
COMMIT;
-- idempotency_key = sha256(conversationId + turnId)  → UNIQUE. Reenvio é no-op.
```

---

### Padrão 4: Handoff como Interrupção Persistida, Não como Callback

**O que:** handoff **não** é uma função suspensa esperando o humano. É um **estado de conversa gravado no banco**. O processo pode reiniciar 500 vezes; o estado `awaiting_human` continua lá.

**Por que:** a espera humana é ilimitada (horas, dias) e o app é local — o PC dorme, fecha, reinicia. Asemelhar o padrão `interrupt()` / `Command(resume=...)` do LangGraph: o checkpointer guarda o estado; a decisão do humano é aplicada **horas depois, num processo diferente**.

**Modelo de modo (por conversa, durável):**

```
bot_active ──[gatilho R-012/R-065/R-056]──▶ awaiting_human ──[Admin assume]──▶ human
                                                              │                        │
                                                    [Admin pede sugestão]           │
                                                              ▼                        ▼
                                                          copilot ◀──[devolve]───── bot_active
pausado ◀──[pausa manual]──────────────────────────────────────────────────────────────┘
```

| Modo | Bot envia? | Copiloto sugere? | Quem envia | Reversão |
|---|---|---|---|---|
| `bot_active` | ✅ (após gate) | — | bot | — |
| `awaiting_human` | ❌ **silêncio total** | — | ninguém | — |
| `human` | ❌ | opcional | Admin direto | explícita |
| `copilot` | ❌ | ✅ armazenado | Admin escolhe | explícita |
| `pausado` | ❌ | ❌ | ninguém | explícita |
| `encerrado` | ❌ | ❌ | ninguém | irreversível |

**Regras não negociáveis de modelagem:**
- `copilot` é um **estado irmão** de `human`, não um sub-estado. A diferença semântica é justamente o que o gate precisa saber: em `copilot`, uma sugestão **existe na base** e **nunca** vira `sent` sem ação explícita (R-014).
- Toda mudança de modo grava uma linha em `mode_changes` com `actor`, `from`, `to`, `reason`, `ts`. Auditoria de AR-010.
- **Não existe auto-retomada.** Nem por timeout, nem por "lead ficou 2 dias em silêncio". Só ação explícita do Admin.
- Sugestões do copiloto nascem em `messages` com `origin='ai_suggestion'` e `status='suggested'`. Nenhuma query as promove. A promoção é um `UPDATE ... SET status='sent' WHERE id=$1 AND status='suggested'` disparado por clique.

---

### Padrão 5: Barramento de Eventos em Memória, Enfileiramento no Postgres

**Por que não Redis nem broker externo:** R-044 restringe integrações a 3 e as Constraints proíbem infraestrutura extra. Postgres já é obrigatório (R-031). Um broker seria a 4ª dependência operacional para um sistema que processa ~80 mensagens/dia.

**Eventos (in-memory, tipados, `EventEmitter`):**

| Evento | Emitido por | Consumido por |
|---|---|---|
| `message.received` | Ingestion | Orchestrator, CrmQuery |
| `connection.changed` | ChannelPort | HealthMonitor, ApiHttp |
| `account.restricted` | ChannelPort (463 / reachoutTimeLock) | HealthMonitor, PolicyGate (via state) |
| `schedule.due` | Scheduler | Orchestrator |
| `handoff.triggered` | HandoffService | NotifyPort, ApiHttp, Orchestrator |
| `mode.changed` | CommandHandlers | ApiHttp, CrmQuery, EventStore |
| `llm.failed` | LlmPort | HealthMonitor, Orchestrator (fallback: silêncio) |

> **O bus em memória é volátil por escolha.** O que sobrevive a um crash é o `EventStore` (append-only) + o estado das conversas + a `outbox`. O bus só distribui o que já foi durável. Isso mantém o bus trivial (sem reentrega, sem DLQ, sem backpressure) sem perder nada que importe.

---

### Padrão 6: Relógio Injetado (`NowToken`)

**O que:** nenhuma lógica de janela, cota ou cadência chama `Date.now()` ou `new Date()`. O tempo é lido **uma vez** no topo do tick e injetado em todas as funções.

**Por que:** a lógica de janela 7h–17h + dias úteis + "próximo dia útil" + R-007 é onde mora a maior parte dos bugs. Com relógio injetado, ela é 100% testável com datas fixas (inclusive virada de mês, feriado, mudança de horário de verão brasileiro), e o re-execução de um dia é reproduzível.

**Regra de lint:** `no-restricted-properties` proibindo `Date.now` / `new Date` fora de `core/clock.ts`.

---

## Fluxo de Dados

### Fluxo 1: Mensagem Recebida → Resposta do Bot (caminho quente)

```
WhatsApp
  │  messages.upsert { type: 'notify' }
  ▼
[BaileysChannelAdapter]          ← adapter conhece Baileys (jid, @s.whatsapp.net, @lid)
  │  ChannelEvent (E.164, phone normalizado)
  ▼
[Ingestion]                      ① dedup por chave idempotente
  │                              ② watermark: descarta o que é anterior ao
  │                                 lastProcessedAt da conversa
  │                              ③ type==='append' (histórico) → persiste, NÃO publica
  │  message.received
  ▼
[EventBus] ──────────────────┐
  │                         │
  ▼                         ▼
[Orchestrator]          [CrmQuery] → painel (SSE)
  │ 1. carrega estado do Postgres (authoritativo)
  │ 2. guarda: opt-out? mídia? handoff? fora da janela?
  │    ├─ SIM → grava evento, muda estado, para. SEM LLM. SEM ENVIO.
  │    └─ NÃO ↓
  │ 3. monta contexto: slots + flags de qualificação + resumo (NÃO histórico bruto)
  │
  ▼
[LlmPort] ──► [API externa]     ④ dados minimizados/mascarados (R-009)
  │                              R-018: só nome/telefone/endereço
  │  TurnEnvelope (JSON, schema Zod)
  │  └─ validação falha → 1 reprompt corretivo → se falhar de novo:
  │                       estado = 'awaiting_human', motivo='llm_invalid'
  ▼
[Orchestrator] ⑤ resolveNextState(prev, hint, sinaisLocais)  ← DETERMINÍSTICO
  │             ⑥ grava: messages + event_log + state, UMA transação
  │  SendIntent { kind:'text', body, parts[], isCatchupDrain:false }
  ▼
[PolicyGate] ⑦ evaluatePolicy(snapshot, now, intent)  ◄── CHOKE POINT
  │
  ├─ deny  → grava blocked_attempt (auditoria) + notifica se crítico
  └─ allow ↓
  ▼
[Outbox] ⑧ reserva-e-envia na mesma transação (cota + linha)
  ▼
[Dispatcher] ⑨ humanização: delay aleatório, "digitando…", quebra em partes
  ▼
[ChannelPort.sendText] ⑩
  ▼
WhatsApp
```

### Fluxo 2: Gatilho de Handoff (o mais sensível)

```
[Orchestrator] detecta sinal: pricingAsked | botSuspicion | irritation
             | optOutIntent | mediaReceived | dúvida complexa
  │
  ├── sinal: optOutIntent
  │     └──▶ [OptOutLedgerService] grava linha de ÓTICA
  │           (base, finalidade, fonte, data, hora, conteúdo literal)
  │           estado = 'encerrado'. PERMANENTE. AR-005.
  │
  ├── sinal: botSuspicion | irritation  (R-057 / R-066)
  │     └──▶ estado = 'awaiting_human'
  │           estado     = 'awaiting_human'
  │           sendIntent = NENHUMA.  ← silêncio total, sem "deixa eu explicar"
  │
  └── qualquer sinal
        ├──▶ [HandoffService] grava handoff_events(reason, trigger, evidence)
        ├──▶ [NotifyPort] som + pop-up com lead/motivo/ação rápida (R-013)
        ├──▶ [Orchestrator] estado = 'awaiting_human'
        └──▶ EventBus → painel mostra o modo em tempo real (R-046)

[Admin] clica "Assumir" ──▶ mode_changes(human) ──▶ [LlmPort] gera sugestões
                              (suggestions, NUNCA enviadas) ──▶ painel
[Admin] clica uma sugestão ──▶ UPDATE status='sent' WHERE status='suggested'
                                ──▶ mesma transação da outbox da Admin
[Admin] clica "Devolver ao bot" ──▶ mode_changes(bot_active) ──▶ retoma FSM
```

> **Nota de assimetria:** mensagens enviadas pelo Admin passam pelo **mesmo** `PolicyGate`, com `intent.origin = 'admin'`. Isso é deliberado. O gate de opt-out, tipo de mídia e base legal se aplicam ao Admin também. O que **não** se aplica a ele é janela e cota automática — o Admin é humano e pode responder à noite. A distinção é `intent.isCatchupDrain` / `origin`, nunca um segundo pipeline.

### Fluxo 3: Follow-up Vencido (R-007) — o fluxo de maior risco

```
[Scheduler] tick de 30s
  │  SELECT * FROM scheduled_tasks
  │   WHERE status='pending' AND scheduled_for <= $now
  │   FOR UPDATE SKIP LOCKED          ← nunca dois dispatchers no mesmo item
  ▼
[evaluateNextBusinessDay]  ①②③
  │  (a) data já é dia útil E dentro de 7h–17h?  → mantém o horário original
  │  (b) dia útil mas fora da janela?              → 07h00 do mesmo dia
  │  (c) fim de semana / feriado?                  → 07h00 do próximo dia útil
  ▼
┌─── DRAIN CONTROLADO (R-007) ─────────────────────────────────────┐
│                                                                  │
│  app abre 06h30 de segunda. Há 14 follow-ups vencidos.           │
│  → NÃO dispara em rajada.                                        │
│  → DRENAGEM: máx. 5 mensagens, espaçadas ≥ 3 min, às 07h00       │
│  → o restante permanece na fila com due = amanhã 07h             │
│  → cada uma passa pelo PolicyGate com isCatchupDrain=true        │
│                                                                  │
│  O gate AINDA é consultado: tipo, opt-out, base legal,           │
│  sequência e timelock continuam valendo.                         │
└──────────────────────────────────────────────────────────────────┘
  ▼
[Outbox → Dispatcher] → [ChannelPort.sendText]
```

**O porquê do drain escalonado:** R-007 é a exceção de maior risco anti-banimento do projeto, e o próprio requisito registra o risco como ALTO. Disparar 14 mensagens em 20 segundos às 06h30 é tecnicamente "dentro da exceção" e operacionalmente suicida. O escalonamento é uma decisão de arquitetura, não de requisito — deve ser registrado como ADR.

---

## Forma do Schema (PostgreSQL)

**Fontes:** padrões de modelagem de conversa + ledger de consentimento + log imutável em Postgres, confirmados em pesquisa (MEDIUM-HIGH confidence).

```sql
-- ═══ IDENTIDADE ═══
-- E.164 é a identidade do domínio. NUNCA 'jid', NUNCA '@lid', NUNCA '@s.whatsapp.net'.
CREATE TABLE leads (
  id              BIGSERIAL PRIMARY KEY,
  phone_e164      TEXT NOT NULL,                    -- único: 1 lead ativo por número
  name            TEXT,
  address_line    TEXT,                             -- R-018: só isso vem da API
  source          TEXT NOT NULL,                    -- origem (R-064/AR-011)
  legal_basis     TEXT NOT NULL DEFAULT 'legitimate_interest',
  purpose         TEXT NOT NULL,                    -- R-064
  legal_registered_at TIMESTAMPTZ,                  -- AR-011: sem isso, gate BLOQUEIA
  dedupe_flag     BOOLEAN DEFAULT FALSE,            -- R-020: sinaliza, NÃO bloqueia
  dedupe_of       BIGINT REFERENCES leads(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT leads_phone_e164_chk CHECK (phone_e164 ~ '^\+[1-9][0-9]{7,14}$')
);
CREATE UNIQUE INDEX ON leads (phone_e164) WHERE dedupe_flag = FALSE;

-- ═══ CONVERSA — o estado autoritativo ═══
CREATE TABLE conversations (
  id                BIGSERIAL PRIMARY KEY,
  lead_id           BIGINT NOT NULL REFERENCES leads(id),
  number_e164       TEXT NOT NULL,                  -- R-059: 1 número
  state             TEXT NOT NULL DEFAULT 'novo',   -- FSM state
  engagement_mode   TEXT NOT NULL DEFAULT 'bot_active',
  stage             TEXT NOT NULL DEFAULT 'aquecimento',
  qualification     JSONB NOT NULL DEFAULT '{}',   -- {verba:0..2, decisionPower:0..2}
  follow_up_index   SMALLINT NOT NULL DEFAULT 0,   -- R-005: máx 4
  last_inbound_at   TIMESTAMPTZ,
  last_outbound_at  TIMESTAMPTZ,
  last_processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),  -- WATERMARK anti-history
  messages_sent_today SMALLINT NOT NULL DEFAULT 0,
  daily_cap         SMALLINT NOT NULL DEFAULT 30,  -- R-023
  timezone          TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  reachout_timelock_until TIMESTAMPTZ,              -- 463 (HIGH confidence)
  closed_reason     TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- DEFESA EM PROFUNDIDADE: o banco recusa estado inválido, mesmo se o app
  -- for buggy ou uma versão antiga for Writer.
  CONSTRAINT conversations_state_chk CHECK (state IN (
    'novo','aquecimento','qualificando','aquecido',
    'awaiting_human','human','copilot','pausado','encerrado')),
  CONSTRAINT conversations_mode_chk CHECK (engagement_mode IN (
    'bot_active','awaiting_human','human','copilot','pausado')),
  CONSTRAINT conversations_quota_chk CHECK (messages_sent_today >= 0)
);
CREATE INDEX ON conversations (engagement_mode) WHERE state <> 'encerrado';
CREATE INDEX ON conversations (last_inbound_at) WHERE engagement_mode = 'bot_active';

-- ═══ MENSAGENS — append-only. NUNCA UPDATE de conteúdo. ═══
CREATE TABLE messages (
  id              BIGSERIAL PRIMARY KEY,
  conversation_id BIGINT NOT NULL REFERENCES conversations(id),
  direction       TEXT NOT NULL,                    -- 'in' | 'out'
  origin          TEXT NOT NULL,                    -- 'lead'|'bot'|'admin'|'ai_suggestion'
  kind            TEXT NOT NULL DEFAULT 'text',     -- R-037: CHECK impede mídia
  body            TEXT NOT NULL,
  parts           JSONB,                            -- quebra de msgs longas (R-067)
  status          TEXT NOT NULL DEFAULT 'queued',   -- queued|suggested|sent|failed|blocked
  provider_msg_id TEXT,                             -- id do Baileys/Cloud API
  idempotency_key TEXT NOT NULL UNIQUE,             -- dedup + crash-safety
  latency_ms      INTEGER,                          -- tempo LLM→resposta (qualidade)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT messages_kind_chk CHECK (kind IN ('text','link'))  -- AR-004
);

-- ═══ LEDGER DE OPT-OUT — linhas, NUNCA boolean ═══
-- O teste de ácido: "mostre o consentimento exato sob o qual a linha X é
-- processada hoje". Com ledger, é um JOIN. Com coluna boolean, é um mistério.
CREATE TABLE optout_ledger (
  id              BIGSERIAL PRIMARY KEY,
  lead_id         BIGINT NOT NULL REFERENCES leads(id),
  event_type      TEXT NOT NULL,                    -- 'opt_out'|'erasure_request'|'reinstate'
  source          TEXT NOT NULL,                    -- 'auto_detected'|'manual'
  detected_by     TEXT,                             -- 'deterministic'|'llm_signal'
  raw_content     TEXT NOT NULL,                    -- texto literal que disparou
  legal_basis     TEXT NOT NULL,
  purpose         TEXT NOT NULL,
  occurred_at     TIMESTAMPTZ NOT NULL,
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- irreversível: a tabela só recebe INSERT. Nenhuma coluna de "ativo".
  -- "ativo" = existe opt_out sem reinstate posterior.
  CONSTRAINT optout_event_chk CHECK (event_type IN ('opt_out','erasure_request','reinstate'))
);
CREATE INDEX ON optout_ledger (lead_id, occurred_at DESC);

-- ═══ OUTBOX ═══
CREATE TABLE outbox (
  id              BIGSERIAL PRIMARY KEY,
  conversation_id BIGINT NOT NULL REFERENCES conversations(id),
  origin          TEXT NOT NULL,                    -- 'bot'|'admin'|'followup'|'catchup'
  message_id      BIGINT REFERENCES messages(id),
  body            TEXT NOT NULL,
  parts           JSONB,
  idempotency_key TEXT NOT NULL UNIQUE,
  scheduled_for   TIMESTAMPTZ NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending',  -- pending|sent|failed|abandoned
  attempt_count   SMALLINT NOT NULL DEFAULT 0,
  last_error      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT outbox_status_chk CHECK (status IN ('pending','sent','failed','abandoned'))
);
CREATE INDEX ON outbox (status, scheduled_for)
  WHERE status = 'pending';                          -- índice parcial: só o que importa

-- ═══ AGENDAMENTOS ═══
CREATE TABLE scheduled_tasks (
  id              BIGSERIAL PRIMARY KEY,
  conversation_id BIGINT NOT NULL REFERENCES conversations(id),
  task_type       TEXT NOT NULL,                    -- 'followup'|'reminder'|'cadence_stop'
  follow_up_index SMALLINT NOT NULL,
  scheduled_for   TIMESTAMPTZ NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending',
  deferral_count  SMALLINT NOT NULL DEFAULT 0,
  reason          TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON scheduled_tasks (scheduled_for) WHERE status = 'pending';

-- ═══ HISTÓRICO DE STATUS — imutável (R-022) ═══
CREATE TABLE status_history (
  id            BIGSERIAL PRIMARY KEY,
  lead_id       BIGINT NOT NULL REFERENCES leads(id),
  from_status   TEXT, to_status TEXT NOT NULL,
  source        TEXT NOT NULL,                      -- 'ai'|'admin'
  justification TEXT,                               -- obrigatório p/ status crítico
  confidence    NUMERIC(3,2),                       -- NUMERIC, nunca float
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ═══ AUDITORIA ═══
CREATE TABLE event_log (                -- append-only, NUNCA UPDATE/DELETE
  id        BIGSERIAL PRIMARY KEY,
  conv_id   BIGINT REFERENCES conversations(id),
  type      TEXT NOT NULL,
  payload   JSONB NOT NULL,
  ts        TIMESTAMPTZ NOT NULL
);
CREATE TABLE mode_changes (              -- auditoria de AR-010
  id BIGSERIAL PRIMARY KEY, conversation_id BIGINT NOT NULL REFERENCES conversations(id),
  actor TEXT NOT NULL, from_mode TEXT NOT NULL, to_mode TEXT NOT NULL,
  reason TEXT, ts TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE handoff_events (
  id BIGSERIAL PRIMARY KEY, conversation_id BIGINT NOT NULL REFERENCES conversations(id),
  reason TEXT NOT NULL, evidence TEXT, acknowledged_at TIMESTAMPTZ,
  ts TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE blocked_attempts (          -- gate negou: a trilha de auditoria mais valiosa
  id BIGSERIAL PRIMARY KEY, conversation_id BIGINT, reason TEXT NOT NULL,
  intent JSONB, ts TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ═══ LLM — custo é propriedade da GERAÇÃO, não da mensagem ═══
CREATE TABLE llm_runs (
  id BIGSERIAL PRIMARY KEY, conversation_id BIGINT NOT NULL REFERENCES conversations(id),
  requested_model TEXT NOT NULL, served_model TEXT, prompt_tokens INTEGER,
  completion_tokens INTEGER, cost_usd NUMERIC(12,6),   -- NUMERIC, nunca float
  status TEXT NOT NULL, error_code TEXT, latency_ms INTEGER,
  redaction_applied JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ═══ CRM (R-043) ═══
CREATE TABLE notes (
  id BIGSERIAL PRIMARY KEY, lead_id BIGINT NOT NULL REFERENCES leads(id),
  body TEXT NOT NULL, author TEXT NOT NULL,        -- 'ai'|'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE tasks (
  id BIGSERIAL PRIMARY KEY, lead_id BIGINT NOT NULL REFERENCES leads(id),
  title TEXT NOT NULL, due_at TIMESTAMPTZ, done_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE tags (
  id SMALLSERIAL PRIMARY KEY, name TEXT UNIQUE NOT NULL);
CREATE TABLE lead_tags (
  lead_id BIGINT REFERENCES leads(id), tag_id SMALLINT REFERENCES tags(id),
  PRIMARY KEY (lead_id, tag_id));

-- ═══ CONFIG ═══
CREATE TABLE settings (key TEXT PRIMARY KEY, value JSONB NOT NULL, updated_at TIMESTAMPTZ DEFAULT now());

-- ═══ CREDENCIAIS — separadas do código e da configuração ═══
CREATE TABLE api_keys (
  id         BIGSERIAL PRIMARY KEY,
  provider   TEXT NOT NULL,            -- 'openai'|'gemini'|'llm'|'lead_source'
  scope      TEXT NOT NULL,            -- 'primary'|'fallback'|'channel_auth'
  kind       TEXT NOT NULL,            -- 'secret'|'basic_auth'|'session'
  value      TEXT NOT NULL,            -- chave/segredo. R-033: sem criptografia adicional,
                                       -- confiança no controle de acesso do PC (risco aceito)
  label      TEXT,                     -- ex.: "Gemini prod", "caça-leads staging"
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason     TEXT                      -- por que existe (auditoria)
);
-- NOTA: a sessão do Baileys (auth state) é armazenada em DISCO separado
-- (creds.json + diretório de auth do @whiskeysockets/auth-state) — nunca no Postgres.
-- O path fica em settings; a migração R-016 muda a origem do adapter, não a tabela.

CREATE TABLE daily_counters (
  day DATE NOT NULL, number_e164 TEXT NOT NULL, sent SMALLINT NOT NULL DEFAULT 0,
  leads_contacted SMALLINT NOT NULL DEFAULT 0, PRIMARY KEY (day, number_e164));
```

**Decisões de modelagem e seu porquê:**

| Decisão | Alternativa rejeitada | Razão |
|---|---|---|
| E.164 como identidade | `jid` como PK | JID vazаBaileys (`@s.whatsapp.net` vs `@lid`); migração para Cloud API reescreveria tudo. R-016 |
| `state` e `engagement_mode` separados | Um único enum | Um é máquina de fluxo, outro é autoridade de envio. `copilot` convive com vários `state` |
| Ledger de opt-out | `leads.opt_out BOOLEAN` | Boolean perde data, base, evidência e histórico. AR-005 exige irreversibilidade auditável |
| `llm_runs` separado de `messages` | Colunas de custo em `messages` | Uma geração falha/re-tenta/fallback e não produz `message`. O custo existe sem a linha |
| `NUMERIC` para custo | `REAL`/`float` | Custo por request tem 5–6 casas decimais; soma de float não bate com a fatura |
| `timestamptz` em tudo | `timestamp` | Janela 7h–17h é dependente de fuso; horário de verão brasileiro quebra naive |
| `CHECK` constraints em todos os enums | Validação só na aplicação | Uma versão antiga do app ou um bug escreve lixo; o banco recusa |
| Sem `updated_at` em tabelas imutáveis | `updated_at` em tudo | `updated_at` em log append-only é um convite a mutação silenciosa |
| `qualification` em `JSONB` | Colunas `has_verba BOOL` | R-052 é híbrido e sequencial; colunas booleanas congelam o modelo de dado cedo demais |

---

## Estrutura de Projeto Recomendada

```
src/
├── core/                        # O HEXÁGONO. Zero imports de adapters.
│   ├── ports/                   # Interfaces (a fronteira de R-016)
│   │   ├── channel.ts           #   E.164, não jid
│   │   ├── llm.ts
│   │   ├── notifier.ts
│   │   ├── promoSources.ts
│   │   └── clock.ts             #   NowToken
│   ├── orchestrator/
│   │   ├── machine.ts           #   Tabela de estados + allowedTransitions
│   │   ├── guards.ts            #   Invariantes locais (opt-out, mídia, handoff)
│   │   ├── transitions.ts       #   resolveNextState() — determinístico
│   │   ├── handlers.ts          #   Um handler por evento do bus
│   │   └── reducer.ts           #   Efeitos colaterais da transição
│   ├── outbound/
│   │   ├── policy-gate.ts       #   CHOKE POINT. Função pura.
│   │   ├── outbox.ts            #   Reserva-e-envia na mesma transação
│   │   ├── dispatcher.ts        #   Único consumidor de ChannelPort.sendText
│   │   ├── humanize.ts          #   R-067: delays, digitando, quebra
│   │   └── guards/              #   1 teste por regra, sem mock de I/O
│   ├── inbound/
│   │   ├── ingest.ts            #   Dedup + watermark + append/notify
│   │   └── event-bus.ts
│   ├── schedule/
│   │   ├── scheduler.ts         #   Tick 30s, SKIP LOCKED
│   │   ├── business-hours.ts    #   7h–17h úteis + feriados BR
│   │   └── cadence.ts           #   1h → 1d → 3d → 7d (R-005)
│   ├── handoff/
│   │   ├── triggers.ts          #   R-012, R-056, R-065, R-038
│   │   └── service.ts
│   ├── compliance/
│   │   ├── optout-ledger.ts     #   Append-only
│   │   ├── legal-basis.ts       #   AR-011
│   │   └── redaction.ts         #   R-009 minimização
│   └── crm/                     # Projeções de leitura
│
├── adapters/                    # TUDO swappable. Zero regras de negócio.
│   ├── channel/
│   │   ├── baileys/             # jid, @lid, presence, 463 — só aqui
│   │   ├── cloud-api/           # R-016: futuro
│   │   └── fake/                # Testes. Sem número real.
│   ├── llm/{openai,gemini,claude,scripted}/
│   ├── notifier/windows.ts
│   ├── persistence/postgres/
│   └── promo-sources/lead-api.ts
│
├── api/                         # Painel (R-046). Só delega; nunca decide.
│   ├── http/routes.ts
│   ├── commands/                # pausar|assumir|devolver|copilot
│   ├── queries/
│   └── sse/stream.ts            # Eventos em tempo real
│
├── app.ts                       # Composition root. Único lugar com `new`.
└── worker.ts                    # Entry point do processo longo
```

### Estrutura — Racional

- **`core/` e `adapters/` separados por regra de lint, não por convenção.** `no-restricted-imports` proíbe `core/**` de importar `adapters/**`. Isso é o que garante que a FSM é testável sem WhatsApp e que a migração R-016 não toca o núcleo.
- **`ports/` dentro de `core/`, não num pacote separado.** As interfaces são *possuídas pelo domínio*. Se morassem fora, um adapter poderia "evoluir" a interface e arrastar o domínio junto.
- **`outbound/` como diretório próprio.** Visualmente ausente do resto do código. A pergunta "por que só `dispatcher.ts` envia?" tem resposta em 3 segundos.
- **`core/outbound/guards/` com um arquivo por regra.** Cada anti-requisito vira um arquivo nomeado. Auditoria de conformidade vira "existe teste para `guards/ar-005-optout.ts`?".
- **`adapters/fake/` é FIRST-class.** Não é `__mocks__`. Fakes de primeira classe são o que torna a FSM testável de graça.

### Modelo de Processo (Windows)

**Recomendação: processo Node único de longa duração como backend (`worker.ts`) + painel no navegador em `localhost`, NÃO Electron no MVP.**

| Opção | Vantagem | Custo | Veredito |
|---|---|---|---|
| **Backend Node + painel em `localhost` (navegador)** | Ciclo de vida do bot independente da UI; mínima superfície; painel aberto numa aba e o PC pode dormir/acordar; testes end-to-end por HTTP | Sem ícone de tray, sem autostart nativo | **MVP** |
| Electron (renderer + main como orquestrador) | Tray, notificações nativas, janela única | Orquestrador preso ao ciclo de vida do Electron; restart da janela derruba o bot; peso e boot lento (arquitetura padrão de apps Electron locais documenta o "background server" justamente para os dois) | Pós-MVP, como *shell* opcional |
| Serviço Windows (NSSM/px) + painel | Inicia com o SO | Complexidade operacional cedo demais para 1 usuário | Deferido |

**Decisões derivadas:**
- **Comunicação painel ↔ backend:** REST (`invoke`-style commands) + **SSE** (1 direcional, tempo real, sem biblioteca extra). Socket.IO/WebSocket é overkill para "modo mudou" / "nova mensagem" (R-046).
- **Segurança do localhost:** bind em `127.0.0.1` (nunca `0.0.0.0`), porta fixa randômica, token de sessão no primeiro GET, **validação do header `Host`** contra DNS rebinding/CSRF de site malicioso que pode chamar `http://localhost:PORT`. Sem isso, um site aberto no navegador consegue disparar comandos no bot (R-033 não cobre isso — é exposição, não criptografia).
- **Notificações:** `node-notifier` a partir do backend (padrão Toast do Windows + som). O painel aberto no navegador não recebe `Notification` nativo de forma confiável — o backend é o `NotifyPort`.
- **Restart:** `worker.ts` registra `SIGINT`/`SIGTERM`; no boot, re-hidrata estado + roda o drain de R-007. A FSM sobrevive a qualquer morte por construção (estado no Postgres, outbox idempotente).

---

## Considerações de Escala

| Escala | Ajuste de Arquitetura |
|---|---|
| **Piloto (1 Admin, 1 número, ~20–30 msg/dia)** | Monólito em 1 processo Node. Postgres local. Dispatcher em `setInterval(30s)`. Painel em `localhost`. **Não há motivo para qualquer outra coisa.** |
| **+1 número dedicado (2–3)** | Nenhuma mudança estrutural. Adicionar `number_e164` como coluna de chave composta em `daily_counters` e no gate. Continua monolítico. |
| **Agência com equipe (5–15 vendedores)** | Ainda monolítico. Adicionar `owner_id` em `leads` (R-028 já prepara o terreno), auth no painel, e `FOR UPDATE` por conversa. `outbox` já é o ponto de contenção. |
| **+50 usuários / +10 números** | O gargalo vira o `PolicyGate` em memória e a serialização por conversa. Extrair o dispatcher para processo próprio com `SKIP LOCKED` transversal. Postgres absorve. Nada de broker externo ainda. |
| **Precisando de feed público** | Só aí considerar LISTEN/NOTIFY do Postgres ou um broker dedicado. O `event_log` já é o log de eventos que um CDC consumiria. |

### Prioridades de Escala

1. **Primeiro gargalo: latência do LLM no caminho quente.** Mitigação já embutida: o gate e a outbox são síncronos e baratos; a chamada externa não bloqueia a ingestão. Mensagens do lead continuam sendo persistidas enquanto o LLM pensa.
2. **Segundo gargalo: rajada de R-007.** Mitigação já embutida: drain escalonado, não disparo em bloco.
3. **Terceiro gargalo: serialização por conversa.** Duas mensagens simultâneas do mesmo lead podem gerar duas chamadas de LLM concorrentes. `SELECT ... FOR UPDATE` na conversa resolve; **deve ser implementado já no MVP**, não depois.

---

## Anti-Padrões

### Anti-Padrão 1: Estado no Prompt

**O que fazem:** descrevem o estágio da conversa, as flags de qualificação e as regras dentro do system prompt, e confiam que o LLM remember.

**Por que está errado:** o LLM é stateless entre turnos e por contexto. Ele *esquece*, *alucina* e pode ser dominado pelo contexto longo. AR-001 e AR-010 deixariam de ser invariantes e virarem sugestões. A pesquisa é unânime aqui (HIGH confidence): o estado deve viver no banco, e o prompt é *renderizado a partir* do estado.

**Faça em vez disso:** estado no Postgres. `renderPrompt(state, lastMessages, now)` monta o prompt. `state → prompt`, nunca `prompt → state`.

---

### Anti-Padrão 2: Transição de Estado Escolhida pelo LLM

**O que fazem:** seguem LangGraph/SMAG/loom, onde o LLM escolhe o próximo nó via `next_state_suggestion` ou tool call.

**Por que está errado:** *é o padrão da indústria, e está errado aqui.* Uma transição errada significa que o bot "negocia preço" ou "responde após handoff". Um único alucinação num turno vira uma violação de AR-001.

**Faça em vez disso:** o padrão "Hinted FSM" do §Padrão 1. A LLM sugere; o código decide; guardas absolutas vencem a sugestão.

---

### Anti-Padrão 3: Dois Caminhos de Saída

**O que fazem:** "o bot passa pelo gate, mas mensagens do Admin vão direto pro canal — o Admin é humano, não precisa de janela".

**Por que está errado:** cria um buraco de LGPD, opt-out e tipo de mídia que o Admin pode atravessar sem querer (e que uma futura feature vai usar por engano). A "exceção R-007" é o cavalo de Troia clássico aqui.

**Faça em vez disso:** um pipeline. `intent.origin` e `intent.isCatchupDrain` são **parâmetros**, não atalhos. O gate avalia tudo sempre; a exceção R-007 é uma entrada do gate, não uma saída dele.

---

### Anti-Padrão 4: Polling de Histórico em Loop

**O que fazem:** `setInterval(() => getChatHistory(jid), 5000)` para "pegar as mensagens novas".

**Por que está errado:** três razões independentes. (a) Duplicata: a janela entre leituras perde mensagens. (b) Latência: até 5s de atraso numa conversa de vendas. (c) **Contamina a contagem de R-023**: mensagens já lidas entram de novo como se fossem novas, e o sistema responde a mensagens antigas.

**Faça em vez disso:** eventos. `messages.upsert` é o evento canônico.

---

### Anti-Padrão 5: Ignorar o Buffer de History-Sync do Baileys

**O que acontece (verificado no código-fonte do Baileys, `src/Utils/event-buffer.ts` e `src/Socket/chats.ts`):** `messages.upsert` está na lista `BUFFERABLE_EVENT`. Ao entrar em `AwaitingInitialSync`, o Baileys chama `ev.buffer()` e **acumula** as mensagens em vez de emití-las. Só um `ev.flush()` — disparado quando a sincronia de histórico termina, ou por um timeout de 20s — as libera. Em reconexão com `accountSyncCounter > 0`, a espera é pulada e vai direto a `Online`.

**Por que está errado:** num **boot novo** (sessão nova, `authState` recriada, mudança de PC), o flush libera um bloco de mensagens de dias anteriores como se fossem novas. O bot responderia a mensagens antigas — violando R-006 (fora da janela), R-023 (cota) e o espírito de R-001 (1º contato é sempre humano, atual).

**Faça em vez disso:**
```typescript
// 1. Só tratar 'notify' como conversa viva. 'append' = histórico → persiste, não publica.
// 2. Watermark por conversa: descartar qualquer inbound com ts <= last_processed_at.
// 3. Startup: marcar o sistema como 'hydration' até o primeiro flush; em 'hydration',
//    o Orchestrator registra as mensagens mas NÃO gera resposta para nada.
if (upsert.type === 'append' || msg.messageTimestamp <= conv.last_processed_at) {
  await messageRepo.append(raw);   // histórico, para o CRM
  return;                           // ← sem publicação no bus
}
eventBus.emit('message.received', normalized);
```

---

### Anti-Padrão 6: Verificação de Existência do Número Antes do Envio

**O que fazem:** `if (!(await sock.onWhatsApp(jid)).exists) return;` antes de enviar, para "não gastar mensagem com número inválido".

**Por que está errado — e este é um achado verificado em produção:** relatórios no tracker do Baileys (issue #2441, #2707 e PR #2442) indicam que **`onWhatsApp` em si consome orçamento de reach-out**, e que enviar para um número não registrado no WhatsApp pode **disparar uma restrição de nível de conta** (erro 463, tipo `RESTRICT_ALL_COMPANSIONES`) em vez de um erro de destinatário. A função de verificação *acelera* o problema que deveria evitar.

**Faça em vez disso:** confiar na qualidade do caça-leads, exatamente como R-019 já determina ("validação é responsabilidade do sistema de caça-leads"). Em caso de falha de envio, registrar e seguir — sem retry agressivo, porque **retry para número inválido é o que mais gera reach-out**.

> **Nota de arquitetura:** R-019 e este achado convergem. A camada de envio **não deve** fazer checagem de existência própria. Registrar isso como ADR para que uma futura "melhoria" não reintroduza a chamada.

---

### Anti-Padrão 7: Reconnect sem Teardown

**O que fazem:** no handler `connection: 'close'`, chamam `connect()` de novo sem destruir o socket morto.

**Por que está errado:** durante a janela de transição, existem **dois sockets vivos na mesma sessão**. O WhatsApp trata isso como conflito; há relatos de escalada de simples desconexão até banimento real. O padrão que funciona é um **guard monotônico de tentativa**: ignorar/destruir qualquer socket ou evento de uma tentativa superada, mais backoff exponencial com teto.

**Faça em vez disso:** `attemptId` incremental; todo callback captura o id e retorna cedo se `id !== currentAttemptId`. Backoff exponencial com jitter, teto de ~30s.

---

### Anti-Padrão 8: Confiar no LLM para Detectar Opt-Out

**O que fazem:** mandam a mensagem do lead pro LLM e perguntam "esse texto indica opt-out?".

**Por que está errado:** AR-005 é irreversível. Uma falha de detecção significa que o sistema envia para alguém que pediu para ser deixado em paz — o pior resultado possível em termos de LGPD e de saúde do número. A detecção por LLM é probabilística; o requisito é absoluto.

**Faça em vez disso:** **dois níveis, com o determinístico como autoridade.** (1) Matcher determinístico de padrões pt-BR ("para de enviar", "não quero mais saber", "tira meu número", "SAIR", "deixa em paz", "não mande mais mensagem") — case-insensitive, com acentos normalizados, cobrindo ~95% dos casos reais. (2) `llm_signal` como **reforço**: se a LLM sinalizar `optOutIntent`, grava no ledger também. **Qualquer um dos dois aciona o opt-out; a liberação (reinstate) só por ação manual explícita do Admin, com linha de log.** Assim o sinal da LLM só pode *aumentar* a proteção, nunca diminuí-la.

---

### Anti-Padrão 9: Agendamento em Memória

**O que fazem:** `node-cron` / `node-schedule` / `croner` para as cadências de follow-up.

**Por que está errado:** todos os três são in-memory (verificado em documentação e comparativos — HIGH confidence). Se o processo morre ou o PC reinicia, o agendamento **é perdido**. Mas R-007 exige justamente o comportamento de "pegar o que venceu quando o app abre" — o que é impossível se o vencimento morre junto com o processo.

**Faça em vez disso:** tabela `scheduled_tasks` no Postgres + dispatcher com `SELECT ... FOR UPDATE SKIP LOCKED`. pg-boss é uma alternativa legítima (mesmo Postgres, sem Redis), mas para ~80 tarefas/dia uma tabela própria dá, de graça, o que importa aqui: **visibilidade de negócio** — o Admin precisa ver no painel *por que* aquele lead está na fila de amanhã.

---

### Anti-Padrão 10: Verificação de Existência do Número no Envio (Ver Anti-Padrão 6)

*(consolidado acima — mesma entrada)*

---

## Pontos de Integração

### Serviços Externos

| Serviço | Padrão | Armadilhas |
|---|---|---|
| **WhatsApp via Baileys** | `ChannelPort` + `BaileysChannelAdapter`. Eventos: `messages.upsert`, `connection.update`, `messages.update`, `message-capping.update` | Buffer de history-sync (§AP5); 463/timelock (HIGH); reconnect sem teardown (HIGH); `jid` vs `@lid` — **armazenar tokens sempre indexados por LID, nunca por JID**; `time_enforcement_ends` vem como **string em segundos unix** (×1000); `onWhatsApp` consome reach-out |
| **WhatsApp Cloud API (futuro, R-016)** | Novo `CloudApiChannelAdapter` implementando o mesmo `ChannelPort` | **Não tem** presence/`composing` nem backfill de histórico equivalente → `capabilities()` deve reportar `canSimulateTyping: false` e o R-067 precisa degradar. Templates de mensagem em vez de texto livre. Webhooks em vez de `messages.upsert` |
| **API de LLM** | `LlmPort`, 1 chamada/turno, saída JSON com schema Zod | Nunca Retry em loop sobre a mesma entrada (custo + é o gatilho de "IA travando"); sempre `llm_runs` para custo/token/latência; mascarar dados sensíveis **antes** (R-009) |
| **PostgreSQL local** | Pool `pg`, migrations versionadas, `NUMERIC`/`timestamptz` | Sem `updated_at` em tabelas imutáveis; `SKIP LOCKED` para o dispatcher; `CHECK` constraints como última linha de defesa |
| **Notificações Windows** | `NotifyPort` → `node-notifier` (Toast) + som do sistema | Notificação é *advisory*: se falhar, o handoff **continua valendo**. Nunca inverter a ordem (gravar estado → depois notificar) |
| **API do caça-leads** | `PromoSourcesPort`; retorna nome/telefone/endereço | Não deduplicar (R-020); validar qualidade do telefone é responsabilidade *dela* (R-019); a entrada precisa escrever `legal_registered_at` ou o gate bloqueia (AR-011) |

### Fronteiras Internas

| Fronteira | Comunicação | Considerações |
|---|---|---|
| `adapters/channel` ↔ `core/inbound` | Eventos tipados, E.164 | Nenhum `jid` cruza. Baileys traduz na fronteira |
| `core/inbound` ↔ `core/orchestrator` | `EventBus` em memória, assíncrono | Publicar **após** persistir. Se o bus perder o evento, o estado no Postgres é a verdade |
| `core/orchestrator` ↔ `core/llm` | Chamada síncrona, 1 por turno | A LLM é a única chamada lenta no caminho quente. Nunca segurar transação aberta durante a chamada |
| `core/orchestrator` → `core/outbound` | `SendIntent` (dados, não handle de canal) | O orquestrador **nunca** recebe o `ChannelPort`. Não tem como enviar |
| `core/outbound` → `adapters/channel` | Uma única chamada no arquivo | Bloqueada por lint fora de `dispatcher.ts` |
| `api/` ↔ `core/` | HTTP commands + SSE | Commands viram eventos no bus. Queries leem o Postgres. A API nunca escreve direto nas tabelas do domínio |
| `core/schedule` ↔ `core/outbound` | Cria `SendIntent` | Segue pelo mesmo gate, com `isCatchupDrain` quando aplicável |

---

## Ordem de Construção Sugerida

A ordem é derivada das arestas de dependência reais, não de conveniência. **A coluna "por que antes" é o que torna a ordem defensável.**

| # | Fase / Componente | Depende de | Por que **precisa** vir antes |
|---|---|---|---|
| 1 | **Schema + migrations + repositórios** | — | Tudo lê estado. Sem isso não existe fonte de verdade. `engagement_mode`, `state` e `optout_ledger` entram **agora**, mesmo que handoff e opt-out só funcionem na fase 7 — retrofitar modo em todas as tabelas é reescrita |
| 2 | **`ChannelPort` + `FakeChannel` + `BaileysChannelAdapter`** | 1 | Define a fronteira de R-016. O fake permite testar a FSM sem número real. A porta é declarada em E.164 desde o primeiro commit |
| 3 | **Ingestion + EventBus + watermark** | 1, 2 | Todo o resto consome eventos. O watermark (AP5) precisa existir antes de qualquer coisa que responda, senão o primeiro boot responde a mensagens antigas |
| 4 | **PolicyGate (função pura) + testes por anti-requisito** | 1 | **O gate antes do LLM.** Nada envia antes do gate existir — nem em teste, nem em branch. 12 arquivos de guard, 12 arquivos de teste. Se só uma fase puder ser feita "com cuidado total", é esta |
| 5 | **Outbox + Dispatcher + humanização** | 2, 4 | Primeiro caminho real de saída. Continua com respostas fixas (sem LLM) para validar ponta a ponta com risco zero de alucinação |
| 6 | **Orchestrator FSM + LlmPort** | 1, 3, 4, 5 | Só agora faz sentido: existe estado, eventos, gate e saída. Primeiro uso de LLM é com um envelope de resposta fixa (ScriptedLlmAdapter) |
| 7 | **Handoff + notificações + copiloto** | 4, 6 | O gate já sabe ler `engagement_mode` desde a fase 4 — ativar o comportamento é só escrever o estado |
| 8 | **Scheduler + cadência + R-007 drain** | 5 | Depende de `outbox` existir. `SKIP LOCKED` e a lógica de próximo dia útil entram aqui |
| 9 | **Painel de controle (R-046) + Command Handlers** | 1, 7, 8 | Lê o que já existe; emite os comandos que o handoff precisa |
| 10 | **CRM: projeções, busca, tags, notas, tarefas** | 1 | Leitura pura sobre dados que já foram gerados. Último porque é derivado, não estrutural |
| 11 | **HealthMonitor + backup (R-032/R-045)** | 2, 6 | Observabilidade de sistema, não de negócio. Pode rodar em qualquer momento depois |

**Invariantes de ordem (o roadmap não deve violá-las):**

1. **`PolicyGate` (fase 4) antes de `LlmPort` (fase 6).** Sem exceção. A ordem invertida produz um sistema que funciona e envia mensagens sem gate — e alguém vai passar dias de uso antes de a trava existir.
2. **`engagement_mode` no schema da fase 1**, muito antes do handoff da fase 7.
3. **`FakeChannel` e `ScriptedLlmAdapter` na fase 2 e 6.** Sem eles, os testes das fases 3–7 exigem um número real de WhatsApp e uma chave de API paga.
4. **`conversations FOR UPDATE` entra na fase 1**, não depois. Concorrência por conversa é um bug de intermitência, a pior classe de bug para depurar.
5. **`last_processed_at` (watermark) na fase 1.** Sem o campo, a fase 3 não tem como filtrar histórico.
6. **R-001 nunca é automatizado.** Não é uma fase, é uma restrição transversal. O achado do erro 463 (§abaixo) transforma isso de convenção em requisito técnico de segurança do número.

---

## Achados Críticos que Mudam a Leitura dos Requisitos

### 1. Erro 463 (Reach-out Time-lock) — R-001 é a mitigação, não um detalhe de UX

**Confiança: ALTA** (issue tracker do Baileys #2441 e #2707, PRs #2442 e #2445, produção relatada por operadores com 12 contas).

O WhatsApp aplica um **reach-out time-lock** a contas que enviam para contatos sem **Trusted Contact (TC) token**. O token tem ~28 dias de validade e é emitido num handshake. Sem ele, o erro **463** retorna e, se insistido, a conta é **temporariamente restringida** (tipos observados: `BULK_MESSAGING`, `DEFAULT`, `RESTRICT_ALL_COMPANSIONES`).

**Consequência arquitetural:** R-001 — "o Admin envia a 1ª mensagem manualmente" — **é a mitigação técnica primária do projeto.** O primeiro contato feito pelo celular real executa o handshake que o bot sozinho não consegue. **Nenhuma ordem de fases pode colocar "bot inicia contato" antes disso.** Isso também explica por que o warm-up manual (R-039/R-040) importa mais do que parece.

**Complemento (Baileys 7.0.0-rc+):** existem dois sinais **read-only** que não gastam reach-out e devem ser consumidos:
- `connection.update` → `reachoutTimeLock { isActive, timeEnforcementEnds, enforcementType }`
- `message-capping.update` → cota de novas conversas (`used_quota`/`total_quota`/`capping_status`)

O `timelock` deve alimentar **duas** coisas: o `PolicyGate` (bloqueio) e o `HealthMonitor` (notificação R-045). Carecer disso é operar às cegas num projeto cujo modo de falha declarado é banir o número (R-059).

### 2. `messages.upsert` é Bufferizado no Boot — Anti-Padrão 5

**Confiança: ALTA** (código-fonte: `src/Utils/event-buffer.ts`, `src/Socket/chats.ts`).

Detalhado no §Anti-Padrão 5. Resumo do impacto no roadmap: **o watermark e a distinção `append`/`notify` são entregáveis da fase 3, não refinamentos posteriores.**

### 3. `onWhatsApp` Consome Reach-Out — R-019 é Load-Bearing

**Confiança: MÉDIA-ALTA** (relatos de produção no tracker; o mecanismo exato é inferido, não documentado oficialmente).

Detalhado no §Anti-Padrão 6. R-019 ("validação é responsabilidade do caça-leads") não é apenas delegação de responsabilidade — é **a decisão que evita um acelerador de banimento**. Merece ADR.

### 4. A Cloud API Não Tem `composing` nem Backfill de Histórico

**Confiança: ALTA** (limitações conhecidas do WhatsApp Cloud API).

R-067 (humanização com "digitando…") depende de presence update, que é um recurso do protocolo Web. Na migração para API oficial, `capabilities().canSimulateTyping` vira `false` e a humanização degrada para apenas delays. **Isso não quebra nada, mas o `capabilities()` precisa existir desde a fase 2**, senão a migração R-016 vira uma reescrita de código que "precisava de presence".

### 5. Custo é Propriedade da Geração, Não da Mensagem

**Confiança: ALTA** (princípio de modelagem de custo de LLM, confirmado).

Uma chamada de LLM pode falhar, ser re-tentada, ou cair para fallback e **não produzir mensagem alguma** — mas continua custando dinheiro. Se o custo mora em `messages`, esses casos somem. `llm_runs` separado é o que torna R-045 ("custo por conversa", parcialmente em R-035) auditável.

---

## Fontes

**Código-fonte e documentação primária (confiança ALTA)**
- Baileys — `src/Utils/event-buffer.ts`: lista `BUFFERABLE_EVENT`, comportamento de `buffer()`/`flush()` — github.com/whiskeysockets/baileys/blob/master/src/Utils/event-buffer.ts
- Baileys — `src/Socket/chats.ts`: `AwaitingInitialSync`, `shouldSyncHistoryMessage`, timeout de 20s, `accountSyncCounter > 0` — github.com/whiskeysockets/baileys/blob/master/src/Socket/chats.ts
- Baileys — `BaileysEventMap` (referência de API): `messages.upsert { type: 'append'|'notify' }`, `connection.update`, `messages.update`, `messages.delete`, `message-receipt.update`, `message-capping.update`, `lid-mapping.update` — github.com/whiskeysockets/baileys/blob/master/_autodocs/api-reference/event-buffer.md
- Baileys — `ReachoutTimelockState`, `NewChatMessageCapInfo` (`src/Types/State.ts`) — github.com/whiskeysockets/baileys/blob/master/src/Types/State.ts
- Baileys PR #2442 — suporte a reachout/limits (463): github.com/WhiskeySockets/Baileys/pull/2442
- Baileys PR #2445 — dispatcher mex (reachout timelock + message capping): github.com/WhiskeySockets/Baileys/pull/2445
- Baileys issue #2441 — investigação do erro 463 / reach-out time-lock: github.com/WhiskeySockets/Baileys/issues/2441
- Baileys issue #2707 — TC token / 463 causando bans: github.com/whiskeysockets/Baileys/issues/2707
- Baileys `useMultiFileAuthState` / `creds.update`: persistência de sessão em disco
- pg-boss — `docs/api/scheduling.md`, `docs/api/jobs.md`: `send`/`sendAfter`/`sendThrottled`/`sendDebounced`, `singletonSeconds`, `SKIP LOCKED`, monitor de cron de 30s — github.com/timgit/pg-boss
- XState: modelo de statecharts, guardas e `allowedTransitions` como dado

**Literatura e prática de arquitetura (confiança MÉDIA-ALTA)**
- loom (`ARCHITECTURE.md`): FSM com estado em banco atômico, invariantes executadas dentro da transação, gates humanos, ledger co-commitado, `NowToken` com proibição de `Date.now()` no kernel
- Thinker / SMAG (arXiv 2503.21036): state machines como ferramentas; **contexto explicitamente contrastado** — SMAG deixa a LLM dirigir a transição, o que é inadequado aqui
- AI Engineering Playbook — *Orchestration*: checkpointing, `interrupt()` / `Command(resume=)` para HITL, memórias de curto/longo prazo, idempotência em nós antes do interrupt
- FSM-inspired prompt engineering (globaldev.tech, 2025-07): templates por estado, saída JSON com `assistant_text` + `slots_to_update` + `next_state_suggestion`, validação estrita e reprompt corretivo
- `fsm_llm` (NikolasMarkou): arquitetura de 2 passes, transições por JsonLogic, persistência de sessão
- "Stop building agents like prompts" (subhanshumg): 1 agente + state machine > N agentes; idempotency keys; HITL como primitiva de interrupt, não callback
- Cockburn, *Hexagonal Architecture*; AWS Prescriptive Guidance — Ports & Adapters, ports propriedade do domínio
- Alistair Cockburn / Tactical Architecture Guidelines: "stick to in-memory event dispatching; introduce async messaging only when forced"
- Comparativos de agendamento Node.js (cronuru, betterstack, npm-compare, resumelens): in-memory vs BullMQ vs agenda vs pg-boss
- Modelagem de schema: padrão de consent ledger (append-only, withdrawal como linha), `generations` separado de `messages`, `numeric` para custo, `timestamptz`, `parent_id` para branch de edição
- relaydesk / grok-build-desktop / mobile-pc-control-server: Electron main-vs-renderer, `contextBridge`, loopback + secret para servidor local
- `baileys-antiban` (npm): observações de campo sobre timelock, caps por minuto/hora/dia, estratégia de ramp-up

**Fontes internas do projeto**
- `.planning/PROJECT.md` — decisões-chave, constraints, escopo
- `docs/01-requisitos-funcionais.md` — R-001, R-005, R-006, R-007, R-009, R-014, R-016, R-019, R-020, R-021, R-022, R-023, R-031, R-034, R-043, R-045, R-046
- `docs/10-anti-requisitos.md` — AR-001 a AR-012
- `.ruler/skills/` — `whatsapp-baileys`, `handoff-humano`, `follow-up-cadencia`, `crm-pipeline`, `lgpd-optout`, `ia-conversa-consultiva`

---

## Lacunas e Research Flags para o Roadmap

| Lacuna | Impacto | Flag |
|---|---|---|
| **A API do caça-leads não está especificada** (schema, auth, rate limit) | R-017 é pré-requisito da ingestão. Bloqueia a integração, não a arquitetura | Research na fase de integração |
| **Feriados e horários brasileiros não estão modelados** | `business-hours.ts` precisa de tabela de feriados. "Próximo dia útil" depende disso | Research curto, decisão de produto |
| **Estrutura de custo da API de LLM não está definida** | `llm_runs.cost_usd` depende do pricing do provedor. Não bloqueia, mas o dashboard de custo (R-035, v2+) depende | Deixar como TODO explícito |
| **Comportamento do Baileys na migração Baileys→Cloud API** | R-016 é fase futura. O `capabilities()` é o ponto de extensão, mas a estratégia de migração de sessão (histórico, IDs de mensagem) não foi pesquisada | Research dedicado quando R-016 entrar no roadmap |
| **Volume real de tokens por turno** | Afeta custo e latência do caminho quente. Estimável, não verificável sem implementar | Medir na fase 6 |
| **WPPConnect vs Baileys** | `.ruler/skills/whatsapp-baileys` menciona ambos. A pesquisa assume Baileys (mais eventos e mais controle). WPPConnect é mais simples mas é um *wrapper* de navegador — a porta `ChannelPort` absorve a diferença, mas o adapter seria diferente | Decisão na fase 2 |

---

*Pesquisa de arquitetura para: Automação Local de WhatsApp para Prospecção B2B*
*Pesquisado em: 2026-09-28*
*Confiança geral: ALTA*
