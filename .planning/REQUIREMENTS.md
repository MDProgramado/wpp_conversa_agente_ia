# Requirements: Automação Local de WhatsApp para Prospecção B2B

**Defined:** 2026-09-28
**Core Value:** Quando o bot assume uma conversa, conduz com naturalidade suficiente para gerar reuniões agendadas sem nunca cruzar uma fronteira proibida — e para no instante exato em que o humano precisa assumir.

## v1 Requirements

Requisitos para o release inicial (escopo do piloto, R-060). Cada um mapeia para uma fase do roadmap.

### Operação e Prospecção (OPRE)

- [ ] **OPRE-01**: Admin envia manualmente a primeira mensagem ao lead; o bot NUNCA inicia o primeiro contato (R-001)
- [ ] **OPRE-02**: Piloto opera apenas com o Admin; sem criação de usuários adicionais nem atribuição de leads (R-049)
- [ ] **OPRE-03**: A lista de leads do sistema não é compartilhada com a equipe durante o piloto; Admin coordena manualmente quem aborda o quê (R-050)
- [ ] **OPRE-04**: IA pode mencionar os serviços (sites, sistemas, automações, programação) de forma consultiva, nunca negociando preço, prazo ou escopo (R-053)
- [ ] **OPRE-05**: IA não presume nicho, porte, dor ou necessidade; personalização ocorre durante a conversa (R-054)

### Ingestão e Qualificação de Leads (LEAD)

- [ ] **LEAD-01**: Integra com a API do sistema de caça-leads (filtros: estado, cidade, região, categoria/nicho, nome-chave), consumindo dados e disponibilizando ação "abordar no WhatsApp" (R-017)
- [ ] **LEAD-02**: Usa apenas nome, telefone e endereço retornados pela API; contexto é descoberto na conversa (R-018)
- [ ] **LEAD-03**: Valida a existência do número via `onWhatsApp()` antes de agendar/envios e trata estado terminal NUMERO_INVALIDO sem quebrar a fila (R-019*, corrigido)
- [ ] **LEAD-04**: Mantém todos os registros de leads e sinaliza duplicidades com histórico de tentativas; decisão de abordagem é manual (R-020)
- [ ] **LEAD-05**: Qualifica lead apenas com verba/interesse em investir E capacidade de decisão (R-051)
- [ ] **LEAD-06**: Valida verba e decisão de forma híbrida — indireta por contexto, ou pergunta direta educada; nunca interrogatório, nunca valor exato (R-052)

### Infraestrutura WhatsApp (WHS)

- [ ] **WHS-01**: Nenhuma mensagem automática fora de dias úteis, 7h–17h (janela operacional) (R-006)
- [ ] **WHS-02**: Follow-up vencido fora da janela é drenado com limite e jitter controlados assim que o app abre — nunca em rajada (misfire `FIRE_ONCE`, ADR) (R-007)
- [ ] **WHS-03**: Camada de conexão do WhatsApp isolada em interface/adaptador, permitindo trocar Baileys/WPPConnect → API oficial sem quebrar histórico, status ou agendamentos (R-016)
- [ ] **WHS-04**: Travas duras: 20 leads/dia + N contatos novos/dia via `fetchNewChatMessageCap()` + 20–30 mensagens/dia; ao atingir, para e enfileira para o próximo dia útil; erro 463 jamais é retryado (R-023*)
- [ ] **WHS-05**: Opera um único número de WhatsApp dedicado e exclusivo para vendas (R-059)

### Fluxo de Conversa e IA (CONV)

