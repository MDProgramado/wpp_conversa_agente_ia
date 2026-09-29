# 10 — Anti-Requisitos (Comportamentos Proibidos)

> Consolidação dos 12 anti-requisitos do sistema.
> Cada AR é uma **invariante de código** validada pelo gate de envio (`evaluatePolicy`).
> Nenhuma mensagem sai sem passar por esta camada (ADR-004).

---

## Visão Geral

| ID | Comportamento proibido | Gatilho | Ação | Testável |
|---|---|---|---|---|
| AR-001 | Negociar preço, valor, desconto | Lead pede preço/desconto | Handoff | ✅ |
| AR-002 | Enviar proposta, orçamento, contrato | Lead pede proposta | Handoff | ✅ |
| AR-003 | Sugerir horário, data, agendamento | Qualquer sugestão de agenda | Handoff | ✅ |
| AR-004 | Enviar mídia | IA tenta enviar arquivo | Bloqueio | ✅ |
| AR-005 | Contornar opt-out | Lead pede para parar | Bloqueio total | ✅ |
| AR-006 | Revelar automação | IA gera texto revelando | Silêncio + Handoff | ✅ |
| AR-007 | Responder fora da janela | Horário fora de 7h–17h úteis | Enfileirar | ✅ |
| AR-008 | Ultrapassar limite diário | Contador > 30/dia | Enfileirar | ✅ |
| AR-009 | Processar mídia recebida | Lead envia áudio/imagem/PDF | Handoff | ✅ |
| AR-010 | Agir após handoff | Handoff ativo | Silêncio | ✅ |
| AR-011 | Contatar sem base legal | Lead sem origem/base/finalidade | Bloqueio | ✅ |
| AR-012 | Tratar preço como objeção comum | Lead pede preço | Handoff (não contornar) | ✅ |

---

## AR-001 — Negociação de Preço

### Definição
O bot **NUNCA** deve informar, sugerir, calcular, estimar ou negociar valores, preços, descontos, condições comerciais ou prazos.

### Motivo
- Preço é decisão do Admin.
- IA pode alucinar valores.
- Um único valor errado pode custar a negociação.
- Pedido de preço sempre aciona handoff (AR-012).

### Gatilhos de violação
- Lead pergunta "quanto custa?".
- Lead pergunta "tem desconto?".
- IA gera resposta contendo "R$", "valor", "preço", "custo", "investimento", "desconto".
- IA sugere faixa de preço.

### Comportamento esperado
- **Bloquear** a mensagem.
- **Acionar handoff** com motivo `PRICE_REQUEST`.
- **Notificar** o Admin localmente (som + pop-up).

### Exemplos

| Contexto | Resposta da IA (errada) | Ação correta |
|---|---|---|
| Lead: "Quanto custa um site?" | "Um site simples custa R$ 2.000" | ❌ Bloquear → Handoff |
| Lead: "Tem desconto?" | "Consigo 10% de desconto" | ❌ Bloquear → Handoff |
| Lead: "Qual o investimento?" | "O investimento varia de R$ 1.500 a R$ 5.000" | ❌ Bloquear → Handoff |
| Lead: "Quanto fica?" | "Depende do escopo..." | ⚠️ Ambíguo — bloquear preventivamente |

### Detecção (regex)

```typescript
const PRICE_PATTERNS = [
  /\b(preço|valor|custo|investimento|orçamento|proposta)\b/i,
  /R\$\s?\d+/i,
  /\b\d+\s?(reais|mil|k)\b/i,
  /\b(desconto|promoção|condição especial)\b/i,
  /\b(quanto (custa|fica|sai|é|vale))\b/i,
  /\b(me (manda|envia|passa) (uma )?(proposta|orçamento|valor))\b/i,
  /\b(faixa de (preço|valor))\b/i,
];
```

### Property test (AR-001)

