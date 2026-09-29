# ADR-009 — Follow-up Conservador com Dreno Jittered

- **Status:** Aceito
- **Data:** 2026-09-28
- **Decisores:** Admin (você), System Architect
- **Contexto:** Fase 3 — Cadência, Operação e Painel
- **Relacionado a:** R-003, R-004, R-005, R-006, R-007, R-023, R-067, AR-007, AR-008

---

## 1. Contexto

Após a primeira mensagem manual, o bot assume a conversa (R-002). Se o lead não responder, é necessário reengajá-lo sem:

- Parecer spam.
- Aumentar risco de banimento.
- Desrespeitar a janela de envio (R-006).
- Ultrapassar o limite diário (R-023).
- Esgotar o lead com mensagens repetidas.

Inicialmente foi considerada a cadência `1h → 1d → 3d → 7d → 15d` (R-004), mas o usuário definiu que **1 semana já basta** (R-005): máximo de 4 tentativas, encerrando após 7 dias sem resposta.

Além disso, existe o cenário de **follow-ups vencidos fora da janela** (R-007): se o app ficou fechado, os follow-ups acumulam e precisam ser enviados ao abrir, sem disparar em rajada.

---

## 2. Decisão

Implementar **follow-up conservador** com:

### Cadência
- **1h → 1d → 3d → 7d** (4 tentativas).
- Encerramento após 7 dias sem resposta (R-005).
- Sem follow-up de 15 dias.

### Interrupções automáticas
A cadência é **interrompida imediatamente** se:
- Lead responder (R-004).
- Lead pedir opt-out (AR-005).
- Handoff for acionado (R-012, R-065).
- Admin pausar manualmente.
- Número for banido ou desconectado.

### Janela e limites
- Envio apenas em **dias úteis, 7h–17h** (R-006).
- Respeito ao **limite diário de 20–30 mensagens** (R-023).
- Se o limite for atingido, follow-ups ficam enfileirados para o próximo dia útil.

### Dreno jittered (R-007)
- Follow-ups vencidos fora da janela são enfileirados.
- Ao abrir o app, são enviados com **delays humanizados e aleatórios** (3–12 s entre mensagens).
- **FIRE_ONCE**: cada follow-up é enviado **uma única vez**. Nunca reenvia.
- Limite máximo de follow-ups drenados por ciclo (ex.: 5) para evitar rajada.

### Variação de mensagens
- Cada tentativa usa **template diferente** (R-067).
- Nunca repetir o mesmo texto.
- Tom consultivo, sem pressão (R-010).

---

## 3. Justificativa

### Por que cadência conservadora (1h → 1d → 3d → 7d)?

- **1h:** lembrete imediato, sem parecer insistente.
- **1d:** segundo toque, timing natural.
- **3d:** espaço para o lead pensar.
- **7d:** última tentativa, com encerramento educado.
- **Sem 15d:** o usuário considerou que 1 semana já é suficiente; evita desgaste.

### Por que interrupção imediata?

- **Resposta do lead:** se ele respondeu, a IA assume (R-008). Follow-up seria redundante.
- **Opt-out:** reengajar após opt-out é violação (AR-005).
- **Handoff:** se o Admin assumiu, o bot não deve enviar nada (AR-010).
- **Pausa manual:** o Admin tem controle total.
- **Banimento/desconexão:** mensagens não saem de qualquer forma.

### Por que dreno jittered?

- **R-007 obriga:** follow-ups vencidos fora da janela devem ser enviados ao abrir.
- **Risco de rajada:** sem jitter, o app abriria e dispararia N mensagens em segundos — comportamento típico de bot, altíssimo risco de banimento (AR-008).
- **FIRE_ONCE:** garante idempotência. Um follow-up já enviado nunca é reenviado, mesmo se o app travar.
- **Limite por ciclo:** evita que 20 follow-ups vencidos saiam de uma vez.

### Por que variação de mensagens?

- **Humanização:** repetir o mesmo texto é sinal claro de automação (R-067).
- **Engajamento:** mensagens diferentes têm mais chance de gerar resposta.
- **Compliance:** evita parecer spam.

---

## 4. Consequências

### Positivas

- **Menor risco de banimento:** cadência curta + jitter + limite por ciclo.
- **Idempotência:** FIRE_ONCE evita reenvio acidental.
- **Respeito à janela:** nada sai fora de dias úteis, 7h–17h (exceto dreno ao abrir, conforme R-007).
- **Menor desgaste:** máximo 4 tentativas, encerramento em 7 dias.
- **Humanização:** variação de templates + delays.
- **Controle:** Admin pode pausar a qualquer momento.

### Negativas

- **Menor alcance:** 4 tentativas pode ser pouco para alguns leads.
- **Encerramento precoce:** leads que responderiam em 10 dias são marcados como PERDIDOS.
- **Complexidade do dreno:** precisa de fila persistente e controle de FIRE_ONCE.
- **Risco de jitter mal calibrado:** delays muito curtos ou longos demais.

