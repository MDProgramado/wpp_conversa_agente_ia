# ADR-010 — Shadow Mode na Fase 2 (IA Rascunha, Nunca Envia)

- **Status:** Aceito
- **Data:** 2026-09-28
- **Decisores:** Admin (você), System Architect
- **Contexto:** Fase 2 — IA, Handoff e Shadow Mode
- **Relacionado a:** R-008, R-009, R-010, R-011, R-034, R-014, R-055, AR-006, AR-010

---

## 1. Contexto

A Fase 2 do roadmap introduz a IA como geradora de respostas e dicas. Porém, liberar envio automático logo de cara tem riscos altos:

- IA pode alucinar e prometer algo indevido (AR-001, AR-002).
- IA pode revelar automação (AR-006).
- IA pode sugerir preço, prazo ou agendamento (AR-001, AR-002, AR-003).
- IA pode processar mídia recebida incorretamente (AR-009).
- IA pode agir após handoff (AR-010).
- IA pode gerar respostas inadequadas ao tom consultivo (R-010).
- IA pode errar a qualificação (R-051).

Antes de permitir que a IA envie mensagens reais ao lead, é preciso **validar o comportamento** dela em um ambiente onde nada sai.

---

## 2. Decisão

Implementar **shadow mode** na Fase 2:

### Comportamento do shadow mode
- A IA **gera** respostas, sugestões e classificações normalmente.
- **Nenhum byte é enviado** ao lead. Nem texto, nem mídia, nem reação.
- As sugestões são registradas no banco e exibidas **apenas** no painel local.
- O Admin pode revisar, aprovar, editar ou descartar cada sugestão.
- O sistema registra o que **teria sido enviado**, para análise posterior.
- O gate de envio (`evaluatePolicy`) roda normalmente e registra suas decisões.
- Handoffs e notificações continuam funcionando (mas o bot não envia nada).

### Como o shadow mode é ativado
- Configuração global (`settings.shadowMode = true`).
- Pode ser ativado/desativado pelo Admin no painel.
- Na Fase 2, é o **modo padrão**.
- Só é desativado quando os critérios de saída forem atingidos.

### Critérios de saída do shadow mode
- **N dias** de operação sem violação de AR.
- **N sugestões** revisadas, com taxa de aprovação acima do mínimo.
- **Zero** alucinações críticas (preço, prazo, proposta).
- **Zero** revelações de automação.
- Aprovação do Admin para liberar envio automático.

(N a definir na fase de calibração.)

---

## 3. Justificativa

### Por que shadow mode?

- **Segurança:** valida o comportamento da IA sem risco para o lead.
- **Aprendizado:** o Admin vê como a IA responderia em situações reais.
- **Calibração:** ajusta prompt, temperatura, tom e limites.
- **Compliance:** garante que os 12 AR sejam respeitados antes de enviar.
- **Confiança:** constrói confiança antes de liberar envio automático.
- **Auditoria:** registra o que teria sido enviado, para revisão.
- **Alinhamento com o roadmap:** a Fase 2 prevê explicitamente "rascunha, nunca envia".

### Por que não liberar envio automático direto?

- **Risco de banimento:** uma única mensagem com preço pode gerar denúncia.
- **Risco reputacional:** revelar automação (AR-006) queima a marca.
- **Risco de alucinação:** IA pode inventar condições, prazos, promessas.
- **Risco de opt-out:** IA pode insistir após pedido de descadastro.
- **Risco de compliance:** IA pode violar LGPD sem que ninguém perceba.
- **Risco de perda de lead:** resposta inadequada pode afastar um lead bom.

### Por que não testar em produção com envio real?

- **Custo:** leads queimados não voltam.
- **Reputação:** o número dedicado pode ser denunciado.
- **Banimento:** o número pode ser bloqueado antes de validar.
- **Impossibilidade de desfazer:** mensagens enviadas não podem ser apagadas do celular do lead.

---

## 4. Consequências

