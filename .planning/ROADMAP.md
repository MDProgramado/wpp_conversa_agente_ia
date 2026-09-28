# Roadmap: Automação Local de WhatsApp para Prospecção B2B

## Overview

Do zero até o piloto de 30 dias, o sistema evolui em 4 fases derivadas das arestas de dependência reais do domínio — não de camadas técnicas. A Fase 1 constrói a fundação anti-ban: estado durável no Postgres, canal WhatsApp isolado e o **único gate mecânico de envio** (`evaluatePolicy`) que lê os 12 anti-requisitos do banco — ele vem **antes** de qualquer fiação de LLM, sem exceção (invariante de ordem nº1 da pesquisa). A Fase 2 conecta o LLM como gerador de *dica* (nunca dono de estado), constrói o handoff humano como fronteira projetada e valida tudo em **shadow mode** (rascunha, nunca envia) — passagem obrigatória antes de gastar a tolerância do número. A Fase 3 entrega cadência conservadora, painel único e CRM operacional — o bot roda sozinho dentro da janela e dos limites, e o Admin opera tudo. A Fase 4 mede: 5 reuniões/mês, 30% de qualificação/mês, com recalibração da cadência por dado real e decisões de produto (break-up) tomadas com evidência. R-001 (primeira mensagem sempre manual) é **restrição transversal a todas as fases** — nunca é automatizado; é a mitigação técnica primária contra erro 463/reach-out time-lock.

**Stack (decisões de pesquisa, validadas na Fase 1):** Node.js 24 LTS + TypeScript 7 + `@whiskeysockets/baileys@7.0.0-rc14` (pin exato) + Drizzle/pg + pg-boss + Fastify + React (localhost, sem Electron) + Vercel AI SDK 7 + pino. Auth state e backups **fora** da árvore OneDrive.

## Ajustes vs. Estrutura do Sintetizador

O sintetizador propôs 4 fases (Fundação+Canal+Gate ⮑ IA+Handoff+Shadow ⮑ Cadência+Operação+Painel ⮑ Piloto). A estrutura foi mantida, mas a auditoria contra os 60 requisitos v1 (REQ-IDs) revelou 9 erros de mapeamento no traceability preliminar, todos corrigidos:

| Requisito | Mapeamento preliminar | Correção | Motivo |
|-----------|----------------------|----------|--------|
| CONV-14 (gate + 12 property tests) | Fase 2 | **Fase 1** | Invariante nº1: `PolicyGate` antes de `LlmPort`. Colocá-lo na F2 produziria sistema que envia sem gate |
| CONV-13 (humanização de envio) | Fase 2 | **Fase 1** | Mecânica do dispatcher/outbox (`humanize.ts`), não da IA |
| CONV-11 (apenas texto e links) | Fase 2 | **Fase 1** | `CHECK (kind IN ('text','link'))` no schema + port sem método de mídia |
| LEAD-05, LEAD-06 (qualificação verba+decisão) | Fase 1 | **Fase 2** | É comportamento de conversa — exige LLM/FSM |
| OPRE-04, OPRE-05 (IA consultiva, sem presumir nicho) | Fase 1 | **Fase 2** | São restrições de geração de texto, não de fundação |
| OPRE-02, OPRE-03 (piloto só com Admin) | Fase 1 | **Fase 4** | São condições de operação do piloto (R-049/R-050) |
| FLUP-04, FLUP-05, FLUP-07, FLUP-09, FLUP-10 (handoff) | Fase 3 | **Fase 2** | Handoff é o produto; gatilhos e notificação nascem com a IA |
| CRM-02 (IA atualiza status) | Fase 3 | **Fase 2** | Depende do `resolveNextState` (Hinted FSM) da Fase 2 |
| COMP-01 (detecção automática de opt-out) | Fase 1 | **Fase 2** | Ledger e guard ficam na F1 (via CONV-14); a *detecção* exige matcher+LLM |
| WHS-02 (dreno de R-007) | Fase 1 | **Fase 3** | Depende do `Scheduler`/misfire policy, entregue na F3 |

**Cobertura:** 60/60 REQ-IDs v1 mapeados ✓ (a contagem "67" refere-se a R-001…R-067; 7 IDs são v2/fora de escopo: R-029, R-030, R-035, R-036, R-039, R-040, R-048). Sem órfãos, sem duplicatas.

