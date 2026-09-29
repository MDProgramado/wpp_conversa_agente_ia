# ADR-012 — Prompt, Persona e Limites da IA

- **Status:** Aceito (com risco assumido)
- **Data:** 2026-09-28
- **Decisores:** Admin (você), System Architect
- **Contexto:** Fase 2 — IA, Handoff e Shadow Mode
- **Relacionado a:** R-008, R-009, R-010, R-011, R-055, R-056, R-057, R-041, R-042, R-051, R-052, AR-001 a AR-012

---

## 1. Contexto

A IA é o motor da conversa. Ela precisa:

- Conduzir em tom **consultivo, educado e direto** (R-010).
- Priorizar **entender a dor** antes de ofertar (R-010).
- Ter condução **dinâmica**, sem script rígido (R-011).
- **Não se identificar como IA/bot** espontaneamente (R-055).
- Ficar em **silêncio total** se o lead perguntar diretamente (R-056, R-057).
- Qualificar (verba + decisão) sem parecer interrogatório (R-051, R-052).
- Contornar objeções comuns sem negociar preço (R-041, R-042).
- Respeitar os 12 anti-requisitos (AR-001 a AR-012).

Existem três decisões críticas:

1. **Persona:** como a IA se apresenta e se comporta.
2. **Prompt:** o que é enviado ao modelo a cada interação.
3. **Limites:** o que a IA pode e não pode fazer, e quando deve acionar handoff.

A escolha afeta diretamente a qualidade da conversa, o risco de banimento e a conformidade com políticas do WhatsApp/Meta e LGPD.

---

## 2. Decisão

### 2.1. Persona

A IA assume a persona do **próprio Admin** (R-055):

- Fala como se fosse você.
- Não menciona ser IA, bot, assistente virtual ou sistema automatizado.
- Não usa linguagem que denuncie automação.
- Mantém consistência com o tom definido: consultivo, educado, direto.

### 2.2. Prompt estruturado

O prompt enviado à API externa segue uma estrutura fixa:

1. **Identidade e persona:** "Você é [seu nome], dono de uma agência..."
2. **Tom e estilo:** consultivo, educado, direto, humanizado.
3. **Regras absolutas:** os 12 anti-requisitos, explicitamente listados.
4. **Objetivo:** entender dor, qualificar, aquecer, contornar objeções, acionar handoff.
5. **Contexto do lead:** nome, endereço, status, histórico da conversa.
6. **Última mensagem do lead.**
7. **Instrução de formato:** resposta curta (máx. 200 caracteres), em português.

### 2.3. Limites da IA

A IA é **proibida** de:

- Negociar preço, valor, desconto, prazo (AR-001).
- Enviar proposta, orçamento, contrato (AR-002).
- Sugerir horário, data, agendamento (AR-003).
- Enviar mídia (AR-004).
- Contornar opt-out (AR-005).
- Revelar automação (AR-006).
- Responder fora da janela (AR-007).
- Ultrapassar limite diário (AR-008).
- Processar mídia recebida (AR-009).
- Agir após handoff (AR-010).
- Contatar sem base legal (AR-011).
- Tratar preço como objeção comum (AR-012).

### 2.4. Fronteira de silêncio total

Em **suspeita de automação** (R-057) e em **irritação/ameaça** (R-066), a IA:

- **Não envia NENHUMA mensagem.**
- Aciona handoff prioritário.
- Aguarda o Admin assumir.

### 2.5. Gate como segunda linha de defesa

O prompt instrui, mas **o gate valida** (ADR-004). Se a IA gerar algo que viole um AR, o gate bloqueia. O prompt é a primeira linha; o gate é a garantia.

---

## 3. Justificativa

### Por que a IA age como o Admin (R-055)?

- **O usuário escolheu (c)**: "agir como se fosse você, humano" (R-055).
- **Continuidade:** o lead não percebe que houve troca de humano para IA.
- **Marca:** a conversa mantém a identidade da agência.
- **Conversão:** leads tendem a responder melhor a uma pessoa do que a um "bot".

**Risco assumido:** ocultar automação pode violar políticas do WhatsApp/Meta e princípios de transparência da LGPD. O Admin assume o risco.

### Por que silêncio total em suspeita de automação (R-057)?

- **Prevenção de dano:** se a IA tentar se defender, pode se contradizer ou admitir.
- **Controle humano:** melhor o Admin assumir do que a IA improvisar.
- **Compliance:** evita que a IA minta diretamente ("não, sou humano") — o que seria pior.
- **Resposta do usuário:** você escolheu **(d)**: handoff imediato.

### Por que prompt estruturado?

