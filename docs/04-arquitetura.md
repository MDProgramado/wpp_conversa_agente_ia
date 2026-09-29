# 04 — Arquitetura

> Documento de arquitetura técnica do sistema local.
> Define camadas, schema PostgreSQL, contratos de API, adaptador de canal, fluxo de dados e decisões técnicas.
> Referência para o System Architect, Backend Engineer e QA Engineer.

---

## 1. Visão geral

Sistema **local**, single-user (fase piloto), rodando em **Windows**, com:

- **Canal WhatsApp** isolado por adaptador (não oficial inicial → API oficial futuro).
- **IA externa** (API de LLM) para conduzir conversa.
- **Gate de envio** que aplica os 12 anti-requisitos como invariantes de código.
- **PostgreSQL local** para persistência.
- **Painel local** para controle em tempo real.
- **Notificações locais** (som + pop-up) para handoff e falhas críticas.
- **Sistema de caça-leads** (API externa) para ingestão.

---

## 2. Camadas

```
┌─────────────────────────────────────────────────────────────────────────┐
│  CAMADA 1 — APRESENTAÇÃO (Painel Local)                                 │
│  • Lista de leads │ Chat │ Sugestões IA │ Histórico │ Ações rápidas     │
│  • Notificações locais (som + pop-up)                                   │
│  • Configurações                                                        │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
┌────────────────────────────────┴────────────────────────────────────────┐
│  CAMADA 2 — ORQUESTRAÇÃO / GATE DE ENVIO                                │
│  • evaluatePolicy(): valida 12 AR como invariantes                      │
│  • Janela de envio (R-006)                                              │
│  • Limite diário (R-023)                                                │
│  • Fila de mensagens com delays humanizados (R-067)                     │
│  • Detecção de gatilhos de handoff (R-012, R-065)                       │
│  • Máquina de estados do lead (R-021, R-022)                            │
│  • Scheduler de follow-up (R-004, R-005)                                │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        ▼                        ▼                        ▼
┌───────────────┐   ┌───────────────────┐   ┌───────────────────────┐
│  CAMADA 3A    │   │  CAMADA 3B        │   │  CAMADA 3C            │
│  CANAL        │   │  IA               │   │  CRM / PERSISTÊNCIA   │
│  WhatsApp     │   │  (API externa)    │   │  PostgreSQL           │
│  (Adapter)    │   │                   │   │                       │
└───────────────┘   └───────────────────┘   └───────────────────────┘
                                 │
┌────────────────────────────────┴────────────────────────────────────────┐
│  CAMADA 4 — INTEGRAÇÕES EXTERNAS                                        │
│  • API do sistema de caça-leads                                         │
│  • API externa de LLM                                                   │
│  • WhatsApp (via adapter)                                               │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Estrutura de pastas sugerida

```
src/
├── main.ts                       # Entry point
├── config/
│   ├── env.ts                    # Variáveis de ambiente
│   └── settings.ts               # Configurações persistidas
├── channel/                      # Adaptador de canal WhatsApp
│   ├── adapter.interface.ts      # Interface (contrato)
│   ├── baileys.adapter.ts        # Implementação não oficial
│   ├── official.adapter.ts       # Implementação API oficial (futuro)
│   └── session/                  # Sessão, QR Code, reconexão
├── gate/                         # Gate de envio (invariantes)
│   ├── evaluatePolicy.ts         # Valida 12 AR
│   ├── window.ts                 # Janela de envio
│   ├── dailyLimit.ts             # Limite diário
│   ├── queue.ts                  # Fila de mensagens
│   └── humanize.ts               # Delays, digitação, quebra
├── ia/                           # Camada de IA
│   ├── llm.client.ts             # Cliente da API externa
│   ├── prompt.builder.ts         # Monta prompt com contexto
│   ├── intent.detector.ts        # Detecta intenção/gatilhos
│   ├── objection.handler.ts      # Objeções comuns
│   ├── qualification.ts          # Verba + decisão
│   └── suggestion.ts             # Sugestões para copiloto
├── conversation/                 # Máquina de estados da conversa
│   ├── state.machine.ts          # Estados e transições
│   ├── handoff.ts                # Gatilhos e handoff
│   ├── followup.ts               # Cadência
│   └── media.handler.ts          # Mídia recebida
├── crm/                          # CRM e pipeline
│   ├── leads.repo.ts             # Repositório de leads
│   ├── status.repo.ts            # Pipeline
│   ├── notes.repo.ts             # Notas
│   ├── tasks.repo.ts             # Tarefas
│   └── tags.repo.ts              # Tags
├── ingestion/                    # Ingestão de leads
│   └── cacaLeads.client.ts       # Cliente da API externa
├── compliance/                   # LGPD e opt-out
│   ├── optout.ts                 # Detecção e registro
│   ├── legalBasis.ts             # Base legal
│   └── retention.ts              # Retenção e exclusão
├── notifications/                # Notificações locais
│   └── localNotifier.ts          # Som + pop-up
├── logs/                         # Logs e falhas
│   └── logger.ts                 # Log detalhado
├── backup/                       # Backup manual
│   └── backupService.ts          # Gerar/restaurar
├── db/                           # Acesso ao PostgreSQL
│   ├── pool.ts                   # Pool de conexões
│   ├── migrations/               # Migrações
│   └── schema.sql                # Schema inicial
└── ui/                           # Painel local (Electron/Tauri/Web)
    ├── pages/
    │   ├── Leads.tsx
    │   ├── Chat.tsx
    │   ├── CRM.tsx
    │   ├── Settings.tsx
    │   └── Logs.tsx
    └── components/
        ├── LeadList.tsx
        ├── ChatWindow.tsx
        ├── SuggestionBox.tsx
        └── HandoffPopup.tsx