## Phases

- [ ] **Phase 1: Fundação, Canal e Gate de Envio** - Estado durável, canal WhatsApp isolado e o gate único que torna os 12 anti-requisitos invariantes de sistema
- [ ] **Phase 2: IA, Handoff e Shadow Mode** - LLM como gerador de dica, handoff como fronteira projetada e validação por rascunho sem tocar no número
- [ ] **Phase 3: Cadência, Operação e Painel** - Follow-up conservador, painel único e CRM operacional: o bot roda sozinho e o Admin opera
- [ ] **Phase 4: Piloto, Calibração e Apuração** - 30 dias de operação real, medição dos critérios de sucesso e decisões com dado

## Phase Details

### Phase 1: Fundação, Canal e Gate de Envio
**Goal**: O Admin conecta o único número dedicado, o sistema tem estado durável (Postgres local) e nenhuma mensagem sai sem passar por um único gate que recusa toda fronteira proibida — com as travas anti-ban (463, contatos novos, janela) armadas desde o primeiro dia. R-001 é restrição transversal: o primeiro contato é sempre manual, feito pelo Admin.
**Mode**: mvp
**Depends on**: Nothing (first phase)
**Requirements**: OPRE-01, LEAD-01, LEAD-02, LEAD-03, LEAD-04, WHS-01, WHS-03, WHS-04, WHS-05, CONV-11, CONV-13, CONV-14, INTR-01, COMP-02, COMP-03, COMP-04, COMP-05, NFRQ-01, NFRQ-02, NFRQ-04, NFRQ-06, EQUP-01, EQUP-02
**Success Criteria** (what must be TRUE):
  1. O Admin lê o QR Code, conecta o único número dedicado (WHS-05) e o sistema reconhece como 1ª mensagem apenas as enviadas manualmente por ele — o bot nunca inicia contato (OPRE-01); após queda de rede, reconecta sozinho e retoma sem duplicar envio, respeitando a janela de dias úteis 7h–17h (WHS-01) e com auth state fora do OneDrive (COMP-05).
  2. Nenhuma mensagem sai sem passar pelo gate único `evaluatePolicy` — verificado por 1 property test por anti-requisito (12 no total) e por lint (`no-restricted-imports`) que bloqueia qualquer chamada ao canal fora do dispatcher; o canal só emite texto e links, sem método de mídia (CONV-14, CONV-11).
  3. Ao atingir 20 leads/dia, a cota de contatos novos lida do número via `fetchNewChatMessageCap()` ou 20–30 mensagens/dia, o sistema para de enviar e enfileira; erro 463 suspende o contato frio **sem retry**; número inexistente cai no estado terminal NUMERO_INVALIDO sem quebrar a fila (WHS-04, LEAD-03).
  4. O lead importado da API do caça-leads (filtros: estado, cidade, região, nicho, nome-chave) entra somente com origem, base legal e finalidade registradas na criação (bloqueio absoluto AR-011, COMP-03); duplicidades são sinalizadas com histórico de tentativas e a decisão de abordar é manual — nada é apagado (LEAD-04, LEAD-01, LEAD-02).
  5. Falha crítica (WhatsApp desconectado, PostgreSQL parado, API de IA fora, sinal de banimento) gera log em arquivo + notificação local com som e pop-up **comprovada na máquina do Admin** (Focus Assist, ExecutionPolicy — smoke test de Fase 1, NFRQ-04, NFRQ-06); o backup versionado por data/hora em pasta local fora do OneDrive restaura com contagem de linhas conferida (NFRQ-02, COMP-04), e os documentos LGPD (Encarregado nomeado com substituto, canal publicado, teste de balanceamento de 3 fases versionado, risco MUITO ALTO declarado para base sem opt-in) existem versionados (COMP-02).
**Plans**: 5 plans
**UI hint**: no

