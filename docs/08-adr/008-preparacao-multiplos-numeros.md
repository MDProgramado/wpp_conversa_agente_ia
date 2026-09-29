# ADR-008 — Preparação para Múltiplos Números de WhatsApp

- **Status:** Aceito
- **Data:** 2026-09-28
- **Decisores:** Admin (você), System Architect
- **Contexto:** Fase 1 — Fundação, Canal e Gate de Envio
- **Relacionado a:** R-059, R-016, R-015, R-023, R-039, R-040

---

## 1. Contexto

O usuário escolheu operar com **um único número dedicado** na fase piloto (R-059). Todavia, a operação pode evoluir para múltiplos números no futuro, por razões como:

- **Escala:** volume acima do que um número suporta com segurança.
- **Segregação:** números diferentes para prospecção, atendimento ou fechamento.
- **Regionalização:** números com DDD local para melhorar taxa de resposta.
- **Nichos:** números dedicados a setores específicos.
- **Resiliência:** se um número for banido, os outros continuam operando.
- **Aquecimento:** distribuir volume entre números em diferentes fases.

O dilema: implementar múltiplos números desde o início (complexidade) ou só depois (risco de refatoração cara)?

---

## 2. Decisão

**Preparar a arquitetura para múltiplos números desde o início, mas operar com apenas um número na fase piloto.**

### O que será implementado agora (Fase 1)

- **Tabela `whatsapp_numbers`** no schema, mesmo que só com um registro.
- **Campo `number_id`** nas tabelas `conversations`, `messages`, `followups`, `daily_counters`.
- **Adapter de canal** com suporte a múltiplas instâncias (mesmo que só uma seja usada).
- **Camada de limites** por número (não global).
- **UI** preparada para exibir número associado (mesmo que só um).

### O que NÃO será implementado agora

- Múltiplas sessões ativas simultaneamente.
- Rotação automática entre números.
- Balanceamento de carga entre números.
- UI de gestão de múltiplos números.
- Atribuição de leads por número.
- Aquecimento paralelo.

### Quando ativar (Fase de Expansão)

- Quando o volume justificar.
- Quando o número único estiver estável e aquecido.
- Quando houver necessidade de segregação (prospecção vs. atendimento).
- Quando houver risco de banimento que exija redundância.

---

## 3. Justificativa

### Por que preparar agora?

- **Custo baixo:** adicionar `number_id` no schema é trivial.
- **Evita refatoração cara:** se implementar só depois, seria necessário migrar dados, refatorar consultas, refazer UI.
- **Isolamento desde o início:** limites, contadores e sessões já pensam por número.
- **Preparação para resiliência:** se o número único for banido, um novo número pode ser adicionado sem reescrever.
- **Alinhamento com R-016:** a estratégia híbrida prevê evolução de canal.

### Por que não implementar agora?

- **Foco no piloto:** validar o fluxo com um número é a prioridade.
- **Complexidade desnecessária:** múltiplas sessões, gestão de QR Codes, aquecimento paralelo.
- **Risco de erro:** mais números = mais risco de banimento agregado.
- **Custo de API oficial:** na fase oficial, cada número tem custo.
- **Single-number é mais simples:** menos bugs, menos casos de borda.

### Por que não ignorar múltiplos números?

- **R-059 diz que é um número *agora*:** não significa que sempre será.
- **Evolução natural:** operações B2B em escala tendem a ter múltiplos números.
- **Resiliência:** número único é ponto único de falha.
- **Segregação:** à medida que a equipe entrar, pode fazer sentido separar.

---

## 4. Consequências

### Positivas

- **Evolução suave:** adicionar um segundo número será incremental.
- **Isolamento por número:** limites, contadores, logs e sessões ficam claros.
- **Resiliência preparada:** se o número único for banido, é possível adicionar outro rapidamente.
- **Sem retrabalho:** o schema já prevê o campo.
- **Auditoria por número:** relatórios podem ser filtrados por número.

### Negativas

- **Schema com campo extra:** `number_id` sempre aponta para o número único (na Fase 1).
- **UI com espaço reservado:** pode parecer incompleto.
- **Complexidade latente:** a camada de limites precisa considerar o número.
- **Adapter com suporte a múltiplas instâncias:** mesmo que só uma seja usada.

### Riscos residuais

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Campos ficarem inconsistentes | Baixa | Médio | Constraints + validação |
| UI parecer incompleta | Média | Baixo | Ocultar seletor de número |
| Limites globais confundirem | Média | Médio | Documentar que limites são por número |
| Adicionar número novo sem aquecer | Média | Alto | Sugerir aquecimento ao cadastrar |
| Conflito de sessão | Baixa | Alto | Um número = uma sessão ativa |
| Rotação mal configurada (futuro) | Média | Alto | Regras claras na fase de expansão |

---

## 5. Alternativas consideradas

### Alternativa A — Implementar múltiplos números desde o início

- **Prós:** pronto para escalar.
- **Contras:** complexidade alta, atrasa o MVP, mais risco.
- **Por que não:** a prioridade é validar o piloto com um número.

### Alternativa B — Ignorar múltiplos números

- **Prós:** simplicidade máxima.
- **Contras:** refatoração cara depois, número único como ponto único de falha.
- **Por que não:** o usuário quer preparar.

### Alternativa C — Preparar apenas o mínimo (só `number_id`)

- **Prós:** mais simples.
- **Contras:** adapter precisaria ser refatorado depois.
- **Por que não:** preparar o adapter com suporte a múltiplas instâncias é barato e evita retrabalho.

### Alternativa D — Usar múltiplos números imediatamente

- **Prós:** distribui risco, permite segregação.
- **Contras:** viola R-059, complica aquecimento, multiplica risco.
- **Por que não:** o usuário escolheu número único no piloto.