```typescript
test('AR-001: nenhuma mensagem com preço é enviada', () => {
  fc.assert(
    fc.property(fc.string(), (msg) => {
      if (containsPrice(msg)) {
        const result = evaluatePolicy({ message: msg, ...baseContext });
        return result.allowed === false && result.action === 'handoff';
      }
      return true;
    })
  );
});
```

### Rastreabilidade
- Requisito: R-012
- Regra de negócio: RN-041, RN-042
- Critério de aceitação: AC-007
- ADR: ADR-004 (gate)

---

## AR-002 — Fechamento de Proposta

### Definição
O bot **NUNCA** deve enviar proposta, orçamento, contrato, confirmar escopo técnico, prazo de entrega ou condições de pagamento.

### Motivo
- Proposta é documento comercial formal.
- IA não conhece escopo real.
- Compromisso enviado pela IA é vinculante.

### Gatilhos de violação
- Lead pede proposta.
- Lead pede orçamento.
- IA gera resposta prometendo prazo ("entrego em 30 dias").
- IA confirma escopo ("farei um site com 5 páginas").

### Comportamento esperado
- **Bloquear** a mensagem.
- **Acionar handoff** com motivo `PROPOSAL_REQUEST`.
- **Notificar** o Admin localmente.

### Exemplos

| Contexto | Resposta da IA (errada) | Ação correta |
|---|---|---|
| Lead: "Me manda uma proposta" | "Segue a proposta: R$ 3.000, 30 dias" | ❌ Bloquear → Handoff |
| Lead: "Você entrega em quanto tempo?" | "Entrego em 15 dias úteis" | ❌ Bloquear → Handoff |
| Lead: "O site terá 5 páginas?" | "Sim, 5 páginas por R$ 2.500" | ❌ Bloquear → Handoff |

### Detecção (regex)

```typescript
const PROPOSAL_PATTERNS = [
  /\b(proposta|orçamento|contrato|escopo)\b/i,
  /\b(vou (enviar|mandar|preparar) (uma )?(proposta|orçamento))\b/i,
  /\b(prazo de (entrega|execução))\b/i,
  /\b(\d+ (dias|semanas|meses) (úteis|para entrega))\b/i,
  /\b(inclui|não inclui|abrange)\b/i,
];
```

### Property test (AR-002)

```typescript
test('AR-002: nenhuma mensagem com proposta é enviada', () => {
  fc.assert(
    fc.property(fc.string(), (msg) => {
      if (containsProposal(msg)) {
        const result = evaluatePolicy({ message: msg, ...baseContext });
        return result.allowed === false && result.action === 'handoff';
      }
      return true;
    })
  );
});
```

### Rastreabilidade
- Requisito: R-012
- Regra de negócio: RN-042
- Critério de aceitação: AC-007
- ADR: ADR-004

---

## AR-003 — Agendamento Autônomo

### Definição
O bot **NUNCA** deve sugerir horário, data, dia da semana, confirmar agendamento, criar evento de calendário ou propor reunião com data/hora.

### Motivo
- Agendamento exige consulta à agenda real do Admin.
- IA pode sugerir horário indisponível.
- Confirmar data errada gera frustração e perda de credibilidade.

### Gatilhos de violação
- Lead pergunta "que dia podemos?".
- IA sugere "que tal terça às 14h?".
- IA confirma "ficou marcado para amanhã".

### Comportamento esperado
- **Bloquear** a mensagem.
- **Acionar handoff** com motivo `SCHEDULE_INTENT`.
- **Notificar** o Admin localmente.
- Admin agenda manualmente (R-025).

### Exemplos

| Contexto | Resposta da IA (errada) | Ação correta |
|---|---|---|
| Lead: "Podemos marcar?" | "Que tal quinta às 15h?" | ❌ Bloquear → Handoff |
| Lead: "Quando você pode?" | "Amanhã às 10h serve?" | ❌ Bloquear → Handoff |
| Lead: "Vamos agendar" | "Fechado para segunda!" | ❌ Bloquear → Handoff |

### Detecção (regex)

