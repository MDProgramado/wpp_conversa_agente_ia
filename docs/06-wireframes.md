# 06 — Wireframes

> Wireframes textuais (ASCII) das telas do sistema local.
> Referência para implementação do painel dividido (R-046), CRM (R-043), handoff (R-013) e demais telas.

---

## 1. Tela Principal — Painel Dividido (R-046)

Visão padrão ao abrir o sistema. Três colunas: lista de leads, chat ativo e painel lateral com sugestões/histórico/ações.

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│  AUTOMAÇÃO WHATSAPP  │  Status: ● Conectado  │  Número: +55 11 9XXXX-XXXX  │  Modo: AUTO     │
│  ─────────────────────────────────────────────────────────────────────────────────────────  │
│  [🔍 Buscar lead...]   [Filtros ▼]   [Tags ▼]   [Status ▼]   [⚠ 2 handoffs pendentes]        │
├─────────────────────┬────────────────────────────────────────────┬───────────────────────────┤
│  LEADS (20/dia)     │  CHAT — João Silva / Padaria Pão Quente   │  SUGESTÕES DA IA          │
│  ─────────────────  │  ────────────────────────────────────────  │  ───────────────────────  │
│                     │                                            │                           │
│  🟢 João Silva      │  [14:32] Você: Olá, tudo bem? Vi que a     │  💡 Sugestão para enviar: │
│     Padaria Pão     │  Padaria Pão Quente está crescendo na      │                           │
│     Quente          │  região. Trabalho com presença digital     │  "Entendi! Muitas         │
│     Qualificado     │  para negócios locais. Posso te fazer      │  padarias têm esse        │
│  ─────────────────  │  uma pergunta rápida?                      │  desafio. Hoje você       │
│  🟡 Maria Souza     │                                            │  divulga como? Só pelo    │
│     Studio M        │  [14:35] João: Opa, pode sim               │  Instagram ou tem site?"  │
│     Respondeu       │                                            │                           │
│  ─────────────────  │  [14:36] Você: Você já tem site ou         │  ───────────────────────  │
│  🔴 Carlos Lima     │  landing page para captar clientes?        │  [✓ Aceitar] [✎ Editar]   │
│     Lima Advocacia  │                                            │  [🗑 Ignorar]             │
│     Handoff         │  [14:40] João: Não tenho, só Instagram     │                           │
│  ─────────────────  │                                            │  ───────────────────────  │
│  ⚪ Ana Costa       │  [14:42] Você: Entendi. E o que te         │  HISTÓRICO DO LEAD        │
│     AC Consultoria  │  impede de ter um site hoje?               │  ───────────────────────  │
│     Novo            │                                            │  Status: Qualificado      │
│  ─────────────────  │  [14:45] João: Falta de tempo e não sei    │  Origem: Busca SP/        │
│  ⚪ Pedro Alves      │  por onde começar                          │  Campinas/Padarias        │
│     PA Serviços     │                                            │  Base legal: Legítimo     │
│     Novo            │  [14:46] João: Quanto custa um site?       │  interesse                │
│                     │  ⚠ GATILHO: PEDIDO DE PREÇO                │  Finalidade: Contato      │
│                     │                                            │  comercial B2B            │
│                     │  ──────────────────────────────────────    │  ───────────────────────  │
│                     │  [ Digite sua resposta... ]                │  NOTAS                    │
│                     │  [📎] [😊] [Enviar]                        │  • 28/09 14:45 — IA:      │
│                     │                                            │    Lead não tem site,     │
│                     │  ⚠ HANDOFF ACIONADO — Motivo: Pedido de    │    só Instagram.          │
│                     │  preço. Bot em silêncio até você assumir.  │  • 28/09 14:40 — IA:      │
│                     │  [ASSUMIR CONVERSA]                        │    Qualificado (verba +   │
│                     │                                            │    decisão confirmados).  │
│                     │                                            │                           │
│                     │                                            │  ───────────────────────  │
│                     │                                            │  AÇÕES RÁPIDAS            │
│                     │                                            │  [⏸ Pausar bot]          │
│                     │                                            │  [👤 Assumir]             │
│                     │                                            │  [🤖 Devolver ao bot]     │
│                     │                                            │  [📋 Copiloto]            │
│                     │                                            │  [📝 Nova nota]           │
│                     │                                            │  [✅ Nova tarefa]         │
└─────────────────────┴────────────────────────────────────────────┴───────────────────────────┘
```

### 1.1. Elementos da coluna esquerda (lista de leads)

| Elemento | Descrição |
|---|---|
| Indicador de cor | 🟢 Qualificado/Aquecido · 🟡 Respondeu · 🔴 Handoff · ⚪ Novo/Contatado |
| Nome | Nome do lead (R-018) |
| Empresa/contexto | Inferido durante conversa ou vazio |
| Status | Pipeline (R-021) |
| Contador | "20/dia" — limite diário (R-023) |
| Busca | Por nome, telefone, endereço, conteúdo (R-043) |
| Filtros | Status, tag, nicho, região, data, responsável, número (R-043) |
| Alerta handoff | "⚠ 2 handoffs pendentes" no topo (R-013) |

### 1.2. Elementos da coluna central (chat)

| Elemento | Descrição |
|---|---|
| Histórico | Mensagens com timestamp, remetente (Você/Lead) |
| Indicador de gatilho | "⚠ GATILHO: PEDIDO DE PREÇO" inline (R-012) |
| Modo atual | AUTO, COPILOTO, PAUSADO, SILÊNCIO (R-046) |
| Campo de digitação | Com botões de anexo, emoji, enviar |
| Aviso de handoff | "⚠ HANDOFF ACIONADO — Motivo: ..." com botão [ASSUMIR] |
| Botão assumir | Ativa copiloto e pausa automação (R-014) |

### 1.3. Elementos da coluna direita (sugestões/histórico/ações)

| Elemento | Descrição |
|---|---|
| Sugestão da IA | Texto sugerido + botões [✓ Aceitar] [✎ Editar] [🗑 Ignorar] (R-014) |
| Histórico do lead | Status, origem, base legal, finalidade (R-064) |
| Notas | Notas manuais e automáticas (R-043) |
| Ações rápidas | Pausar, assumir, devolver, copiloto, nova nota, nova tarefa (R-046) |

---

## 2. Tela de Handoff — Notificação Local (R-013)

Pop-up que aparece quando o handoff é acionado. Deve ter som e ser impossível ignorar.

```
┌─────────────────────────────────────────────────────────────┐
│  ⚠  HANDOFF ACIONADO                                  [X]   │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  Lead: João Silva — Padaria Pão Quente                      │
│  Telefone: +55 11 9XXXX-XXXX                                │
│  Motivo: PEDIDO DE PREÇO                                    │
│  Horário: 14:46                                             │
│                                                             │
│  Última mensagem do lead:                                   │
│  "Quanto custa um site?"                                    │
│                                                             │
│  Status: Qualificado                                        │
│  Modo do bot: SILÊNCIO TOTAL                                │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│  [ASSUMIR CONVERSA]   [VER CHAT]   [ADIAR 5min]             │
└─────────────────────────────────────────────────────────────┘
```

### 2.1. Comportamento

- **Som:** alerta sonoro distinto para handoff (R-013).
- **Pop-up:** sempre no topo, não pode ser fechado sem ação.
- **Botões:** assumir (vai para o chat em modo copiloto), ver chat (abre sem assumir), adiar (renotifica em 5 min).
- **Prioridade:** handoffs de suspeita de bot, irritação e ameaça têm prioridade máxima.

---

## 3. Tela de CRM — Pipeline (R-021, R-043)

Visão de kanban ou lista para acompanhar todos os leads por status.

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│  CRM — PIPELINE                                    [Lista] [Kanban]   [Exportar CSV]         │
│  ─────────────────────────────────────────────────────────────────────────────────────────  │
│  [🔍 Buscar...]   [Tags ▼]   [Nicho ▼]   [Região ▼]   [Data ▼]   [Responsável ▼]            │
├──────────┬──────────┬──────────┬──────────┬──────────┬──────────┬──────────┬───────────────┤
│ NOVO (5) │ CONTAT.  │ RESPOND. │ QUALIF.  │ AQUECIDO │ REUNIÃO  │ PROPOSTA │ FECHADO (2)   │
│          │ (12)     │ (8)      │ (6)      │ (3)      │ (2)      │ (1)      │               │
├──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼───────────────┤
│ Ana C.   │ João S.  │ Maria S. │ Carlos L.│ Pedro A. │ Rita M.  │ José F.  │ Carla T.      │
│ AC Cons. │ Padaria  │ Studio M │ Lima Adv.│ PA Serv. │ RM Design│ JF Store │ CT Modas      │
│          │          │          │          │          │          │          │               │
│ Pedro A. │ Luiz G.  │ Sofia R. │ ...      │ ...      │ ...      │          │ Marcos P.     │
│ PA Serv. │ LG Mec.  │ SR Culin.│          │          │          │          │ MP Consult.   │
│          │          │          │          │          │          │          │               │
│ ...      │ ...      │ ...      │          │          │          │          │ ...           │
└──────────┴──────────┴──────────┴──────────┴──────────┴──────────┴──────────┴───────────────┘
```