### Positivas

- **Zero risco para o lead** durante a validação.
- **Aprendizado rápido:** o Admin vê a IA em ação sem consequências.
- **Calibração precisa:** prompt, tom e limites podem ser ajustados com dados reais.
- **Confiança construída:** o Admin aprova a liberação com base em evidências.
- **Auditoria rica:** o banco guarda todas as sugestões e decisões do gate.
- **Compliance garantido:** nenhuma mensagem viola AR antes da liberação.

### Negativas

- **Operação mais lenta:** o Admin precisa revisar sugestões manualmente.
- **Menor throughput:** shadow mode não automatiza de verdade.
- **Tempo de validação:** exige N dias/semanas de operação.
- **Complexidade:** modo adicional para implementar e manter.
- **Risco de fadiga:** Admin pode se cansar de revisar sugestões.

### Riscos residuais

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Shadow mode mal implementado envia algo | Baixa | Crítico | Gate + testes E2E + auditoria |
| IA gera sugestões ruins e Admin se cansa | Média | Médio | Calibrar prompt + templates |
| Validação longa demais | Média | Médio | Critérios objetivos de saída |
| Admin libera envio sem validar | Baixa | Alto | Checklist obrigatório + auditoria |
| Falha em desativar shadow mode | Baixa | Médio | Confirmação explícita |

---

## 5. Alternativas consideradas

### Alternativa A — Envio automático desde o início

- **Prós:** velocidade, aprendizado rápido, throughput alto.
- **Contras:** risco altíssimo de banimento, denúncia, erro de preço, revelação de automação.
- **Por que não:** incompatível com o princípio de segurança do sistema.

### Alternativa B — Apenas aprovar cada mensagem manualmente (auto com aprovação)

- **Prós:** mais seguro que automático, mais rápido que shadow.
- **Contras:** ainda envia mensagens reais; erros podem ocorrer.
- **Por que não:** o shadow mode é mais seguro para a Fase 2; a aprovação manual pode vir depois.

### Alternativa C — Copiloto (sugere, Admin envia manualmente)

- **Prós:** seguro, útil, já é o modo pós-handoff.
- **Contras:** é basicamente o shadow mode com envio manual.
- **Por que não:** o shadow mode é mais rígido: nem mesmo o Admin envia durante a validação.

### Alternativa D — Testar em número separado

- **Prós:** isola risco.
- **Contras:** multiplica números (viola R-059), complica aquecimento.
- **Por que não:** o número único é dedicado; testar em outro número exigiria novo aquecimento.

### Alternativa E — Testar offline (sem WhatsApp)

- **Prós:** zero risco.
- **Contras:** não valida comportamento real com leads reais.
- **Por que não:** o shadow mode valida em contexto real, apenas sem enviar.

---

## 6. Implementação

### 6.1. Flag global

```typescript
// src/config/settings.ts

export interface ShadowModeSettings {
  enabled: boolean;                // Fase 2: true
  showSuggestionsInPanel: true;    // exibe sugestões no painel
  allowManualSend: false;          // shadow: nem o Admin envia; só revisa
  logTentativeSends: true;         // registra o que teria sido enviado
  exitCriteria: {
    minDaysOfOperation: number;    // a definir
    minSuggestionsReviewed: number;// a definir
    minApprovalRate: number;       // ex.: 0.8 (80%)
    maxCriticalHallucinations: 0;  // ex.: 0
    maxAutomationReveals: 0,       // ex.: 0
  };
}
```

### 6.2. Ponto de bloqueio no pipeline

