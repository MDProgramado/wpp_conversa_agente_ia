# 01 — Requisitos Funcionais

> Sistema local de automação de conversas no WhatsApp para prospecção B2B e venda de serviços digitais (sites, sistemas, automações).
> Fluxo: você envia a 1ª mensagem manualmente → bot assume → IA conduz → follow-up → handoff humano em momento crítico.

---

## Módulo 1 — Perfil da Operação e Modelo de Negócio

### R-001 — Assunção do bot após primeira mensagem humana
- **Descrição:** O usuário envia manualmente a primeira mensagem ao lead. Após esse envio, o sistema assume a conversa.
- **Regra:** A automação NÃO inicia o primeiro contato. O primeiro contato é sempre humano.
- **Dados:** lead, mensagem inicial, timestamp, número de WhatsApp.
- **Risco:** confusão no lead, aparência robótica, banimento.

### R-048 — Modelo comercial: agência/estúdio com equipe
- **Descrição:** O usuário atua como agência/estúdio com equipe, não como vendedor solo.
- **Regra:** O sistema deve considerar que a operação pode ter equipe em funções diferentes.
- **Pendência:** reconciliar com R-027 (single-user nesta fase).

### R-049 — Implantação gradual
- **Descrição:** Fase inicial apenas com o Admin (você). Equipe continua prospecção manual. Futuramente, sistema liberado para todos.
- **Regra:** Durante o piloto, não criar usuários adicionais nem atribuir leads. Handoffs e notificações centralizados em você.
- **Risco:** sobreposição entre prospecção manual da equipe e automação.

### R-050 — Evitar sobreposição no piloto
- **Descrição:** A lista de leads do sistema NÃO é compartilhada com a equipe. Você coordena manualmente quem aborda o quê.
- **Risco:** ALTO — mesma pessoa abordada duas vezes → irritação, denúncia, banimento.

### R-053 — Serviços oferecidos
- **Descrição:** Sites, sistemas, automações e tudo que envolva programação.
- **Regra:** IA pode mencionar serviços de forma consultiva, mas NUNCA negociar preço, prazo ou escopo.
- **Risco:** IA divagar, prometer o que não pode entregar.

### R-054 — Nichos de atuação
- **Descrição:** Vários nichos, sem prioridade definida.
- **Regra:** IA NÃO deve presumir nicho, porte, dor ou necessidade. Personalização ocorre durante a conversa.

---

## Módulo 2 — Origem, Ingestão e Qualificação de Leads

### R-017 — Integração via API do sistema de caça-leads
- **Descrição:** Integração com API do sistema de caça-leads. Parâmetros: estado, cidade, região, categoria/nicho, nome-chave. Retorna lista com botão "abordar no WhatsApp".
- **Regra:** Automação não inicia conversa. Consome dados da API e assume após o envio da 1ª mensagem.
- **Risco:** dependência da API, qualidade dos leads, LGPD, duplicidade.

### R-018 — Dados disponíveis por lead
- **Descrição:** API retorna apenas **nome, telefone e endereço**.
- **Regra:** IA NÃO pode assumir dados não fornecidos. Deve descobrir contexto durante a conversa.
- **Risco:** IA pode perguntar demais e soar robotizada.

### R-019 — Validação de número
- **Descrição:** A validação de WhatsApp é responsabilidade do sistema de caça-leads (só retorna números ativos).
- **Regra:** Automação NÃO precisa validar existência; tratar erros de envio sem quebrar a fila.

### R-020 — Deduplicação manual
- **Descrição:** Sistema NÃO deduplica automaticamente. Você decide qual lead abordar.
- **Regra:** Manter todos os registros; sinalizar duplicidades com histórico de tentativas.
- **Risco:** abordar mesmo lead duas vezes → banimento.

### R-051 — Critérios de qualificação
- **Descrição:** Lead qualificado = tem **verba/interesse em investir** E **capacidade de decisão**.
- **Regra:** IA não avança para oferta/handoff de preço sem identificar os dois critérios.
- **Risco:** inferência errada → qualificar/desqualificar indevidamente.