### Riscos residuais

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Lead responde após encerramento | Média | Médio | Admin pode reativar manualmente (RN-022) |
| Follow-up reenviado por bug | Baixa | Alto | FIRE_ONCE + testes E2E |
| Rajada ao abrir o app | Média | Alto | Jitter + limite por ciclo + FIRE_ONCE |
| Delay curto demais | Média | Médio | Calibrar 3–12 s |
| Delay longo demais | Média | Baixo | Limite superior de 12 s |
| Follow-up enviado fora da janela | Baixa | Médio | evaluatePolicy (AR-007) bloqueia |

---

## 5. Alternativas consideradas

### Alternativa A — Cadência mais longa (1h → 1d → 3d → 7d → 15d → 30d)

- **Prós:** mais toques, maior alcance.
- **Contras:** mais desgaste, mais risco de denúncia, mais chance de banimento.
- **Por que não:** o usuário definiu 1 semana como suficiente.

### Alternativa B — Cadência mais curta (1h → 3h → 1d → 3d)

- **Prós:** resposta mais rápida.
- **Contras:** alta chance de parecer spam, risco elevado.
- **Por que não:** conservador é melhor para o piloto.

### Alternativa C — Sem follow-up

- **Prós:** zero risco.
- **Contras:** perde a maioria dos leads que não respondem de imediato.
- **Por que não:** o follow-up é o coração da reengagem.

### Alternativa D — Dreno sem jitter

- **Prós:** simples, rápido.
- **Contras:** dispara em rajada, risco alto de banimento.
- **Por que não:** viola o princípio de humanização (R-067) e AR-008.

### Alternativa E — Dreno sem FIRE_ONCE

- **Prós:** mais simples.
- **Contras:** risco de reenvio duplicado se o app travar no meio.
- **Por que não:** duplicidade irrita o lead e pode gerar denúncia.

---

## 6. Implementação

### 6.1. Estado de um follow-up

```typescript
type FollowupStatus = 'PENDING' | 'SENT' | 'CANCELLED' | 'SKIPPED';

interface Followup {
  id: string;
  leadId: string;
  numberId: string;
  sequence: 1 | 2 | 3 | 4;       // 1h, 1d, 3d, 7d
  scheduledAt: Date;
  sentAt: Date | null;
  status: FollowupStatus;
  cancelledReason: string | null;
  templateId: string;             // template usado
}
```

### 6.2. Agendamento da cadência

Ao enviar a primeira mensagem manual (R-001), agendar a sequência:

```typescript
// src/conversation/followup.ts

export async function scheduleFollowupSequence(leadId: string, numberId: string, baseTime: Date) {
  const sequence = [
    { seq: 1, delayMs: 60 * 60 * 1000 },        // 1h
    { seq: 2, delayMs: 24 * 60 * 60 * 1000 },   // 1d
    { seq: 3, delayMs: 3 * 24 * 60 * 60 * 1000 }, // 3d
    { seq: 4, delayMs: 7 * 24 * 60 * 60 * 1000 }, // 7d
  ];

  for (const item of sequence) {
    await db.insert('followups', {
      lead_id: leadId,
      number_id: numberId,
      sequence: item.seq,
      scheduled_at: new Date(baseTime.getTime() + item.delayMs),
      status: 'PENDING',
      template_id: `followup_${item.seq}`,
    });
  }
}
```

### 6.3. Cancelamento em cascata

```typescript
export async function cancelPendingFollowups(leadId: string, reason: string) {
  await db.query(
    `UPDATE followups
     SET status = 'CANCELLED', cancelled_reason = $1
     WHERE lead_id = $2 AND status = 'PENDING'`,
    [reason, leadId]
  );
}
```

Chamado quando:
- Lead responde → `reason = 'LEAD_RESPONDED'`
- Opt-out → `reason = 'OPTOUT'`
- Handoff → `reason = 'HANDOFF'`
- Pausa manual → `reason = 'MANUAL_PAUSE'`

### 6.4. Scheduler com dreno jittered

```typescript
// src/conversation/scheduler.ts

const MAX_DRAIN_PER_CYCLE = 5;
const JITTER_MIN_MS = 3000;
const JITTER_MAX_MS = 12000;

export async function runSchedulerCycle() {
  const now = new Date();

  // 1. Buscar follow-ups vencidos, ordenados por scheduled_at
  const due = await db.query(
    `SELECT * FROM followups
     WHERE status = 'PENDING' AND scheduled_at <= $1
     ORDER BY scheduled_at ASC
     LIMIT $2`,
    [now, MAX_DRAIN_PER_CYCLE]
  );

  for (const followup of due) {
    // 2. Verificar se pode enviar
    const lead = await getLead(followup.lead_id);
    if (lead.optOut || lead.handoffActive || lead.responded) {
      await cancelFollowup(followup.id, 'INTERRUPTED');
      continue;
    }

    // 3. Verificar janela (R-006)
    if (!isWithinWindow(now)) {
      // Manter PENDING para dreno ao abrir o app (R-007)
      continue;
    }

    // 4. Verificar limite diário (R-023)
    const counter = await getDailyCounter(followup.number_id, now);
    if (counter.messages_sent >= getDailyLimit(followup.number_id)) {
      continue; // enfileira para próximo dia útil
    }

    // 5. Gerar mensagem (template variado)
    const template = pickTemplate(followup.template_id, followup.sequence);
    const message = await generateFollowupMessage(lead, template);

    // 6. Passar pelo gate (evaluatePolicy)
    const policy = evaluatePolicy({ leadId: lead.id, message, context: lead.context, now, counter });
    if (!policy.allowed) {
      await handlePolicyAction(policy, lead, followup);
      continue;
    }

    // 7. Marcar FIRE_ONCE ANTES de enviar (idempotência)
    const marked = await db.query(
      `UPDATE followups SET status = 'SENT', sent_at = NOW()
       WHERE id = $1 AND status = 'PENDING'
       RETURNING id`,
      [followup.id]
    );
    if (marked.rowCount === 0) continue; // outro ciclo já enviou

    // 8. Humanizar (jitter + digitação + quebra)
    await humanizeAndSend(followup.number_id, lead.phone, message);

    // 9. Incrementar contador
    await incrementDailyCounter(followup.number_id, now, 'message');

    // 10. Jitter antes do próximo
    await sleep(randomBetween(JITTER_MIN_MS, JITTER_MAX_MS));
  }

  // 11. Verificar encerramento da cadência (7d sem resposta)
  await checkSequenceEnd(now);
}
```

