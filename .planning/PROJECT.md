# Automação Local de WhatsApp para Prospecção B2B

## What This Is

Sistema local (Windows) de automação de conversas no WhatsApp para prospecção B2B e venda de serviços digitais (sites, sistemas, automações, tudo que envolva programação). O fluxo é: o Admin envia a primeira mensagem manualmente ao lead → o sistema assume a conversa → uma API externa de LLM conduz a conversa de forma consultiva e humanizada → follow-ups programados disparam enquanto não há resposta → e nos momentos críticos (preço, agendamento, opt-out, irritação, dúvida complexa) o sistema faz handoff humano com notificação local e entra em silêncio total. O MVP é operado por uma única pessoa (o Admin) em um único número dedicado, com dados em PostgreSQL local.

## Core Value

Quando o bot assume uma conversa, ele conduz com naturalidade suficiente para gerar reuniões agendadas sem nunca cruzar uma fronteira proibida (negociar preço, agendar sozinho, enviar mídia, contornar opt-out, revelar automação) — e para no instante exato em que o humano precisa assumir.

## Requirements

### Validated

(Nenhum ainda — precisa ser entregue e validado)

### Active

- [ ] **R-001** — Bot assume a conversa somente após o Admin enviar manualmente a primeira mensagem (sem resposta do lead necessária)
- [ ] **R-017** — Integração com API do sistema de caça-leads (filtros: estado, cidade, região, categoria/nicho, nome-chave) com botão "abordar no WhatsApp"
- [ ] **R-018** — Sistema usa apenas nome, telefone e endereço retornados pela API; contexto é descoberto na conversa
- [ ] **R-019*** — Validação de número via `onWhatsApp()` antes do envio (estado terminal NUMERO_INVALIDO), corrigido pela pesquisa (R-023 refeito: envio a número inexistente pode gerar restrição de conta)
- [ ] **R-020** — Deduplicação manual: todos os registros mantidos, duplicidades sinalizadas com histórico de tentativas
- [ ] **R-023*** — Duas travas duras: 20 leads/dia + N contatos novos/dia via `fetchNewChatMessageCap()`; 20–30 mensagens/dia; fila para o próximo dia útil; erro 463 jamais retryado
- [ ] **R-051** — Qualificação de lead por dois critérios: verba/interesse em investir E capacidade de decisão
- [ ] **R-052** — Validação híbrida de verba e decisão (indireta por contexto, ou pergunta direta educada)
- [ ] **R-006** — Janela de envio: dias úteis, 7h–17h; nenhuma mensagem automática fora dela
- [ ] **R-007** — Follow-up vencido fora da janela: dreno limitado e jitterado (misfire `FIRE_ONCE`), enviado assim que o app abrir — nunca em rajada (ADR)
- [ ] **R-016** — Camada de conexão isolada (interface/adaptador) para permitir troca Baileys/WPPConnect → API oficial sem quebrar histórico, status ou agendamentos
- [ ] **R-023** — Trava de segurança de 20 leads/dia e 20–30 mensagens/dia, com fila para o próximo dia útil ao atingir
- [ ] **R-059** — Um único número de WhatsApp dedicado e exclusivo para vendas
- [ ] **R-002** — Assumção imediata da conversa pelo bot após a 1ª mensagem do Admin
- [ ] **R-008** — Resposta automática com IA cobrindo qualificação, aquecimento, diagnóstico, objeções e CTA em tom humanizado
- [ ] **R-009** — Uso de API externa de LLM, com sistema local no controle de fluxo/limites/handoff e minimização de dados sensíveis antes do envio
- [ ] **R-010** — Persona de tom consultivo, educado e direto, focado em entender a dor antes de oferecer solução
- [ ] **R-011** — Condução dinâmica sem script rígido, alternando ouvir/comentar/validar/contextualizar/perguntar
- [ ] **R-041** — Reconhecimento e contorno de objeções (preço, tempo, fornecedor, "vou pensar")
- [ ] **R-042** — Contorno autônomo de objeções dentro de limites rígidos (sem valores, prazos, descontos, proposta ou agendamento)
- [ ] **R-055** — IA atua como se fosse o Admin humano, sem revelar automação espontaneamente
- [ ] **R-056** — Pergunta direta sobre automação → handoff imediato, sem negação/admissão/desvio pela IA
- [ ] **R-057** — Silêncio total quando o lead suspeita de automação até o Admin assumir
- [ ] **R-037** — Envio de apenas texto e links; nenhuma mídia
- [ ] **R-038** — Mídia recebida apenas registrada + notificação + handoff; conversa pausada
- [ ] **R-067** — Humanização do envio: delays aleatórios, simulação de digitando, quebra de mensagens longas
- [ ] **R-003** — Follow-up de mensagem curta após tempo configurável sem resposta
- [ ] **R-004** — Cadência de follow-up 1h → 1d → 3d → 7d → 15d
- [ ] **R-005** — Limite de 4 tentativas (1h, 1d, 3d, 7d); após 7 dias sem resposta, encerrar e marcar "sem resposta"
- [ ] **R-012** — Handoff em pedido de preço/proposta/orçamento ou intenção de agendar reunião/chamada
- [ ] **R-013** — Notificação local de handoff (som + pop-up) identificando lead, motivo e ação rápida
- [ ] **R-014** — Modo copiloto pós-handoff: sugere respostas sem enviar nada
- [ ] **R-025** — Bot nunca agenda sozinho; apenas notifica; sem integração de calendário
- [ ] **R-026** — Confirmação e lembrete pós-agendamento registrado pelo Admin, com opção de confirmar/remarcar/cancelar
- [ ] **R-065** — Handoff também em irritação, ameaça de denúncia/bloqueio, pedido de opt-out e dúvida técnica complexa
- [ ] **R-066** — Em irritação/ameaça: pausar automação, notificar, silêncio total, aguardar decisão
- [ ] **R-021** — Pipeline de status: Novo → Contatado → Respondeu → Qualificado → Aquecido → Reunião agendada → Proposta → Fechado → Perdido (com motivo)
- [ ] **R-022** — Atualização automática de status pela IA, com transições auditáveis e correção manual pelo Admin
- [ ] **R-043** — CRM intermediário: lista, status, histórico, busca, tags, filtros, notas, tarefas, lembretes e responsável; histórico imutável
- [ ] **R-044** — Escopo mínimo de integrações: API do caça-leads, API de LLM e WhatsApp local
- [ ] **R-024** — Opt-out e LGPD: detecção automática, registro de base legal/finalidade/consentimento, comando manual de opt-out e exclusão, política de retenção
- [ ] **R-063** — Base de contato sem opt-in explícito (fontes públicas/terceiros) tratada com risco declarado
- [ ] **R-064** — Base legal de legítimo interesse para contato B2B, com registro de origem, base legal e finalidade
- [ ] **R-033** — Sem criptografia adicional implementada; confiança no controle de acesso do PC
- [ ] **R-031** — Persistência em PostgreSQL local, com script/migração de schema
- [ ] **R-032** — Backup manual versionado por data/hora, com restauração sem serviços externos
- [ ] **R-034** — Modo de operação automático total após a 1ª mensagem manual; só chama nos handoffs
- [ ] **R-045** — Logs detalhados em arquivo + painel de erros + notificação local em falhas críticas (desconexão do WhatsApp, API de IA fora, PostgreSQL parado, banimento)
- [ ] **R-046** — Painel de controle dividido: lista de leads + chat + sugestões da IA + histórico + botões de ação rápida, com modo exibido em tempo real
- [ ] **R-047** — Operação em Windows com PostgreSQL local, sessão WhatsApp, painel e notificações nativas
- [ ] **R-048** — Operação como agência/estúdio com equipe (implantação gradual, começando só pelo Admin)
- [ ] **R-049** — Piloto com apenas o Admin; sem criação de usuários adicionais nem atribuição de leads
- [ ] **R-050** — Lista de leads do sistema não é compartilhada com a equipe durante o piloto
- [ ] **R-053** — Serviços oferecidos: sites, sistemas, automações e programação em geral; IA só menciona de forma consultiva
- [ ] **R-054** — Nichos múltiplos sem prioridade; IA não presume nicho, porte, dor ou necessidade
- [ ] **R-027** — Usuário único nesta fase, sem perfis, permissões ou auditoria multiusuário
- [ ] **R-028** — Arquitetura preparada para multiusuário (responsável, criado por, permissões, auditoria)
- [ ] **R-060** — Escopo do MVP conforme delimitado no documento de requisitos
- [ ] **R-061** — Critérios de sucesso do piloto: 5 reuniões agendadas/mês e 30% de taxa de qualificação/mês
- [ ] **R-062** — Apuração mensal dos critérios de sucesso