```typescript
// src/conversation/pipeline.ts

export async function handleIncomingMessage(message: IncomingMessage) {
  const conversation = await getConversation(message.from);
  const lead = await getLead(conversation.lead_id);

  // 1. Detectar intenção e gatilhos de handoff
  const intent = await detectIntent(message.text, conversation);

  // 2. Se handoff, acionar (mesmo em shadow mode)
  if (isHandoffIntent(intent)) {
    await triggerHandoff(lead, intent);
    return;
  }

  // 3. Gerar resposta com IA
  const suggestion = await generateResponse({
    systemPrompt: buildSystemPrompt(lead),
    conversationHistory: conversation.messages,
    lastMessage: message.text,
    leadContext: lead,
  });

  // 4. Rodar o gate
  const policy = evaluatePolicy({
    leadId: lead.id,
    message: suggestion.text,
    context: conversation,
    now: new Date(),
    dailyCounter: await getDailyCounter(lead.number_id, new Date()),
  });

  // 5. Registrar a sugestão e a decisão do gate
  await db.insert('suggestions', {
    conversation_id: conversation.id,
    lead_id: lead.id,
    source: 'IA',
    text: suggestion.text,
    tokens_input: suggestion.tokensInput,
    tokens_output: suggestion.tokensOutput,
    model: suggestion.model,
    latency_ms: suggestion.latencyMs,
    policy_allowed: policy.allowed,
    policy_action: policy.action,
    policy_reason: policy.reason,
    shadow_mode: settings.shadowMode.enabled,
    created_at: new Date(),
  });

  // 6. Se shadow mode, NÃO envia
  if (settings.shadowMode.enabled) {
    await logShadowDecision(lead, suggestion, policy);
    return; // nada sai
  }

  // 7. Se gate bloqueou, tratar
  if (!policy.allowed) {
    await handlePolicyAction(policy, lead);
    return;
  }

  // 8. Se gate liberou e não é shadow, humanizar e enviar
  await humanizeAndSend(lead.number_id, lead.phone, suggestion.text);
  await incrementDailyCounter(lead.number_id, new Date(), 'message');
}
```

### 6.3. Tabela `suggestions`

```sql
CREATE TABLE suggestions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id   UUID NOT NULL REFERENCES conversations(id),
  lead_id           UUID NOT NULL REFERENCES leads(id),
  source            TEXT NOT NULL,           -- IA, ADMIN
  text              TEXT NOT NULL,
  tokens_input      INT,
  tokens_output     INT,
  model             TEXT,
  latency_ms        INT,
  policy_allowed    BOOLEAN NOT NULL,
  policy_action     TEXT,
  policy_reason     TEXT,
  shadow_mode       BOOLEAN NOT NULL DEFAULT TRUE,
  reviewed_by_admin BOOLEAN NOT NULL DEFAULT FALSE,
  admin_decision    TEXT,                    -- APPROVED, EDITED, DISCARDED
  admin_edited_text TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_suggestions_lead ON suggestions(lead_id, created_at DESC);
CREATE INDEX idx_suggestions_reviewed ON suggestions(reviewed_by_admin);
```

### 6.4. Exibição no painel

```
┌─────────────────────────────────────────────────────────────┐
│  💡 SUGESTÃO DA IA (SHADOW MODE)                            │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  "Entendi! Muitas padarias têm esse desafio. Hoje você      │
│  divulga como? Só pelo Instagram ou tem site?"              │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│  Gate: ✅ PERMITIDO                                          │
│  Modelo: gpt-4o-mini                                        │
│  Latência: 1.2s                                             │
│  Tokens: 320 in / 45 out                                    │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│  [✓ Aprovar] [✎ Editar] [🗑 Descartar]                       │
│                                                             │
│  ⚠ SHADOW MODE ATIVO — NENHUMA MENSAGEM SERÁ ENVIADA       │
└─────────────────────────────────────────────────────────────┘
```

### 6.5. Log de decisão em shadow

```typescript
async function logShadowDecision(lead: Lead, suggestion: Suggestion, policy: PolicyResult) {
  await db.insert('logs', {
    level: 'INFO',
    module: 'shadowMode',
    message: 'Sugestão gerada em shadow mode — não enviada',
    context: {
      leadId: lead.id,
      suggestionPreview: suggestion.text.slice(0, 80),
      policyAllowed: policy.allowed,
      policyAction: policy.action,
      policyReason: policy.reason,
    },
    lead_id: lead.id,
  });
}
```

