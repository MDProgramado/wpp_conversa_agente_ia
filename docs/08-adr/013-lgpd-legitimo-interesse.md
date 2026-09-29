# ADR-013 — LGPD: Legítimo Interesse para Contato B2B sem Opt-in

- **Status:** Aceito (com risco assumido e recomendações)
- **Data:** 2026-09-28
- **Decisores:** Admin (você), System Architect
- **Contexto:** Fase 1 — Fundação, Canal e Gate de Envio
- **Relacionado a:** R-024, R-063, R-064, R-033, AR-005, AR-011

---

## 1. Contexto

O sistema faz prospecção ativa B2B via WhatsApp com leads obtidos da API do sistema de caça-leads. Esses leads:

- **Não possuem opt-in explícito** (R-063).
- São dados de fontes públicas ou de terceiros.
- Contêm nome, telefone e endereço.
- Serão contatados comercialmente pela primeira vez pelo Admin.

A LGPD (Lei 13.709/2018) exige **base legal** para o tratamento de dados pessoais. As bases possíveis incluem:

1. **Consentimento** (art. 7º, I) — o titular autoriza.
2. **Legítimo interesse** (art. 7º, IX) — o controlador tem interesse legítimo, desde que não prevaleçam direitos do titular.
3. **Execução de contrato** (art. 7º, V) — se houver relação contratual.
4. **Cumprimento de obrigação legal** (art. 7º, II).

O usuário escolheu **(a) legítimo interesse**, com avaliação, transparência e opt-out.

**Além da LGPD**, há também as **políticas do WhatsApp/Meta**, que exigem opt-in para mensagens iniciadas pelo negócio — o que é incompatível com a prospecção ativa sem consentimento. Isso afeta diretamente a viabilidade de migrar para a API oficial (ADR-001).

---

## 2. Decisão

Adotar **legítimo interesse** como base legal para o contato comercial B2B, com as seguintes obrigações:

### 2.1. Avaliação de legítimo interesse (LIA simplificada)

Documentar, para cada campanha ou conjunto de leads:

- **Interesse legítimo:** prospecção comercial B2B de serviços de programação.
- **Necessidade:** contato direto é necessário para oferta comercial.
- **Proporcionalidade:** dados mínimos (nome, telefone, endereço); finalidade limitada.
- **Expectativa do titular:** contato profissional relacionado à atividade da empresa.
- **Salvaguardas:** opt-out imediato, transparência, retenção limitada.

### 2.2. Transparência

- Mencionar na primeira mensagem (ou em mensagem acessível) a origem do contato, se aplicável.
- Disponibilizar canal para o titular exercer direitos (opt-out, acesso, exclusão).
- Não ocultar a finalidade comercial do contato.

### 2.3. Opt-out

- Detecção automática de pedido de opt-out (R-024).
- Marcação imediata como "não contatar" (AR-005).
- Interrupção de toda automação.
- Registro de data, hora e conteúdo.
- Nenhuma tentativa de reversão.

### 2.4. Direitos do titular

- **Acesso:** o titular pode solicitar quais dados estão armazenados.
- **Correção:** o titular pode corrigir dados incorretos.
- **Exclusão:** o titular pode solicitar exclusão dos dados.
- **Portabilidade:** o titular pode solicitar exportação.
- **Informação:** o titular pode saber com quem os dados foram compartilhados.

### 2.5. Retenção

- Dados mantidos apenas pelo tempo necessário à finalidade.
- Leads sem interação após 12 meses (a definir) entram em revisão.
- Leads com opt-out têm dados mantidos apenas pelo tempo mínimo legal (registro da solicitação).
- Exclusão sob solicitação em até 15 dias (a definir).

### 2.6. Segurança

- **Sem criptografia local** (R-033) — risco assumido.
- Recomendações: BitLocker, senha forte, antivírus, backup fora de nuvem.
- Dados enviados à API de IA são **mascarados** (R-009, RNF-062).

### 2.7. Registro

- Cada lead tem origem, base legal e finalidade registradas (R-064).
- Cada opt-out tem data, hora e conteúdo registrados.
- Cada exclusão tem registro.
- Logs de contato são mantidos para auditoria.