### 3.1. Modo Lista

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│  CRM — LISTA                                                                  [Kanban]      │
├────┬──────────────┬──────────────┬───────────┬──────────┬───────────┬──────────┬────────────┤
│ ID │ Nome         │ Empresa      │ Status    │ Tags     │ Último    │ Resp.    │ Ações      │
│    │              │              │           │          │ contato   │          │            │
├────┼──────────────┼──────────────┼───────────┼──────────┼───────────┼──────────┼────────────┤
│ 01 │ João Silva   │ Padaria Pão  │ Qualif.   │ #padaria │ 28/09 14: │ Admin    │ [Ver]      │
│    │              │ Quente       │           │ #sp      │ 46        │          │ [Editar]   │
├────┼──────────────┼──────────────┼───────────┼──────────┼───────────┼──────────┼────────────┤
│ 02 │ Maria Souza  │ Studio M     │ Respondeu │ #design  │ 28/09 11: │ Admin    │ [Ver]      │
│    │              │              │           │ #rj      │ 20        │          │ [Editar]   │
├────┼──────────────┼──────────────┼───────────┼──────────┼───────────┼──────────┼────────────┤
│ 03 │ Carlos Lima  │ Lima Advoc.  │ Handoff   │ #advoc.  │ 28/09 09: │ Admin    │ [Ver]      │
│    │              │              │           │ #sp      │ 15        │          │ [Editar]   │
└────┴──────────────┴──────────────┴───────────┴──────────┴───────────┴──────────┴────────────┘
```

---

## 4. Tela de Detalhe do Lead

Ao clicar em um lead, abre a visão detalhada com histórico, notas, tarefas e dados de compliance.

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│  LEAD — João Silva / Padaria Pão Quente                                       [X Fechar]     │
│  ─────────────────────────────────────────────────────────────────────────────────────────  │
│  Telefone: +55 11 9XXXX-XXXX      Endereço: Rua X, 123 — Campinas/SP                        │
│  Status: Qualificado               Tags: #padaria #sp #site                                 │
│  Origem: Busca SP/Campinas/Padarias — 28/09 10:00                                            │
│  Base legal: Legítimo interesse    Finalidade: Contato comercial B2B                         │
│  ─────────────────────────────────────────────────────────────────────────────────────────  │
│                                                                                              │
│  [Conversa]  [Notas]  [Tarefas]  [Histórico]  [Compliance]                                   │
│  ─────────────────────────────────────────────────────────────────────────────────────────  │
│                                                                                              │
│  CONVERSA                                                                                    │
│  • 28/09 14:32 — Você: Olá, tudo bem? ...                                                    │
│  • 28/09 14:35 — João: Opa, pode sim                                                         │
│  • 28/09 14:36 — Você: Você já tem site ou landing page?                                     │
│  • 28/09 14:40 — João: Não tenho, só Instagram                                               │
│  • 28/09 14:42 — Você: Entendi. E o que te impede de ter um site hoje?                       │
│  • 28/09 14:45 — João: Falta de tempo e não sei por onde começar                             │
│  • 28/09 14:46 — João: Quanto custa um site?  ⚠ GATILHO: PEDIDO DE PREÇO                     │
│  • 28/09 14:46 — [HANDOFF ACIONADO — Bot em silêncio]                                        │
│                                                                                              │
│  [ Ver conversa completa ]                                                                   │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 4.1. Aba Notas

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│  NOTAS                                                                        [+ Nova nota]  │
│  ─────────────────────────────────────────────────────────────────────────────────────────  │
│  • 28/09 14:45 — IA: Lead não tem site, só Instagram. Dor: falta de tempo e não sabe por    │
│    onde começar.                                                                             │
│  • 28/09 14:40 — IA: Qualificado (verba + decisão confirmados).                              │
│  • 28/09 14:00 — Você: Lead parece promissor, padaria em crescimento na região.             │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 4.2. Aba Tarefas

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│  TAREFAS                                                                     [+ Nova tarefa] │
│  ─────────────────────────────────────────────────────────────────────────────────────────  │
│  [ ] 28/09 15:00 — Ligar para João e discutir proposta (prioridade: alta)                    │
│  [✓] 28/09 14:50 — Assumir conversa após handoff                                             │
│  [ ] 29/09 10:00 — Enviar portfólio de padarias                                               │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 4.3. Aba Compliance

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│  COMPLIANCE                                                                                  │
│  ─────────────────────────────────────────────────────────────────────────────────────────  │
│  Origem do dado: API Caça-Leads — busca SP/Campinas/Padarias — 28/09 10:00                   │
│  Base legal: Legítimo interesse                                                              │
│  Finalidade: Contato comercial B2B                                                           │
│  Avaliação de legítimo interesse: [Ver documento]                                            │
│  Opt-out: [ ] Não solicitado  [✓] Solicitado em ___/___/___                                  │
│  Retenção: até ___/___/___ (conforme política)                                               │
│  ─────────────────────────────────────────────────────────────────────────────────────────  │
│  [Marcar opt-out]   [Excluir dados do lead]                                                  │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Tela de Configurações

Onde você ajusta parâmetros do sistema.

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│  CONFIGURAÇÕES                                                                               │
│  ─────────────────────────────────────────────────────────────────────────────────────────  │
│                                                                                              │
│  [Canal WhatsApp]  [IA]  [Follow-up]  [Limites]  [Notificações]  [Backup]  [Compliance]      │
│  ─────────────────────────────────────────────────────────────────────────────────────────  │
│                                                                                              │
│  CANAL WHATSAPP                                                                              │
│  • Número dedicado: +55 11 9XXXX-XXXX                                                        │
│  • Status: ● Conectado                                                                       │
│  • Tipo de conexão: Não oficial (Baileys)  [Migrar para API oficial]                         │
│  • Sessão: [Reconectar] [Backup de sessão]                                                   │
│  • Aquecimento: Fase atual (sugerida): 3 — 15–20 msg/dia  [Ver plano completo]               │
│                                                                                              │
│  IA                                                                                          │
│  • Provedor: OpenAI / Gemini / Claude  [Configurar]                                          │
│  • Modelo: [selecionar]                                                                      │
│  • Tom: Consultivo, educado e direto                                                         │
│  • Persona: Age como você (humano)                                                           │
│  • Limite de tokens: [___]                                                                   │
│  • Custo estimado: R$ ___/mês                                                                │
│                                                                                              │
│  FOLLOW-UP                                                                                   │
│  • Cadência: 1h → 1d → 3d → 7d                                                               │
│  • Máximo de tentativas: 4                                                                    │
│  • Encerrar após: 7 dias sem resposta                                                        │
│                                                                                              │
│  LIMITES                                                                                     │
│  • Leads/dia: 20                                                                             │
│  • Mensagens/dia: 20–30                                                                      │
│  • Janela: Dias úteis, 7h–17h                                                                │
│  • Follow-ups fora da janela: Enviar ao abrir o app                                          │
│                                                                                              │
│  NOTIFICAÇÕES                                                                                │
│  • Handoff: Som + pop-up                                                                     │
│  • Falhas críticas: Som + pop-up                                                             │
│  • Fora da janela: Notificar sem responder                                                   │
│                                                                                              │
│  BACKUP                                                                                      │
│  • Último backup: 28/09 08:00                                                                │
│  • [Fazer backup agora]  [Restaurar backup]                                                  │
│  • Pasta de destino: C:\Users\...\backups                                                    │
│  • Criptografia: Nenhuma (R-033)                                                             │
│                                                                                              │
│  COMPLIANCE                                                                                  │
│  • Base legal padrão: Legítimo interesse                                                     │
│  • Finalidade: Contato comercial B2B                                                         │
│  • Retenção: ___ meses                                                                       │
│  • Exclusão automática: [ ] Sim  [✓] Não                                                     │
│                                                                                              │
│  [Salvar configurações]                                                                      │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Tela de Logs e Falhas

Painel de erros e logs detalhados (R-045).

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│  LOGS E FALHAS                                                       [Filtrar ▼] [Exportar] │
│  ─────────────────────────────────────────────────────────────────────────────────────────  │
│  [Todos]  [Crítico]  [Erro]  [Aviso]  [Info]                                                 │
│  ─────────────────────────────────────────────────────────────────────────────────────────  │
│  ● 28/09 14:46 — INFO — Handoff acionado — João Silva — Motivo: Pedido de preço              │
│  ● 28/09 14:40 — INFO — Status atualizado — João Silva — Respondeu → Qualificado            │
│  ● 28/09 14:32 — INFO — Mensagem enviada — João Silva — 1ª mensagem manual                   │
│  ⚠ 28/09 13:15 — AVISO — Follow-up 1h enviado fora da janela (ao abrir o app)                │
│  ✖ 28/09 11:00 — ERRO — Falha ao enviar mensagem — Maria Souza — Timeout                     │
│  ● 28/09 11:00 — INFO — Reconexão automática bem-sucedida                                    │
│  ● 28/09 08:00 — INFO — Backup manual concluído — 2,3 MB                                     │
│                                                                                              │
│  [Ver detalhes]  [Limpar logs antigos]                                                       │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 6.1. Pop-up de falha crítica

```
┌─────────────────────────────────────────────────────────────┐
│  ✖  FALHA CRÍTICA                                     [X]   │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  WhatsApp desconectado                                      │
│  Horário: 14:50                                             │
│  Ação: Reconexão automática em andamento                    │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│  [Ver logs]   [Reconectar agora]                            │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. Tela de Aquecimento (sugestão)