```typescript
const SCHEDULE_PATTERNS = [
  /\b(segunda|terça|quarta|quinta|sexta|sábado|domingo)(-feira)?\b/i,
  /\b(amanhã|depois de amanhã|próxima semana|semana que vem)\b/i,
  /\b\d{1,2}(:\d{2})?\s?(h|horas)?\b/i,
  /\b(às|as)\s?\d{1,2}/i,
  /\b(que tal|podemos marcar|vamos agendar|fica (bom|marcado))\b/i,
  /\b(agendar|agendamento|reunião|call)\b/i,
];
```

### Property test (AR-003)

```typescript
test('AR-003: nenhuma mensagem sugere horário/data', () => {
  fc.assert(
    fc.property(fc.string(), (msg) => {
      if (containsScheduleSuggestion(msg)) {
        const result = evaluatePolicy({ message: msg, ...baseContext });
        return result.allowed === false && result.action === 'handoff';
      }
      return true;
    })
  );
});
```

### Rastreabilidade
- Requisito: R-012, R-025
- Regra de negócio: RN-057
- Critério de aceitação: AC-008
- ADR: ADR-004

---

## AR-004 — Envio de Mídia

### Definição
O bot **NUNCA** deve enviar imagens, PDFs, áudios, vídeos, documentos, stickers ou qualquer arquivo. Apenas texto e links.

### Motivo
- Mídia não passa pelo gate de conteúdo.
- Arquivos podem conter informações erradas ou desatualizadas.
- Portfólio/proposta devem ser enviados manualmente pelo Admin.

### Gatilhos de violação
- IA tenta anexar arquivo.
- IA menciona "segue em anexo".
- IA promete enviar PDF.

### Comportamento esperado
- **Bloquear** a mensagem (ou a parte de mídia).
- **Registrar** o evento no log.
- **Notificar** o Admin localmente.
- Não acionar handoff automaticamente (a IA pode reformular).

### Exemplos

| Contexto | Resposta da IA (errada) | Ação correta |
|---|---|---|
| Lead pede portfólio | IA tenta enviar PDF | ❌ Bloquear → Log + Notificar |
| IA gera "segue em anexo" | — | ❌ Bloquear → Log |
| IA promete enviar vídeo | — | ❌ Bloquear → Log |

### Detecção

```typescript
const MEDIA_PATTERNS = [
  /\b(segue (em )?anexo|em anexo|anexado)\b/i,
  /\b(vou (enviar|mandar) (o |a )?(pdf|imagem|vídeo|áudio|arquivo|documento))\b/i,
];

// Verificação estrutural (o adapter não expõe sendMedia)
function containsMedia(message: OutgoingMessage): boolean {
  return message.type !== 'text';
}
```

### Property test (AR-004)

```typescript
test('AR-004: nenhuma mensagem de mídia é enviada', () => {
  fc.assert(
    fc.property(fc.constantFrom('audio', 'image', 'pdf', 'video', 'document'), (type) => {
      const result = evaluatePolicy({ message: '', type, ...baseContext });
      return result.allowed === false && result.action === 'block';
    })
  );
});
```

### Rastreabilidade
- Requisito: R-037
- Regra de negócio: RN-073
- Critério de aceitação: AC-013
- ADR: ADR-004

---

## AR-005 — Contorno de Opt-out

### Definição
O bot **NUNCA** deve tentar reverter, desconsiderar ou contornar pedido de opt-out. Após o pedido, **nenhuma mensagem** deve ser enviada.

### Motivo
- Direito do titular (LGPD).
- Política do WhatsApp/Meta.
- Denúncia e banimento em caso de descumprimento.

### Gatilhos de violação
- Lead pede para parar.
- Lead pede para sair da lista.
- Sistema tenta enviar follow-up após opt-out.

### Comportamento esperado
- **Detectar** automaticamente.
- **Marcar** lead como "não contatar" (irreversível).
- **Cancelar** todos os follow-ups pendentes.
- **Bloquear** toda mensagem futura.
- **Registrar** data, hora e conteúdo.
- **Nunca** tentar reverter.

