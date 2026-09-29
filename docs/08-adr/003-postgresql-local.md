# ADR-003 — PostgreSQL Local como Banco de Dados

- **Status:** Aceito
- **Data:** 2026-09-28
- **Decisores:** Admin (você), System Architect
- **Contexto:** Fase 1 — Fundação, Canal e Gate de Envio
- **Relacionado a:** R-031, R-032, R-033, R-022, R-035, R-028

---

## 1. Contexto

O sistema precisa armazenar localmente:

- Leads (nome, telefone, endereço, status, origem, base legal, opt-out).
- Conversas e mensagens (texto, direção, timestamps, bloqueios).
- Follow-ups (cadência, status, agendamento).
- Notas, tarefas, tags.
- Logs e auditoria.
- Contadores diários.
- Histórico de backups.
- (Futuro) Usuários, permissões, atribuições.

O volume estimado no piloto é modesto (20–30 mensagens/dia, poucos milhares de leads/mês), mas o sistema precisa de:

- Consultas relacionais (joins entre leads, conversas, mensagens, status).
- Índices para busca (telefone, status, opt-out, timestamps).
- Integridade referencial.
- Transações.
- Migrações versionadas.
- Base para relatórios avançados futuros (R-035).
- Preparação para multiusuário (R-028).

As opções consideradas foram:

1. **SQLite** — arquivo único, leve, zero configuração.
2. **JSON/arquivos locais** — simples, mas frágil.
3. **PostgreSQL local** — robusto, relacional, com recursos avançados.
4. **MongoDB local** — NoSQL, flexível, mas overkill.

O usuário escolheu **PostgreSQL local**.

---

## 2. Decisão

Adotar **PostgreSQL 15+ local** como banco de dados do sistema, rodando na mesma máquina do aplicativo, com:

- **Instância local** (serviço do Windows ou instância portátil).
- **Schema versionado** via migrações.
- **Foreign keys ativas** para integridade referencial.
- **Índices** em telefone, status, opt-out e timestamps.
- **Transações** para operações críticas (mudança de status + auditoria).
- **Sem criptografia em repouso** (R-033 — risco assumido).
- **Backup manual** (R-032).

---

## 3. Justificativa

### Por que PostgreSQL e não SQLite?

| Critério | SQLite | PostgreSQL |
|---|---|---|
| Setup | Zero configuração | Exige instalação/serviço |
| Concorrência | Escrita serializada | MVCC, múltiplas conexões |
| Consultas relacionais | Simples | Avançadas (CTEs, window functions) |
| JSON nativo | Sim | Sim (JSONB) |
| Full-text search | Limitado | Avançado (tsvector) |
| Índices | Básicos | Avançados (GIN, GiST, parciais) |
| Migrações | Manuais | Ferramentas maduras |
| Multiusuário futuro | Limitado | Nativo |
| Relatórios avançados | Limitado | Robusto |
| Tamanho do arquivo | Bom para pequeno | Bom para médio/grande |
| Backup | Copiar arquivo | pg_dump + restore |

**Decisão:** PostgreSQL é mais adequado porque o sistema precisa de:

- **Relatórios avançados** (R-035) — funil, taxas, desempenho por nicho/horário/número.
- **Multiusuário futuro** (R-028) — concorrência, permissões, auditoria.
- **Integridade** — foreign keys, transações, constraints.
- **Consultas complexas** — joins entre leads, conversas, mensagens, status, logs.
- **Migrações versionadas** — evolução controlada do schema.

SQLite seria suficiente para o piloto, mas limitaria a evolução. PostgreSQL evita refatoração futura.

### Por que não JSON/arquivos locais?

- Sem integridade referencial.
- Sem consultas eficientes.
- Sem transações.
- Difícil de versionar schema.
- Inviável para relatórios e multiusuário.

### Por que não MongoDB?

- Modelo orientado a documentos não é o mais natural para dados relacionais (leads ↔ conversas ↔ mensagens ↔ status).
- Overkill para o volume do piloto.
- Menos ferramentas maduras para migração e relatórios.
- SQL continua sendo a melhor escolha para relatórios e agregações.

---

## 4. Consequências

### Positivas

- **Robustez:** transações, foreign keys, constraints.
- **Consultas avançadas:** joins, CTEs, window functions, agregações.
- **Relatórios:** base sólida para R-035.
- **Multiusuário:** preparado para R-028.
- **JSONB:** flexibilidade para contextos variáveis (ex.: `context` em logs).
- **Migrações:** ferramentas maduras (node-pg-migrate, Prisma Migrate, Knex).
- **Índices avançados:** GIN, GiST, parciais, para busca e performance.
- **Full-text search:** útil para busca em conversas.

### Negativas

- **Setup:** exige instalação do PostgreSQL no Windows.
- **Consumo:** mais recursos que SQLite (RAM, CPU).
- **Serviço:** precisa estar rodando; se parar, o sistema fica indisponível.
- **Manutenção:** atualizações, backup, restauração.
- **Portabilidade:** migrar para outra máquina exige dump + restore.

