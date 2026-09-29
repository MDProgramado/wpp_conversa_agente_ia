# 00 — Product Brief

> Documento de visão de produto. Define problema, solução, público, escopo e métricas.
> Este é o ponto de partida para todo o restante da especificação.

---

## 1. Identificação

| Campo | Valor |
|---|---|
| **Nome do projeto** | Automação Local de WhatsApp para Prospecção B2B |
| **Dono do produto** | Você (Admin único na fase de piloto) |
| **Modelo comercial** | Agência/estúdio com equipe (R-048) |
| **Fase atual** | Piloto — uso exclusivo do Admin (R-027, R-049) |
| **Versão do brief** | 1.0 |
| **Data** | 2026-09-28 |

---

## 2. Problema

Hoje a prospecção B2B é feita **manualmente** pela equipe, lead a lead, sem automação de conversa, sem follow-up estruturado e sem qualificação padronizada. Isso gera:

- **Baixa escala:** o volume de abordagens depende de tempo humano disponível.
- **Follow-up inconsistente:** leads esfriam porque ninguém lembra de retomar no tempo certo.
- **Qualificação desigual:** cada pessoa qualifica de um jeito, sem critério claro.
- **Perda de timing:** o momento crítico (pedido de preço ou intenção de agendamento) chega quando ninguém está olhando.
- **Sem rastreabilidade:** não há histórico estruturado de conversas, objeções, motivos de perda ou conversão por nicho.

O sistema de caça-leads já entrega **nome, telefone e endereço** de empresas com WhatsApp ativo, a partir de busca por estado, cidade, região, categoria/nicho e nome-chave. O que falta é **automatizar a conversa** a partir do momento em que a primeira mensagem é enviada.

---

## 3. Solução

Um **sistema local** (roda no PC Windows do usuário) que:

1. **Importa leads** da API do sistema de caça-leads.
2. **Você envia a primeira mensagem manualmente** (o sistema nunca inicia o contato).
3. **O bot assume imediatamente** após o envio.
4. **Conduz a conversa com IA externa** em tom consultivo, humanizado e dinâmico — sem script rígido.
5. **Qualifica** o lead (verba/interesse + poder de decisão), aquece, contorna objeções comuns.
6. **Faz follow-up** na cadência 1h → 1d → 3d → 7d, encerrando após 7 dias sem resposta.
7. **Aciona handoff humano** quando o lead pede preço/proposta, demonstra intenção de agendar, pergunta se é bot, demonstra irritação/ameaça, pede opt-out, envia mídia ou faz dúvida técnica complexa.
8. **Notifica você localmente** (som + pop-up) e entra em **modo copiloto** — sugere respostas, nunca envia sozinho.
9. **Você agenda manualmente** e o bot envia confirmação + lembrete antes da reunião.
10. **Registra tudo em CRM local** com pipeline completo, tags, notas, tarefas e histórico.

---

## 4. Público-alvo

### 4.1. Usuário principal (fase piloto)

- **Você**, dono da agência/estúdio.
- Perfil Admin: acesso total a configurações, IA, integrações, financeiro, campanhas e usuários.
- Opera sozinho nesta fase, com o objetivo de validar o fluxo antes de liberar para a equipe.

### 4.2. Usuários futuros (fase de expansão)

- **Vendedor**: vê e assume apenas leads atribuídos a ele. Não dispara campanhas, não aprova mensagens, não acessa financeiro nem configurações (R-030).
- A equipe atual, que hoje faz prospecção manual, migrará gradualmente para o sistema após o piloto atingir os critérios de sucesso.

### 4.3. Leads (público externo)

- Empresas B2B com WhatsApp ativo, obtidas via API do sistema de caça-leads.
- **Sem opt-in explícito** — base legal por legítimo interesse (R-063, R-064).
- Contato relacionado à atividade profissional, com transparência e opt-out imediato.

---

## 5. Escopo

### 5.1. Dentro do escopo (MVP — R-060)

- Importação de leads via API do sistema de caça-leads.
- Primeira mensagem manual + assunção imediata do bot.
- IA externa (API de LLM) para conduzir a conversa.
- Follow-up 1h / 1d / 3d / 7d, com encerramento após 7 dias sem resposta.
- Handoff por preço/proposta, agendamento, suspeita de automação, irritação/ameaça, opt-out, mídia e dúvida técnica complexa.
- Notificação local (som + pop-up) + modo copiloto.
- CRM básico/intermediário: pipeline, histórico, busca, tags, filtros, notas, tarefas, lembretes, responsável.
- Janela de envio: dias úteis, 7h–17h.
- Limite: até 20 leads/dia e 20–30 mensagens/dia.
- Opt-out e LGPD: detecção automática, registro de base legal, exclusão, retenção.
- Número único dedicado, conexão não oficial inicial com migração futura para API oficial.
- PostgreSQL local, backup manual, sem criptografia adicional.
- Logs detalhados + notificação de falhas críticas.
- Painel dividido: lista + chat + sugestões da IA + histórico + botões de ação.