---

## 3. Justificativa

### Por que legítimo interesse?

- **Viabilidade:** sem opt-in, é a única base legal razoável para prospecção B2B.
- **Previsão legal:** a LGPD prevê legítimo interesse como base válida.
- **Contexto B2B:** contato profissional tem expectativa social diferente de B2C.
- **Flexibilidade:** permite iniciar a conversa e obter consentimento depois, se necessário.

### Por que não consentimento?

- **Inviável:** não há como obter consentimento antes do primeiro contato.
- **Fricção:** pedir consentimento antes de qualquer conversa reduz conversão a quase zero.
- **Prática:** no B2B, o consentimento costuma ser obtido durante a conversa, não antes.

### Por que não execução de contrato?

- **Não se aplica:** não há relação contratual prévia com o lead.
- **Não cobre:** prospecção ativa não é execução de contrato.

### Por que não cumprimento de obrigação legal?

- **Não se aplica:** não há obrigação legal de contatar o lead.

### Por que documentar a avaliação?

- **LGPD exige:** o legítimo interesse precisa ser avaliado e documentado.
- **Defesa:** em caso de questionamento da ANPD, a avaliação é a prova.
- **Transparência:** demonstra que o controlador levou a sério a base legal.

### Por que transparência?

- **LGPD exige:** o titular tem direito à informação.
- **Confiança:** transparência reduz risco de denúncia.
- **Ética:** contato comercial deve ser claro sobre sua finalidade.

### Por que opt-out imediato?

- **LGPD exige:** o titular pode se opor ao tratamento.
- **Políticas do WhatsApp:** opt-out é obrigatório.
- **Reputação:** respeitar opt-out preserva a marca.
- **Risco:** ignorar opt-out pode gerar denúncia, bloqueio e banimento.

---

## 4. Consequências

### Positivas

- **Viabilidade:** permite iniciar a prospecção B2B sem opt-in prévio.
- **Conformidade:** base legal documentada e aplicada.
- **Transparência:** titular informado sobre finalidade e origem.
- **Controle:** opt-out imediato e direitos do titular respeitados.
- **Auditoria:** registros completos de base legal, opt-out e exclusão.
- **Defesa:** documentação para eventual questionamento da ANPD.

### Negativas

- **Risco regulatório:** legítimo interesse é interpretativo; pode ser questionado.
- **Risco de banimento:** WhatsApp/Meta pode bloquear por prospecção ativa sem opt-in.
- **Incompatibilidade com API oficial:** a API oficial exige opt-in para mensagens iniciadas pelo negócio.
- **Necessidade de LIA:** exige documento de avaliação (mesmo simplificado).
- **Necessidade de transparência:** aumenta complexidade das mensagens.
- **Risco de denúncia:** leads podem se sentir incomodados e denunciar.

### Riscos residuais

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| ANPD questiona legítimo interesse | Média | Alto | LIA documentada + transparência + opt-out |
| WhatsApp/Meta bloqueia número | Alta | Alto | Volume conservador + aquecimento + opt-out |
| Lead denuncia | Média | Alto | Opt-out imediato + tom consultivo |
| Vazamento de dados (sem criptografia) | Média | Alto | Recomendações de segurança + LGPD |
| Dados retidos além do necessário | Média | Médio | Política de retenção + revisão periódica |
| Titular não consegue exercer direitos | Baixa | Alto | Canal claro + processo de atendimento |
| API de IA recebe dados sensíveis | Média | Alto | Mascaramento + minimização |
| Falta de registro de base legal | Baixa | Alto | Gate (AR-011) + registro automático |

---

## 5. Alternativas consideradas

### Alternativa A — Consentimento prévio

- **Prós:** base legal mais robusta, alinhada com API oficial.
- **Contras:** inviável na prática (não há como pedir antes do contato).
- **Por que não:** fricção mata a prospecção.

### Alternativa B — Execução de contrato

- **Prós:** base legal clara quando aplicável.
- **Contras:** não cobre prospecção ativa.
- **Por que não:** não se aplica.