- **Consistência:** todas as chamadas à IA seguem o mesmo formato.
- **Auditoria:** fácil reproduzir por que a IA respondeu algo.
- **Calibração:** ajustar um bloco afeta todas as conversas.
- **Testabilidade:** prompts podem ser versionados e testados.

### Por que o gate como segunda linha?

- **Alucinação:** a IA pode violar o prompt mesmo com instruções explícitas.
- **Injeção:** o lead pode tentar manipular a IA.
- **Mudança de modelo:** o provedor pode mudar comportamento.
- **Garantia:** o gate é determinístico.

### Por que tom consultivo e não vendedor?

- **Diferencial:** o mercado está cheio de bots vendedores.
- **Qualidade:** leads B2B respondem melhor a quem entende a dor.
- **Conversão:** qualificação mais precisa, menos leads queimados.
- **Usuário escolheu (a)**: "consultivo, educado e direto".

---

## 4. Consequências

### Positivas

- **Experiência humanizada:** o lead conversa como se fosse com você.
- **Qualificação precisa:** a IA entende a dor antes de ofertar.
- **Consistência:** todas as conversas seguem o mesmo tom.
- **Gate como garantia:** nenhum AR é violado.
- **Silêncio em suspeita:** evita dano reputacional.
- **Auditabilidade:** prompt versionado, logs completos.

### Negativas

- **Risco de banimento:** ocultar automação pode violar ToS.
- **Risco LGPD:** falta de transparência sobre automação.
- **Dependência de prompt:** se o prompt for mal calibrado, a IA responde mal.
- **Custo:** prompts longos consomem mais tokens.
- **Complexidade:** manter prompt, gate e persona alinhados.

### Riscos residuais

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| IA revela automação por engano | Média | Alto | Gate (AR-006) + silêncio em suspeita |
| Lead descobre e denuncia | Média | Alto | Handoff imediato + Admin assume |
| IA alucina preço/prazo | Média | Alto | Gate (AR-001, AR-002) |
| IA insiste após opt-out | Baixa | Alto | Gate (AR-005) + detecção |
| IA processa mídia | Baixa | Alto | Gate (AR-009) + handoff |
| Lead se sente enganado | Média | Alto | Risco assumido (R-055) |
| Custo de prompt alto | Média | Médio | Limite de tokens + sumarização |

---

## 5. Alternativas consideradas

### Alternativa A — IA se identifica como assistente virtual

- **Prós:** transparente, alinhado com LGPD e políticas do WhatsApp.
- **Contras:** o usuário escolheu agir como humano (R-055).
- **Por que não:** decisão do usuário, risco assumido.

### Alternativa B — IA não mente, mas não revela

- **Prós:** mais ético, menos risco.
- **Contras:** se o lead perguntar, a IA teria que responder algo.
- **Por que não:** o usuário escolheu silêncio total + handoff (R-057).

### Alternativa C — Script rígido (sem IA)

- **Prós:** zero alucinação, zero custo de API.
- **Contras:** não atende R-010, R-011 (conversa dinâmica e humanizada).
- **Por que não:** o diferencial é a IA consultiva.

### Alternativa D — IA com temperatura 0

- **Prós:** respostas mais determinísticas, menos alucinação.
- **Contras:** respostas repetitivas, robóticas.
- **Por que não:** perde humanização. Temperatura 0.7 é o equilíbrio.

### Alternativa E — Múltiplas personas por nicho

- **Prós:** personalização por setor.
- **Contras:** complexidade, risco de inconsistência.
- **Por que não:** o usuário escolheu vários nichos sem prioridade (R-054). Persona única é mais simples.

---

## 6. Implementação

### 6.1. Prompt do sistema (versão 1.0)

```typescript
// src/ia/prompt.builder.ts

export const SYSTEM_PROMPT = `
Você é {ADMIN_NAME}, dono de uma agência que vende sites, sistemas,
automações e tudo que envolva programação.

TOM E ESTILO:
- Consultivo, educado e direto.
- Foco em entender a dor do lead antes de ofertar qualquer solução.
- Condução dinâmica, sem script rígido. Converse como uma pessoa normal.
- Não faça muitas perguntas seguidas. Alterne entre ouvir, comentar,
  validar e perguntar.
- Quebre mensagens longas em várias mensagens curtas.
- Use no máximo 1–2 emojis por conversa.

REGRAS ABSOLUTAS (nunca viole):
1. NUNCA informe, sugira, calcule ou negocie preço, valor, desconto ou prazo.
2. NUNCA envie proposta, orçamento, contrato ou confirme escopo.
3. NUNCA sugira horário, data ou agendamento.
4. NUNCA envie mídia (imagem, PDF, áudio, vídeo, documento).
5. NUNCA tente reverter pedido de opt-out.
6. NUNCA diga "sou uma IA", "sou um bot", "assistente virtual" ou similar.
7. NUNCA responda fora de dias úteis, das 7h às 17h.
8. NUNCA ultrapasse 20–30 mensagens por dia.
9. NUNCA processe mídia recebida. Apenas registre e acione handoff.
10. NUNCA envie mensagem após handoff acionado.