### R-052 — Validação híbrida de verba e decisão
- **Descrição:** IA valida verba/decisão de forma híbrida: indireto por contexto → pergunta direta educada se necessário.
- **Regra:** Não transformar em interrogatório. Não perguntar valor exato.

---

## Módulo 3 — Infraestrutura Local e Conexão com WhatsApp

### R-006 — Janela de envio
- **Descrição:** Operação em **dias úteis, das 7h às 17h**.
- **Regra:** Nenhuma mensagem automática fora desse intervalo.

### R-007 — Follow-ups vencidos fora da janela
- **Descrição:** Follow-up agendado fora da janela → enviar **assim que o app abrir**, mesmo fora da janela.
- **Risco:** ALTO — disparo em rajada pode causar banimento.

### R-015 — Definição do canal
- **Descrição:** Opções em avaliação: API oficial, biblioteca não oficial, WhatsApp Web, híbrido.
- **Regra:** Equilibrar custo, risco de banimento, esforço e operação local 24/7.

### R-016 — Estratégia híbrida
- **Descrição:** Iniciar com conexão não oficial (Baileys/WPPConnect) em número dedicado. Migrar para API oficial quando houver resultados.
- **Regra:** Camada de conexão isolada (interface/adaptador). Troca de canal não quebra histórico, status ou agendamentos.
- **Risco:** banimento do número antes da migração.

### R-023 — Volume diário e limite de mensagens
- **Descrição:** Até **20 leads/dia** e **20–30 mensagens/dia**.
- **Regra:** Trava de segurança. Ao atingir, parar e enfileirar para o próximo dia útil.
- **Risco:** limite baixo atrasa operação; limite alto aumenta banimento.

### R-039 — Aquecimento do número
- **Descrição:** Sistema sugere estratégia de aquecimento em fases (5–10 → 10–15 → 15–20 → 20–25 → 20–30 mensagens/dia).
- **Regra:** Sugestão apenas; você controla manualmente (R-040).

### R-040 — Controle manual do aquecimento
- **Descrição:** Sistema apenas sugere; NÃO bloqueia automaticamente o volume.
- **Regra:** Você decide e controla manualmente.
- **Risco:** ultrapassar limites seguros por engano → banimento.

### R-059 — Número dedicado único
- **Descrição:** Apenas **um número de WhatsApp dedicado** exclusivo para vendas.
- **Risco:** ALTO — se banido, operação inteira para. Sem redundância.

---

## Módulo 4 — Fluxo de Conversa, IA e Aquecimento

### R-002 — Assunção imediata
- **Descrição:** Bot assume assim que você envia a 1ª mensagem, mesmo sem resposta do lead.

### R-008 — Resposta automática com IA
- **Descrição:** Ao detectar resposta do lead, bot conduz conversa com IA (qualificação, aquecimento, diagnóstico, objeções, CTA) em tom humanizado.
- **Regra:** Não responder roboticamente. Manter contexto. Handoff no momento crítico.

### R-009 — Provedor de IA externo
- **Descrição:** Usar **API externa de LLM** (OpenAI, Gemini, Claude etc.).
- **Regra:** Sistema local controla fluxo, limites e handoff. Minimizar/mascarar dados sensíveis antes do envio.
- **Risco:** LGPD, indisponibilidade, custo, latência, alucinação, vazamento.

### R-010 — Tom de voz e persona
- **Descrição:** Tom **consultivo, educado e direto**, focado em entender a dor do cliente antes de oferecer solução.
- **Regra:** Não empurrar oferta precocemente. Priorizar diagnóstico e escuta.

### R-011 — Condução dinâmica e humanizada
- **Descrição:** IA conduz conversa de forma dinâmica, sem script rígido. Conversa como pessoa normal.
- **Regra:** NÃO transformar em questionário. Alternar entre ouvir, comentar, validar, contextualizar e perguntar.
- **Risco:** IA fugir do controle, prometer indevidamente, alucinar.

### R-041 — Tratamento de objeções
- **Descrição:** Bot reconhece objeções (preço, tempo, fornecedor, "vou pensar") e tenta contornar com argumentos.
- **Regra:** Pedidos de preço/proposta/orçamento SEMPRE acionam handoff (R-012), independente da objeção.