### Exemplos

| Contexto | Ação correta |
|---|---|
| Lead: "Não quero mais receber" | Opt-out registrado, lead marcado, automação interrompida |
| Lead: "Me tira da lista" | Opt-out registrado |
| Lead: "Pare de me mandar mensagens" | Opt-out registrado |
| Lead: "Isso é spam, vou bloquear" | Opt-out + handoff (irritação) |

### Detecção (regex)

```typescript
const OPTOUT_PATTERNS = [
  /\b(não quero|pare|para) (de )?(me )?(mandar|enviar|receber|contatar)\b/i,
  /\b(me (tira|remove|exclui) (da|de) (lista|contato))\b/i,
  /\b(não me (manda|envia|contata) mais)\b/i,
  /\b(descadastr[ao]|unsubscribe|opt.?out)\b/i,
  /\b(bloque[ae]|denunci[ae])\b/i,
];
```

### Property test (AR-005)

```typescript
test('AR-005: nenhuma mensagem é enviada após opt-out', () => {
  fc.assert(
    fc.property(fc.string(), (msg) => {
      const context = { ...baseContext, lead: { ...baseContext.lead, optOut: true } };
      const result = evaluatePolicy({ message: msg, context, ... });
      return result.allowed === false && result.action === 'block';
    })
  );
});
```

### Rastreabilidade
- Requisito: R-024
- Regra de negócio: RN-063 a RN-067
- Critério de aceitação: AC-011
- ADR: ADR-013 (LGPD)

---

## AR-006 — Revelação de Automação

### Definição
O bot **NUNCA** deve se identificar como IA, bot, robô, assistente virtual ou sistema automatizado espontaneamente.

### Motivo
- Decisão do Admin: agir como humano (R-055).
- Se o lead perguntar diretamente: silêncio total + handoff (R-056, R-057).
- Revelação espontânea quebra a persona.

### Gatilhos de violação
- IA usa "sou uma IA", "sou um bot".
- IA usa "como assistente virtual".
- IA usa "atendimento automatizado".

### Comportamento esperado
- **Bloquear** a mensagem.
- Se o lead perguntou diretamente: **silêncio total** + handoff prioritário.
- Se foi espontâneo: **regenerar** a resposta, logar e notificar.

### Exemplos

| Contexto | Resposta da IA (errada) | Ação correta |
|---|---|---|
| IA gera "Sou uma IA..." | — | ❌ Bloquear → Regenerar + Log |
| Lead: "Você é um robô?" | Qualquer resposta | ❌ Silêncio total + Handoff |
| IA gera "Como assistente virtual..." | — | ❌ Bloquear → Regenerar + Log |

### Detecção (regex)

```typescript
const AUTOMATION_PATTERNS = [
  /\b(sou (uma )?(ia|inteligência artificial|bot|robô|assistente virtual))\b/i,
  /\b(como (uma )?(ia|inteligência artificial|assistente virtual))\b/i,
  /\b(sistema automatizado|atendimento automatizado)\b/i,
  /\b(chatbot|robô de atendimento)\b/i,
];

const BOT_SUSPICION_PATTERNS = [
  /\b(você|vc) (é|e) (um |uma )?(robô|bot|ia|inteligência artificial|humano)\b/i,
  /\b(é|e) (um |uma )?(robô|bot|ia)\b/i,
  /\b(estou falando com (um |uma )?(robô|bot|ia|pessoa|humano))\b/i,
  /\b(atendimento (automático|automatizado|robotizado))\b/i,
];
```

### Property test (AR-006)

