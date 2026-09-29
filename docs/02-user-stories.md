# 02 — User Stories

> Histórias de usuário por persona, com critérios de aceitação resumidos.
> Cada user story referencia os requisitos funcionais (R-XXX) e anti-requisitos (AR-XXX) que a sustentam.

---

## Personas

| ID | Persona | Descrição | Fase |
|---|---|---|---|
| **P-01** | Admin (você) | Dono da agência. Opera o sistema sozinho no piloto. Acesso total. | Piloto |
| **P-02** | Vendedor | Futuro usuário. Vê e assume apenas leads atribuídos a ele. | Expansão |
| **P-03** | Lead B2B | Empresa prospectada. Interage pelo WhatsApp. Não usa o sistema. | Sempre |
| **P-04** | Equipe de prospecção (atual) | Faz prospecção manual hoje. Migrará gradualmente para o sistema. | Transição |

---

## Épico 1 — Ingestão de Leads

### US-001 — Importar leads da API do sistema de caça-leads
**Como** Admin,  
**quero** importar leads a partir da API do sistema de caça-leads informando estado, cidade, região, categoria/nicho e nome-chave,  
**para** ter uma lista de empresas com WhatsApp ativo prontas para abordagem.

**Critérios de aceitação:**
- [ ] O sistema aceita os parâmetros: estado, cidade, região, categoria/nicho, nome-chave.
- [ ] A API retorna nome, telefone e endereço (R-018).
- [ ] A lista é exibida com o botão "Abordar no WhatsApp".
- [ ] Leads duplicados são mantidos e sinalizados (R-020).
- [ ] A origem da busca é registrada (R-064).

**Requisitos:** R-017, R-018, R-019, R-020  
**Anti-requisitos:** AR-011

---

### US-002 — Visualizar lista de leads com contexto de duplicidade
**Como** Admin,  
**quero** ver quando um telefone já apareceu em buscas anteriores,  
**para** decidir manualmente se abordo ou não o mesmo lead duas vezes.

**Critérios de aceitação:**
- [ ] O sistema agrupa ou sinaliza registros com o mesmo telefone.
- [ ] Exibe o histórico de tentativas anteriores (data, origem, status).
- [ ] A decisão de abordar é sempre minha (R-020).
- [ ] Nenhum lead é descartado automaticamente.

**Requisitos:** R-020  
**Anti-requisitos:** —

---

### US-003 — Registrar origem, base legal e finalidade do lead
**Como** Admin,  
**quero** que cada lead tenha registrada a origem, a base legal (legítimo interesse) e a finalidade do contato,  
**para** estar em conformidade com a LGPD.

**Critérios de aceitação:**
- [ ] Origem registrada (parâmetros de busca, data, sistema).
- [ ] Base legal registrada como "legítimo interesse".
- [ ] Finalidade registrada como "contato comercial B2B".
- [ ] Avaliação de legítimo interesse documentada (simplificada).
- [ ] O sistema bloqueia contato sem esses registros (R-064, AR-011).

**Requisitos:** R-063, R-064  
**Anti-requisitos:** AR-011

---

## Épico 2 — Primeira Abordagem

### US-004 — Enviar a primeira mensagem manualmente
**Como** Admin,  
**quero** enviar a primeira mensagem manualmente ao lead,  
**para** garantir que o primeiro contato seja humano e personalizado.

**Critérios de aceitação:**
- [ ] O sistema nunca inicia a conversa sozinho (R-001).
- [ ] Eu escolho o lead e envio a primeira mensagem.
- [ ] O bot assume imediatamente após o envio (R-002).
- [ ] O timestamp do envio é registrado.
- [ ] O número dedicado é usado (R-059).

**Requisitos:** R-001, R-002, R-059  
**Anti-requisitos:** —

---

### US-005 — Bot assumir imediatamente após o envio
**Como** Admin,  
**quero** que o bot assuma a conversa assim que eu enviar a primeira mensagem,  
**para** não perder tempo de resposta e já iniciar o monitoramento.

