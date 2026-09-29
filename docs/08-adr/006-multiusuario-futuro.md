# ADR-006 — Multiusuário Preparado, Single-User na Fase Piloto

- **Status:** Aceito
- **Data:** 2026-09-28
- **Decisores:** Admin (você), System Architect
- **Contexto:** Fase 1 — Fundação, Canal e Gate de Envio
- **Relacionado a:** R-027, R-028, R-029, R-030, R-049, R-050

---

## 1. Contexto

O usuário opera hoje como **agência/estúdio com equipe** (R-048), mas quer começar o piloto **sozinho** (R-027, R-049). A equipe continuará fazendo prospecção manual até que o sistema atinja os critérios de sucesso do piloto (R-061, R-062).

Se o piloto der certo, o sistema será liberado para a equipe, com:

- **Admin** (você): acesso total.
- **Vendedor**: vê e assume apenas leads atribuídos a ele. Não dispara campanhas, não aprova mensagens, não acessa financeiro nem configurações (R-030).

O dilema: implementar multiusuário desde o início (complexidade) ou só depois (risco de refatoração)?

---

## 2. Decisão

**Preparar a arquitetura para multiusuário desde o início, mas operar como single-user na fase piloto.**

### O que será implementado agora (Fase 1)

- **Campos no schema** para `assigned_to`, `created_by`, `changed_by`.
- **Tabela `users`** vazia ou com apenas o Admin.
- **Tabela `audit_status_changes`** já com `changed_by`.
- **Registros de log** com `user_id` (opcional nesta fase).
- **Interface de UI** com espaço reservado para "Responsável" (embora só o Admin apareça).

### O que NÃO será implementado agora

- Login local com múltiplos usuários.
- Perfis e permissões ativos.
- Fila de atribuição de leads.
- Fluxo de aprovação de mensagens.
- Restrições de acesso por perfil na UI.
- Auditoria por usuário ativo (só o Admin existe).

### Quando ativar (Fase de Expansão)

Quando o piloto atingir os critérios de sucesso (R-061, R-062):

- Criar tabela `users` com perfis.
- Ativar login local (usuário + senha).
- Implementar permissões por perfil.
- Ativar atribuição de leads.
- Ativar auditoria por usuário.
- Implementar UI de gestão de usuários.

---

## 3. Justificativa

### Por que preparar agora?

- **Custo baixo:** adicionar campos `assigned_to`, `created_by`, `changed_by` no schema é trivial.
- **Evita refatoração cara:** se implementar só depois, seria necessário alterar schema, migrar dados, refatorar consultas e refazer UI.
- **Rastreabilidade desde o início:** auditoria com `changed_by` já registra o Admin, mesmo que só ele use.
- **Alinhamento com R-028:** o requisito diz explicitamente "preparar para multiusuário".
- **Flexibilidade:** quando a equipe entrar, a base já está pronta.

### Por que não implementar agora?

- **Foco no piloto:** a prioridade é validar o fluxo, não gerenciar usuários.
- **Complexidade desnecessária:** login, perfis, permissões, aprovações — tudo isso adiciona camadas que não são necessárias agora.
- **Risco de atrasar o MVP:** o MVP (R-060) não inclui multiusuário ativo.
- **Single-user é mais simples:** menos bugs, menos casos de borda, mais velocidade.
- **A equipe continua manual:** não há urgência em liberar o sistema para outros.

### Por que não ignorar multiusuário totalmente?

- **R-028 exige preparação.**
- **A empresa já tem equipe** (R-048).
- **A intenção é expandir** (R-049).
- **Refatorar depois custaria mais** do que preparar agora.

---

## 4. Consequências

### Positivas

- **Evolução suave:** a transição para multiusuário será incremental, sem reescrita.
- **Auditoria desde o início:** toda mudança de status registra quem mudou.
- **Atribuição futura:** o campo `assigned_to` já existe; basta ativar.
- **Sem retrabalho:** a UI pode reservar espaço para "Responsável" desde já.
- **Alinhamento com R-028:** requisito atendido.

### Negativas

- **Schema com campos não usados:** `assigned_to` fica sempre apontando para o Admin (ou NULL).
- **UI com espaço reservado:** pode parecer incompleto.
- **Complexidade latente:** campos de auditoria precisam ser preenchidos corretamente mesmo em single-user.

### Riscos residuais

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Campos ficarem inconsistentes | Baixa | Médio | Constraints + validação |
| UI parecer incompleta | Média | Baixo | Ocultar campos até ativação |
| Esquecer de ativar permissões | Média | Alto | Checklist na fase de expansão |
| Migração de dados mal feita | Baixa | Alto | Testes + backup antes |
| Conflito de atendimento | Média | Alto | Regra de bloqueio: 1 lead = 1 responsável |

---

## 5. Alternativas consideradas

### Alternativa A — Implementar multiusuário desde o início

- **Prós:** pronto para a equipe desde o dia 1.
- **Contras:** complexidade, atrasa o MVP, adiciona bugs.
- **Por que não:** a equipe ainda não vai usar; o piloto é single-user.