```typescript
test('AR-006: nenhuma mensagem revela automação', () => {
  fc.assert(
    fc.property(fc.string(), (msg) => {
      if (revealsAutomation(msg)) {
        const result = evaluatePolicy({ message: msg, ...baseContext });
        return result.allowed === false && result.action === 'silence';
      }
      return true;
    })
  );
});

test('AR-006: pergunta direta aciona silêncio', () => {
  fc.assert(
    fc.property(fc.constantFrom(
      'Você é um robô?',
      'Estou falando com um bot?',
      'Isso é atendimento automático?'
    ), (msg) => {
      const result = evaluatePolicy({ message: msg, isIncoming: true, ...baseContext });
      return result.action === 'silence' && result.reason === 'AR-006';
    })
  );
});
```

### Rastreabilidade
- Requisito: R-055, R-056, R-057
- Regra de negócio: RN-030, RN-031
- Critério de aceitação: AC-009, AC-014
- ADR: ADR-012 (prompt/persona)

---

## AR-007 — Resposta Fora da Janela

### Definição
O bot **NUNCA** deve enviar mensagens automáticas fora de **dias úteis, das 7h às 17h**.

### Motivo
- Reduzir risco de banimento.
- Respeitar horário comercial.
- Evitar incomodar o lead fora do horário.

### Gatilhos de violação
- Mensagem agendada para 22h.
- Follow-up disparado no domingo.
- IA responde sábado à tarde.

### Comportamento esperado
- **Enfileirar** a mensagem.
- **Enviar** no próximo dia útil às 7h (ou ao abrir o app, conforme R-007).
- **Não** notificar o lead.

### Exceções
- **Dreno ao abrir o app** (R-007): follow-ups vencidos podem ser enviados ao abrir, mesmo fora da janela, desde que o Admin esteja operando.

### Exemplos

| Contexto | Ação correta |
|---|---|
| Follow-up agendado para 22h de segunda | Enfileirar para terça 7h |
| Lead responde sábado às 10h | Bot não responde (R-058) |
| Follow-up vencido, app aberto às 6h | Enviar com jitter (R-007) |

### Detecção

```typescript
function isWithinWindow(now: Date): boolean {
  const day = now.getDay();        // 0 = domingo, 6 = sábado
  const hour = now.getHours();
  const isWeekday = day >= 1 && day <= 5;
  const isWithinHours = hour >= 7 && hour < 17;
  return isWeekday && isWithinHours;
}
```

### Property test (AR-007)

```typescript
test('AR-007: nenhuma mensagem é enviada fora da janela', () => {
  fc.assert(
    fc.property(fc.date(), (date) => {
      if (!isWithinWindow(date)) {
        const result = evaluatePolicy({ now: date, ...baseContext });
        return result.allowed === false && result.action === 'queue';
      }
      return true;
    })
  );
});
```

### Rastreabilidade
- Requisito: R-006, R-058
- Regra de negócio: RN-006, RN-007, RN-008
- Critério de aceitação: AC-002
- ADR: ADR-009 (follow-up)

---

## AR-008 — Ultrapassar Limite Diário

### Definição
O bot **NUNCA** deve enviar mais de **20–30 mensagens por dia** no número dedicado.

### Motivo
- Reduzir risco de banimento.
- Evitar comportamento de spam.
- Manter aquecimento seguro do número.

### Gatilhos de violação
- Contador diário >= limite.
- Dreno de follow-ups vencidos em rajada.
- Múltiplas respostas no mesmo minuto.

### Comportamento esperado
- **Enfileirar** mensagens excedentes.
- **Enviar** no próximo dia útil.
- **Registrar** o bloqueio no log.

### Exemplos

| Contexto | Ação correta |
|---|---|
| 30 mensagens já enviadas hoje | Enfileirar próxima para amanhã 7h |
| 25 follow-ups vencidos ao abrir | Enviar até 5 por ciclo (jitter) |
| Limite ajustado para 20 | Enfileirar a partir da 21ª |

### Detecção

```typescript
async function exceedsDailyLimit(numberId: string, now: Date): Promise<boolean> {
  const counter = await getDailyCounter(numberId, now);
  const limit = await getDailyLimit(numberId);
  return counter.messages_sent >= limit;
}
```

### Property test (AR-008)