**Critérios de aceitação:**
- [ ] O bot assume mesmo sem resposta do lead.
- [ ] O modo de operação é "automático total" (R-034).
- [ ] Se o lead não responder, o follow-up 1h/1d/3d/7d é agendado (R-004).
- [ ] Eu posso pausar a automação a qualquer momento.

**Requisitos:** R-002, R-034, R-003, R-004  
**Anti-requisitos:** —

---

## Épico 3 — Condução da Conversa pela IA

### US-006 — IA conduzir a conversa em tom consultivo
**Como** Lead B2B,  
**quero** conversar com alguém que entende minha dor antes de me oferecer algo,  
**para** sentir que estou sendo ouvido e não apenas empurrado para uma venda.

**Critérios de aceitação:**
- [ ] A IA usa tom consultivo, educado e direto (R-010).
- [ ] A IA entende o contexto antes de ofertar.
- [ ] A IA não faz muitas perguntas seguidas (R-011).
- [ ] A IA conversa como pessoa normal, sem script rígido.
- [ ] A IA quebra mensagens longas em várias curtas + simula digitação (R-067).

**Requisitos:** R-010, R-011, R-067  
**Anti-requisitos:** AR-006

---

### US-007 — IA qualificar lead (verba/interesse + poder de decisão)
**Como** Admin,  
**quero** que a IA qualifique o lead identificando verba/interesse e poder de decisão,  
**para** focar meu tempo apenas nos leads com real potencial.

**Critérios de aceitação:**
- [ ] A IA identifica verba/interesse em investir.
- [ ] A IA identifica poder de decisão (dono, sócio, autonomia).
- [ ] A validação é híbrida: indireta por contexto → pergunta direta educada se necessário (R-052).
- [ ] A IA não pergunta valor exato.
- [ ] Lead só é marcado "Qualificado" quando os dois critérios forem identificados (R-051).

**Requisitos:** R-051, R-052  
**Anti-requisitos:** —

---

### US-008 — IA contornar objeções comuns
**Como** Lead B2B,  
**quero** receber respostas consultivas para minhas objeções (preço, tempo, fornecedor),  
**para** sentir que a conversa avança sem pressão.

**Critérios de aceitação:**
- [ ] A IA reconhece objeções comuns (R-041).
- [ ] A IA gera argumentos autonomamente (R-042).
- [ ] A IA NUNCA negocia valores, promete prazos ou oferece descontos (AR-001, AR-002).
- [ ] Pedido de preço SEMPRE aciona handoff (AR-012, R-012).
- [ ] Se a objeção persistir, a IA aciona handoff.

**Requisitos:** R-041, R-042, R-012  
**Anti-requisitos:** AR-001, AR-002, AR-012

---

### US-009 — IA não revelar automação espontaneamente
**Como** Admin,  
**quero** que a IA conduza a conversa como se fosse eu,  
**para** manter a experiência humanizada.

**Critérios de aceitação:**
- [ ] A IA não se identifica como bot/IA espontaneamente (R-055).
- [ ] A IA não usa linguagem que denuncie automação.
- [ ] Se o lead perguntar diretamente se é bot → silêncio total + handoff (R-056, R-057).

**Requisitos:** R-055, R-056, R-057  
**Anti-requisitos:** AR-006

---

### US-010 — IA tratar mídia recebida com handoff
**Como** Admin,  
**quero** que a IA não tente processar áudio, imagem, PDF ou vídeo,  
**para** evitar respostas erradas e me chamar para assumir.

**Critérios de aceitação:**
- [ ] A IA NÃO transcreve nem interpreta mídia (R-038, AR-009).
- [ ] Ao receber mídia, registra, notifica e aciona handoff.
- [ ] A conversa fica pausada até minha intervenção.
- [ ] A IA não finge que entendeu.

**Requisitos:** R-038  
**Anti-requisitos:** AR-009

---

## Épico 4 — Follow-up

### US-011 — Follow-up automático em cadência
**Como** Admin,  
**quero** que o bot faça follow-up automático na cadência 1h → 1d → 3d → 7d,  
**para** reengajar leads que não responderam sem depender da minha memória.