- [ ] **CONV-01**: Bot assume a conversa assim que o Admin envia a 1ª mensagem, mesmo sem resposta do lead (R-002)
- [ ] **CONV-02**: Ao detectar resposta do lead, a IA conduz qualificação, aquecimento, diagnóstico, objeções e CTA em tom humanizado (R-008)
- [ ] **CONV-03**: Usa API externa de LLM; o sistema local controla fluxo, limites e handoff; minimiza/mascara dados sensíveis antes do envio (R-009)
- [ ] **CONV-04**: Persona consultiva, educada e direta — foca em entender a dor antes de oferecer solução (R-010)
- [ ] **CONV-05**: Condução dinâmica, sem script rígido, alternando ouvir/comentar/validar/contextualizar/perguntar (R-011)
- [ ] **CONV-06**: Reconhece objeções (preço, tempo, fornecedor, "vou pensar") e tenta contornar com argumentos (R-041)
- [ ] **CONV-07**: Gera argumentos de contorno de objeções autonomamente, dentro de limites rígidos (sem valores, prazos, descontos, proposta ou agendamento) (R-042)
- [ ] **CONV-08**: IA age como o Admin humano, sem revelar automação espontaneamente (R-055)
- [ ] **CONV-09**: Pergunta direta se é bot/robô/IA → handoff imediato, sem negar, admitir ou desviar (R-056)
- [ ] **CONV-10**: Suspeita de automação → silêncio total até o Admin assumir; nenhuma mensagem de transição (R-057)
- [ ] **CONV-11**: Envia apenas texto e links; jamais imagens, PDFs, áudios, vídeos ou documentos (R-037)
- [ ] **CONV-12**: Mídia recebida (áudio, imagem, PDF, vídeo) é apenas registrada; notifica e aciona handoff; não finge entendimento (R-038)
- [ ] **CONV-13**: Humaniza o envio com delays aleatórios, simulação de "digitando…" e quebra de mensagens longas em varias mensagens curtas (R-067)
- [ ] **CONV-14**: Anti-requisitos (AR-001 a AR-012) impõem-se como invariantes de estado via um único gate de envio mecânico (`evaluatePolicy`), com 1 property test por AR; nenhum caminho de mensagem escapa do gate (derivado da pesquisa — mecânica transversal)

### Follow-up, Agendamento e Handoff (FLUP)

- [ ] **FLUP-01**: Se o lead não responde, envia follow-up curto após tempo configurável (R-003)
- [ ] **FLUP-02**: Cadência de follow-up 1h → 1d → 3d → 7d; cadência interrompida se responder, opt-out, handoff ou pausa manual (R-004)
- [ ] **FLUP-03**: Máximo de 4 tentativas (1h, 1d, 3d, 7d); após 7 dias sem resposta, encerra e marca "sem resposta"; follow-up de 15 dias NÃO é executado (R-005)
- [ ] **FLUP-04**: Handoff acionado em pedido de preço/proposta/orçamento OU intenção de agendar reunião/chamada; automação pausa e notifica (R-012)
- [ ] **FLUP-05**: Notificação local (som + pop-up) em handoff, identificando lead, motivo e ação rápida (R-013)
- [ ] **FLUP-06**: Após handoff quando o Admin assume, bot entra em modo copiloto: sugere respostas sem enviar nada (R-014)
- [ ] **FLUP-07**: Bot nunca agenda sozinho; apenas avisa; sem link, horários ou confirmação (R-025)
- [ ] **FLUP-08**: Após o Admin registrar agendamento, o bot envia confirmação e lembrete antes da reunião, com opção de confirmar/remarcar/cancelar, respeitando janela e limite (R-026)
- [ ] **FLUP-09**: Handoff também em irritação, ameaça de denúncia/bloqueio, pedido de opt-out e dúvida técnica complexa (R-065)
- [ ] **FLUP-10**: Em irritação/ameaça: pausa automação, notifica, silêncio total, aguarda decisão; bot não se desculpa nem ameniza sozinho (R-066)

### CRM Local e Pipeline (CRM)