```typescript
test('AR-008: nenhuma mensagem é enviada acima do limite', () => {
  fc.assert(
    fc.property(fc.integer({ min: 30, max: 100 }), async (count) => {
      const result = evaluatePolicy({
        dailyCounter: { messages_sent: count },
        ...baseContext,
      });
      return result.allowed === false && result.action === 'queue';
    })
  );
});
```

### Rastreabilidade
- Requisito: R-023
- Regra de negócio: RN-010, RN-011
- Critério de aceitação: AC-004
- ADR: ADR-009

---

## AR-009 — Processar Mídia Recebida

### Definição
O bot **NUNCA** deve transcrever, interpretar, analisar ou responder ao conteúdo de mídia recebida (áudio, imagem, PDF, vídeo, documento).

### Motivo
- IA não tem visão/áudio confiável.
- Erro de interpretação pode gerar resposta inadequada.
- Admin deve assumir para tratar mídia.

### Gatilhos de violação
- Lead envia áudio.
- Lead envia imagem.
- Lead envia PDF.
- IA tenta transcrever.

### Comportamento esperado
- **Registrar** o evento (tipo de mídia, timestamp).
- **Notificar** o Admin localmente.
- **Acionar handoff** para o Admin assumir.
- **Não** processar o conteúdo.

### Exemplos

| Contexto | Ação correta |
|---|---|
| Lead envia áudio | Registrar + Notificar + Handoff |
| Lead envia imagem | Registrar + Notificar + Handoff |
| Lead envia PDF | Registrar + Notificar + Handoff |
| Lead envia vídeo | Registrar + Notificar + Handoff |

### Detecção

```typescript
function isMediaMessage(message: IncomingMessage): boolean {
  return message.type !== 'text';
}
```

### Property test (AR-009)

```typescript
test('AR-009: nenhuma mídia é processada', () => {
  fc.assert(
    fc.property(fc.constantFrom('audio', 'image', 'pdf', 'video', 'document'), (type) => {
      const result = evaluatePolicy({
        context: { ...baseContext, lastMessageType: type },
        ...baseContext,
      });
      return result.allowed === false && result.action === 'handoff';
    })
  );
});
```

### Rastreabilidade
- Requisito: R-038
- Regra de negócio: RN-075, RN-076, RN-077
- Critério de aceitação: AC-012
- ADR: ADR-004

---

## AR-010 — Agir Após Handoff

### Definição
Após o handoff ser acionado, o bot **NUNCA** deve enviar mensagens até que o Admin assuma ou devolva explicitamente.

### Motivo
- Handoff é fronteira entre bot e humano.
- Após handoff, o Admin é responsável pela conversa.
- Bot pode atrapalhar a negociação.

### Gatilhos de violação
- Handoff ativo e IA tenta responder.
- Admin assumiu e IA ainda envia.
- Modo copiloto e IA envia sem aprovação.

### Comportamento esperado
- **Bloquear** toda mensagem automática.
- **Permitir** apenas sugestões (visíveis ao Admin).
- **Aguardar** ação explícita do Admin.

### Exemplos

| Contexto | Ação correta |
|---|---|
| Handoff por preço acionado | Bot em silêncio |
| Admin assumiu (copiloto) | Bot sugere, não envia |
| Admin devolveu ao bot | Modo automático retomado |
| Handoff por irritação | Silêncio total |

### Detecção

```typescript
function isHandoffActive(context: ConversationContext): boolean {
  return context.handoffActive === true;
}
```

### Property test (AR-010)

```typescript
test('AR-010: nenhuma mensagem é enviada com handoff ativo', () => {
  fc.assert(
    fc.property(fc.string(), (msg) => {
      const context = { ...baseContext, handoffActive: true };
      const result = evaluatePolicy({ message: msg, context, ... });
      return result.allowed === false && (result.action === 'silence' || result.action === 'block');
    })
  );
});
```