### 6.5. FIRE_ONCE (idempotência)

O ponto crítico: **marcar como SENT antes de enviar**. Se o app travar entre o `UPDATE` e o `sendText`, o follow-up fica como SENT mesmo sem ter sido enviado. Isso é aceitável porque:

- **Melhor perder um follow-up do que duplicar.**
- Duplicidade gera irritação e risco de denúncia.
- O Admin pode reativar manualmente se necessário.

Alternativa mais robusta: registrar `sent_at` apenas após confirmação do adapter. Mas isso abre janela para duplicação se o app travar após o envio e antes do commit. **Escolha: fail-safe (perder > duplicar).**

### 6.6. Encerramento da cadência

```typescript
async function checkSequenceEnd(now: Date) {
  // Leads com follow-up 4 (7d) enviado há mais de 1 dia e sem resposta
  const expired = await db.query(
    `SELECT l.id FROM leads l
     JOIN followups f ON f.lead_id = l.id
     WHERE f.sequence = 4
       AND f.status = 'SENT'
       AND f.sent_at < NOW() - INTERVAL '1 day'
       AND l.status = 'CONTATADO'
       AND l.opt_out = FALSE`
  );

  for (const row of expired.rows) {
    await changeStatus(row.id, 'PERDIDO', 'SEM_RESPOSTA_7D', 'IA');
    await cancelPendingFollowups(row.id, 'SEQUENCE_ENDED');
  }
}
```

### 6.7. Variação de templates

| Sequência | Template | Tom |
|---|---|---|
| 1 (1h) | `followup_1h_leve` | "Só passando pra ver se você viu..." |
| 2 (1d) | `followup_1d_contexto` | "Voltei aqui rapidinho..." |
| 3 (3d) | `followup_3d_espaco` | "Imagino que a semana esteja cheia..." |
| 4 (7d) | `followup_7d_encerramento` | "Esse é meu último contato pra não te incomodar..." |

Ver `docs/07-template-mensagens.md`, seção 6.

---

## 7. Configuração

```typescript
// src/config/settings.ts

export interface FollowupSettings {
  cadence: [
    { sequence: 1, delayMs: 60 * 60 * 1000 },         // 1h
    { sequence: 2, delayMs: 24 * 60 * 60 * 1000 },    // 1d
    { sequence: 3, delayMs: 3 * 24 * 60 * 60 * 1000 },// 3d
    { sequence: 4, delayMs: 7 * 24 * 60 * 60 * 1000 },// 7d
  ];
  maxAttempts: 4;
  endAfterDays: 7;
  drain: {
    maxPerCycle: 5,
    jitterMinMs: 3000,
    jitterMaxMs: 12000,
    fireOnce: true,
  };
  templates: {
    vary: true,
    perSequence: true,
  };
}
```

---

## 8. Critérios de sucesso da decisão

- **Cadência:** 4 tentativas enviadas nos intervalos corretos.
- **Interrupção:** cancelamento imediato ao responder, opt-out, handoff ou pausa.
- **Dreno:** follow-ups vencidos enviados ao abrir o app, com jitter e limite por ciclo.
- **FIRE_ONCE:** zero reenvios duplicados.
- **Encerramento:** lead marcado como PERDIDO após 7 dias sem resposta.
- **Janela e limites:** nenhuma mensagem fora da janela (exceto dreno conforme R-007) e nenhum limite ultrapassado.

---

## 9. Referências

- `docs/03-regras-de-negocio.md` — RN-015 a RN-022
- `docs/07-template-mensagens.md` — Seção 6 (follow-up)
- `docs/04-arquitetura.md` — Seção 10 (scheduler)
- `docs/08-adr/004-gate-invariantes.md` — AR-007, AR-008
- `docs/08-adr/008-preparacao-multiplos-numeros.md` — limites por número
- R-003, R-004, R-005, R-006, R-007, R-023, R-067