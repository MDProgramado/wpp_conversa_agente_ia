# ADR-002 — IA Externa via API de LLM

- **Status:** Aceito
- **Data:** 2026-09-28
- **Decisores:** Admin (você), System Architect
- **Contexto:** Fase 2 — IA, Handoff e Shadow Mode
- **Relacionado a:** R-008, R-009, R-010, R-011, R-041, R-042, R-051, R-052, R-055

---

## 1. Contexto

O sistema precisa de uma camada de IA para:

- Interpretar mensagens do lead.
- Manter contexto da conversa.
- Gerar respostas humanizadas em tom consultivo.
- Qualificar o lead (verba/interesse + poder de decisão).
- Contornar objeções comuns (sem negociar preço).
- Detectar intenções e gatilhos de handoff.
- Sugerir respostas no modo copiloto.
- Resumir conversas e extrair dados para o CRM.

Existem duas abordagens principais:

1. **LLM local** (rodando na máquina do usuário, ex.: Ollama, LM Studio, llama.cpp).
2. **API externa de LLM** (OpenAI, Gemini, Claude, Groq, etc.).

O usuário escolheu **(b) API externa**.

---

## 2. Decisão

Adotar **API externa de LLM** como camada de IA do sistema, com:

- **Provedor principal:** a definir (OpenAI, Gemini, Claude ou Groq).
- **Modelo:** a definir (equilíbrio entre custo, latência e qualidade).
- **Minimização de dados:** mascarar telefone, endereço e dados sensíveis antes do envio.
- **Registro de custo:** tokens de entrada/saída por conversa.
- **Fallback:** em caso de falha, registrar log, notificar Admin e pausar a conversa.
- **Isolamento:** adapter de IA (interface), permitindo troca de provedor sem refatoração.

---

## 3. Justificativa

### Por que API externa?

- **Qualidade:** modelos de ponta (GPT-4o, Gemini 1.5, Claude 3.5) oferecem qualidade muito superior a modelos locais pequenos.
- **Custo inicial baixo:** APIs cobram por uso. Em volume baixo (20–30 mensagens/dia), o custo mensal pode ser inferior a R$ 50.
- **Setup rápido:** sem necessidade de hardware potente, sem instalação de modelos locais.
- **Manutenção zero:** sem atualizações de modelo, sem GPU, sem consumo de RAM/CPU local.
- **Latência aceitável:** respostas em 1–5 segundos, adequadas para conversa em tempo real.
- **Multilíngue e contexto:** modelos grandes entendem nuances, ironia, objeções e contexto.

### Por que não LLM local?

- **Hardware:** exige GPU ou CPU potente, com 8–32 GB de RAM dedicada.
- **Qualidade:** modelos locais pequenos (7B–13B) têm qualidade inferior para conversa consultiva e qualificação.
- **Latência:** em máquinas sem GPU, a latência pode ser de 10–30 segundos por resposta.
- **Manutenção:** exige atualização de modelos, configuração de runtime, tuning.
- **Consumo:** compete com o PostgreSQL, o app do WhatsApp e o painel local.
- **Escopo:** o usuário quer focar em validar o fluxo, não em gerenciar infraestrutura de IA.

---

## 4. Consequências

### Positivas

- **Qualidade superior** nas respostas e na qualificação.
- **Setup rápido** — apenas chave de API.
- **Custo proporcional ao uso** — baixo no piloto.
- **Sem hardware dedicado** — roda em qualquer PC.
- **Atualizações automáticas** — provedor melhora modelos continuamente.
- **Multi-provedor** — adapter permite trocar se um falhar ou ficar caro.

### Negativas

- **Dependência de terceiros** — se a API cair, a conversa para (mitigação: fallback + notificação).
- **Custo variável** — pode aumentar com volume (mitigação: limite de tokens + monitoramento).
- **LGPD** — dados da conversa são enviados para fora (mitigação: minimização + mascaramento + base legal).
- **Latência de rede** — 1–5 segundos por resposta (mitigação: aceitável para WhatsApp).
- **Sem controle total** — modelo pode mudar, política pode mudar (mitigação: adapter).
- **Risco de alucinação** — modelo pode inventar (mitigação: gate de envio + anti-requisitos + handoff).

### Riscos residuais

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Indisponibilidade da API | Média | Médio | Fallback + notificação + pausa |
| Aumento de custo | Média | Médio | Limite de tokens + monitoramento |
| Vazamento de dados sensíveis | Baixa | Alto | Mascaramento + minimização |
| Alucinação com promessa indevida | Média | Alto | Gate de envio + 12 AR + handoff |
| Mudança de política do provedor | Baixa | Médio | Adapter + multi-provedor |
| Latência acima do aceitável | Baixa | Baixo | Ajuste de modelo + timeout |

---

## 5. Alternativas consideradas

### Alternativa A — LLM local (Ollama, LM Studio)

- **Prós:** privacidade total, sem custo por uso, sem dependência externa.
- **Contras:** hardware potente, qualidade inferior, latência alta, manutenção.
- **Por que não:** o usuário não tem hardware dedicado e quer focar no fluxo de negócio.

### Alternativa B — Híbrido (local para classificação + API para respostas)