**Critérios de aceitação:**
- [ ] Cadência: 1h, 1d, 3d, 7d (R-004).
- [ ] Máximo 4 tentativas. Após 7 dias → encerra e marca "sem resposta" (R-005).
- [ ] A cadência é interrompida se o lead responder, pedir opt-out, houver handoff ou pausa manual.
- [ ] As mensagens são humanizadas e variadas.
- [ ] Respeita janela de envio (dias úteis, 7h–17h) e limite diário (20–30/dia).

**Requisitos:** R-003, R-004, R-005, R-006, R-023  
**Anti-requisitos:** AR-007, AR-008

---

### US-012 — Tratamento de follow-ups vencidos fora da janela
**Como** Admin,  
**quero** que follow-ups agendados fora da janela sejam enviados assim que eu abrir o app,  
**para** não perder o timing.

**Critérios de aceitação:**
- [ ] Follow-ups vencidos ficam na fila (R-007).
- [ ] São enviados quando o app abre, mesmo fora da janela.
- [ ] Devem ser enviados com delays humanizados para evitar rajada.
- [ ] Notificação local avisa sobre acúmulo de mensagens pendentes.

**Requisitos:** R-007  
**Anti-requisitos:** AR-007, AR-008

---

### US-013 — Confirmação e lembrete pós-agendamento
**Como** Lead B2B,  
**quero** receber confirmação e lembrete da reunião agendada,  
**para** não esquecer o compromisso.

**Critérios de aceitação:**
- [ ] Após eu (Admin) registrar o agendamento, o bot envia confirmação (R-026).
- [ ] O bot envia lembrete antes do horário.
- [ ] A mensagem contém data, hora e canal.
- [ ] O lead pode confirmar, remarcar ou cancelar.
- [ ] Respeita janela e limite diário.

**Requisitos:** R-026  
**Anti-requisitos:** AR-003

---

## Épico 5 — Handoff Humano

### US-014 — Handoff por pedido de preço
**Como** Admin,  
**quero** ser chamado quando o lead pedir preço, proposta ou orçamento,  
**para** negociar pessoalmente e não deixar a IA passar valores errados.

**Critérios de aceitação:**
- [ ] Pedido de preço/proposta/orçamento aciona handoff imediato (R-012, AR-012).
- [ ] A IA não informa nem sugere valores (AR-001).
- [ ] Notificação local com som + pop-up (R-013).
- [ ] A IA não envia mensagem após o gatilho, até eu assumir (AR-010).

**Requisitos:** R-012, R-013  
**Anti-requisitos:** AR-001, AR-002, AR-010, AR-012

---

### US-015 — Handoff por intenção de agendamento
**Como** Admin,  
**quero** ser chamado quando o lead demonstrar intenção de agendar,  
**para** agendar manualmente com minha agenda real.

**Critérios de aceitação:**
- [ ] Intenção de agendamento aciona handoff imediato (R-012).
- [ ] A IA não sugere horários nem confirma datas (AR-003, R-025).
- [ ] Notificação local com som + pop-up (R-013).
- [ ] Eu assumo e agendo manualmente.

**Requisitos:** R-012, R-013, R-025  
**Anti-requisitos:** AR-003, AR-010

---

### US-016 — Handoff por suspeita de automação
**Como** Admin,  
**quero** ser chamado imediatamente se o lead perguntar se é bot,  
**para** assumir como humano e evitar denúncia.

**Critérios de aceitação:**
- [ ] Pergunta direta sobre bot/robô/IA aciona handoff prioritário (R-056).
- [ ] Silêncio total até eu assumir (R-057, AR-010).
- [ ] Notificação local clara e prioritária.
- [ ] Após eu assumir, o bot entra em copiloto (R-014).

**Requisitos:** R-056, R-057, R-014  
**Anti-requisitos:** AR-006, AR-010

---