- [ ] **CRM-01**: Pipeline completo de status: Novo → Contatado → Respondeu → Qualificado → Aquecido → Reunião agendada → Proposta → Fechado → Perdido (com motivo) (R-021)
- [ ] **CRM-02**: IA atualiza status automaticamente com transições de critérios claros e auditáveis; status críticos com justificativa e timestamp; Admin corrige manualmente (R-022)
- [ ] **CRM-03**: CRMS intermediário: lista de leads, status, histórico (imutável), busca, tags, filtros, notas, tarefas, lembretes e responsável; Admin cria notas/tarefas e a IA cria notas automáticas (resumo, objeções, próximos passos) (R-043)

### Integrações (INTR)

- [ ] **INTR-01**: Escopo mínimo de integrações: API do caça-leads, API externa de LLM e WhatsApp local; nenhuma outra nesta etapa (R-044)

### Compliance, Segurança e LGPD (COMP)

- [ ] **COMP-01**: Detecta opt-out automaticamente; registra base legal/finalidade/consentimento; oferece comando manual de opt-out e exclusão; aplica política de retenção (R-024)
- [ ] **COMP-02**: Trata base de contato sem opt-in explícito (fontes públicas/terceiros) com risco declarado de MUITO ALTO (R-063)
- [ ] **COMP-03**: Base legal de legítimo interesse para contato B2B: registra origem, base legal e finalidade; opt-out imediato; exclusão sob solicitação (R-064)
- [ ] **COMP-04**: Sem criptografia adicional nesta fase; confiança no controle de acesso do PC (risco aceito e documentado) (R-033)
- [ ] **COMP-05**: Auth state do WhatsApp e backups fora da árvore OneDrive/git (derivado da pesquisa — protege R-033/LGPD)

### Requisitos Não Funcionais e Operação Local (NFRQ)

- [ ] **NFRQ-01**: Banco PostgreSQL local com script/migração de criação e atualização de schema; sem servidor externo (R-031)
- [ ] **NFRQ-02**: Backup manual para pasta local, versionado por data/hora, com restauração sem serviços externos (R-032)
- [ ] **NFRQ-03**: Modo automático total após a 1ª mensagem manual; bot conduz sozinho e só chama nos handoffs; após handoff → modo copiloto (R-034)
- [ ] **NFRQ-04**: Logs em arquivo + painel de erros + notificação local imediata em falhas críticas (WhatsApp desconectado, API de IA fora, PostgreSQL parado, suspeita de banimento) (R-045)
- [ ] **NFRQ-05**: Painel de controle: lista de leads + chat + sugestões da IA + histórico + botões de ação rápida (pausar bot, assumir, devolver ao bot, copiloto); exibe modo em tempo real; sugestões só enviadas com ação explícita (R-046)
- [ ] **NFRQ-06**: Roda em Windows: PostgreSQL local, sessão WhatsApp, painel e notificações nativas compatíveis (R-047)

### Equipe e Arquitetura (EQUP)

- [ ] **EQUP-01**: Usuário único nesta fase; sem perfis, permissões ou auditoria multiusuário (R-027)
- [ ] **EQUP-02**: Arquitetura preparada para multiusuário futuro: campos de responsável, criado por, permissões e auditoria no schema desde já (R-028)

### Critérios do Piloto (PILO)

- [ ] **PILO-01**: Escopo do MVP executado conforme R-060 (núcleo operacional listado acima) (R-060)
- [ ] **PILO-02**: Critérios de sucesso do piloto: 5 reuniões agendadas/mês e 30% de taxa de qualificação/mês (R-061)
- [ ] **PILO-03**: Apuração mensal dos critérios de sucesso (R-062)

## v2 Requirements

Adiados para depois do piloto. Rastreados, mas fora do roadmap atual.

### Analytics e Relatórios

- **ANLT-01**: Painel avançado de relatórios: leads importados, mensagens, respostas, reuniões, taxas, objeções, tempo médio, no-show, desempenho por script/IA/horário/nicho/número, motivos de perda, custo por conversa, funil completo (R-035)
- **ANLT-02**: Exportação CSV/Excel com filtros por período, nicho, status, número e usuário (R-035)