### Out of Scope

- **Negociação de preço, proposta, orçamento, prazo ou condição comercial** (AR-001, AR-002, AR-012) — gatilho de handoff imediato, sem exceção
- **Agendamento autônomo de reuniões** (AR-003, R-025) — sem integração com Google Calendar, sem sugestão de horários
- **Envio de mídia pelo bot** (AR-004, R-037) — apenas texto e links; portfólio/proposta enviados manualmente pelo Admin
- **Processamento de mídia recebida** (AR-009, R-038) — áudio, imagem, PDF e vídeo apenas registrados
- **Contorno ou reversão de opt-out** (AR-005, R-024) — opt-out é irreversível por padrão
- **Revelação espontânea de automação** (AR-006, R-055) — silêncio total + handoff se houver pergunta direta
- **Resposta fora da janela 7h–17h em dias úteis** (AR-007, R-006) — única exceção: follow-up vencido que dispara quando o app abre (R-007)
- **Ultrapassar o limite de 20–30 mensagens/dia** (AR-008, R-023) — trava de segurança, não sugestão
- **Ação do bot após handoff sem assumir/devolver explicitamente** (AR-010, R-066) — silêncio total
- **Contato a lead sem origem, base legal e finalidade registrados** (AR-011, R-064) — bloqueio absoluto
- **Google Calendar, e-mail, Telegram, planilhas, webhooks e CRM externo** (R-044) — escopo mínimo de integrações
- **Relatórios avançados e analytics** (R-035) — v2+
- **Financeiro avançado: contratos, recibos, comissões, impostos** (R-036) — apenas registro manual básico de valor/status/ticket médio
- **Perfis de usuário, permissões e auditoria multiusuário** (R-029, R-030) — preparando terreno com R-027/R-028, mas fora do MVP
- **Criptografia adicional dos dados** (R-033) — risco aceito conscientemente, depende do controle de acesso do PC
- **Aquecimento automático do número** (R-039, R-040) — sistema apenas sugere, Admin controla manualmente
- **Validação de existência de número de WhatsApp** (remove R-019 do Out of Scope) — **corrigida pela pesquisa**: `onWhatsApp()` volta ao escopo pois envio a número inexistente gera restrição de conta, não apenas erro de mensagem
- **Deduplicação automática de leads** (R-020) — decisão manual do Admin para evitar sobreposição