```

---

## 4. Adaptador de canal (Channel Adapter)

### 4.1. Interface (contrato)

```typescript
// src/channel/adapter.interface.ts

export interface ChannelAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  onMessage(handler: (msg: IncomingMessage) => void): void;
  onDisconnect(handler: () => void): void;

  sendText(to: string, text: string): Promise<SendResult>;
  // NÃO existe sendMedia() — AR-004 (proibido enviar mídia)

  getSession(): Promise<SessionData>;
  restoreSession(data: SessionData): Promise<void>;
}

export interface IncomingMessage {
  from: string;
  timestamp: Date;
  type: 'text' | 'audio' | 'image' | 'pdf' | 'video' | 'document';
  text?: string;       // apenas para type='text'
  mediaRef?: string;   // referência à mídia (não processada)
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}
```

### 4.2. Implementações

| Implementação | Quando usar | Status |
|---|---|---|
| `baileys.adapter.ts` | Fase piloto (não oficial) | Padrão inicial |
| `official.adapter.ts` | Fase de expansão (API oficial) | Futuro |

### 4.3. Regras

- O adapter **não conhece** regras de negócio, IA ou CRM.
- O adapter **não envia** sem passar pelo `evaluatePolicy` (gate).
- O adapter **não processa** mídia recebida (AR-009).
- O adapter **isola** a sessão e a reconexão.

---

## 5. Gate de Envio (`evaluatePolicy`)

### 5.1. Responsabilidade

Validar **toda** mensagem antes de sair. Se qualquer invariante falhar, bloquear.

### 5.2. Pseudo-código

```typescript
// src/gate/evaluatePolicy.ts

export interface PolicyInput {
  leadId: string;
  message: string;
  context: ConversationContext;
  now: Date;
}

export interface PolicyResult {
  allowed: boolean;
  reason?: string;
  action?: 'send' | 'block' | 'handoff' | 'silence';
}