### Financeiro e Comercial

- **FIN-01**: Registro básico de valor da proposta, status de pagamento e ticket médio, manual pelo Admin (R-036 — básico; pode entrar ainda no piloto se cobrir R-060)

### Equipe, Perfis e Processos

- **EQUP-03**: Perfis Admin e Vendedor; Admin com acesso total, Vendedor com acesso limitado (R-029)
- **EQUP-04**: Vendedor vê e assume apenas leads atribuídos; não dispara campanhas, não aprova mensagens, não acessa financeiro nem configurações (R-030)
- **OPER-01**: Aquecimento assistido do número em fases (5–10 → 10–15 → 15–20 → 20–25 → 20–30 mensagens/dia) como sugestão, nunca bloqueio (R-039, R-040)
- **OPER-02**: Rolls/liberação progressiva do sistema para a equipe após o piloto (R-048 completo)

### Consolidação do Fluxo

- **FLUP-11**: Break-up message ao encerrar "sem resposta" — decisão com dado do piloto (questão aberta da pesquisa, não muda R-005 por ora)

## Out of Scope

Explicitamente excluídos. Documentado para prevenir escopo creep.

| Feature | Reason |
|---------|--------|
| Negociação de preço, proposta, orçamento, prazo ou condições comerciais pelo bot | AR-001/AR-002/AR-012 — handoff imediato, sem exceção |
| Agendamento autônomo de reuniões | AR-003/R-025 — bot apenas avisa |
| Envio de mídia pelo bot | AR-004/R-037 — apenas texto e links |
| Processamento de mídia recebida | AR-009/R-038 — apenas registra e faz handoff |
| Contorno de opt-out de qualquer forma | AR-005/R-024 — opt-out irreversível |
| Revelação espontânea de automação / impersonação profunda (clonar voz, fabricar dados do Admin) | AR-006/R-055 — silêncio total + handoff |
| Resposta fora da janela 7h–17h dias úteis | AR-007/R-006 — única exceção R-007 (dreno pós-abertura) |
| Ultrapassar limite de mensagens/dia ou contatos novos/dia | AR-008/R-023 — travas duras; 463 nunca retryado |
| Enviar qualquer mensagem após handoff até o Admin assumir/devolver | AR-010/R-066 — silêncio total |
| Contatar lead sem registrar origem, base legal e finalidade | AR-011/R-064 — bloqueio absoluto |
| Auto primeiro contato / mensagem de massa / broadcast | R-001 + pesquisa (463/RFT, políticas Meta) |
| Ferramentas conformáveis da API oficial (templates, quality rating, opt-in Meta) | Pesquisa: prospecção fria é proibida na plataforma oficial — conjunto é anti-feature, não backlog |
| Google Calendar, e-mail, Telegram, planilhas, webhooks ou CRM externo | R-044 — escopo mínimo de integrações |
| Relatórios avançados e analytics completo (R-035) | v2 — apesar de desejável, fora do núcleo do piloto (R-060) |
| Financeiro avançado: contratos, recibos, comissões, impostos | R-036 limitado a registro básico manual |
| Perfis de usuário, permissões e auditoria multiusuário operacionais | R-029/R-030 — v2; schema já prepara (R-028) |
| Criptografia adicional dos dados | R-033 — risco aceito conscientemente |
| Aquecimento automático/controlado do número | R-039/R-040 — apenas sugestão, Admin controla |
| Deduplicação automática de leads | R-020 — decisão manual para evitar sobreposição |
| Redundância de números / multi-número | R-059 — um número dedicado; risco "sem redundância" aceito e documentado |

## Traceability

Atualizado na criação do roadmap (2026-09-28), mapeamento corrigido após auditoria dos 60 REQ-IDs v1 contra a estrutura do sintetizador.