Plans:
- [ ] 01-01-PLAN.md — **Walking Skeleton** (wave 1, autonomous: false) — preflight `[BLOCKING]` (Node 24 LTS, PG 18.3, `DATA_ROOT` fora do OneDrive) + correção do pin em `AGENTS.md` + ADR-001; scaffold com pins exatos e barreira de lint D-06; 6 tabelas + `0000_initial.sql` aplicada 2× (idempotente); `launch.cmd` sobe tudo sem elevação; gate puro com Guard 0 + 6 guardas AR + kill switch + `dispatcher` choke-point; checkpoint do toast do Windows
- [ ] 01-02-PLAN.md — **Fundação de dados e compliance** (wave 2, autonomous: false) — 7 tabelas restantes + 3 colunas de authorship nullable (R-028); `0001_guards_and_audit.sql` com triggers de append-only e de irreversibilidade de `opt_out`; checkpoint de higiene do PostgreSQL (`listen_addresses = localhost`); dossiê LGPD (encarregado, balanceamento, canal do titular, retenção) + ADR-002/003
- [ ] 01-04-PLAN.md — **Canal e ingestão** (wave 2, autonomous: false) — `session.ts` com detecção de `CREDS_INVALID` (auth corrompido aborta em vez de degradar), `capabilities.ts` com `fetchNewChatMessageCap`/`fetchAccountReachoutTimelock`, `jid-resolver.ts` LID↔PN, `signals.ts` com 463 sem retry, `adapter.ts` sendText-only; `inbound-handler` marcando `first_contact_by_human` **só** por `fromMe` do número dedicado; `lead-importer` gravando origem/base legal/finalidade na mesma transação e nunca reativando opt-out; checkpoint de pareamento real do número
- [ ] 01-05-PLAN.md — **Gate de envio: os 12 anti-requisitos** (wave 3, autonomous: true) — 6 guardas restantes + 2 arquivos de padrões; `evaluatePolicy` com os 13 invariantes em ordem fixa exportada (`GUARD_ORDER`) e `AR_MAP`; `outbox` durável com `FOR UPDATE SKIP LOCKED` e cota na mesma transação; 12 property tests de AR + teste de ordem + teste de choke-point por grep
- [ ] 01-06-PLAN.md — **Operação e humanização** (wave 4, autonomous: false) — `humanize.ts` com atraso determinístico, typing indicator, quebra preservando ordem e fila **por lead**; `health-monitor` com croner, severidade e notificação por transição; `daily-report` apurando R-061/R-062 a partir de `status_history` com denominador explícito; `env-check` pegando mismatch de `pg_dump` no boot; checkpoint de backup com `pg_dump -Fc` e restauração verificada

> **Nota de granularity**: os 3 sketches originais foram decompostos em 5 planos porque o
> `01-01` precisa ser um Walking Skeleton executável por conta própria (MVP mode) e porque os 3
> checkpoints de hardware — toast, pareamento QR e restauração de backup — não podem conviver com
> trabalho de implementação no mesmo plano. Os 23 REQ-IDs da fase estão cobertos; nenhum plano
> entrega trabalho horizontal.