### US-017 — Handoff por irritação ou ameaça
**Como** Admin,  
**quero** ser chamado se o lead demonstrar irritação ou ameaçar denúncia/bloqueio,  
**para** intervir antes que o número seja comprometido.

**Critérios de aceitação:**
- [ ] Irritação ou ameaça aciona handoff (R-065, R-066).
- [ ] Silêncio total até eu assumir (R-066).
- [ ] A IA não tenta se desculpar ou contornar.
- [ ] Prioridade máxima na notificação.

**Requisitos:** R-065, R-066  
**Anti-requisitos:** AR-010

---

### US-018 — Handoff por pedido de opt-out
**Como** Lead B2B,  
**quero** que meu pedido de não contatar mais seja respeitado imediatamente,  
**para** não ser incomodado.

**Critérios de aceitação:**
- [ ] Pedido de opt-out é detectado automaticamente (R-024).
- [ ] O lead é marcado "não contatar" e toda automação é interrompida.
- [ ] A IA NUNCA tenta reverter (AR-005).
- [ ] Registro de data, hora e conteúdo do pedido.
- [ ] Dados do lead entram na política de retenção/exclusão.

**Requisitos:** R-024, R-064  
**Anti-requisitos:** AR-005, AR-011

---

### US-019 — Handoff por dúvida técnica complexa
**Como** Admin,  
**quero** ser chamado se o lead fizer dúvida técnica que a IA não consegue responder,  
**para** não arriscar resposta errada.

**Critérios de aceitação:**
- [ ] Dúvida técnica complexa aciona handoff (R-065).
- [ ] A IA não arrisca resposta incorreta.
- [ ] Notificação local com contexto da dúvida.
- [ ] Eu assumo e respondo manualmente.

**Requisitos:** R-065  
**Anti-requisitos:** AR-010

---

### US-020 — Modo copiloto após assumir
**Como** Admin,  
**quero** que o bot, após eu assumir, entre em modo copiloto e sugira respostas sem enviar nada,  
**para** manter total autonomia na conversa.

**Critérios de aceitação:**
- [ ] Após o handoff, o bot para de enviar mensagens (R-014, AR-010).
- [ ] O bot sugere respostas visíveis apenas para mim.
- [ ] Nenhuma sugestão é enviada sem ação explícita minha.
- [ ] Posso editar, ignorar ou enviar a sugestão.
- [ ] Posso devolver ao modo automático quando quiser.

**Requisitos:** R-014  
**Anti-requisitos:** AR-010

---

## Épico 6 — CRM Local

### US-021 — Registro de status do pipeline
**Como** Admin,  
**quero** acompanhar o lead no pipeline (Novo → ... → Perdido),  
**para** saber em que estágio cada oportunidade está.

**Critérios de aceitação:**
- [ ] Status disponíveis: Novo, Contatado, Respondeu, Qualificado, Aquecido, Reunião agendada, Proposta, Fechado, Perdido (R-021).
- [ ] Cada lead está em um único status.
- [ ] "Perdido" exige ou sugere motivo.
- [ ] Posso corrigir o status manualmente.

**Requisitos:** R-021  
**Anti-requisitos:** —

---

### US-022 — Atualização automática do status pela IA
**Como** Admin,  
**quero** que a IA atualize o status do lead automaticamente com base na conversa,  
**para** não ter que fazer isso manualmente a cada interação.

**Critérios de aceitação:**
- [ ] A IA interpreta sinais da conversa e muda o status (R-022).
- [ ] Transições são auditáveis com timestamp e motivo.
- [ ] Status críticos (Reunião agendada, Proposta, Fechado, Perdido) registram justificativa.
- [ ] Posso corrigir manualmente a qualquer momento.

**Requisitos:** R-022  
**Anti-requisitos:** —

---

### US-023 — Notas, tarefas e lembretes
**Como** Admin,  
**quero** criar notas, tarefas e lembretes vinculados ao lead,  
**para** organizar meu acompanhamento.