| Requirement | Phase | Status |
|-------------|-------|--------|
| OPRE-01 | Phase 1 | Pending |
| OPRE-02 | Phase 4 | Pending |
| OPRE-03 | Phase 4 | Pending |
| OPRE-04 | Phase 2 | Pending |
| OPRE-05 | Phase 2 | Pending |
| LEAD-01 | Phase 1 | Pending |
| LEAD-02 | Phase 1 | Pending |
| LEAD-03 | Phase 1 | Pending |
| LEAD-04 | Phase 1 | Pending |
| LEAD-05 | Phase 2 | Pending |
| LEAD-06 | Phase 2 | Pending |
| WHS-01 | Phase 1 | Pending |
| WHS-02 | Phase 3 | Pending |
| WHS-03 | Phase 1 | Pending |
| WHS-04 | Phase 1 | Pending |
| WHS-05 | Phase 1 | Pending |
| CONV-01 | Phase 2 | Pending |
| CONV-02 | Phase 2 | Pending |
| CONV-03 | Phase 2 | Pending |
| CONV-04 | Phase 2 | Pending |
| CONV-05 | Phase 2 | Pending |
| CONV-06 | Phase 2 | Pending |
| CONV-07 | Phase 2 | Pending |
| CONV-08 | Phase 2 | Pending |
| CONV-09 | Phase 2 | Pending |
| CONV-10 | Phase 2 | Pending |
| CONV-11 | Phase 1 | Pending |
| CONV-12 | Phase 2 | Pending |
| CONV-13 | Phase 1 | Pending |
| CONV-14 | Phase 1 | Pending |
| FLUP-01 | Phase 3 | Pending |
| FLUP-02 | Phase 3 | Pending |
| FLUP-03 | Phase 3 | Pending |
| FLUP-04 | Phase 2 | Pending |
| FLUP-05 | Phase 2 | Pending |
| FLUP-06 | Phase 3 | Pending |
| FLUP-07 | Phase 2 | Pending |
| FLUP-08 | Phase 3 | Pending |
| FLUP-09 | Phase 2 | Pending |
| FLUP-10 | Phase 2 | Pending |
| CRM-01 | Phase 3 | Pending |
| CRM-02 | Phase 2 | Pending |
| CRM-03 | Phase 3 | Pending |
| INTR-01 | Phase 1 | Pending |
| COMP-01 | Phase 2 | Pending |
| COMP-02 | Phase 1 | Pending |
| COMP-03 | Phase 1 | Pending |
| COMP-04 | Phase 1 | Pending |
| COMP-05 | Phase 1 | Pending |
| NFRQ-01 | Phase 1 | Pending |
| NFRQ-02 | Phase 1 | Pending |
| NFRQ-03 | Phase 2 | Pending |
| NFRQ-04 | Phase 1 | Pending |
| NFRQ-05 | Phase 3 | Pending |
| NFRQ-06 | Phase 1 | Pending |
| EQUP-01 | Phase 1 | Pending |
| EQUP-02 | Phase 1 | Pending |
| PILO-01 | Phase 4 | Pending |
| PILO-02 | Phase 4 | Pending |
| PILO-03 | Phase 4 | Pending |

**Coverage:**
- v1 requirements (REQ-IDs): 60 total
- Mapped to phases: 60
- Unmapped: 0 ✓
- Nota: a contagem "67" (R-001…R-067) inclui 7 IDs v2/fora de escopo (R-029, R-030, R-035, R-036, R-039, R-040, R-048); todos os 60 requisitos v1 em REQ-IDs estão mapeados, sem órfãos nem duplicatas.

---
*Requirements defined: 2026-09-28*
*Last updated: 2026-09-28 after roadmap creation (traceability auditado e corrigido: CONV-13/CONV-14 → Fase 1, LEAD-05/06 e handoffs → Fase 2, OPRE-02/03 → Fase 4)*