Sugestão de aquecimento exibida para você (R-039, R-040).

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│  AQUECIMENTO DO NÚMERO — SUGESTÃO                                                            │
│  ─────────────────────────────────────────────────────────────────────────────────────────  │
│                                                                                              │
│  Fase 1 — Repouso ativo (Dias 1–2)         5–10 msg/dia    [✓ Concluída]                     │
│  Fase 2 — Aquecimento leve (Dias 3–5)      10–15 msg/dia   [✓ Concluída]                     │
│  Fase 3 — Aquecimento moderado (Dias 6–10) 15–20 msg/dia   [• Em andamento]                  │
│  Fase 4 — Transição (Dias 11–15)           20–25 msg/dia   [ ] Pendente                      │
│  Fase 5 — Operação normal (Dia 16+)        20–30 msg/dia   [ ] Pendente                      │
│                                                                                              │
│  ⚠ O sistema NÃO bloqueia automaticamente. Você controla o volume manualmente.               │
│                                                                                              │
│  Volume realizado hoje: 12 mensagens                                                         │
│  Sugestão do dia: 15–20 mensagens                                                            │
│                                                                                              │
│  [Ver plano completo]   [Ajustar fase manualmente]                                           │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Tela de Backup e Restauração

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│  BACKUP E RESTAURAÇÃO                                                                        │
│  ─────────────────────────────────────────────────────────────────────────────────────────  │
│                                                                                              │
│  Último backup: 28/09 08:00 — 2,3 MB — C:\Users\...\backups\2026-09-28_08-00.zip             │
│  Backups anteriores:                                                                         │
│  • 27/09 08:00 — 2,2 MB                                                                      │
│  • 26/09 08:00 — 2,1 MB                                                                      │
│                                                                                              │
│  [Fazer backup agora]                                                                        │
│                                                                                              │
│  Restaurar:                                                                                  │
│  [Selecionar arquivo de backup]  [Restaurar]                                                 │
│                                                                                              │
│  ⚠ A restauração substitui o banco atual. Faça backup antes.                                 │
│  ⚠ Sem criptografia (R-033) — proteja a pasta de destino.                                    │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 9. Tela de Inicialização / Conexão WhatsApp

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│  CONECTAR WHATSAPP                                                                           │
│  ─────────────────────────────────────────────────────────────────────────────────────────  │
│                                                                                              │
│  Número dedicado: +55 11 9XXXX-XXXX                                                          │
│  Tipo de conexão: Não oficial (Baileys)                                                      │
│                                                                                              │
│  [QR Code aparece aqui — escaneie com o WhatsApp do número dedicado]                         │
│                                                                                              │
│  Status: Aguardando leitura do QR Code                                                       │
│                                                                                              │
│  [Reconectar]   [Usar sessão existente]                                                      │
│                                                                                              │
│  ⚠ Não use este número para fins pessoais.                                                   │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 10. Mapa de telas