### Riscos residuais

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| PostgreSQL parar | Baixa | Alto | Serviço do Windows + notificação local (R-045) |
| Corrupção do banco | Baixa | Alto | Backup manual (R-032) + integridade |
| Consumo excessivo de RAM | Baixa | Médio | Configuração de shared_buffers adequada |
| Falha de migração | Média | Médio | Migrações versionadas + testes |
| Perda de dados por falta de backup | Média | Alto | Alerta de backup antigo (RNF-026) |
| Sem criptografia | Alta | Alto | Risco assumido (R-033) |

---

## 5. Alternativas consideradas

### Alternativa A — SQLite

- **Prós:** zero configuração, arquivo único, leve, portátil.
- **Contras:** concorrência limitada, relatórios limitados, multiusuário limitado.
- **Por que não:** o sistema precisa evoluir para relatórios avançados e multiusuário. SQLite exigiria refatoração futura.

### Alternativa B — JSON/arquivos locais

- **Prós:** simples, sem instalação.
- **Contras:** sem integridade, sem transações, sem consultas.
- **Por que não:** inviável para o escopo.

### Alternativa C — MongoDB local

- **Prós:** flexível, schema dinâmico.
- **Contras:** modelo não relacional, menos ferramentas de relatório, overkill.
- **Por que não:** os dados são naturalmente relacionais.

### Alternativa D — DuckDB

- **Prós:** analítico, rápido para relatórios, embutido.
- **Contras:** menos maduro para operação transacional, menos ferramentas.
- **Por que não:** PostgreSQL é mais adequado para operação + relatórios.

### Alternativa E — PostgreSQL embarcado (portátil)

- **Prós:** sem instalação de serviço, portátil.
- **Contras:** menos comum, exige configuração manual.
- **Por que não:** o serviço do Windows é mais simples de manter e reiniciar.

---

## 6. Implementação

### 6.1. Instalação

- **Windows:** instalador oficial do PostgreSQL (EDB) ou Chocolatey (`choco install postgresql`).
- **Versão:** PostgreSQL 15+.
- **Serviço:** rodando como serviço do Windows.
- **Porta:** 5432 (padrão) ou customizada.
- **Usuário:** `whatsapp_bot` (dedicado).
- **Banco:** `whatsapp_automation`.

### 6.2. Conexão

```typescript
// src/db/pool.ts

import { Pool } from 'pg';

export const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'whatsapp_bot',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'whatsapp_automation',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});
```

### 6.3. Configuração recomendada

```
# postgresql.conf (ajustes)
shared_buffers = 256MB
work_mem = 16MB
maintenance_work_mem = 64MB
max_connections = 20
```

### 6.4. Migrações

Ferramentas sugeridas:
- **node-pg-migrate** — simples, baseado em SQL.
- **Prisma Migrate** — ORM com migrações.
- **Knex** — query builder com migrações.

Recomendação: **node-pg-migrate** por ser leve e transparente.

### 6.5. Schema inicial

Ver `docs/04-arquitetura.md`, seção 6 — tabelas: `leads`, `conversations`, `messages`, `followups`, `notes`, `tasks`, `tags`, `lead_tags`, `logs`, `audit_status_changes`, `daily_counters`, `backup_history`.

### 6.6. Transações críticas

```typescript
// Exemplo: mudar status + registrar auditoria em transação

async function changeStatus(leadId: string, newStatus: string, reason: string, changedBy: string) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const old = await client.query('SELECT status FROM leads WHERE id = $1', [leadId]);
    await client.query('UPDATE leads SET status = $1, updated_at = NOW() WHERE id = $2', [newStatus, leadId]);
    await client.query(
      'INSERT INTO audit_status_changes (lead_id, from_status, to_status, reason, changed_by) VALUES ($1, $2, $3, $4, $5)',
      [leadId, old.rows[0].status, newStatus, reason, changedBy]
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
```

### 6.7. Backup

```bash
# Backup
pg_dump -U whatsapp_bot -d whatsapp_automation -F c -f backup_YYYY-MM-DD_HH-MM.dump

# Restauração
pg_restore -U whatsapp_bot -d whatsapp_automation --clean backup_YYYY-MM-DD_HH-MM.dump
```

### 6.8. Falhas e reconexão

- Detectar queda do PostgreSQL.
- Registrar log e notificar Admin (R-045).
- Tentar reconectar com backoff exponencial.
- Se persistir, exibir painel de erro.

---

## 7. Configuração

```typescript
// src/config/settings.ts

export interface DatabaseSettings {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  maxConnections: number;
  backupPath: string;
  encryptionEnabled: false;  // R-033
}
```

---

## 8. Critérios de sucesso da decisão

- **Performance:** consultas em menos de 100ms no volume do piloto.
- **Integridade:** nenhuma violação de foreign key não tratada.
- **Disponibilidade:** PostgreSQL rodando durante toda a operação.
- **Migrações:** schema evolui sem perda de dados.
- **Backup:** restauração testada com sucesso.

---

## 9. Referências

- `docs/04-arquitetura.md` — schema completo
- `docs/02-requisitos-nao-funcionais.md` — RNF-010 a RNF-028
- `docs/08-adr/001-canal-hibrido.md` — ADR anterior
- `docs/08-adr/002-ia-externa.md` — ADR anterior
- R-031, R-032, R-033, R-022, R-035, R-028