### Phase 2: IA, Handoff e Shadow Mode
**Goal**: O bot rascunha conversas consultivas, qualifica, respeita todas as fronteiras e para no instante exato em que o humano precisa assumir — tudo validado em shadow mode, sem tocar no número dedicado.
**Mode**: mvp
**Depends on**: Phase 1
**Requirements**: OPRE-04, OPRE-05, LEAD-05, LEAD-06, CONV-01, CONV-02, CONV-03, CONV-04, CONV-05, CONV-06, CONV-07, CONV-08, CONV-09, CONV-10, CONV-12, FLUP-04, FLUP-05, FLUP-07, FLUP-09, FLUP-10, CRM-02, COMP-01, NFRQ-03
**Success Criteria** (what must be TRUE):
  1. Quando o lead responde, o bot rascunha (shadow mode, `engagement_mode = shadow`) uma resposta consultiva via LLM externo — com PII mascarada antes do envio (CONV-03), entendendo a dor antes de oferecer solução (CONV-04), condução dinâmica sem script (CONV-05), reconhecendo e contornando objeções comuns sem prometer condição (CONV-06), mencionando os serviços só de forma consultiva e sem presumir nicho/porte/dor (OPRE-04, OPRE-05), agindo como o Admin humano sem se revelar (CONV-08) — e o Admin vê o rascunho na tela: **zero bytes enviados ao número** (CONV-13 reforçado; CONV-01, CONV-02).
  2. O rascunho é barrado **em código** quando cita valor, prazo, desconto, proposta, agendamento, competidor ou mídia (fail-closed, campos-canário no schema de saída, 1 reprompt e depois silêncio + notificação) (CONV-07); a IA apenas **sugere** o próximo estado e a sugestão é aceita somente se constar nas transições permitidas — a FSM no Postgres decide (CONV-03, CONV-05); o bot nunca agenda sozinho: sem link, horários ou confirmação (FLUP-07).
  3. O lead só é qualificado com os dois critérios (verba/interesse em investir **E** capacidade de decisão), por inferência de contexto ou pergunta direta educada — nunca interrogatório, nunca valor exato (LEAD-05, LEAD-06); cada atualização de status tem justificativa + timestamp, é auditável e corrigível pelo Admin (CRM-02).
  4. Preço/proposta/orçamento, intenção de agendar, "você é robô/IA?", mídia recebida, irritação, ameaça ou dúvida técnica complexa param a automação e disparam handoff com notificação local (som + pop-up) identificando lead, motivo e ação de 1 clique (FLUP-04, FLUP-05, FLUP-09, CONV-12); em suspeita de automação ou irritação o bot fica em **silêncio total** — sem negar, sem admitir, sem desviar, sem mensagem de transição (CONV-09, CONV-10, FLUP-10).
  5. Recusa de receber contato (explícita ou recusa sutil) bloqueia o lead permanentemente e fica registrada em ledger com base legal, finalidade e origem — nenhum caminho a contorna (COMP-01, reforça COMP-03/AR-005); após o handoff o modo muda (mode_changes append-only) e o bot só volta a falar com ação explícita do Admin (NFRQ-03, reforça FLUP-04).
**Plans**: 3 plans
**UI hint**: yes

Plans:
- [ ] 02-01: LlmPort e FSM hintada — `ScriptedLlmAdapter` primeiro; sanduíche de 3 camadas (LLM extrai intent → código decide → LLM responde com a decisão), schema Zod com campos-canário, `resolveNextState()` com guardas locais vencendo a hint, captura do texto da 1ª mensagem do Admin como contexto (CONV-01/CONV-02), set adversarial pt-BR (~200 mensagens) + harness de bake-off de provedor (escolha de provedor = resultado medido)
- [ ] 02-02: Handoff e silêncio — `HandoffService` + gatilhos R-012/R-056/R-065/R-038 + `handoff_events` + `mode_changes` + silêncio total, `NotifyPort` (som + pop-up + chime Web Audio como redundância), matcher determinístico de opt-out pt-BR (autoridade) + `llm_signal` (reforço), qualificação auditável (verba + decisão) com histórico de status corrigível
- [ ] 02-03: Shadow mode — `engagement_mode = shadow` (rascunha, mostra no endpoint mínimo de visualização, nunca envia), kill switch de 1 clique, validação do set adversarial + guardrails, relatório shadow (rascunho vs. o que seria enviado) como gate de saída da Fase 2