### 5.2. Fora do escopo (por agora)

- Múltiplos números de WhatsApp (R-059).
- Integração com Google Calendar, e-mail, Telegram, planilhas, webhooks (R-044).
- Relatórios avançados (R-035 fica para pós-MVP).
- Financeiro completo (R-036 fica no básico: valor da proposta, status de pagamento, ticket médio).
- Multiusuário completo com perfis e permissões (R-028 a R-030 — arquitetura preparada, mas não ativa).
- Envio de mídia pelo bot (R-037).
- Processamento de mídia recebida (R-038).
- Aquecimento controlado automaticamente (R-040 — apenas sugestão).
- Enriquecimento externo de leads (CNPJ, site, redes sociais).
- Criptografia local de dados e sessão (R-033).

---

## 6. Diferenciais

- **Handoff cirúrgico:** o bot não tenta fechar nada sozinho. Ele aquece, qualifica e chama você no momento exato.
- **IA consultiva de verdade:** não é um script de perguntas. Conversa como pessoa, entende a dor antes de ofertar.
- **Anti-requisitos como invariantes de sistema:** os 12 comportamentos proibidos (AR-001 a AR-012) são travas de código, não apenas orientações de prompt.
- **Modo copiloto:** quando você assume, o bot continua sugerindo — mas nunca envia sozinho.
- **Compliance desde o dia 1:** opt-out, base legal, retenção e exclusão tratados como parte do produto, não como remendo.
- **Operação 100% local:** sem servidor externo, sem dependência de cloud. Você vê tudo em tempo real, pausa, assume, ajusta.

---

## 7. Métricas de sucesso (piloto — R-061, R-062)

| Métrica | Meta | Período |
|---|---|---|
| Reuniões agendadas | ≥ 5 | por mês |
| Taxa de qualificação | ≥ 30% | por mês |
| Operação estável (sem banimento) | 100% | durante o piloto |
| Handoffs assumidos em tempo | ≥ 90% | durante o piloto |
| Opt-outs respeitados | 100% | sempre |

Se os critérios forem atingidos, o piloto avança para:
1. Liberação do sistema para a equipe (perfis Admin + Vendedor).
2. Migração para API oficial do WhatsApp Business.

---

## 8. Riscos principais

| Risco | Severidade | Mitigação |
|---|---|---|
| Banimento do número dedicado | **Crítico** | Conexão não oficial com limites conservadores + aquecimento sugerido + migração planejada para API oficial |
| Violação de LGPD (sem opt-in) | **Alto** | Base legal por legítimo interesse + transparência + opt-out imediato + retenção definida |
| IA alucinar e prometer algo indevido | **Alto** | Anti-requisitos como invariantes de código + handoff em preço/proposta + revisão de argumentos |
| Ocultação de automação gerar denúncia | **Alto** | Handoff imediato se o lead perguntar se é bot + silêncio total |
| Perda de dados (sem criptografia, backup manual) | **Médio** | Backup manual versionado + disciplina operacional |
| Dependência de API externa de LLM | **Médio** | Fallback em caso de falha + logs detalhados + notificação local |
| Sobreposição com prospecção manual da equipe | **Médio** | Coordenação manual durante o piloto (R-050) |

---

## 9. Restrições

- **Sistema operacional:** Windows (R-047).
- **Persistência:** PostgreSQL local (R-031).
- **Canal WhatsApp:** conexão não oficial inicial (Baileys/WPPConnect) com migração futura para API oficial (R-016).
- **IA:** API externa (R-009).
- **Sem servidor externo:** tudo roda localmente.
- **Sem envio de mídia pelo bot:** apenas texto e links (R-037).
- **Sem agendamento automático:** sempre manual (R-025).

---

## 10. Fases do roadmap (referência GSD)

| # | Fase | Objetivo |
|---|---|---|
| 1 | Fundação, Canal e Gate de Envio | Estado durável + canal isolado + gate que torna os 12 AR invariantes — antes de qualquer LLM |
| 2 | IA, Handoff e Shadow Mode | LLM como gerador de dica, handoff como fronteira projetada, validado em shadow mode (rascunha, nunca envia) |
| 3 | Cadência, Operação e Painel | Follow-up conservador, scheduler com dreno jittered, painel único e CRM operacional |
| 4 | Piloto, Calibração e Apuração | 30 dias reais, apuração R-061/R-062 e decisões com dado |

---

## 11. Referências

- `docs/01-requisitos-funcionais.md` — R-001 a R-067
- `docs/10-anti-requisitos.md` — AR-001 a AR-012
- `.planning/PROJECT.md` — visão GSD
- `.planning/REQUIREMENTS.md` — 60 REQ-IDs v1
- `.planning/ROADMAP.md` — 4 fases
- `.planning/research/` — STACK, FEATURES, ARCHITECTURE, PITFALLS, SUMMARY