### Alternativa C — Cumprimento de obrigação legal

- **Prós:** base legal clara.
- **Contras:** não se aplica.
- **Por que não:** não há obrigação legal de contatar.

### Alternativa D — Não fazer prospecção ativa

- **Prós:** zero risco regulatório e de banimento.
- **Contras:** inviabiliza o projeto.
- **Por que não:** o objetivo é justamente prospectar.

### Alternativa E — Prospecção apenas por e-mail

- **Prós:** menos risco de banimento.
- **Contras:** fora do escopo (foco é WhatsApp).
- **Por que não:** o usuário escolheu WhatsApp.

---

## 6. Implementação

### 6.1. Avaliação de Legítimo Interesse (LIA simplificada)

```markdown
# Avaliação de Legítimo Interesse — Prospecção B2B via WhatsApp

## 1. Controlador
- Nome: [Seu nome / agência]
- Contato: [e-mail para exercício de direitos]

## 2. Interesse legítimo
- Prospecção comercial B2B de serviços de programação (sites, sistemas, automações).
- Contato direto com empresas com potencial de contratar esses serviços.

## 3. Necessidade
- O contato via WhatsApp é necessário para oferta comercial.
- Não há meio menos invasivo igualmente eficaz para o contexto B2B.
- A abordagem inicial é manual e personalizada.

## 4. Proporcionalidade
- Dados tratados: nome, telefone, endereço (mínimos necessários).
- Finalidade: contato comercial B2B.
- Não há tratamento de dados sensíveis.

## 5. Expectativa do titular
- Contato profissional relacionado à atividade da empresa.
- O titular é uma pessoa jurídica ou profissional atuando em contexto B2B.
- A abordagem é inicial e respeitosa.

## 6. Salvaguardas
- Opt-out imediato em todas as conversas.
- Transparência sobre a finalidade do contato.
- Retenção limitada ao necessário.
- Direitos do titular respeitados (acesso, correção, exclusão).
- Dados mascarados antes de envio à API de IA.

## 7. Balanceamento
- O interesse legítimo do controlador prevalece sobre os direitos do titular?
  - Sim, dado o contexto B2B, a finalidade comercial legítima e as salvaguardas.
- Há risco desproporcional ao titular?
  - Não, pois os dados são mínimos, o opt-out é imediato e a finalidade é profissional.

## 8. Decisão
- Base legal adotada: Legítimo interesse.
- Data: 2026-09-28.
- Responsável: [Admin].
- Revisão: anual ou em caso de mudança relevante.
```

### 6.2. Registro automático de base legal

```typescript
// src/compliance/legalBasis.ts

export async function registerLegalBasis(lead: Lead, params: SearchParams) {
  await db.insert('legal_basis_records', {
    lead_id: lead.id,
    basis: 'LEGITIMO_INTERESSE',
    purpose: 'CONTATO_COMERCIAL_B2B',
    origin: params.origin,           // ex.: "Busca SP/Campinas/Padarias"
    origin_date: new Date(),
    lia_reference: 'LIA-v1',         // referência ao documento
    created_at: new Date(),
  });
}
```

### 6.3. Bloqueio de contato sem base legal

```typescript
// src/gate/evaluatePolicy.ts

export function evaluatePolicy(input: PolicyInput): PolicyResult {
  // AR-011 — base legal
  if (!hasLegalBasis(input.context.lead)) {
    return {
      allowed: false,
      action: 'block',
      reason: 'AR-011',
      details: 'Lead sem base legal registrada',
    };
  }

  // ... demais ARs
}
```

### 6.4. Detecção de opt-out