### Phase 3: Cadência, Operação e Painel
**Goal**: O bot roda sozinho dentro da janela e dos limites, mantém cadência conservadora de follow-up e o Admin opera, audita e corrige tudo em um único painel local — com o modo exibido em tempo real.
**Mode**: mvp
**Depends on**: Phase 2
**Requirements**: WHS-02, FLUP-01, FLUP-02, FLUP-03, FLUP-06, FLUP-08, CRM-01, CRM-03, NFRQ-05
**Success Criteria** (what must be TRUE):
  1. Lead sem resposta recebe follow-ups em 1h → 1d → 3d → 7d, no máximo 4 toques; no 7º dia a cadência encerra e marca "sem resposta" — o toque de 15 dias nunca executa (FLUP-03); qualquer resposta, opt-out, handoff ou pausa manual interrompe a cadência (FLUP-02); o primeiro follow-up é curto e sai após tempo configurável (FLUP-01).
  2. O app aberto após um fim de semana não dispara rajada: dreno com misfire `FIRE_ONCE`, limite e jitter — máx. 3 mensagens nos primeiros 10 min e 1 follow-up por lead/dia de drenagem; o restante é **adiado, nunca descartado** (WHS-02).
  3. O Admin opera de um painel único: lista de leads + chat + sugestões da IA + histórico imutável + modo exibido em tempo real ("BOT ATIVO" vs "MÃO HUMANA ATIVA — BOT EM SILÊNCIO") + motivo do silêncio + contador diário + janela + fila de handoff + botões de ação rápida (pausar, assumir, devolver, copiloto, kill switch) — sugestões da IA só são enviadas com ação explícita (NFRQ-05).
  4. O Admin busca, filtra, tagueia, anota e cria tarefas/lembretes; move o lead pelo pipeline (Novo → Contatado → Respondeu → Qualificado → Aquecido → Reunião agendada → Proposta → Fechado → Perdido com motivo) e corrige status manualmente, com histórico imutável (CRM-01, CRM-03); após registrar um agendamento, o bot envia confirmação e lembrete antes da reunião com opção de confirmar/remarcar/cancelar — remarcar ou cancelar vira handoff, respeitando janela e limite (FLUP-08; nota: a pesquisa sugere reagendar/cancelar → handoff por R-025/AR-003).
  5. Depois de o Admin assumir um handoff, o bot entra em modo copiloto: sugere respostas no painel e **nunca envia nada sozinho** (FLUP-06); nenhuma mensagem automática sai fora de dias úteis 7h–17h e nada ultrapassa os limites diários — a fila espera o próximo dia útil (reforça WHS-01/WHS-04, cuja mecânica veio na Fase 1).
**Plans**: 3 plans
**UI hint**: yes

Plans:
- [ ] 03-01: Cadência e scheduler — `Scheduler` tick 30s + `FOR UPDATE SKIP LOCKED` + lease + reconciliador + idempotência `(lead_id, follow_up_index)`, misfire policies por tipo (`CATCH_UP` proibido), `business-hours.ts` com feriados BR + "próximo dia útil", detecção de não-resposta (read receipts/watermark), default conservador (máx. 2 toques automáticos sem resposta → handoff)
- [ ] 03-02: Painel de controle — `ApiHttp` (Fastify + SSE, bind `127.0.0.1`, `Host` header validado, token por request) + React localhost; R-046 completo (lista + chat + sugestões + histórico + ações rápidas + modo em tempo real + contador + janela + motivo do silêncio + fila de handoff); comando kill switch global
- [ ] 03-03: CRM operacional e copiloto — pipeline com motivos de "Perdido", busca/filtros/tags/notas/tarefas/lembretes, histórico imutável, notas automáticas da IA, modo copiloto pós-handoff (sugere, nunca envia), confirmação/lembrete pós-agendamento; migração do doc `01-requisitos-funcionais.md` (R-004/R-005, R-058) + ADRs (R-019 revertido, dreno R-007, `isCatchupDrain` como parâmetro)

### Phase 4: Piloto, Calibração e Apuração
**Goal**: Comprovar em ~30 dias de operação real no número dedicado que o sistema gera reuniões sem queimar o número, apurar os critérios de sucesso (5 reuniões/mês, 30% de qualificação/mês) e responder com dado as questões abertas do roadmap.
**Mode**: mvp
**Depends on**: Phase 3
**Requirements**: OPRE-02, OPRE-03, PILO-01, PILO-02, PILO-03
**Success Criteria** (what must be TRUE):
  1. O Admin opera sozinho o sistema durante o piloto: nenhum usuário adicional criado, nenhuma atribuição de leads (OPRE-02) e a lista de leads do sistema nunca aparece para a equipe — o Admin coordena manualmente quem aborda o quê e o risco ALTO de sobreposição (R-050) é controlado (OPRE-03).
  2. O fluxo completo do escopo MVP (PILO-01/R-060) roda sem intervenção do desenvolvedor: importar da API do caça-leads → Admin envia a 1ª mensagem manualmente → bot assume → handoffs nos momentos críticos → reunião agendada — com trilha de auditoria de cada decisão da IA e humana; saída de shadow mode com comparação rascunho vs. envio real.
  3. A apuração mensal mede os dois critérios — 5 reuniões agendadas/mês e 30% de taxa de qualificação/mês (PILO-02) — e a cadência é recalibrada com o dado real (tempo mediano até 1ª resposta, taxa de resposta por toque) em vez dos intervalos presumidos (PILO-03); a decisão de break-up no encerramento é tomada com o dado do piloto (questão aberta da pesquisa, FLUP-11 v2).
  4. O material de appeal de banimento (registro de origem, opt-outs, template da 1ª mensagem, frequência) e os documentos LGPD (Encarregado, canal do titular, teste de balanceamento revisto, resposta a titular < 48h) estão prontos **antes** de serem necessários. — *Critério de continuidade operacional: reforça COMP-02/COMP-03 (Fase 1) e decide FLUP-11 (v2); sem ele, os critérios R-061/R-062 não têm condições de execução segura no período.*