export function evaluatePolicy(input: PolicyInput): PolicyResult {
  // AR-001, AR-002, AR-012 — preço/proposta
  if (containsPriceOrProposal(input.message)) {
    return { allowed: false, reason: 'AR-001/AR-002/AR-012', action: 'handoff' };
  }

  // AR-003 — agendamento autônomo
  if (containsScheduleSuggestion(input.message)) {
    return { allowed: false, reason: 'AR-003', action: 'handoff' };
  }

  // AR-004 — envio de mídia
  if (containsMedia(input.message)) {
    return { allowed: false, reason: 'AR-004', action: 'block' };
  }

  // AR-005 — opt-out
  if (input.context.lead.optOut) {
    return { allowed: false, reason: 'AR-005', action: 'block' };
  }

  // AR-006 — revelação de automação
  if (revealsAutomation(input.message)) {
    return { allowed: false, reason: 'AR-006', action: 'silence' };
  }

  // AR-007 — janela de envio
  if (!isWithinWindow(input.now)) {
    return { allowed: false, reason: 'AR-007', action: 'queue' };
  }

  // AR-008 — limite diário
  if (exceedsDailyLimit(input.now)) {
    return { allowed: false, reason: 'AR-008', action: 'queue' };
  }

  // AR-009 — processamento de mídia recebida
  if (input.context.lastMessageType !== 'text') {
    return { allowed: false, reason: 'AR-009', action: 'handoff' };
  }

  // AR-010 — agir após handoff
  if (input.context.handoffActive) {
    return { allowed: false, reason: 'AR-010', action: 'silence' };
  }

  // AR-011 — base legal
  if (!hasLegalBasis(input.context.lead)) {
    return { allowed: false, reason: 'AR-011', action: 'block' };
  }

  return { allowed: true, action: 'send' };
}
```

### 5.3. Property tests (Fase 1 do GSD)

Cada AR deve ter **property test** garantindo que nenhuma entrada o viole. Exemplos:

```typescript
// tests/gate/ar-001.property.test.ts
test('AR-001: nenhuma mensagem com valor é enviada', () => {
  fc.assert(
    fc.property(fc.string(), (msg) => {
      if (containsPrice(msg)) {
        const result = evaluatePolicy({ message: msg, ... });
        return result.allowed === false && result.action === 'handoff';
      }
      return true;
    })
  );
});
```

---

## 6. Schema PostgreSQL

### 6.1. Tabelas principais

```sql
-- 001_init.sql

CREATE TABLE leads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  phone           TEXT NOT NULL,
  address         TEXT,
  status          TEXT NOT NULL DEFAULT 'NOVO',
  origin          TEXT NOT NULL,           -- parâmetros da busca
  legal_basis     TEXT NOT NULL DEFAULT 'LEGITIMO_INTERESSE',
  purpose         TEXT NOT NULL DEFAULT 'CONTATO_COMERCIAL_B2B',
  opt_out         BOOLEAN NOT NULL DEFAULT FALSE,
  opt_out_at      TIMESTAMPTZ,
  opt_out_content TEXT,
  assigned_to     UUID,                    -- futuro multiusuário
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_leads_phone ON leads(phone);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_opt_out ON leads(opt_out);

CREATE TABLE conversations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         UUID NOT NULL REFERENCES leads(id),
  mode            TEXT NOT NULL DEFAULT 'AUTO',  -- AUTO, COPILOTO, PAUSADO, SILENCIO
  handoff_active  BOOLEAN NOT NULL DEFAULT FALSE,
  handoff_reason  TEXT,
  handoff_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id),
  direction       TEXT NOT NULL,           -- IN, OUT
  sender          TEXT NOT NULL,           -- ADMIN, IA, LEAD
  type            TEXT NOT NULL,           -- TEXT, AUDIO, IMAGE, PDF, VIDEO, DOCUMENT
  content         TEXT,
  media_ref       TEXT,
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered       BOOLEAN,
  blocked         BOOLEAN DEFAULT FALSE,
  blocked_reason  TEXT
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id, sent_at);

CREATE TABLE followups (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         UUID NOT NULL REFERENCES leads(id),
  sequence        INT NOT NULL,            -- 1=1h, 2=1d, 3=3d, 4=7d
  scheduled_at    TIMESTAMPTZ NOT NULL,
  sent_at         TIMESTAMPTZ,
  status          TEXT NOT NULL DEFAULT 'PENDING', -- PENDING, SENT, CANCELLED
  cancelled_reason TEXT
);

CREATE INDEX idx_followups_scheduled ON followups(scheduled_at, status);

CREATE TABLE notes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         UUID NOT NULL REFERENCES leads(id),
  author          TEXT NOT NULL,           -- ADMIN, IA
  content         TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE tasks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         UUID NOT NULL REFERENCES leads(id),
  title           TEXT NOT NULL,
  description     TEXT,
  priority        TEXT DEFAULT 'MEDIA',
  due_at          TIMESTAMPTZ,
  done            BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE tags (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT UNIQUE NOT NULL
);

CREATE TABLE lead_tags (
  lead_id         UUID NOT NULL REFERENCES leads(id),
  tag_id          UUID NOT NULL REFERENCES tags(id),
  PRIMARY KEY (lead_id, tag_id)
);

CREATE TABLE logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level           TEXT NOT NULL,           -- INFO, WARN, ERROR, CRITICAL
  module          TEXT NOT NULL,
  message         TEXT NOT NULL,
  context         JSONB,
  lead_id         UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_logs_level_created ON logs(level, created_at DESC);