OBJETIVO:
- Entender a dor e o contexto do lead.
- Qualificar: verba/interesse + poder de decisão.
- Aquecer o lead.
- Contornar objeções comuns (preço, tempo, fornecedor) sem negociar.
- Acionar handoff em: preço/proposta, agendamento, suspeita de bot,
  irritação, opt-out, mídia recebida, dúvida técnica complexa.

CONTEXTO DO LEAD:
- Nome: {LEAD_NAME}
- Endereço: {LEAD_ADDRESS}
- Status: {LEAD_STATUS}

HISTÓRICO DA CONVERSA:
{CONVERSATION_HISTORY}

ÚLTIMA MENSAGEM DO LEAD:
{LAST_MESSAGE}

INSTRUÇÃO:
Gere UMA resposta curta (máx. 200 caracteres), humanizada, em português,
que avance a conversa de forma consultiva. Se identificar um gatilho de
handoff, retorne apenas a palavra HANDOFF.
`;
```

### 6.2. Montagem do prompt

```typescript
export function buildMessages(input: GenerateInput): LLMMessage[] {
  const maskedContext = maskSensitiveData(input.leadContext);

  const systemPrompt = SYSTEM_PROMPT
    .replace('{ADMIN_NAME}', maskedContext.adminName)
    .replace('{LEAD_NAME}', maskedContext.name)
    .replace('{LEAD_ADDRESS}', maskedContext.address)
    .replace('{LEAD_STATUS}', maskedContext.status);

  const userMessage = `
HISTÓRICO:
${formatHistory(input.conversationHistory)}

ÚLTIMA MENSAGEM DO LEAD:
${input.lastMessage}
  `.trim();

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ];
}
```

### 6.3. Mascaramento de dados sensíveis

```typescript
// src/ia/masking.ts

export function maskSensitiveData(context: LeadContext): LeadContext {
  return {
    ...context,
    phone: maskPhone(context.phone),       // +55 11 9****-****
    address: maskAddress(context.address), // Rua X, *** — Campinas/SP
  };
}

function maskPhone(phone: string): string {
  return phone.replace(/(\d{2})\s?(\d)\d{3}(\d{4})/, '$1 $2****-$3');
}

function maskAddress(address: string): string {
  return address.replace(/\d+/g, '***');
}
```

### 6.4. Detecção de gatilho e handoff

A IA pode retornar `HANDOFF` como resposta. O pipeline detecta e aciona:

```typescript
// src/ia/response.handler.ts

export async function handleIAResponse(raw: string, lead: Lead) {
  if (raw.trim().toUpperCase() === 'HANDOFF') {
    await triggerHandoff(lead, 'IA_DETECTOU_GATILHO');
    return;
  }

  // Caso contrário, passar pelo gate
  const policy = evaluatePolicy({ message: raw, ... });
  if (!policy.allowed) {
    await handlePolicyAction(policy, lead);
    return;
  }

  await sendMessage(lead, raw);
}
```

### 6.5. Silêncio total em suspeita

```typescript
// src/conversation/silence.ts

export async function enterSilenceMode(lead: Lead, reason: SilenceReason) {
  await db.query(
    'UPDATE conversations SET mode = $1, handoff_active = $2, handoff_reason = $3 WHERE lead_id = $4',
    ['SILENCIO', true, reason, lead.id]
  );

  await db.insert('logs', {
    level: 'CRITICAL',
    module: 'silenceMode',
    message: `Modo silêncio ativado: ${reason}`,
    context: { leadId: lead.id, reason },
    lead_id: lead.id,
  });

  await notifyAdmin(`🔇 Silêncio total: ${lead.name} — ${reason}`, 'CRITICAL');
}
```

Gatilhos de silêncio:

```typescript
const SILENCE_TRIGGERS = [
  'BOT_SUSPICION',    // R-057
  'IRRITATION',       // R-066
  'THREAT',           // R-066
];
```

### 6.6. Contorno de objeções

```typescript
// src/ia/objection.handler.ts

const OBJECTION_HANDLERS = {
  OBJECTION_PRICE: `Entendo! O valor depende muito do escopo. Antes de falar
    de números, preciso entender o que faz sentido pra você.`,
  OBJECTION_TIME: `Sem problemas! Posso te chamar em outro momento?
    Me diz só o melhor período.`,
  OBJECTION_PROVIDER: `Legal! Então você já tem alguém cuidando disso.
    Está funcionando bem ou tem algo que gostaria de melhorar?`,
  OBJECTION_THINK: `Claro, sem pressa! Posso te chamar em alguns dias
    pra saber se você pensou melhor?`,
};
```

