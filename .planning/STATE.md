---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: Pronto para planejar
last_updated: "2026-09-28T16:39:52.563Z"
progress:
  total_phases: 4
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Estado do Projeto

## Referência do Projeto

Ver: `.planning/PROJECT.md` (atualizado 2026-09-28)

**Valor central:** Quando o bot assume uma conversa, conduz com naturalidade suficiente para gerar reuniões agendadas sem nunca cruzar uma fronteira proibida — e para no instante exato em que o humano precisa assumir.
**Foco atual:** Phase 1 — Fundação, Canal e Gate de Envio

## Posição Atual

Fase: 1 de 4 (Fundação, Canal e Gate de Envio)
Plano: 0 de 3 na fase atual
Status: Pronto para planejar
Última atividade: 2026-09-28 — Roadmap criado (4 fases, 60/60 requisitos mapeados)

Progresso: [░░░░░░░░░░] 0%

## Métricas de Desempenho

**Velocidade:**

- Planos concluídos: 0
- Duração média: —
- Tempo total de execução: —

**Por Fase:**

| Fase | Planos | Total | Média/Plano |
|------|--------|-------|-------------|
| 1. Fundação, Canal e Gate | 3 | — | — |
| 2. IA, Handoff e Shadow | 3 | — | — |
| 3. Cadência, Operação e Painel | 3 | — | — |
| 4. Piloto, Calibração e Apuração | 2 | — | — |

*Atualizado após cada plano concluído*

## Contexto Acumulado

### Decisões

Decisões completas em PROJECT.md (tabela Key Decisions). Recentes que afetam o trabalho atual:

- **Gate antes do LLM, sem exceção:** `PolicyGate` (Fase 1) precede `LlmPort` (Fase 2); CONV-14 corrigido para a Fase 1 no roadmap.
- **R-001 é restrição transversal:** primeira mensagem sempre manual — mitigação técnica primária anti-463; nenhuma fase automatiza primeiro contato.
- **Baileys `7.0.0-rc14` pin exato** (`--save-exact`): a linha 6.7.x não tem tctoken/463/APIs de quota.
- **Auth state + backups fora do OneDrive** (COMP-05): path concreto a decidir no plano 01-01 (ex.: `C:\whatsapp_prospecao\`).
- **Shadow mode é gate de P1:** Fase 2 valida fala e guardrails sem consumir a tolerância do número; saída da F2 exige relatório shadow.
- **R-019 corrigido pela pesquisa:** `onWhatsApp()` volta ao escopo; estado terminal NUMERO_INVALIDO.
- **R-023 com 2ª trava dura:** contatos novos/dia via `fetchNewChatMessageCap()`; 463 nunca retryado.
- **Ambiente resolvido 2026-09-28 (pós-pesquisa Fase 1):**
  - **Baileys `7.0.0-rc14` confirmado** despite `AGENTS.md` §STACK.md fixar `6.7.24`. As fontes do projeto (PROJECT.md Key Decisions, STATE.md, 01-CONTEXT.md D-01/specifics) decidem rc14 porque a linha 6.7.x não tem tctoken/erro-463/APIs de quota — sem elas, WHS-04 e LEAD-03 ficam sem implementação. `AGENTS.md` é snapshot de pesquisa pré-projeto e está desatualizado neste ponto. **Follow-up: corrigir `AGENTS.md` §STACK.md.**
  - **PostgreSQL 18.3 é o alvo** (o STACK.md autoriza "17.x **ou 18.x se já instalado**"; 18.3 está instalado e `pg_dump`/`pg_restore` são 18.3 = mesma major do servidor). Sem migração de dados.
  - **Node 24 LTS é o alvo, mas a máquina tem v22.14.0.** Gap real. Vira **tarefa de preflight** no primeiro plano da Fase 1 (instalar/verificar Node 24 LTS antes de qualquer dependência), não uma decisão de arquitetura.

### Todos Pendentes

De `.planning/todos/pending/`:

Nenhum ainda.

### Bloqueios/Preocupações

- ⚠️ **API do caça-leads não especificada** (schema, auth, rate limit) — bloqueia LEAD-01 na integração (não a arquitetura); decidir forma do insert antes (AR-011 exige `legal_registered_at` na criação).
- ⚠️ **Smoke test Windows de Fase 1** — notificação (Focus Assist, ExecutionPolicy, som em RDP) e presença de `fetchAccountReachoutTimelock` no typings do pacote instalado precisam de validação empírica na máquina do Admin.
- ⚠️ **R-059 (número único, sem redundância)** — risco dominante aceito e documentado; mitigação: shadow mode, kill switch, appeal preparado, exportação contínua do CRM.
- ⚠️ **Node 22.14.0 instalado vs. Node 24 LTS exigido** (2026-09-28) — `ai@7` aceita `>=22`, mas `typescript@7.0.2`/drizzle-kit/vite seguem a pinagem do STACK em 24 LTS. Preflight obrigatório antes da primeira dependência.
- ⚠️ **`AGENTS.md` §STACK.md desatualizado** — fixa `6.7.24`, projeto decide `7.0.0-rc14`. Risco de um agente futuro reverter o pin. Corrigir.

## Itens Adiados

| Categoria | Item | Status | Adiado Em |
|-----------|------|--------|-----------|
| Pesquisa | Procedimento de appeal de ban (fonte secundária) — confirmar antes de depender | Aberto | 2026-09-28 |
| Pesquisa | Onboarding da API oficial (migração R-016) — não pesquisado | Aberto | 2026-09-28 |
| Produto | Break-up message (FLUP-11 v2) — decidir com dado do piloto | Aberto | 2026-09-28 |

## Continuidade de Sessão

Última sessão: 2026-09-28
Parou em: Roadmap criado e aprovado-pendente; traceability de REQUIREMENTS.md atualizado
Arquivo de retomada: Nenhum

---
*Atualizado: 2026-09-28*