## Context

### Ambiente técnico
- **SO:** Windows (notificações nativas por pop-up + som)
- **Linguagem:** Node.js + TypeScript (preferencial) ou Python — `.ruler/` e `AGENTS.md` sugerem ambos
- **Canal WhatsApp:** começa com conexão não oficial (Baileys ou WPPConnect) em número dedicado; migração futura para API oficial quando houver resultados
- **Banco:** PostgreSQL local, com script de criação/migração de schema
- **IA:** API externa de LLM (OpenAI, Gemini, Claude ou similar) — o sistema local controla fluxo, limites e handoff
- **Notificações:** locais (som + pop-up no Windows)

### Skills e personas já definidos
O projeto já tem `.ruler/skills/` como fonte de verdade com 7 skills: `crm-pipeline`, `follow-up-cadencia`, `handoff-humano`, `ia-conversa-consultiva`, `lgpd-optout`, `whatsapp-baileys` e agentes (`backend-engineer`, `compliance-reviewer`, `product-manager`, `qa-engineer`, `system-architect`). Distribuídos via `npx ruler apply` para `.opencode/skills/`.

### Conflito aberto a reconciliar
R-048 (operação como agência/estúdio com equipe) está em tensão com R-027 (usuário único nesta fase). R-049/R-050 resolvem na prática: o piloto é só com o Admin, e a lista de leads do sistema não é compartilhada com a equipe — o Admin coordena manualmente quem aborda o quê. O risco R-050 é ALTO: mesma pessoa abordada duas vezes gera irritação, denúncia ou banimento.

### Estado atual do repositório
O diretório contém apenas `main.py` — um script não relacionado (gera um checklist de crédito em `.docx` com `python-docx` para "Auto Equity"). Não pertence a este projeto e não deve ser misturado com a implementação do sistema de automação de WhatsApp.

## Constraints