### R-042 — Contorno autônomo de objeções
- **Descrição:** IA pode gerar argumentos autonomamente, sem aprovação prévia.
- **Regra:** Limites rígidos: NUNCA negociar valores, prometer prazos, oferecer descontos, enviar proposta ou confirmar agendamento.
- **Risco:** ALTO — alucinação, promessas indevidas, irritação do lead.

### R-055 — Identidade do bot
- **Descrição:** IA age como se fosse você (humano), sem revelar automação.
- **Risco:** MUITO ALTO — pode violar políticas WhatsApp/Meta e LGPD.

### R-056 — Pergunta direta sobre automação
- **Descrição:** Se lead perguntar se é bot/robô/IA → handoff imediato, você assume como humano.
- **Regra:** IA não nega, não admite, não desvia sozinha.

### R-057 — Silêncio total em suspeita de automação
- **Descrição:** Quando lead pergunta se é bot → **silêncio total** até você assumir.
- **Regra:** Nenhuma mensagem de transição. Handoff prioritário.

### R-037 — Envio de mídia
- **Descrição:** Bot envia **apenas texto e links**. NUNCA imagens, PDFs, áudios, vídeos ou documentos.
- **Regra:** Portfólio/proposta enviados manualmente por você após handoff.

### R-038 — Tratamento de mídia recebida
- **Descrição:** Bot NÃO processa áudio, imagem, PDF ou vídeo. Apenas registra, notifica você e aciona handoff.
- **Regra:** Conversa pausada até sua intervenção. IA não finge que entendeu.

### R-067 — Humanização do envio
- **Descrição:** Delays aleatórios + simulação de "digitando…" + quebra de mensagens longas em várias curtas.
- **Regra:** Delays variáveis, respeitar janela e limite diário. Handoff não segue essa regra.

---

## Módulo 5 — Follow-up, Agendamento e Handoff Humano

### R-003 — Follow-up enquanto lead não responde
- **Descrição:** Se lead não responde, bot aguarda tempo configurável e envia follow-up curto. Inicia sequência programada.

### R-004 — Cadência de follow-up
- **Descrição:** Cadência: **1h → 1d → 3d → 7d → 15d** (inicialmente).
- **Regra:** Interromper se lead responder, opt-out, handoff ou pausa manual.

### R-005 — Limite da sequência (revisado)
- **Descrição:** Máximo **4 tentativas: 1h, 1d, 3d, 7d**. Após 7 dias sem resposta → encerrar e marcar "sem resposta".
- **Regra:** Follow-up de 15 dias NÃO deve ser executado.

### R-012 — Gatilhos de handoff
- **Descrição:** Handoff acionado quando lead pede **preço/proposta/orçamento** OU demonstra **intenção de agendar reunião/chamada**.
- **Regra:** IA não negocia preço, não fecha proposta, não confirma agendamento. Pausa automação e notifica você.

### R-013 — Notificação de handoff
- **Descrição:** Notificação **local no PC**, com som e pop-up.
- **Regra:** Identificar lead, motivo do handoff e permitir ação rápida.

### R-014 — Modo Copiloto
- **Descrição:** Após handoff e quando você assume, bot entra em modo copiloto: **sugere respostas sem enviar nada**.
- **Regra:** Nenhuma mensagem é enviada sem ação explícita sua. Você tem total autonomia.

### R-025 — Agendamento manual
- **Descrição:** Bot NÃO agenda sozinho. Apenas avisa você. Você agenda manualmente.
- **Regra:** Sem integração com calendário nesta etapa. Bot não envia link, não sugere horários, não confirma.

### R-026 — Confirmação e lembrete pós-agendamento
- **Descrição:** Após você registrar agendamento, bot envia confirmação e lembrete antes da reunião.
- **Regra:** Mensagem humanizada com data, hora, canal. Permitir confirmar/remarcar/cancelar. Respeitar janela e limite.