### Rastreabilidade
- Requisito: R-014, R-066
- Regra de negócio: RN-052, RN-053, RN-054
- Critério de aceitação: AC-019
- ADR: ADR-011 (painel)

---

## AR-011 — Contatar Sem Base Legal

### Definição
O bot **NUNCA** deve contatar um lead sem que **origem**, **base legal** e **finalidade** estejam registradas.

### Motivo
- LGPD exige base legal para tratamento de dados.
- Sem registro, não há como comprovar conformidade.
- ANPD pode questionar.

### Gatilhos de violação
- Lead importado sem registro de origem.
- Lead sem base legal.
- Lead sem finalidade.
- Tentativa de envio sem registro.

### Comportamento esperado
- **Bloquear** o envio.
- **Notificar** o Admin.
- **Exigir** preenchimento antes de prosseguir.

### Exemplos

| Contexto | Ação correta |
|---|---|
| Lead importado sem base legal | Bloquear envio + Notificar |
| Lead sem origem registrada | Bloquear envio + Notificar |
| Lead com tudo registrado | Permitir envio |

### Detecção

```typescript
function hasLegalBasis(lead: Lead): boolean {
  return (
    !!lead.origin &&
    !!lead.legalBasis &&
    !!lead.purpose
  );
}
```

### Property test (AR-011)

```typescript
test('AR-011: nenhuma mensagem é enviada sem base legal', () => {
  fc.assert(
    fc.property(fc.string(), (msg) => {
      const lead = { ...baseContext.lead, legalBasis: null };
      const result = evaluatePolicy({ context: { lead }, ... });
      return result.allowed === false && result.action === 'block';
    })
  );
});
```

### Rastreabilidade
- Requisito: R-064
- Regra de negócio: RN-069, RN-072
- Critério de aceitação: AC-017
- ADR: ADR-013 (LGPD)

---

## AR-012 — Tratar Preço como Objeção Comum

### Definição
O bot **NUNCA** deve tratar pedido de preço como objeção comum (a ser contornada). **Pedido de preço sempre aciona handoff.**

### Motivo
- Preço é decisão do Admin (AR-001).
- Contornar pedido de preço pode levar a IA a sugerir valores.
- Diferente de "está caro" (objeção), "quanto custa" é pedido direto.

### Gatilhos de violação
- Lead pergunta "quanto custa?".
- IA tenta contornar com "depende do escopo".
- IA sugere faixa de preço.

### Comportamento esperado
- **Bloquear** a mensagem.
- **Acionar handoff** imediato com motivo `PRICE_REQUEST`.
- **Não** tentar contornar.

### Exemplos

| Contexto | Resposta da IA (errada) | Ação correta |
|---|---|---|
| Lead: "Quanto custa?" | "Depende do escopo, mas fica entre X e Y" | ❌ Bloquear → Handoff |
| Lead: "Qual o valor?" | "Varia bastante..." | ❌ Bloquear → Handoff |
| Lead: "Me passa um valor" | Qualquer resposta com valor | ❌ Bloquear → Handoff |

**Diferença crítica:**
- "Está caro" → objeção → IA pode contornar (R-041).
- "Quanto custa?" → pedido de preço → handoff (AR-012).

### Detecção (prioridade sobre objeções)

```typescript
function classifyPriceRelated(message: string): 'PRICE_REQUEST' | 'OBJECTION_PRICE' | null {
  if (/(quanto (custa|fica|sai|é|vale)|qual o (valor|preço|custo)|me (manda|passa|envia) (um )?(valor|preço|orçamento))/i.test(message)) {
    return 'PRICE_REQUEST';
  }
  if (/(está|ta|é|acho que é) (muito )?(caro|salgado|elevado)|não tenho (verba|orçamento)|fora do meu orçamento/i.test(message)) {
    return 'OBJECTION_PRICE';
  }
  return null;
}
```

**Regra:** `PRICE_REQUEST` sempre aciona handoff. `OBJECTION_PRICE` pode ser contornada.

### Property test (AR-012)