---

## 6. Implementação

### 6.1. Schema preparado (Fase 1)

```sql
-- Tabela de números de WhatsApp
CREATE TABLE whatsapp_numbers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone           TEXT NOT NULL UNIQUE,
  label           TEXT,                              -- ex.: "Prospecção", "Atendimento"
  channel_type    TEXT NOT NULL DEFAULT 'BAILEYS',   -- BAILEYS, OFFICIAL
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  warmup_phase    INT DEFAULT 1,                     -- 1–5
  daily_limit     INT DEFAULT 30,                    -- 20–30
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Inserir apenas um número na Fase 1
INSERT INTO whatsapp_numbers (phone, label, channel_type)
VALUES ('+5511999999999', 'Principal', 'BAILEYS');

-- Campo number_id nas tabelas existentes
ALTER TABLE conversations ADD COLUMN number_id UUID REFERENCES whatsapp_numbers(id);
ALTER TABLE messages ADD COLUMN number_id UUID REFERENCES whatsapp_numbers(id);
ALTER TABLE followups ADD COLUMN number_id UUID REFERENCES whatsapp_numbers(id);
ALTER TABLE daily_counters ADD COLUMN number_id UUID REFERENCES whatsapp_numbers(id);

-- Ajustar PK de daily_counters para composta
-- (date, number_id) em vez de apenas date
```

### 6.2. Camada de limites por número

```typescript
// src/gate/dailyLimit.ts

export async function getDailyCounter(numberId: string, date: Date): Promise<DailyCounter> {
  return db.queryOne(
    'SELECT * FROM daily_counters WHERE date = $1 AND number_id = $2',
    [date, numberId]
  );
}

export async function incrementDailyCounter(numberId: string, date: Date, type: 'message' | 'lead') {
  await db.query(
    `INSERT INTO daily_counters (date, number_id, messages_sent, leads_contacted)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (date, number_id) DO UPDATE SET
       messages_sent = daily_counters.messages_sent + $3,
       leads_contacted = daily_counters.leads_contacted + $4`,
    [date, numberId, type === 'message' ? 1 : 0, type === 'lead' ? 1 : 0]
  );
}
```

### 6.3. Adapter com suporte a múltiplas instâncias

```typescript
// src/channel/manager.ts

export class ChannelManager {
  private adapters: Map<string, ChannelAdapter> = new Map();

  async connect(numberId: string, config: ChannelConfig): Promise<void> {
    const adapter = createAdapter(config);
    await adapter.connect();
    this.adapters.set(numberId, adapter);
  }

  getAdapter(numberId: string): ChannelAdapter {
    const adapter = this.adapters.get(numberId);
    if (!adapter) throw new Error(`Adapter não encontrado: ${numberId}`);
    return adapter;
  }

  async disconnect(numberId: string): Promise<void> {
    const adapter = this.adapters.get(numberId);
    if (adapter) {
      await adapter.disconnect();
      this.adapters.delete(numberId);
    }
  }
}
```

Na Fase 1, apenas um adapter é registrado.

### 6.4. UI preparada

- Seletor de número oculto (só um número ativo).
- Exibir número associado em cada conversa (útil para auditoria).
- Configurações de número único, com espaço para adicionar novos no futuro.

### 6.5. Rotação e balanceamento (futuro)

Regras a definir na fase de expansão:

- **Rotação por nicho:** cada número atende um conjunto de nichos.
- **Rotação por região:** cada número tem DDD de uma região.
- **Rotação por fase de aquecimento:** números em aquecimento recebem volume menor.
- **Rotação por carga:** distribuir leads entre números ativos.
- **Fallback:** se um número for banido, redirecionar conversas para outro.

### 6.6. Aquecimento por número

Cada número tem sua própria fase de aquecimento (R-039, R-040):

```sql
-- Campo warmup_phase em whatsapp_numbers
UPDATE whatsapp_numbers SET warmup_phase = 2 WHERE id = '...';
```

Limites diários são calculados por número, com base na fase:

```typescript
function getDailyLimitForNumber(number: WhatsappNumber): number {
  const phaseLimits = {
    1: 10,   // Repouso ativo
    2: 15,   // Aquecimento leve
    3: 20,   // Aquecimento moderado
    4: 25,   // Transição
    5: 30,   // Operação normal
  };
  return phaseLimits[number.warmup_phase] || 30;
}
```

---

## 7. Configuração

```typescript
// src/config/settings.ts

export interface MultiNumberSettings {
  multiNumberEnabled: false;       // Fase 1: false
  defaultNumberId: string;         // ID do número único
  limitsPerNumber: true;           // limites são por número, não globais
  rotationEnabled: false;          // Fase 1: false
  rotationStrategy?: 'NICHE' | 'REGION' | 'WARMUP' | 'LOAD' | 'FALLBACK';
}
```

---

## 8. Critérios de sucesso da decisão

- **Fase 1:** o sistema opera com um número sem erros de schema.
- **Fase 1:** os limites diários são contabilizados por número.
- **Fase Expansão:** é possível adicionar um segundo número sem refatoração estrutural.
- **Fase Expansão:** a rotação entre números funciona sem perda de conversas ou leads.
- **Resiliência:** se o número único for banido, é possível adicionar outro rapidamente.

---

## 9. Referências

- `docs/04-arquitetura.md` — schema com `whatsapp_numbers`
- `docs/08-adr/001-canal-hibrido.md` — ADR do canal
- `docs/08-adr/006-multiusuario-futuro.md` — ADR do multiusuário
- `docs/03-regras-de-negocio.md` — RN-006 a RN-014 (limites), RN-096 a RN-100 (aquecimento)
- R-015, R-016, R-023, R-039, R-040, R-059