### R-065 — Gatilhos adicionais de handoff
- **Descrição:** Handoff também em: **irritação**, **ameaça de denúncia/bloqueio**, **pedido de opt-out**, **dúvida técnica complexa**.

### R-066 — Handoff por irritação ou ameaça
- **Descrição:** Em caso de irritação ou ameaça → pausar automação, notificar você, **silêncio total**, aguardar decisão.
- **Regra:** IA não tenta se desculpar, amenizar ou responder sozinha.

---

## Módulo 6 — CRM Local, Pipeline e Histórico

### R-021 — Status do lead
- **Descrição:** Pipeline completo: **Novo → Contatado → Respondeu → Qualificado → Aquecido → Reunião agendada → Proposta → Fechado → Perdido**.
- **Regra:** Cada lead em um status por vez. "Perdido" deve exigir/sugerir motivo.

### R-022 — Atualização automática de status
- **Descrição:** IA atualiza status automaticamente com base na conversa.
- **Regra:** Transições com critérios claros e auditáveis. Status críticos com justificativa e timestamp. Você pode corrigir manualmente.

### R-043 — Recursos intermediários do CRM
- **Descrição:** Lista de leads, status, histórico, busca, **tags, filtros, notas, tarefas, lembretes e responsável**.
- **Regra:** Notas e tarefas podem ser criadas por você. IA cria notas automáticas (resumo, objeções, próximos passos). Histórico não pode ser editado.

---

## Módulo 7 — Integrações

### R-044 — Escopo mínimo de integrações
- **Descrição:** Apenas API do sistema de caça-leads, API externa de LLM e WhatsApp local.
- **Regra:** Sem Google Calendar, e-mail, Telegram, planilhas, webhooks ou CRM externo nesta etapa.

---

## Módulo 8 — Analytics e Relatórios

### R-035 — Painel avançado
- **Descrição:** Relatórios avançados: leads importados, mensagens, respostas, reuniões agendadas, taxas, objeções, tempo médio, no-show, desempenho por script/IA/horário/nicho/número, motivos de perda, custo por conversa, funil completo.
- **Regra:** Dados do PostgreSQL local. Exportação CSV/Excel. Filtros por período, nicho, status, número, usuário.

---

## Módulo 9 — Financeiro e Comercial

### R-036 (revisado) — Financeiro básico
- **Descrição:** Registro básico de **valor da proposta**, **status de pagamento** e **ticket médio**. Sem contratos, recibos, comissões, impostos ou relatórios avançados.
- **Regra:** Registro manual pelo Admin. Bot continua proibido de enviar preço ou negociar.

---

## Módulo 10 — Equipe, Processos e Permissões

### R-027 — Usuário único nesta fase
- **Descrição:** Apenas você usará o sistema agora. Sem perfis, permissões ou auditoria multiusuário nesta etapa.

### R-028 — Preparação para multiusuário
- **Descrição:** Arquitetura preparada para múltiplos usuários no futuro (campos de responsável, criado por, permissões, auditoria).

### R-029 — Perfis de usuário
- **Descrição:** Perfis previstos: **Admin** e **Vendedor**.
- **Regra:** Admin tem acesso total. Vendedor tem acesso limitado.

### R-030 — Permissões do Vendedor
- **Descrição:** Vendedor vê e assume **apenas leads atribuídos a ele**. Não dispara campanhas, não aprova mensagens, não acessa financeiro nem configurações.

---

## Módulo 11 — Compliance, Segurança e Riscos

### R-024 — Opt-out e LGPD
- **Descrição:** Sistema deve: detectar opt-out automaticamente; registrar base legal/finalidade/consentimento; oferecer comando manual de opt-out e exclusão; aplicar política de retenção.
- **Regra:** Opt-out é irreversível por padrão. IA não contorna. Registra data, hora e conteúdo.

### R-063 — Base de contato sem opt-in
- **Descrição:** Leads NÃO possuem opt-in explícito. Dados de fontes públicas/terceiros.
- **Risco:** MUITO ALTO — LGPD, denúncias, banimento, impossibilidade de usar API oficial para mensagens iniciadas pelo negócio.