```typescript
test('AR-012: pedido de preço sempre aciona handoff', () => {
  fc.assert(
    fc.property(fc.constantFrom(
      'Quanto custa um site?',
      'Qual o valor?',
      'Me passa um orçamento',
      'Quanto fica?'
    ), (msg) => {
      const result = evaluatePolicy({ message: msg, isIncoming: true, ...baseContext });
      return result.action === 'handoff' && result.handoffReason === 'PRICE_REQUEST';
    })
  );
});
```

### Rastreabilidade
- Requisito: R-012, R-041
- Regra de negócio: RN-040, RN-041
- Critério de aceitação: AC-007
- ADR: ADR-004

---

## Ordem de Avaliação no Gate

A ordem importa. O gate avalia nesta sequência:

| Ordem | Verificação | Ação | AR |
|---|---|---|---|
| 1 | Kill switch ativo | Bloquear | — |
| 2 | Base legal | Bloquear | AR-011 |
| 3 | Opt-out | Bloquear | AR-005 |
| 4 | Handoff ativo | Silêncio | AR-010 |
| 5 | Mídia recebida | Handoff | AR-009 |
| 6 | Preço/proposta | Handoff | AR-001, AR-002, AR-012 |
| 7 | Agendamento | Handoff | AR-003 |
| 8 | Mídia a enviar | Bloquear | AR-004 |
| 9 | Revelação de automação | Silêncio | AR-006 |
| 10 | Janela de envio | Enfileirar | AR-007 |
| 11 | Limite diário | Enfileirar | AR-008 |
| 12 | Permitir envio | Enviar | — |

---

## Matriz de Rastreabilidade

| AR | Requisito | Regra de Negócio | Critério de Aceitação | ADR | Property Test |
|---|---|---|---|---|---|
| AR-001 | R-012 | RN-042 | AC-007 | ADR-004 | ✅ |
| AR-002 | R-012 | RN-042 | AC-007 | ADR-004 | ✅ |
| AR-003 | R-012, R-025 | RN-057 | AC-008 | ADR-004 | ✅ |
| AR-004 | R-037 | RN-073 | AC-013 | ADR-004 | ✅ |
| AR-005 | R-024 | RN-063 a RN-067 | AC-011 | ADR-013 | ✅ |
| AR-006 | R-055, R-056, R-057 | RN-030, RN-031 | AC-009, AC-014 | ADR-012 | ✅ |
| AR-007 | R-006, R-058 | RN-006, RN-007 | AC-002 | ADR-009 | ✅ |
| AR-008 | R-023 | RN-010, RN-011 | AC-004 | ADR-009 | ✅ |
| AR-009 | R-038 | RN-075, RN-076 | AC-012 | ADR-004 | ✅ |
| AR-010 | R-014, R-066 | RN-052, RN-053 | AC-019 | ADR-011 | ✅ |
| AR-011 | R-064 | RN-069, RN-072 | AC-017 | ADR-013 | ✅ |
| AR-012 | R-012, R-041 | RN-040, RN-041 | AC-007 | ADR-004 | ✅ |

---

## Garantia de Invariância

Os 12 AR são garantidos por **três camadas**:

1. **Prompt da IA (ADR-012):** instruções explícitas ao modelo.
2. **Gate de envio (ADR-004):** validação determinística de código.
3. **Property tests (Fase 1 do GSD):** provas de invariância automatizadas.

**Se qualquer camada falhar, as outras seguram.** O sistema é **fail-closed**: se o gate não puder validar, **não envia**.

---

## Referências

- `docs/04-arquitetura.md` — gate de envio, seção 5
- `docs/09-criterios-de-aceitacao.md` — AC-021
- `docs/08-adr/004-gate-invariantes.md` — ADR do gate
- `docs/08-adr/012-prompt-persona.md` — ADR do prompt
- `docs/08-adr/013-lgpd-legitimo-interesse.md` — ADR da LGPD
- `.planning/ROADMAP.md` — Fase 1 (property tests)