**Plans**: 2 plans
**UI hint**: no

Plans:
- [ ] 04-01: Piloto real e calibração — 30 dias no número dedicado com shadow como comparação, recalibração da cadência (1h/1d/3d/7d só fixados com dado), decisão de break-up, plano de appeal preparado antecipadamente, tensão R-059 (SIM descartável) registrada e decidida
- [ ] 04-02: Apuração e relatório — apuração mensal R-061/R-062 em visão mínima (reaproveita o painel da Fase 3, sem analytics avançado), revisão do teste de balanceamento LGPD, relatório de guardrails (nenhuma fronteira cruzada), lições do piloto para v2 (R-016 migração oficial, multiusuário, analytics)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Fundação, Canal e Gate de Envio | 0/3 | Not started | - |
| 2. IA, Handoff e Shadow Mode | 0/3 | Not started | - |
| 3. Cadência, Operação e Painel | 0/3 | Not started | - |
| 4. Piloto, Calibração e Apuração | 0/2 | Not started | - |

## Notas de Cobertura e Decisões de Mapeamento

- **Cobertura:** 60/60 REQ-IDs v1 mapeados (o número "67" refere-se a R-001…R-067; 7 IDs são v2/fora de escopo: R-029, R-030, R-035, R-036, R-039, R-040, R-048). Sem órfãos, sem duplicatas.
- **Requisitos de forma sem comportamento observável direto** (verificados por revisão de migração/ADR, não por comportamento de usuário): NFRQ-01 (migração com CHECKs/FOR UPDATE/watermark na 1ª migration), COMP-04 (sem criptografia, risco aceito e documentado), EQUP-01/EQUP-02 (usuário único + schema apto a multiusuário), INTR-01 (apenas 3 integrações), todos na Fase 1.
- **Divisão mecânica/comportamento:** requisitos cujo *mecanismo* nasce numa fase e cujo *comportamento observável* só aparece depois foram alocados na fase do mecanismo — ex.: WHS-04 (trava + enfileiramento = Fase 1; retomada no próximo dia útil completa na Fase 3), COMP-01 (ledger/guard = Fase 1 via CONV-14; detecção automática = Fase 2), FLUP-06 (machine de modos = Fase 2 via NFRQ-03; sugestões de copiloto no painel = Fase 3).
- **R-001 é restrição transversal, não fase:** nenhuma fase automatiza o primeiro contato. A Fase 1 o impõe como guard AR-001 no gate; a Fase 3 reforça no scheduler (contato frio **não** é automatizado); o piloto (Fase 4) o executa diariamente.
- **Granularidade:** coarse (config.json) → 4 fases, 11 plans (3/3/3/2). A Fase 1 concentra os 4 pitfalls CRÍTICOS de fundação (463, R-019, gate único, OneDrive) por serem não-adiáveis; planos da Fase 1 podem ser revisitados no plan-phase sem mudar o roadmap.
- **Flags de pesquisa por fase:** Fase 1 — validação empírica na máquina do Admin (notificação Windows, `fetchAccountReachoutTimelock` no typings) + API do caça-leads não especificada (bloqueia LEAD-01 na integração, não a arquitetura). Fase 2 — bake-off de provedor de LLM em PT-BR (medição, não pesquisa). Fase 3 — feriados BR e definição de produto de "próximo dia útil". Fase 4 — procedimento de appeal de ban (confirmar em fonte primária antes de depender).

---
*Roadmap criado: 2026-09-28*