### R-064 — Base legal por legítimo interesse
- **Descrição:** Usar **legítimo interesse** para contato B2B, com avaliação, transparência e opt-out.
- **Regra:** Registrar origem, base legal e finalidade. Contato relacionado à atividade profissional. Opt-out imediato. Exclusão sob solicitação.

### R-033 — Proteção local dos dados
- **Descrição:** **Sem criptografia adicional** implementada pelo sistema. Confiança no controle de acesso do PC.
- **Risco:** ALTO — vazamento em caso de acesso indevido, malware, roubo.

---

## Módulo 12 — Requisitos Não Funcionais e Operação Local

### R-031 — Persistência em PostgreSQL local
- **Descrição:** Banco **PostgreSQL local**. Script/migração para criação e atualização do schema. Sem servidor externo.

### R-032 — Backup manual
- **Descrição:** Backup **manual** quando você quiser, para pasta local.
- **Regra:** Versionado por data/hora. Restauração sem serviços externos.

### R-034 — Modo de operação
- **Descrição:** Modo **automático total**. Após 1ª mensagem manual, bot conduz tudo sozinho. Só chama nos handoffs. Após handoff → modo copiloto.
- **Risco:** ALTO — banimento, respostas inadequadas, alucinação, promessas indevidas.

### R-045 — Logs e tratamento de falhas
- **Descrição:** Logs detalhados em arquivo + painel de erros. Notificação local imediata em falhas críticas (WhatsApp desconectado, API de IA fora, PostgreSQL parado, banimento).
- **Regra:** Timestamp, severidade, módulo, mensagem, contexto.

### R-046 — Painel de controle
- **Descrição:** Painel dividido: **lista de leads + chat + sugestões da IA + histórico + botões de ação rápida** (pausar bot, assumir, devolver ao bot, copiloto).
- **Regra:** Exibir modo em tempo real (bot, copiloto, handoff, manual). Sugestões só enviadas com ação explícita.

### R-047 — Sistema operacional
- **Descrição:** Rodar em **Windows**. PostgreSQL local, sessão WhatsApp, painel e notificações nativas compatíveis.

---

## Módulo 13 — Escopo do MVP

### R-060 — Núcleo operacional do MVP
- **Descrição:** MVP inclui: importação via API, 1ª mensagem manual, bot assumindo, IA respondendo, follow-up 1h/1d/3d/7d, handoff por preço/agendamento, notificação local, CRM básico/intermediário, janela 7h–17h, limite 20–30/dia, opt-out e LGPD, número único, PostgreSQL, backup manual, logs e notificação de falhas críticas.
- **Fora do MVP:** relatórios avançados, financeiro, multiusuário completo, aquecimento controlado, logs detalhados, painel dividido completo, modo copiloto completo.

### R-061 — Critérios de sucesso do piloto
- **Descrição:** **5 reuniões agendadas/mês** E **taxa de qualificação de 30%/mês**.

### R-062 — Período de apuração
- **Descrição:** Apuração **mensal** dos critérios de sucesso.

---

## Resumo de Rastreabilidade

| Módulo | Requisitos |
|---|---|
| Perfil da Operação | R-001, R-048, R-049, R-050, R-053, R-054 |
| Ingestão de Leads | R-017, R-018, R-019, R-020, R-051, R-052 |
| Infraestrutura WhatsApp | R-006, R-007, R-015, R-016, R-023, R-039, R-040, R-059 |
| Fluxo/IA | R-002, R-008, R-009, R-010, R-011, R-041, R-042, R-055, R-056, R-057, R-037, R-038, R-067 |
| Follow-up/Handoff | R-003, R-004, R-005, R-012, R-013, R-014, R-025, R-026, R-065, R-066 |
| CRM | R-021, R-022, R-043 |
| Integrações | R-044 |
| Analytics | R-035 |
| Financeiro | R-036 |
| Equipe | R-027, R-028, R-029, R-030 |
| Compliance | R-024, R-063, R-064, R-033 |
| Não Funcionais | R-031, R-032, R-034, R-045, R-046, R-047 |
| MVP | R-060, R-061, R-062 |