### 6.6. Métricas do shadow mode

```typescript
// src/shadowMode/metrics.ts

export async function getShadowMetrics(period: DateRange) {
  return {
    totalSuggestions: await countSuggestions(period),
    approvedByAdmin: await countByDecision(period, 'APPROVED'),
    editedByAdmin: await countByDecision(period, 'EDITED'),
    discardedByAdmin: await countByDecision(period, 'DISCARDED'),
    approvalRate: await calculateApprovalRate(period),
    blockedByGate: await countBlockedByGate(period),
    criticalHallucinations: await countCriticalHallucinations(period), // preço, prazo, proposta
    automationReveals: await countAutomationReveals(period),
    avgLatencyMs: await avgLatency(period),
    totalCost: await sumTokensCost(period),
  };
}
```

### 6.7. Saída do shadow mode

```typescript
// src/shadowMode/exitCriteria.ts

export async function canExitShadowMode(): Promise<ExitDecision> {
  const settings = getShadowModeSettings();
  const metrics = await getShadowMetrics(getPilotPeriod());

  const checks = {
    daysOfOperation: metrics.daysOfOperation >= settings.exitCriteria.minDaysOfOperation,
    suggestionsReviewed: metrics.totalSuggestions >= settings.exitCriteria.minSuggestionsReviewed,
    approvalRate: metrics.approvalRate >= settings.exitCriteria.minApprovalRate,
    criticalHallucinations: metrics.criticalHallucinations <= settings.exitCriteria.maxCriticalHallucinations,
    automationReveals: metrics.automationReveals <= settings.exitCriteria.maxAutomationReveals,
  };

  const allPassed = Object.values(checks).every(Boolean);

  return {
    canExit: allPassed,
    checks,
    metrics,
    requiresAdminApproval: true, // sempre precisa aprovação explícita
  };
}
```

**Regra:** mesmo que todos os critérios passem, a saída do shadow mode exige **confirmação explícita do Admin** com checklist.

---

## 7. Configuração

```typescript
// src/config/settings.ts

export interface ShadowModeSettings {
  enabled: boolean;                  // Fase 2: true; Fase 3: false após validação
  showSuggestionsInPanel: boolean;   // true
  allowManualSend: boolean;          // false (shadow é rígido)
  logTentativeSends: boolean;        // true
  exitCriteria: {
    minDaysOfOperation: number;      // a definir (ex.: 14)
    minSuggestionsReviewed: number;  // a definir (ex.: 100)
    minApprovalRate: number;         // ex.: 0.80
    maxCriticalHallucinations: number; // ex.: 0
    maxAutomationReveals: number;    // ex.: 0
  };
  requiresAdminApprovalToExit: boolean; // true
}
```

---

## 8. Critérios de sucesso da decisão

- **Zero envios em shadow:** nenhuma mensagem sai enquanto `shadowMode = true`.
- **Sugestões registradas:** 100% das sugestões ficam no banco para auditoria.
- **Gate rodando:** todas as sugestões passam pelo `evaluatePolicy`.
- **Auditoria completa:** decisões do gate e decisões do Admin ficam registradas.
- **Métricas disponíveis:** o painel mostra aprovação, edição, descarte, bloqueios.
- **Saída controlada:** só é possível sair do shadow com checklist + confirmação.
- **Nenhuma violação de AR:** as 12 invariantes se mantêm.

---

## 9. Referências

- `docs/04-arquitetura.md` — pipeline, gate, IA
- `docs/08-adr/002-ia-externa.md` — ADR da IA
- `docs/08-adr/004-gate-invariantes.md` — ADR do gate
- `docs/10-anti-requisitos.md` — AR-001 a AR-012
- `.planning/ROADMAP.md` — Fase 2 (GSD)
- R-008, R-009, R-010, R-011, R-014, R-034, R-055