```typescript
// src/compliance/optout.ts

const OPTOUT_PATTERNS = [
  /\b(não quero|pare|para) (de )?(me )?(mandar|enviar|receber|contatar)/i,
  /\b(me (tira|remove|exclui) (da|de) (lista|contato))/i,
  /\b(não me (manda|envia|contata) mais)/i,
  /\b(descadastr[ao]|unsubscribe|opt.?out)/i,
  /\b(bloque[ae]|denunci[ae])/i,
];

export function detectOptOut(message: string): boolean {
  return OPTOUT_PATTERNS.some((p) => p.test(message));
}

export async function registerOptOut(lead: Lead, message: string) {
  await db.query(
    `UPDATE leads
     SET opt_out = TRUE, opt_out_at = NOW(), opt_out_content = $1
     WHERE id = $2`,
    [message, lead.id]
  );

  await db.query(
    `UPDATE followups SET status = 'CANCELLED', cancelled_reason = 'OPTOUT'
     WHERE lead_id = $1 AND status = 'PENDING'`,
    [lead.id]
  );

  await db.insert('logs', {
    level: 'CRITICAL',
    module: 'compliance.optout',
    message: 'Opt-out registrado',
    context: { leadId: lead.id, content: message },
    lead_id: lead.id,
  });
}
```

### 6.5. Direitos do titular

```typescript
// src/compliance/dataSubjectRights.ts

export async function handleDataSubjectRequest(request: DataSubjectRequest) {
  switch (request.type) {
    case 'ACCESS':
      return await exportLeadData(request.leadId);
    case 'CORRECTION':
      return await correctLeadData(request.leadId, request.corrections);
    case 'DELETION':
      return await deleteLeadData(request.leadId);
    case 'PORTABILITY':
      return await exportLeadData(request.leadId, 'JSON');
    case 'INFORMATION':
      return await listDataSharing(request.leadId);
    default:
      throw new Error('Tipo de solicitação inválido');
  }
}

export async function deleteLeadData(leadId: string) {
  await db.transaction(async (tx) => {
    await tx.query('DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE lead_id = $1)', [leadId]);
    await tx.query('DELETE FROM conversations WHERE lead_id = $1', [leadId]);
    await tx.query('DELETE FROM followups WHERE lead_id = $1', [leadId]);
    await tx.query('DELETE FROM notes WHERE lead_id = $1', [leadId]);
    await tx.query('DELETE FROM tasks WHERE lead_id = $1', [leadId]);
    await tx.query('DELETE FROM lead_tags WHERE lead_id = $1', [leadId]);
    await tx.query('DELETE FROM audit_status_changes WHERE lead_id = $1', [leadId]);
    await tx.query('DELETE FROM legal_basis_records WHERE lead_id = $1', [leadId]);

    // Manter registro de opt-out (tempo mínimo legal)
    await tx.query('UPDATE leads SET name = NULL, phone = NULL, address = NULL, deleted_at = NOW() WHERE id = $1', [leadId]);

    await tx.query('INSERT INTO deletion_audit (lead_id, deleted_at, reason) VALUES ($1, NOW(), $2)', [leadId, 'DATA_SUBJECT_REQUEST']);
  });
}
```

### 6.6. Política de retenção

```typescript
// src/compliance/retention.ts

export async function applyRetentionPolicy() {
  // Leads sem interação há mais de 12 meses (a definir)
  const stale = await db.query(`
    SELECT id FROM leads
    WHERE updated_at < NOW() - INTERVAL '12 months'
      AND opt_out = FALSE
      AND status NOT IN ('FECHADO', 'PERDIDO')
  `);

  for (const lead of stale.rows) {
    await db.insert('retention_review', {
      lead_id: lead.id,
      action: 'REVIEW',
      scheduled_at: new Date(),
    });
  }

  // Leads com opt-out mantidos por tempo mínimo legal
  const optedOut = await db.query(`
    SELECT id FROM leads
    WHERE opt_out = TRUE
      AND opt_out_at < NOW() - INTERVAL '5 years'
  `);

  for (const lead of optedOut.rows) {
    await deleteLeadData(lead.id);
  }
}
```

### 6.7. Transparência na primeira mensagem

A primeira mensagem (manual) deve mencionar a origem do contato, se aplicável:

```
Olá, [Nome]! Tudo bem?

Vi que você atua com [contexto] na região de [cidade/região]
[ou: "Encontrei seu contato em uma busca por empresas de X na região"].
Trabalho com presença digital para negócios locais e queria entender
se faz sentido conversarmos.

Posso te fazer uma pergunta rápida?

Se não quiser receber mensagens, é só me avisar que não envio mais.
```