- **Prós:** reduz custo e latência, mantém privacidade no que é local.
- **Contras:** complexidade de manutenção, dois runtimes, duas stacks.
- **Por que não:** o usuário escolheu API externa; híbrido fica para o futuro, se necessário.

### Alternativa C — Sem IA (apenas scripts rígidos)

- **Prós:** zero custo, zero risco de alucinação.
- **Contras:** não atende ao requisito de conversa consultiva e humanizada (R-010, R-011).
- **Por que não:** o diferencial do sistema é justamente a IA consultiva.

### Alternativa D — Múltiplos provedores em paralelo

- **Prós:** resiliência, comparação de qualidade.
- **Contras:** complexidade, custo duplicado.
- **Por que não:** overkill para o piloto. O adapter permite adicionar no futuro.

---

## 6. Implementação

### 6.1. Interface do adapter de IA

```typescript
// src/ia/llm.client.ts

export interface LLMClient {
  generateResponse(input: GenerateInput): Promise<GenerateOutput>;
  classifyIntent(message: string, context: ConversationContext): Promise<Intent>;
  summarize(conversation: Message[]): Promise<string>;
  suggestReply(conversation: Message[]): Promise<string>;
  extractQualification(conversation: Message[]): Promise<QualificationData>;
}

export interface GenerateInput {
  systemPrompt: string;
  conversationHistory: Message[];
  lastMessage: string;
  leadContext: LeadContext;
}

export interface GenerateOutput {
  text: string;
  tokensInput: number;
  tokensOutput: number;
  model: string;
  latencyMs: number;
}

export interface QualificationData {
  hasBudget: boolean | null;
  hasDecisionPower: boolean | null;
  confidence: number;
  evidence: string[];
}
```

### 6.2. Provedores suportados (exemplos)

| Provedor | Modelo sugerido | Custo aprox. (por 1M tokens) | Latência |
|---|---|---|---|
| OpenAI | gpt-4o-mini | US$ 0,15 (in) / US$ 0,60 (out) | Baixa |
| Google | gemini-1.5-flash | US$ 0,075 (in) / US$ 0,30 (out) | Baixa |
| Anthropic | claude-3-haiku | US$ 0,25 (in) / US$ 1,25 (out) | Baixa |
| Groq | llama-3.1-70b | US$ 0,59 (in) / US$ 0,79 (out) | Muito baixa |

### 6.3. Minimização de dados antes do envio

```typescript
// src/ia/prompt.builder.ts

export function buildPrompt(input: GenerateInput): LLMMessage[] {
  // Mascarar telefone e endereço
  const maskedContext = {
    ...input.leadContext,
    phone: maskPhone(input.leadContext.phone),
    address: maskAddress(input.leadContext.address),
  };

  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: formatContext(maskedContext, input.conversationHistory, input.lastMessage) },
  ];
}
```

### 6.4. Registro de custo

```typescript
// src/ia/cost.tracker.ts

export async function trackCost(output: GenerateOutput) {
  const cost = calculateCost(output.model, output.tokensInput, output.tokensOutput);
  await db.insert('ia_costs', {
    model: output.model,
    tokens_input: output.tokensInput,
    tokens_output: output.tokensOutput,
    cost_usd: cost,
    latency_ms: output.latencyMs,
    created_at: new Date(),
  });
}
```

### 6.5. Fallback em caso de falha

```typescript
// src/ia/llm.client.ts

export async function generateWithFallback(input: GenerateInput): Promise<GenerateOutput> {
  try {
    return await primaryProvider.generateResponse(input);
  } catch (err) {
    log.error('IA falhou', { err });
    await notifyAdmin('API de IA fora do ar', 'CRITICAL');
    await pauseConversation(input.leadContext.leadId);
    throw err;
  }
}
```

---

## 7. Configuração

```typescript
// src/config/settings.ts

export interface IASettings {
  provider: 'openai' | 'gemini' | 'claude' | 'groq';
  model: string;
  apiKey: string;              // armazenado localmente
  maxTokens: number;           // limite por resposta
  temperature: number;         // 0.7
  timeoutMs: number;           // 10000
  costLimitMonthly: number;    // alerta se ultrapassar
  maskSensitiveData: boolean;  // true
  fallbackProvider?: string;
}
```

---

## 8. Critérios de sucesso da decisão

- **Qualidade:** respostas consideradas humanizadas e consultivas na revisão do Admin.
- **Custo:** custo mensal compatível com o piloto (a definir).
- **Latência:** respostas em menos de 5 segundos.
- **LGPD:** minimização e mascaramento implementados e documentados.
- **Confiabilidade:** fallback funcional em caso de falha da API.

---

## 9. Referências

- `docs/04-arquitetura.md` — camadas e adapter
- `docs/03-regras-de-negocio.md` — RN-023 a RN-032, RN-039 a RN-044
- `docs/10-anti-requisitos.md` — AR-001 a AR-012
- `docs/09-criterios-de-aceitacao.md` — AC-007, AC-014, AC-021
- R-008, R-009, R-010, R-011, R-041, R-042, R-051, R-052, R-055
- `.planning/research/STACK.md` — pesquisa de stack (GSD)