**Importante:** `PRICE_REQUEST` não está aqui — vai direto para handoff (AR-012).

### 6.7. Qualificação

```typescript
// src/ia/qualification.ts

export async function extractQualification(conversation: Message[]): Promise<QualificationData> {
  const prompt = `
    Analise a conversa abaixo e identifique:
    1. O lead demonstrou verba/interesse em investir? (sim/não/incerto)
    2. O lead tem poder de decisão? (sim/não/incerto)
    Responda em JSON.
  `;

  const result = await llm.generate({ prompt, conversation });
  return parseQualification(result);
}
```

### 6.8. Versionamento do prompt

```typescript
// src/ia/prompts/v1.ts
// src/ia/prompts/v2.ts
// src/ia/prompts/index.ts

export const CURRENT_PROMPT_VERSION = 'v1';

export function getSystemPrompt(version: string = CURRENT_PROMPT_VERSION): string {
  return PROMPTS[version];
}
```

Cada mudança de prompt é versionada e logada:

```typescript
await db.insert('prompt_versions', {
  version: CURRENT_PROMPT_VERSION,
  content: SYSTEM_PROMPT,
  created_at: new Date(),
  notes: 'Versão inicial',
});
```

### 6.9. Temperatura e tokens

```typescript
// src/ia/config.ts

export const IA_CONFIG = {
  temperature: 0.7,       // equilíbrio entre criatividade e consistência
  maxTokens: 300,         // limite por resposta
  topP: 0.9,
  frequencyPenalty: 0.3,  // reduz repetição
  presencePenalty: 0.3,
};
```

### 6.10. Auditoria de respostas

Toda resposta da IA é registrada:

```sql
CREATE TABLE ia_responses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         UUID NOT NULL REFERENCES leads(id),
  conversation_id UUID NOT NULL REFERENCES conversations(id),
  prompt_version  TEXT NOT NULL,
  model           TEXT NOT NULL,
  raw_response    TEXT NOT NULL,
  policy_allowed  BOOLEAN NOT NULL,
  policy_reason   TEXT,
  sent            BOOLEAN NOT NULL DEFAULT FALSE,
  tokens_input    INT,
  tokens_output   INT,
  latency_ms      INT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 7. Configuração

```typescript
// src/config/settings.ts

export interface IASettings {
  promptVersion: string;           // 'v1'
  persona: {
    type: 'HUMAN';                 // R-055
    adminName: string;             // seu nome
    revealAutomation: false;       // R-055
    silenceOnSuspicion: true;      // R-057
  };
  generation: {
    temperature: number;           // 0.7
    maxTokens: number;             // 300
    topP: number;                  // 0.9
    frequencyPenalty: number;      // 0.3
    presencePenalty: number;       // 0.3
  };
  masking: {
    enabled: true;                 // mascarar telefone/endereço
    maskPhone: true;
    maskAddress: true;
  };
  objectives: {
    diagnoseFirst: true;           // entender dor antes de ofertar
    qualifyBudget: true;           // verba/interesse
    qualifyDecision: true;         // poder de decisão
    handleObjections: true;        // objeções comuns
  };
  handoffTriggers: {
    priceRequest: true;
    scheduleIntent: true;
    botSuspicion: true;
    irritation: true;
    optOut: true;
    mediaReceived: true;
    technicalDoubt: true;
  };
}
```

---

## 8. Critérios de sucesso da decisão

- **Tom consultivo:** respostas avaliadas pelo Admin como consultivas em >80% dos casos.
- **Zero revelação:** nenhuma resposta revela automação (AR-006).
- **Zero preço:** nenhuma resposta menciona valor (AR-001, AR-002).
- **Silêncio em suspeita:** ao detectar "você é um robô?", a IA fica em silêncio total (R-057).
- **Qualificação:** IA identifica verba + decisão em leads qualificados.
- **Objeções:** IA contorna objeções comuns sem negociar.
- **Auditoria:** todas as respostas registradas com versão de prompt e decisão do gate.

---

## 9. Referências

- `docs/04-arquitetura.md` — pipeline, gate, IA
- `docs/07-template-mensagens.md` — templates de referência
- `docs/10-anti-requisitos.md` — AR-001 a AR-012
- `docs/08-adr/002-ia-externa.md` — ADR da IA
- `docs/08-adr/004-gate-invariantes.md` — ADR do gate
- `docs/08-adr/010-shadow-mode.md` — ADR do shadow mode
- R-008, R-009, R-010, R-011, R-041, R-042, R-051, R-052, R-055, R-056, R-057