**Critérios de aceitação:**
- [ ] Posso criar notas manuais.
- [ ] A IA cria notas automáticas (resumo, objeções, próximos passos) (R-043).
- [ ] Posso criar tarefas com prazo e prioridade.
- [ ] Posso criar lembretes.
- [ ] Notas da IA são visualmente separadas das minhas.
- [ ] A IA não cria tarefas sem minha confirmação.

**Requisitos:** R-043  
**Anti-requisitos:** —

---

### US-024 — Tags e filtros
**Como** Admin,  
**quero** usar tags e filtros para organizar meus leads,  
**para** encontrar rapidamente o que preciso.

**Critérios de aceitação:**
- [ ] Posso criar tags personalizadas.
- [ ] A IA pode atribuir tags automaticamente, conforme configuração.
- [ ] Filtros por status, tag, nicho, região, data, responsável e número.
- [ ] Busca por nome, telefone, endereço e conteúdo.

**Requisitos:** R-043  
**Anti-requisitos:** —

---

## Épico 7 — Painel de Controle

### US-025 — Painel dividido em tempo real
**Como** Admin,  
**quero** um painel dividido com lista de leads, chat, sugestões da IA, histórico e botões de ação,  
**para** controlar tudo em tempo real.

**Critérios de aceitação:**
- [ ] Lista de leads + janela de chat ao lado (R-046).
- [ ] Área de sugestões da IA.
- [ ] Histórico do lead.
- [ ] Botões: pausar bot, assumir, devolver ao bot, copiloto.
- [ ] Indicador de modo em tempo real (bot, copiloto, handoff, manual).
- [ ] Alertas de falha crítica visíveis.

**Requisitos:** R-046  
**Anti-requisitos:** —

---

### US-026 — Pausar, assumir e devolver ao bot
**Como** Admin,  
**quero** pausar a automação, assumir a conversa e devolver ao bot quando quiser,  
**para** manter controle total sobre a operação.

**Critérios de aceitação:**
- [ ] Botão "pausar" para a automação daquele lead.
- [ ] Botão "assumir" pausa a automação e ativa o copiloto (R-014).
- [ ] Botão "devolver ao bot" retoma o modo automático total (R-034).
- [ ] Toda ação é registrada com timestamp.

**Requisitos:** R-014, R-034, R-046  
**Anti-requisitos:** AR-010

---

## Épico 8 — Compliance e Segurança

### US-027 — Detecção e registro de opt-out
**Como** Admin,  
**quero** que o sistema detecte e registre pedidos de opt-out automaticamente,  
**para** cumprir LGPD e evitar denúncias.

**Critérios de aceitação:**
- [ ] Pedidos de opt-out são detectados automaticamente (R-024).
- [ ] Lead é marcado "não contatar".
- [ ] Toda automação é interrompida.
- [ ] Data, hora e conteúdo são registrados.
- [ ] Comando manual para marcar opt-out e excluir dados disponível.

**Requisitos:** R-024  
**Anti-requisitos:** AR-005

---

### US-028 — Exclusão de dados mediante solicitação
**Como** Lead B2B,  
**quero** que meus dados sejam excluídos mediante solicitação,  
**para** exercer meus direitos como titular.

**Critérios de aceitação:**
- [ ] Comando manual para exclusão de dados (R-024).
- [ ] Política de retenção e exclusão aplicada.
- [ ] Dados de opt-out mantidos apenas pelo tempo mínimo legal.
- [ ] Registro da exclusão.

**Requisitos:** R-024  
**Anti-requisitos:** AR-005, AR-011

---

### US-029 — Notificação local de falhas críticas
**Como** Admin,  
**quero** ser notificado imediatamente em falhas críticas,  
**para** agir rápido e não perder operação.

**Critérios de aceitação:**
- [ ] Notificação local com som + pop-up (R-045).
- [ ] Falhas críticas: WhatsApp desconectado, API de IA fora, PostgreSQL parado, banimento, erro repetido de envio.
- [ ] Logs detalhados com timestamp, severidade, módulo, mensagem, contexto.
- [ ] Painel de erros acessível.

**Requisitos:** R-045  
**Anti-requisitos:** —