CREATE TABLE audit_status_changes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         UUID NOT NULL REFERENCES leads(id),
  from_status     TEXT,
  to_status       TEXT NOT NULL,
  reason          TEXT,
  changed_by      TEXT NOT NULL,           -- IA ou ADMIN
  changed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE daily_counters (
  date            DATE PRIMARY KEY,
  messages_sent   INT NOT NULL DEFAULT 0,
  leads_contacted INT NOT NULL DEFAULT 0
);

CREATE TABLE backup_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  path            TEXT NOT NULL,
  size_bytes      BIGINT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 6.2. Diagrama de relacionamentos

```
leads ──┬── conversations ── messages
        │
        ├── followups
        ├── notes
        ├── tasks
        ├── lead_tags ── tags
        └── audit_status_changes

logs (independente, referencia lead_id opcional)
daily_counters (independente)
backup_history (independente)
```

---

## 7. Contratos de API

### 7.1. API do sistema de caça-leads (entrada)

**Endpoint:** `POST /search` (exemplo — a definir com o provedor)

**Request:**
```json
{
  "state": "SP",
  "city": "Campinas",
  "region": "Centro",
  "category": "Padarias",
  "keyword": "pão quente"
}
```

**Response:**
```json
{
  "leads": [
    {
      "name": "João Silva",
      "phone": "+5511999999999",
      "address": "Rua X, 123 — Campinas/SP"
    }
  ]
}
```

**Observações:**
- A API já retorna apenas números com WhatsApp ativo (R-019).
- Não há opt-in explícito (R-063).
- Origem, base legal e finalidade devem ser registradas na importação (R-064).

### 7.2. API externa de LLM (IA)

**Endpoint:** `POST /v1/chat/completions` (OpenAI-compatible) ou equivalente.

**Request:**
```json
{
  "model": "gpt-4o-mini",
  "messages": [
    { "role": "system", "content": "<prompt com persona, tom, limites e anti-requisitos>" },
    { "role": "user", "content": "<histórico da conversa + última mensagem do lead>" }
  ],
  "temperature": 0.7,
  "max_tokens": 300
}
```

**Response:**
```json
{
  "choices": [
    { "message": { "role": "assistant", "content": "<resposta gerada>" } }
  ],
  "usage": { "prompt_tokens": 500, "completion_tokens": 80 }
}
```

**Observações:**
- Dados sensíveis devem ser minimizados/mascarados antes do envio (R-009).
- Custo por conversa deve ser registrado (R-035).
- Fallback em caso de falha (R-045).

### 7.3. WhatsApp (via adapter)

Não há contrato HTTP — o adapter encapsula a biblioteca escolhida.

---

## 8. Máquina de estados do lead

```
        ┌──────┐
        │ NOVO │
        └───┬──┘
            │ 1ª mensagem manual
            ▼
     ┌────────────┐
     │ CONTATADO  │◀──── follow-up (até 7d)
     └─────┬──────┘
           │ lead responde
           ▼
     ┌────────────┐
     │ RESPONDEU  │
     └─────┬──────┘
           │ IA qualifica (verba + decisão)
           ▼
     ┌─────────────┐
     │ QUALIFICADO │
     └─────┬───────┘
           │ IA aquece
           ▼
     ┌──────────┐
     │ AQUECIDO │
     └─────┬────┘
           │ handoff por agendamento + Admin registra
           ▼
     ┌──────────────────┐
     │ REUNIÃO AGENDADA │
     └─────┬────────────┘
           │
     ┌─────┴─────┐
     ▼           ▼
┌──────────┐ ┌─────────┐
│ PROPOSTA │ │ FECHADO │
└────┬─────┘ └─────────┘
     │
┌────┴────┐
▼         ▼
FECHADO   PERDIDO

Estados terminais: FECHADO, PERDIDO
```

**Transições automáticas (IA):** NOVO → CONTATADO, CONTATADO → RESPONDEU, RESPONDEU → QUALIFICADO, QUALIFICADO → AQUECIDO, CONTATADO → PERDIDO.

**Transições manuais (Admin):** QUALQUER → QUALQUER, REUNIÃO AGENDADA → PROPOSTA/FECHADO, PROPOSTA → FECHADO/PERDIDO, PERDIDO → NOVO (reativação).

---

## 9. Fluxo de dados (ponta a ponta)