### Alternativa B — Ignorar multiusuário completamente

- **Prós:** simples, foco total no MVP.
- **Contras:** refatoração cara depois, viola R-028.
- **Por que não:** o usuário quer preparar.

### Alternativa C — Preparar apenas o mínimo (só `assigned_to`)

- **Prós:** mais simples que preparar tudo.
- **Contras:** auditoria ficaria incompleta, permissões exigiriam refatoração.
- **Por que não:** preparar auditoria e `changed_by` é barato e útil desde já.

### Alternativa D — Usar um CRM externo com multiusuário

- **Prós:** pronto.
- **Contras:** viola R-044 (sem integrações externas além das essenciais).
- **Por que não:** o usuário quer CRM local.

---

## 6. Implementação

### 6.1. Schema preparado (Fase 1)

```sql
-- Tabela de usuários (preparada, mas com apenas o Admin)
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  email           TEXT UNIQUE,
  role            TEXT NOT NULL DEFAULT 'ADMIN',  -- ADMIN, VENDEDOR
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Inserir apenas o Admin na Fase 1
INSERT INTO users (name, role) VALUES ('Admin', 'ADMIN');

-- Campos de responsabilidade já nas tabelas existentes
-- leads.assigned_to UUID REFERENCES users(id)
-- audit_status_changes.changed_by UUID REFERENCES users(id)
-- messages.sender já tem 'ADMIN', 'IA', 'LEAD' — pode evoluir para user_id
```

### 6.2. Fase de Expansão — O que ativar

| Item | Fase 1 (agora) | Fase Expansão |
|---|---|---|
| Tabela `users` | Criada, só Admin | Múltiplos usuários |
| Login local | Não | Sim (usuário + senha) |
| Perfis | Apenas Admin | Admin + Vendedor |
| Permissões na UI | Não | Sim, por perfil |
| Atribuição de leads | Não (só Admin) | Sim |
| Fila de atribuição | Não | Sim |
| Auditoria por usuário | `changed_by` preenchido com Admin | Preenchido com usuário ativo |
| Aprovação de mensagens | Não | A definir |

### 6.3. Perfis e permissões (futuro)

| Permissão | Admin | Vendedor |
|---|---|---|
| Ver todos os leads | ✅ | ❌ |
| Ver leads atribuídos a ele | ✅ | ✅ |
| Assumir conversa atribuída | ✅ | ✅ |
| Assumir conversa de outro | ✅ | ❌ |
| Disparar campanhas | ✅ | ❌ |
| Aprovar mensagens | ✅ | ❌ |
| Alterar configurações | ✅ | ❌ |
| Alterar IA | ✅ | ❌ |
| Alterar integrações | ✅ | ❌ |
| Acessar financeiro | ✅ | ❌ |
| Acessar política de opt-out | ✅ | ❌ |
| Atribuir leads | ✅ | ❌ |
| Criar usuários | ✅ | ❌ |

### 6.4. Regra de conflito (futuro)

- Um lead tem **um único responsável** por vez.
- Se o Vendedor A está atendendo, o Vendedor B não pode assumir sem transferência explícita.
- O Admin pode reatribuir a qualquer momento.

### 6.5. UI preparada (Fase 1)

- Campo "Responsável" visível apenas no detalhe do lead (mostra o Admin).
- Menu "Usuários" oculto ou mostrando apenas o Admin.
- Configurações de permissões desabilitadas ou ocultas.

### 6.6. Auditoria desde o início

Toda ação registra `changed_by`:

```typescript
async function changeStatus(leadId: string, newStatus: string, reason: string) {
  const changedBy = currentUser.id;  // Admin, na Fase 1
  // ...
  await client.query(
    'INSERT INTO audit_status_changes (lead_id, from_status, to_status, reason, changed_by) VALUES ($1, $2, $3, $4, $5)',
    [leadId, oldStatus, newStatus, reason, changedBy]
  );
}
```

---

## 7. Configuração

```typescript
// src/config/settings.ts

export interface UserSettings {
  multiUserEnabled: false;        // Fase 1: false
  defaultAdminId: string;         // ID do Admin criado na inicialização
  allowAttribution: false;        // Fase 1: false
  requireLogin: false;            // Fase 1: false
}
```

---

## 8. Critérios de sucesso da decisão

- **Fase 1:** o sistema funciona em single-user sem erros de schema.
- **Fase 1:** os campos de auditoria são preenchidos corretamente com o Admin.
- **Fase Expansão:** é possível criar Vendedor, atribuir leads e restringir acesso sem refatoração estrutural.
- **Fase Expansão:** a migração de dados é feita sem perda.

---

## 9. Referências

- `docs/04-arquitetura.md` — schema com campos de usuário
- `docs/02-requisitos-nao-funcionais.md` — RNF-071
- `docs/03-regras-de-negocio.md` — RN-078 a RN-085
- `docs/09-criterios-de-aceitacao.md` — AC-016
- R-027, R-028, R-029, R-030, R-048, R-049, R-050