| Tela | Requisitos | User Stories |
|---|---|---|
| Painel dividido | R-046 | US-025, US-026 |
| Notificação de handoff | R-013 | US-014, US-015, US-016, US-017 |
| CRM Pipeline (Kanban/Lista) | R-021, R-043 | US-021, US-024 |
| Detalhe do lead | R-043 | US-023, US-024 |
| Configurações | R-006, R-007, R-023, R-039, R-040, R-044, R-045 | US-029 |
| Logs e falhas | R-045 | US-029 |
| Aquecimento (sugestão) | R-039, R-040 | — |
| Backup e restauração | R-032 | US-030 |
| Conexão WhatsApp | R-016 | US-032 |

---

## 11. Observações de design

- **Tema:** escuro ou claro, configurável. Padrão: escuro (menos fadiga visual em operação prolongada).
- **Fonte:** sans-serif legível, tamanho mínimo 14px.
- **Cores de status:** 🟢 verde (qualificado/aquecido), 🟡 amarelo (respondeu), 🔴 vermelho (handoff), ⚪ cinza (novo/contatado), ⚫ preto (perdido).
- **Atalhos de teclado:** a definir na implementação, mas prever atalhos para assumir, pausar, devolver, aceitar sugestão.
- **Responsividade:** painel otimizado para desktop (Windows). Não é prioridade para mobile nesta fase.
- **Notificações:** sempre no topo, com som distinto para handoff e falha crítica.