```
1. Admin busca leads na API caça-leads
   → ingestion/cacaLeads.client.ts
   → crm/leads.repo.ts (INSERT leads)

2. Admin envia 1ª mensagem manual
   → gate/evaluatePolicy (valida AR-011: base legal)
   → channel/adapter.sendText()
   → crm/status.repo (NOVO → CONTATADO)
   → conversation/state.machine (assume)
   → conversation/followup (agenda 1h)

3. Lead responde
   → channel/adapter.onMessage()
   → conversation/state.machine (CONTATADO → RESPONDEU)
   → ia/llm.client (gera resposta)
   → gate/evaluatePolicy (valida ARs)
   → gate/humanize (delays + digitação)
   → gate/queue (fila)
   → channel/adapter.sendText()

4. IA detecta gatilho de handoff
   → conversation/handoff (aciona)
   → notifications/localNotifier (som + pop-up)
   → conversation/state.machine (modo SILENCIO ou PAUSADO)

5. Admin assume
   → conversation/state.machine (modo COPILOTO)
   → ia/suggestion (sugere respostas)
   → Admin envia manualmente

6. Lead pede opt-out
   → compliance/optout (registra)
   → crm/leads.repo (opt_out = TRUE)
   → conversation/state.machine (PERDIDO)
   → gate/evaluatePolicy (bloqueia toda mensagem futura)
```

---

## 10. Scheduler de follow-up

```
┌─────────────────────────────────────────────────────────────────────────┐
│  SCHEDULER (roda a cada 1 minuto)                                       │
│                                                                         │
│  1. Buscar followups com scheduled_at <= NOW() e status = PENDING       │
│  2. Para cada follow-up:                                                │
│     a. Verificar se lead respondeu, opt-out ou handoff ativo            │
│        → se sim: status = CANCELLED                                     │
│     b. Verificar janela de envio (R-006)                                │
│        → se fora: manter PENDING (dreno ao abrir o app — R-007)         │
│     c. Verificar limite diário (R-023)                                  │
│        → se atingido: manter PENDING para próximo dia útil              │
│     d. Gerar mensagem (ia/followup)                                     │
│     e. evaluatePolicy (valida ARs)                                      │
│     f. gate/humanize (delays + digitação)                               │
│     g. channel/adapter.sendText()                                       │
│     h. status = SENT; registrar timestamp                               │
│  3. Se sequência = 4 (7d) e enviado, e lead não respondeu:              │
│     → marcar lead como PERDIDO (R-005)                                  │
└─────────────────────────────────────────────────────────────────────────┘
```

**Dreno ao abrir o app (R-007):** ao iniciar, o scheduler roda imediatamente e processa follow-ups vencidos, respeitando delays humanizados e limite diário.

---

## 11. Detecção de intenção e gatilhos

### 11.1. Gatilhos de handoff

```typescript
// src/ia/intent.detector.ts

export type Intent =
  | 'PRICE_REQUEST'        // "quanto custa", "me manda proposta"
  | 'SCHEDULE_INTENT'      // "podemos marcar", "que dia"
  | 'BOT_SUSPICION'        // "você é um robô?"
  | 'IRRITATION'           // "isso é spam", "vou denunciar"
  | 'OPTOUT'               // "não quero mais"
  | 'MEDIA_RECEIVED'       // áudio, imagem, PDF
  | 'TECHNICAL_DOUBT'      // "integra com ERP?"
  | 'OBJECTION_PRICE'      // "está caro"
  | 'OBJECTION_TIME'       // "não tenho tempo"
  | 'OBJECTION_PROVIDER'   // "já tenho fornecedor"
  | 'OBJECTION_THINK'      // "vou pensar"
  | 'NEUTRAL';

export function detectIntent(message: string, context: ConversationContext): Intent {
  // Detecção por regex + LLM (classificação)
  // Preço SEMPRE tem prioridade sobre objeção (AR-012)
  if (containsPriceRequest(message)) return 'PRICE_REQUEST';
  if (containsOptOut(message)) return 'OPTOUT';
  if (containsBotSuspicion(message)) return 'BOT_SUSPICION';
  if (containsIrritation(message)) return 'IRRITATION';
  if (context.lastMessageType !== 'text') return 'MEDIA_RECEIVED';
  if (containsScheduleIntent(message)) return 'SCHEDULE_INTENT';
  // ... demais intenções
  return 'NEUTRAL';
}
```