### 6.8. Tabelas de compliance

```sql
CREATE TABLE legal_basis_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         UUID NOT NULL REFERENCES leads(id),
  basis           TEXT NOT NULL,           -- LEGITIMO_INTERESSE
  purpose         TEXT NOT NULL,           -- CONTATO_COMERCIAL_B2B
  origin          TEXT NOT NULL,
  origin_date     TIMESTAMPTZ NOT NULL,
  lia_reference   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE deletion_audit (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         UUID NOT NULL,
  deleted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason          TEXT NOT NULL
);

CREATE TABLE retention_review (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         UUID NOT NULL REFERENCES leads(id),
  action          TEXT NOT NULL,           -- REVIEW, DELETE, ANONYMIZE
  scheduled_at    TIMESTAMPTZ NOT NULL,
  executed_at     TIMESTAMPTZ,
  notes           TEXT
);

CREATE TABLE data_subject_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         UUID REFERENCES leads(id),
  type            TEXT NOT NULL,           -- ACCESS, CORRECTION, DELETION, PORTABILITY, INFORMATION
  received_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at    TIMESTAMPTZ,
  status          TEXT NOT NULL DEFAULT 'PENDING'
);
```

---

## 7. Configuração

```typescript
// src/config/settings.ts

export interface ComplianceSettings {
  legalBasis: {
    default: 'LEGITIMO_INTERESSE';
    purpose: 'CONTATO_COMERCIAL_B2B';
    liaReference: string;              // 'LIA-v1'
    requireRegistration: true;         // AR-011
  };
  transparency: {
    mentionOrigin: true;
    offerOptOutInFirstMessage: true;
  };
  optOut: {
    autoDetect: true;
    irreversible: true;                // AR-005
    registerContent: true;
  };
  dataSubjectRights: {
    accessEnabled: true;
    correctionEnabled: true;
    deletionEnabled: true;
    portabilityEnabled: true;
    informationEnabled: true;
    responseDeadlineDays: 15;          // a definir
  };
  retention: {
    staleLeadMonths: 12;               // a definir
    optOutRetentionYears: 5;           // a definir
    reviewPeriodically: true;
  };
  security: {
    encryptionEnabled: false;          // R-033
    maskBeforeAI: true;                // RNF-062
    recommendBitLocker: true;
    warnSyncedFolders: true;
  };
}
```

---

## 8. Critérios de sucesso da decisão

- **Base legal registrada:** 100% dos leads têm origem, base legal e finalidade.
- **Opt-out respeitado:** 100% dos pedidos detectados e aplicados.
- **Direitos do titular:** todos os tipos de solicitação respondidos dentro do prazo.
- **Retenção:** política aplicada periodicamente.
- **Transparência:** primeira mensagem menciona finalidade e oferece opt-out.
- **Sem violação:** nenhuma mensagem enviada sem base legal (AR-011).
- **LIA documentada:** avaliação de legítimo interesse disponível.

---

## 9. Aviso legal

Esta decisão **não substitui** a consultoria jurídica especializada. A LGPD é interpretativa e a ANPD pode questionar a base legal adotada.

**Recomendação forte:** validar com advogado especializado em LGPD antes de operar em produção.

**Riscos não mitigados pelo sistema:**
- Interpretação da ANPD sobre legítimo interesse em prospecção B2B.
- Políticas do WhatsApp/Meta sobre automação e opt-in.
- Vazamento de dados por falta de criptografia (R-033).

---

## 10. Referências

- `docs/03-regras-de-negocio.md` — RN-063 a RN-072
- `docs/09-criterios-de-aceitacao.md` — AC-011, AC-017
- `docs/08-adr/005-sem-criptografia.md` — ADR de criptografia
- `docs/10-anti-requisitos.md` — AR-005, AR-011
- R-024, R-033, R-063, R-064
- LGPD (Lei 13.709/2018), art. 7º, IX
- Guia Orientativo da ANPD sobre Legítimo Interesse