- **Anti-requisitos são invariantes absolutas**: os 12 anti-requisitos (AR-001 a AR-012) não podem ser relaxados, contornados nem "exceptions" de implementação. Falha de regra de segurança é falha do sistema, não motivo para negociar exceção.
- **Stack**: Node.js + TypeScript preferencial, ou Python — decisão adiada para a primeira fase de planejamento
- **Canal WhatsApp**: começar não oficial (Baileys/WPPConnect) com camada de conexão isolada em interface/adaptador; migração para API oficial é uma fase futura
- **SO**: Windows obrigatório (notificações nativas, PostgreSQL local, sessão WhatsApp)
- **Banco**: PostgreSQL local apenas, sem servidor externo
- **Integrações**: só 3 — API do caça-leads, API de LLM, WhatsApp local. Nenhuma outra nesta etapa
- **Volume**: 20 leads/dia e 20–30 mensagens/dia no número dedicado (trava dura, com fila para o próximo dia útil)
- **Janela operacional**: dias úteis, 7h–17h
- **Número**: exatamente um, dedicado a vendas
- **LGPD**: leads não têm opt-in explícito; base legal é legítimo interesse com registro de origem, finalidade e opt-out imediato
- **Segurança**: sem criptografia adicional nesta fase — risco aceito e documentado (R-033)
- **Idioma**: português do Brasil para toda a interface, prompts de IA e documentação
- **Objetivo do piloto**: 5 reuniões agendadas/mês e 30% de taxa de qualificação/mês, apurados mensalmente (R-061, R-062)

## Key Decisions

| Decisão | Rationale | Outcome |
|----------|-----------|---------|
| R-019 corrigido: `onWhatsApp()` volta ao escopo | Pesquisa: envio a número inexistente gera restrição de conta (erro 463 / reach-out) — não só erro de mensagem | ✓ Good |
| Primeiro contato sempre humano; bot só assume depois | Erro 463/RFT faz da 1ª msg manual a mitigação técnica anti-ban primária, além de evitar aparência robótica (R-001) | ✓ Good |
| R-023 com 2ª trava dura (contatos novos/dia via `fetchNewChatMessageCap()`) | Orçamento real é N contatos novos/dia, não só 20-30 mensagens; retry de 463 proibido | — Pending |
| R-007 com misfire `FIRE_ONCE` + dreno limitado/jitterado | Dreno em rajada após restart é risco de ban (AR-008) — precisa de política + ADR | — Pending |
| Baileys 7.0.0-rc14 pin exato (via `--save-exact`) | A linha 6.7.x não tem tctoken/erro-463/APIs de quota — é o caminho anti-ban primário | ⚠️ Revisit |
| Node 24 LTS + TypeScript + Biome + Drizzle + `pg-boss` (sem Redis) | `pg-boss` evita serviço extra (R-044); Biome evita shim typescript-eslint/TS7 | — Pending |
| Auth state do Baileys + backups fora da árvore OneDrive | OneDrive sincronizaria dados LGPD sem criptografia, contradizendo R-033 | ✓ Good |
| Shadow mode como gate do piloto | R-061 exige ~30 dias com risco diário; shadow valida fala e guardrails sem gastar a janela de tolerância do número | — Pending |
| Prospecção fria não move nunca para API oficial | É proibida na plataforma oficial da Meta (opt-in + template); o conjunto conformável é anti-feature, não v2 | ✓ Good |
| Break-up message é questão aberta | R-005 encerra em "sem resposta" sem break-up; mercado BR reporta break-up como maior taxa de resposta — não muda o requisito, decide com dado do piloto | ⚠️ Revisit |
| Camada de conexão ao WhatsApp isolada em interface/adaptador | Permite migrar de Baileys/WPPConnect para API oficial sem quebrar histórico, status ou agendamentos (R-016) | — Pending |
| Handoff como mecanismo central, não exceção | Preço, agendamento, opt-out, irritação e dúvida complexa sempre voltam ao humano; é o que protege o número (R-012, R-065) | — Pending |
| Silêncio total em suspeita de automação | R-056/R-057 e AR-006: a IA não nega, não admite, não desvia — o Admin assume como humano | — Pending |
| Contorno autônomo de objeções, mas nunca de preço | Maximiza conversão dentro da fronteira (R-041/R-042) enquanto AR-001/AR-012 protegem a operação | — Pending |
| Limites diários como trava, não sugestão | R-023 é trava de segurança; R-039/R-040 deixam o aquecimento sob controle manual do Admin | — Pending |
| Piloto apenas com Admin; lista de leads não compartilhada | Elimina o risco ALTO de sobreposição de prospecção com a equipe (R-049, R-050) | — Pending |
| Limite de 4 follow-ups (1h, 1d, 3d, 7d) | Revisão do R-004: a cadência de 15 dias não é executada; após 7 dias sem resposta, marca "sem resposta" (R-005) | — Pending |
| Sem criptografia adicional nesta fase | Confiança no controle de acesso do PC; risco documentado e aceito (R-033) | ⚠️ Revisit |
| Sem integração de calendário | Bot apenas avisa; Admin agenda manualmente (R-025, AR-003) | — Pending |
| Granularidade grosseira no roadmap (3-5 fases) | 67 requisitos em 13 módulos; fases amplas evitam fragmentação excessiva do piloto | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-09-28 after initialization*