### 11.2. Prioridade de gatilhos

| Prioridade | Gatilho | Ação |
|---|---|---|
| 1 | `PRICE_REQUEST` | Handoff + silêncio parcial |
| 2 | `OPTOUT` | Opt-out + silêncio total |
| 3 | `BOT_SUSPICION` | Handoff + silêncio total |
| 4 | `IRRITATION` | Handoff + silêncio total |
| 5 | `MEDIA_RECEIVED` | Handoff + silêncio parcial |
| 6 | `SCHEDULE_INTENT` | Handoff + silêncio parcial |
| 7 | `TECHNICAL_DOUBT` | Handoff |
| 8 | Objeções | Contorno autônomo (R-042) |

---

## 12. Prompt da IA (estrutura)

```
Você é [seu nome], dono de uma agência que vende sites, sistemas e automações.

TOM: consultivo, educado, direto. Foco em entender a dor antes de ofertar.
PERSONA: humana. Nunca se identifique como IA, bot ou assistente virtual.

REGRAS ABSOLUTAS (nunca viole):
- NUNCA informe, sugira, calcule ou negocie preço, valor, desconto ou prazo.
- NUNCA envie proposta, orçamento ou contrato.
- NUNCA sugira horário, data ou agendamento.
- NUNCA envie mídia (imagem, PDF, áudio, vídeo).
- NUNCA tente reverter pedido de opt-out.
- NUNCA use "sou uma IA", "sou um bot" ou "assistente virtual".
- NUNCA responda fora de dias úteis, 7h–17h.
- NUNCA ultrapasse 20–30 mensagens/dia.
- NUNCA processe mídia recebida.

OBJETIVO:
- Entender a dor do lead.
- Qualificar (verba/interesse + poder de decisão).
- Aquecer.
- Contornar objeções comuns (sem negociar).
- Acionar handoff em: preço/proposta, agendamento, suspeita de bot, irritação, opt-out, mídia, dúvida técnica.

CONTEXTO DO LEAD:
- Nome: {name}
- Endereço: {address}
- Status: {status}
- Histórico: {conversation}

ÚLTIMA MENSAGEM DO LEAD:
{lastMessage}

Gere uma resposta curta (máx. 200 caracteres), humanizada, em português.
```

---

## 13. Decisões técnicas (ADRs)

| ADR | Decisão | Status |
|---|---|---|
| ADR-001 | Canal híbrido: não oficial → API oficial | Aceito |
| ADR-002 | IA externa (API de LLM) | Aceito |
| ADR-003 | PostgreSQL local | Aceito |
| ADR-004 | Gate de envio com 12 AR como invariantes | Aceito |
| ADR-005 | Adapter de canal isolado | Aceito |
| ADR-006 | Sem criptografia local (R-033) | Aceito (risco assumido) |
| ADR-007 | Backup manual | Aceito |
| ADR-008 | Multiusuário preparado, single-user na fase piloto | Aceito |

---

## 14. Requisitos não funcionais técnicos

| Requisito | Valor |
|---|---|
| SO | Windows 10/11 |
| Linguagem | Node.js + TypeScript |
| Runtime | Node 20+ |
| Banco | PostgreSQL 15+ |
| UI | Electron, Tauri ou Web local |
| Logs | Arquivo + painel |
| Notificações | Nativas do Windows (som + pop-up) |
| Backup | Manual, versionado por data/hora |
| Criptografia | Nenhuma (R-033) |
| Limite de recursos | Baixo consumo (roda em background) |
| Inicialização | Manual ou com o Windows |

---

## 15. Referências cruzadas

| Seção | Requisitos | Anti-requisitos |
|---|---|---|
| Adaptador de canal | R-015, R-016, R-059 | — |
| Gate de envio | R-006, R-007, R-023, R-067 | AR-001 a AR-012 |
| Schema PostgreSQL | R-031 | — |
| Contratos de API | R-017, R-009 | — |
| Máquina de estados | R-021, R-022 | — |
| Scheduler de follow-up | R-003, R-004, R-005, R-007 | — |
| Detecção de intenção | R-012, R-065, R-066 | AR-001, AR-002, AR-003, AR-005, AR-006, AR-009, AR-012 |
| Prompt da IA | R-009, R-010, R-011, R-055 | AR-001 a AR-012 |
| ADRs | R-015, R-016, R-031, R-032, R-033, R-034 | — |