---

### US-030 — Backup manual
**Como** Admin,  
**quero** fazer backup manual do banco e da sessão do WhatsApp,  
**para** garantir recuperação em caso de falha.

**Critérios de aceitação:**
- [ ] Ação clara para gerar backup completo (R-032).
- [ ] Backup versionado por data/hora.
- [ ] Ação para restaurar.
- [ ] Backup salvo em pasta local escolhida por mim.
- [ ] Alerta quando o backup estiver muito antigo (opcional).

**Requisitos:** R-032  
**Anti-requisitos:** —

---

## Épico 9 — Futuro (Fase de Expansão)

### US-031 — Atribuir leads a Vendedores
**Como** Admin,  
**quero** atribuir leads a Vendedores,  
**para** distribuir a operação quando a equipe entrar no sistema.

**Critérios de aceitação:**
- [ ] Posso atribuir lead a um Vendedor (R-029, R-030).
- [ ] Vendedor vê e assume apenas leads atribuídos a ele.
- [ ] Posso reatribuir leads.
- [ ] Toda ação é registrada com usuário, data e hora.

**Requisitos:** R-029, R-030  
**Anti-requisitos:** —

---

### US-032 — Migrar para API oficial do WhatsApp
**Como** Admin,  
**quero** migrar da conexão não oficial para a API oficial do WhatsApp Business,  
**para** eliminar risco de banimento e aumentar estabilidade.

**Critérios de aceitação:**
- [ ] A camada de conexão é isolada (adaptador) (R-016).
- [ ] A troca de canal não quebra histórico, status ou agendamentos.
- [ ] A migração é planejada para ocorrer quando houver volume/resultados.
- [ ] Novo número ou re-homologação previsto.

**Requisitos:** R-016  
**Anti-requisitos:** —

---

## Mapa de rastreabilidade

| User Story | Persona | Requisitos | Anti-requisitos |
|---|---|---|---|
| US-001 | Admin | R-017, R-018, R-019, R-020 | AR-011 |
| US-002 | Admin | R-020 | — |
| US-003 | Admin | R-063, R-064 | AR-011 |
| US-004 | Admin | R-001, R-002, R-059 | — |
| US-005 | Admin | R-002, R-034, R-003, R-004 | — |
| US-006 | Lead | R-010, R-011, R-067 | AR-006 |
| US-007 | Admin | R-051, R-052 | — |
| US-008 | Lead | R-041, R-042, R-012 | AR-001, AR-002, AR-012 |
| US-009 | Admin | R-055, R-056, R-057 | AR-006 |
| US-010 | Admin | R-038 | AR-009 |
| US-011 | Admin | R-003, R-004, R-005, R-006, R-023 | AR-007, AR-008 |
| US-012 | Admin | R-007 | AR-007, AR-008 |
| US-013 | Lead | R-026 | AR-003 |
| US-014 | Admin | R-012, R-013 | AR-001, AR-002, AR-010, AR-012 |
| US-015 | Admin | R-012, R-013, R-025 | AR-003, AR-010 |
| US-016 | Admin | R-056, R-057, R-014 | AR-006, AR-010 |
| US-017 | Admin | R-065, R-066 | AR-010 |
| US-018 | Lead | R-024, R-064 | AR-005, AR-011 |
| US-019 | Admin | R-065 | AR-010 |
| US-020 | Admin | R-014 | AR-010 |
| US-021 | Admin | R-021 | — |
| US-022 | Admin | R-022 | — |
| US-023 | Admin | R-043 | — |
| US-024 | Admin | R-043 | — |
| US-025 | Admin | R-046 | — |
| US-026 | Admin | R-014, R-034, R-046 | AR-010 |
| US-027 | Admin | R-024 | AR-005 |
| US-028 | Lead | R-024 | AR-005, AR-011 |
| US-029 | Admin | R-045 | — |
| US-030 | Admin | R-032 | — |
| US-031 | Admin | R-029, R-030 | — |
| US-032 | Admin | R-016 | — |