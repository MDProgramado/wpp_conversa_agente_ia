# Feature Research

**Domain:** Automação local de conversas WhatsApp para prospecção B2B (venda de serviços digitais)
**Researched:** 2026-09-28
**Confidence:** HIGH (políticas e tecnologia) / MEDIUM (diferenciação e posicionamento)
**Modo:** Ecosystem — features de produtos de automação WhatsApp/B2B no Brasil, 2025–2026

---

## Leitura do Ecossistema (contexto que determina a categorização)

O mercado brasileiro de automação WhatsApp se divide em **dois campos com regras opostas**, e o projeto vive no segundo:

| Campo | Ferramentas | Pode fazer prospecção fria? | Por quê |
|---|---|---|---|
| **API oficial (Meta BSP)** | BotConversa, AiSensy, Wati, Zenvia, AvisaApp, LeadCNPJ (canal API) | **Não** | Meta exige opt-in + template aprovado para mensagem iniciada pelo negócio ([Business Messaging Policy](https://business.whatsapp.com/policy)) |
| **Canal não oficial (QR/Baileys)** | LeadCNPJ LeadWhats (QR), Redrive, ProspectaMax, LEAD AI, Evolution API | **Sim** | Não passa pela aprovação de template; opera fora dos termos de WhatsApp |

A LeadCNPJ documenta isso abertamente no próprio produto: *"A política da Meta exige opt-in do contato e template aprovado para mensagem ativa — por isso a prospecção fria não roda neste canal. Canal não oficial · Gratuito · **Permite prospecção fria, que a política da API oficial não autoriza**."*

**Consequência direta para este projeto:** o fluxo "humano manda a 1ª mensagem manualmente → bot assume" **só é possível no canal não oficial**. Na API oficial o 1º contato exigiria template aprovado, o que mataria a premissa do R-001. Isso valida a decisão de canal do PROJECT.md e significa que **todo o conjunto de features conformáveis (opt-in real, template, qualidade monitorada pela Meta) fica fora do alcance do MVP** — e precisa ser explicitamente listado como anti-feature, não esquecido.

**Segundo fato estrutural:** o mercado é dominado por ferramentas de **alto volume e multi-conta** (ZAPFire: 10 números no plano Business; SocialHub: orientação de multi-chip; tiers 1K/10K/100K conversas). O projeto é deliberadamente o **oposto**: 1 número, 20–30 mensagens/dia, ~20 leads/dia. As features que esses concorrentes tratam como table stakes (broadcast, templates, integração, escala) são **anti-features** aqui.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features que o usuário assume que existem. Ausentes = produto parece quebrado. Todas listadas já têm cobertura em R-xxx; o valor desta seção é dizer **o que NÃO pode faltar mesmo no MVP** e evidenciar o padrão de mercado.

| Feature | Why Expected | Complexity | Evidência / Nota |
|---|---|---|---|
| **Assumir conversa após 1ª mensagem manual** | Fluxo não faz sentido sem isso; é a premissa do produto | LOW (Baileys) / MEDIUM (painel manual) | Padrão inverso do mercado: LeadCNPJ, Redrive e afins iniciam contato automaticamente. É o que nos diferencia, mas continua sendo table stake funcional (R-001, R-002) |
| **Conversa conduzida por LLM com memória** | "IA que responde" é o headline de AiSensy, BotConversa, ChatFlux, Lead Copilot | MEDIUM | Requisito de contexto é explícito: memória curta+média, resumo progressivo. Sem isso o bot "esquece" e queima o lead (R-008, R-011) |
| **Humanização de envio (delays + digitando + quebra de mensagem)** | Assinatura comportamental do canal; vendida como "anti-ban" por toda ferramenta de nicho (ProspectaMax, SocialHub, ZAPFire) | LOW | Evidência técnica: `baileys-antiban` documenta que `PresenceChoreographer` com modelo WPM (45±15) e jitter Gaussiano é o que impede detecção de "too perfect bot" (MEDIUM — fonte npm, sem paper) (R-067) |
| **Follow-up com cadência** | Todo CRM de cadência tem; LeadCNPJ documenta 4 toques = padrão canônico BR | LOW | Cadência BR canônica: Dia 0 → Dia 3 → Dia 7 → Dia 14 (break-up). "Acima de 4 vira assédio" (LeadCNPJ, MEDIUM) (R-003, R-004, R-005) |
| **Trava de limite diário + janela de envio** | Qualidade de número é medida por bloqueios/denúncias; limites existem pra preservar o canal | LOW | Meta: quality rating considera blocos/denúncias/taxa de entrega; <2% blocos = High, 2–5% Medium, >5% Low. Um número novo em base fria é a causa nº1 de ban (HIGH) (R-006, R-023) |
| **Pipeline de status com histórico imutável** | Padrão universal de CRM B2B: PipeRun, Pipely, LeadCNPJ, CRM Whats Pro, Mia CRM, Zopkit | MEDIUM | Kanban + drag-and-drop + coluna de perdidos é o piso (R-021) |
| **Busca e filtros** | CRM sem busca é planilha (LeadCNPJ contraponto: "sem alt+tab") | LOW | (R-043) |
| **Tags** | Padrão: Zopkit ("tag support"), Pipely ("tags de status e segmentação"), CRM Whats Pro ("etiquetas com cor") | LOW | (R-043) |
| **Notas + timeline de atividades** | Padrão: Mia CRM ("notes and tags on any record"), Zopkit ("chronological activity timeline"), PipeRun ("histórico em linha do tempo") | LOW | (R-043) |
| **Tarefas/lembretes com responsável** | Padrão: Mia CRM ("tasks with due dates and assignees"), TatvaCRM, Leads2B ("atribuição automática, prazos e avisos") | LOW | No piloto o "responsável" é sempre o Admin (R-049) — a coluna existe por compatibilidade futura (R-028) (R-043) |
| **Handoff humano com notificação** | Table stake em TODO agente de IA: AiSensy ("Smooth Chatbot to Human Transfer"), Wati ("AI Copilot"), LEADFY | MEDIUM | Mas quase todos tratam como *escalonamento*. O nosso é *fronteira projetada* — ver diferenciadores (R-012, R-013) |
| **Modo copiloto pós-handoff** | Wati e AiSensy já vendem; LeadCNPJ LeadWhats tem "Copilot IA" com resumo em bullets e próximos passos | MEDIUM | No MVP é parcial (R-060 "fora do MVP: modo copiloto completo") (R-014) |
| **Detecção de opt-out + registro de opt-out** | Politicamente e legalmente obrigatório; toda ferramenta de WhatsApp tem | MEDIUM | WhatsApp Business Messaging Policy exige respeitar opt-out **on ou off WhatsApp** (HIGH) (R-024) |
| **Registro de origem/base legal/finalidade** | Exigência LGPD art. 37 (registro das operações) + ANPD | LOW | Balance test em 3 fases (finalidade / necessidade / balanceamento e salvaguardas) é o modelo da ANPD (HIGH) (R-064) |
| **Logs + notificação de falha crítica** | Piso operacional. Desconexão do WhatsApp ou PG parado = lead queimado | LOW | R-045 é a salvaguarda que torna o sistema operável sem supervisão constante (R-034) |
| **Persistência + backup** | Sinônimo de "CRM"; sem backup local, perda de histórico = perda do asset | LOW | (R-031, R-032) |
| **Kill switch global** | Ferramenta de número único precisa de parada instantânea independente do app | LOW | ⚠️ **GAP**: R-046 só tem "pausar bot" por conversa. Falta pausa global que não dependa de fechar o app |
| **Nenhum envio sem ação explícita do Admin em modo manual/copiloto** | Segurança contratual do sistema | LOW | Invariante de AR-010 e R-014 |

### Differentiators (Competitive Advantage)

Features que o mercado **não** oferece ou oferece mal, e que sustentam o Core Value do PROJECT.md ("conduzir com naturalidade suficiente para gerar reuniões sem cruzar fronteira proibida — e parar no instante exato").

| Feature | Value Proposition | Complexity | Evidência / Nota |
|---|---|---|---|
| **Guardrails como invariantes de runtime, não como prompt** | Cada concorrente lista "human handoff" como feature. Nenhum lista "o bot está PROIBIDO de falar de preço/prazo" como restrição de sistema verificada. O guardrail em código (não em prompt) é o produto | HIGH | É a razão pela qual o bot é confiável o suficiente para operar sozinho (R-034). Alinhado ao "framework híbrido bot+humano" que a própria AiSensy recomenda como best practice, mas com fronteiras mais estreitas (R-012, R-041, R-042) |
| **Contato sempre iniciado por humano (inversão do mercado)** | Toda a categoria de tools de prospecção fria é construída ao redor de auto-first-contact + broadcast. Inverter isso é a assinatura do produto | MEDIUM | R-001. Reduz o principal vetor de denúncia e combina com o requisito de opt-out irreversível (R-024) |
| **Modo silêncio total** | Bot que deliberadamente NÃO responde e notifica o humano quando a fronteira é cruzada. Nenhum concorrente tem "não responder" como feature — todos respondem sempre | MEDIUM | R-057, R-066. É o que transforma "bot que errou" em "bot que se retirou" (AR-006, AR-010) |
| **Trilha de auditoria das decisões da IA** | Não só *o que* aconteceu, mas *por que*: transições de status com critério, justificativa e timestamp; auto-notas com resumo/objeções/próximo passo | MEDIUM | Diferencia de "activity timeline" genérico (Pipedrive/Mia) porque registra inferência da IA, não só ação humana. Necessário para R-022 auditável (R-021, R-022) |
| **Shadow mode / simulação antes do envio real** | Permite validar qualidade de fala e guarda-corpo com risco zero antes de tocar no número (irrecuperável se banido — R-059) | MEDIUM | ⚠️ **RECOMENDAÇÃO ADICIONAL**: não está nos requisitos. Alinhado a "testar antes de ir pra produção" que toda ferramenta séria de IA de vendas faz. Ver "MVP Definition" |
| **Camada de canal isolada (adaptador Baileys → API oficial)** | Permiteitantar o sistema sem reescrever histórico/status/agendamentos. Quase todo concorrente é hard-wired num canal | HIGH | R-016. Estratégia: começar não-oficial, migrar quando houver base quente. Valor de fase futura, não de MVP |
| **Qualificação BANT-lite de 2 critérios (verba + decisão), com evidência indireta primeiro** | BANT completo (4 campos) e MEDDICC (8) são pesado demais pra LLM em chat curto. Critério mínimo de 2 eixos com validação híbrida é mais executável e auditável | MEDIUM | Salesforce: BANT é "rápida série de yes/no", mas "ignora fatores humanos" e "desqualifica leads que poderiam ser nutridos". MEDDICC: BANT é insuficiente em enterprise. Para o piloto de venda de sites/sistemas, 2 eixos bastam (MEDIUM) (R-051, R-052) |
| **Local-first: dado sai do PC só para a API de LLM** | Sem SaaS, sem preço por assento, sem vendor lock-in, sem gegeben de dados de clientes para terceiro. Relevante porque o PROJECT.md já assumiu risco de "sem criptografia" (R-033) — local-first reduz a superfície | MEDIUM | Concorrentes cobram R$137–300/mês (LeadCNPJ, BotConversa, Pipely) e mantêm dado em nuvem |
| **Baixo volume por design (20–30 msg/dia) como posição, não limitação** | Números pequenos são os que sobrevivem. Não é limitação: é a postura que a Meta e o mercado de channels convergeiram para | LOW | Contraste direto: métricas de mercado ("124.5K mensagens", "10.000 em Black Friday") são exatamente o perfil que produz ban. Um número dedicado em volume baixo é o que permite a migração futura para API oficial (R-023, R-059) |
| **Painel único: lista + chat + sugestões IA + histórico + ações rápidas, com modo exibido em tempo real** | Reduz o custo de supervisão. Sem isso, o Admin precisa olhar o WhatsApp e o CRM separado (a sobreposição de R-050 é problema de coordenação manual) | MEDIUM | R-046. Padrão de mercado: LeadCNPJ diferencia "tudo num único dashboard"; Clickmassa "centralize conversas de todas as redes sociais num só lugar" |
| **Filtro de compliance local (cláusulas proibidas) com notificação** | "Pedido de preço/proposta" e "quer agendar" viram handoff na mesma frase. Sinteza de intent com LLM é permitida; síntese de valor NÃO | MEDIUM | AR-012: preço nunca é "objeção comum" — é handoff imediato. Precisa de classificador dedicado, não só do prompt (R-012) |

### Anti-Features (Commonly Requested, Deliberately Not Built)

Features que parecem óbvias, que concorrentes vendem ativamente, e que **não** serão construídas. Cada linha: por que é pedido, por que é problemático aqui, o que fazer em vez disso.

| Feature | Why Requested | Why Problematic | Alternative |
|---|---|---|---|
| **Disparo em massa / broadcast / campanhas** | É o headline de LEADFY, Redrive, AvisaApp, AiSensy ("Broadcast Unlimited") | Exige template aprovado + opt-in na API oficial (proibido); no canal não oficial é o principal driver de ban e denúncia. Contraria R-023/AR-008 | Follow-up individual 1:1 com cadência e limite rígido (R-003, R-023) |
| **Contato frio automático (auto first-contact)** | É o produto de toda a categoria de prospecção fria | Inverte R-001; cria alto risco de denúncia; contraria o requisito de "origem registrada antes do contato" (AR-011) | Admin envia 1ª mensagem manualmente; o sistema assume depois (R-001) |
| **Envio de mídia (imagem, PDF, áudio, vídeo, documentos, catálogo, carrossel, botões interativos)** | Padrão de venda de todas as ferramentas (AiSensy: carousel cards, webviews, payments; Clickmassa: push com mídia) | AR-004/R-037. Mídia é vetor de Complain/spam e aumenta superfície de falha | Portfólio/proposta enviado manualmente pelo Admin após handoff (R-037) |
| **Processamento de mídia recebida (transcrição de áudio, leitura de imagem/PDF, text-to-voice)** | AiSensy vende Voice-to-Text, Text-to-Voice, Image Response, Video Response como diferencial | AR-009/R-038. IA "fingindo que entendeu" áudio destrói a conversa e é risco de alucinação | Registrar + notificar + handoff; conversa pausada (R-038) |
| **Negociação / informação de preço, proposta, desconto, prazo** | "IA que negocia" é o demo de venda de todo mundo | AR-001/AR-002/AR-012 — invariantes absolutas. Alucinação de preço é risco comercial direto | Handoff imediato ao primeiro sinal (R-012) |
| **Agendamento autônomo de reunião (sugerir horários, criar evento, confirmar data)** | AiSensy: "Effortless Appointment Scheduling". BotConversa: "agenda compromissos" | AR-003/R-025. Bot que erra data cria no-show e frustração | Bot só notifica; Admin agenda manualmente e registra (R-025, R-026) |
| **Integração com Google Calendar / e-mail / planilhas / Telegram / CRM externo** | BotConversa: "50+ integrações"; ChatFlux: "Conecte seu CRM, agenda, prontuário" | R-044 — escopo mínimo de integrações. 50 integrações é afogamento de escopo para piloto monousuário | Só 3 integrações: caça-leads, LLM, WhatsApp local (R-044) |
| **Omnichannel (Instagram, Telegram, site, e-mail)** | Clickmassa/ChatFlux/BotConversa posicionam "multicanal" | Fora do escopo; cada canal adiciona superfície de compliance e duplica trabalho de handoff | WhatsApp apenas (R-044) |
| **Multi-número / rotação de chips / granjas de instâncias** | ZAPFire: 10 números (Business), ilimitado (Enterprise); guia de "multi-chip" como contorno de ban | Contraria R-059 (número único dedicado). Risco: se 1 número cai, sem redundância; multi-chip aumenta chance de 1 cair | Um número. Risco aceito e documentado (R-059) |
| **Aquecimento automático / auto-escalada de volume** | Toda ferramenta oferece "warm-up automático" (SocialHub, Poli) | R-039/R-040 — sistema apenas sugere; Admin controla manualmente | Sugestão de aquecimento no painel, controle manual (R-039, R-040) |
| **Validação automática de existência de número WhatsApp** | Conveniência técnica | R-019 — responsabilidade é do caça-leads; sistema não valida | Tratar erro de envio sem quebrar a fila (R-019) |
| **Deduplicação automática de leads** | "Standard" em CRM (Zopkit tem "duplicate detection") | R-020 — decisão manual do Admin para evitar sobreposição | Sinalizar duplicidade com histórico de tentativas (R-020) |
| **Lead scoring / enriquecimento de dados (CNAE, faturamento, sócios) → injetar na IA** | DataCNPJ vende "enrichment_score", "poder de compra", "dados públicos do CNPJ" | R-018 — API retorna apenas nome, telefone, endereço. R-054 — IA não presume nicho, porte, dor ou necessidade. Enriquecer contradiz os dois e amplia exposição LGPD | Contexto é descoberto na conversa (R-018, R-054) |
| **Relatórios avançados / dashboards analíticos / forecast** | Padrão total de CRM (PipeRun, Pipely, Zopkit) | R-035 (v2+). Além disso: 20–30 msg/dia, ~20 leads/dia → qualquer dashboard produz número estranho e com falsa precisão. Risco de decisões baseadas em ruído | Apuração mensal mínima de R-061 (5 reuniões, 30% qualificação) (R-062) |
| **Financeiro avançado (contratos, recibos, comissões, impostos)** | Padrão de CRM comercial | R-036 — v2+. Fora do núcleo operacional | Registro manual básico de valor/status/ticket (R-036) |
| **Multiusuário, papéis, permissões, funis por vendedor** | Padrão de CRM (TatvaCRM, CRM Whats Pro "visão por vendedor") | R-027 (piloto só Admin) + R-050 (risco ALTO: mesma pessoa abordada 2x se lista compartilhada). Sem usuários adicionais, sem atribuição | Arquitetura preparada (responsável, criado_por) sem UI multiusuário (R-028) |
| **WhatsApp Payments / checkout no chat** | AiSensy: "WhatsApp Payments" como diferencial | Fora do escopo; adiciona superfície de pagamento. E o bot não pode "fechar negócio" (AR-002) | Fechamento manual pelo Admin |
| **Gestão de templates de mensagem (WhatsApp Business API)** | Toda ferramenta de API oficial tem ("crie template, aguarde aprovação") | Só tem sentido se migrar para API oficial — e na API oficial a prospecção fria é proibida. Construir agora é trabalho jogado fora | Quando migrar (fase futura) |
| **Respostas automáticas de ausência / mensagem de fora do expediente** | WhatsApp Business nativo; Clickmassa lista "mensagem de ausência" | A janela 7h–17h + silêncio total em irritação (R-066) conflita com auto-responder. Silêncio é a postura de segurança | Nada é enviado fora da janela (R-006) |
| **Resposta automática a mídia / qualquer ação do bot após handoff** | Conveniência | AR-009/AR-010 — silêncio total até Admin assumir | Bot registra e notifica (R-038, R-066) |
| **Build de automação visual (n8n-style) / corretor de fluxos** | ChatFlux: "n8n exposto ao cliente é ruim"; BotConversa: "construtor de blocos sem programar" | R-044/escopo mínimo. Construtor visual é produto SaaS, não ferramenta pessoal. Não escala valor aqui | Configuração em arquivo/painel local para uso pessoal |

**Anti-feature adicional com implicação legal (recomendação — ver "Riscos & Recomendações"):**

| Anti-feature a adicionar | Why Requested | Why Problematic | Alternative |
|---|---|---|---|
| **Impersonação profunda: clonar voz do Admin, fabricar detalhes pessoais/biográficos do Admin, imitar terceiro** | "Humanizar ao máximo" | AR-006 já proíbe revelação espontânea, mas silêncio + handoff é a única posição defensável. Jurisprudência emergente (Air Canada/BC 2024; Hamm/Alemanha 2026) rejeita "o bot é terceiro" como defesa — empresa responde pelo que o bot diz. Features que aprofundam a enganação aumentam exposição sem benefício de conversão | Bot fala como o Admin, sobre o negócio do Admin, sem inventar fatos pessoais; em pergunta direta sobre automação: silêncio + handoff (R-055, R-056, R-057) |

---

## Feature Dependencies

```
[Camada de canal (Baileys) — R-016]
    └──requires──> [Humanização de envio: delays + digitando — R-067]
                       └──requires──> [Janela 7h-17h + limite diário — R-006, R-023]
                                              └──requires──> [Fila para próximo dia útil / drip pós-abertura — R-007]

[Conexão WhatsApp]
    └──enables──> [1ª mensagem manual → assunção do bot — R-001, R-002]
                       └──requires──> [Integração API LLM — R-009]
                       └──requires──> [Guardrails de handoff em runtime — R-012, R-065, AR-001..012]
                       └──requires──> [Lead no CRM com histórico imutável — R-021, R-043]
                                              └──enables──> [Status automático por IA — R-022]
[Notificação local de handoff]  ←──requires── [Guardrails de handoff]

[Opt-out + LGPD]  ←──blocks──  [Qualquer mensagem ativa]

[Canal não oficial] ──conflita── [API oficial / templates / opt-in Meta]
[Multiusuário]    ──conflita──  [Piloto Admin-only / R-050 sobreposição]
[R-026 lembrete pós-agendamento] ──conflita── [R-025 bot nunca agenda] (só se "remarcar/cancelar" for deixado como ação do bot)
```

### Dependency Notes

- **[Humanização] requires [Canal]**: presença/typing é um recurso do socket WebSocket (Baileys `sendPresenceUpdate`), não uma camada de aplicação. Não dá pra "simular digitando" sem conexão ativa.
- **[Janela/limite] requires [Humanização]**: sem pacing, "20-30/dia" vira 30 envios em rajada num instante único, que é exatamente o padrão de detecção.
- **[Handoff] requires [Notificação local]**: um handoff sem alerta = lead orphan. A notificação é o que torna o "modo automático total" (R-034) seguro.
- **[CRM/histórico] enables [Status automático]**: R-022 exige "transições auditáveis" — só é auditável se existe histórico imutável (R-043) para anexar a justificativa.
- **[Canal não oficial] conflicts [API oficial/templating]**: LeadCNPJ documenta que a API oficial **não autoriza prospecção fria**. Migrar de canal no futuro significa abrir mão da prospecção fria OU conseguir opt-in real. Tensiona R-016.
- **[R-026 lembrete] conflicts [R-025]**: ver Gaps §5.

---

## MVP Definition (R-060)

### Launch With (v1)

Mínimo para validar o conceito sem colocar o número (irrecuperável se banido — R-059) em risco indevido. Ordene por dependência, não por valor.

- [ ] **Canal Baileys + QR pairing + watchdog de desconexão** — foundation; sem ele nada roda (R-016, R-045)
- [ ] **Import via API do caça-leads** (filtros: estado, cidade, região, nicho, nome-chave) — sem lista não há o que abordar (R-017, R-018)
- [ ] **Registro de origem/base legal/finalidade no ato da importação** — bloqueia contato sem lastro (AR-011, R-064)
- [ ] **1ª mensagem manual → assunção do bot** — a premissa (R-001, R-002)
- [ ] **Persona + contexto persistido (incluindo a 1ª mensagem do Admin)** — ver Gap §1; sem isso o bot assume às cegas
- [ ] **Guardrails de handoff em runtime** (preço/proposta/agendamento/irritação/denúncia/opt-out/dúvida complexa/pergunta sobre automação) — o produto (R-012, R-065, R-056, AR-001..012)
- [ ] **Notificação local (som + pop-up) com lead, motivo e ação rápida** — torna o automático-total operável (R-013)
- [ ] **Follow-up 1h/1d/3d/7d, máx 4, encerra em "sem resposta"** (com detecção de não-resposta!) — ver Gap §2 (R-003..R-005)
- [ ] **Janela dias úteis 7h–17h + limite 20–30/dia com trava e fila** — o que protege o número (R-006, R-023)
- [ ] **Humanização: delays aleatórios, typing, quebra de mensagem longa** (R-067)
- [ ] **CRM intermediário: lista, status, histórico imutável, busca, tags, filtros, notas** (R-021, R-043)
- [ ] **Status automático por IA, auditável, com override manual** (R-022)
- [ ] **Detecção de opt-out + registro de exclusão/retensão** (R-024)
- [ ] **PostgreSQL local + script de migração + backup manual versionado** (R-031, R-032)
- [ ] **Logs em arquivo + notificação de falha crítica** (R-045)
- [ ] **Shadow mode (bot rascunha, não envia)** — *RECOMENDAÇÃO ADICIONAL* (ver §Riscos)
- [ ] **Kill switch global** — *RECOMENDAÇÃO ADICIONAL* (tabela de Table Stakes)

### Add After Validation (v1.x)

- [ ] **Modo copiloto pós-handoff completo** (sugestões sem enviar) — gatilho: primeiro handoff de preço mal atendido pelo Admin (R-014, R-046)
- [ ] **Confirmação e lembrete pós-agendamento** (R-026) — gatilho: Admin começa a registrar reuniões manualmente e a taxa de no-show incomoda
- [ ] **Painel dividido completo (chat + sugestões IA + ações rápidas em tempo real)** (R-046) — gatilho: volume de handoffs > ~5/dia torna o switch de janela inviável
- [ ] **Botões de assumir/devolver/copiloto por conversa** (R-046) — gatilho: operacional após o painel
- [ ] **Mensagem de break-up no follow-up final** — gatilho: taxa de resposta no toque 4 se mostra maior que nos demais (LeadCNPJ observa isso; MEDIUM). Nota: OUR R-005 hoje **encerra**; introduzir break-up é decisão, não default
- [ ] **Mensagem de ausência do Admin (manual, não automática)** — gatilho: lead escreve fora da janela com frequência

### Future Consideration (v2+)

- [ ] **Apuração mensal dos critérios de sucesso (R-061, R-062)** — gatilho: 30 dias de operação contínua
- [ ] **Camada de conexão → API oficial** (R-016) — gatilho: base quente com opt-in real e o negócio migrando para atendimento a clientes existentes (prospectação fria é proibida lá)
- [ ] **Analytics avançado (R-035)** — gatilho: volume sustenta amostragem; hoje produziria ruído
- [ ] **Financeiro básico (R-036)** — gatilho: começam a fechar contratos
- [ ] **Multiusuário (R-028..R-030)** — gatilho: R-048 (agência com equipe) ativado
- [ ] **Relatório de teste de balanceamento LGPD como documento versionado** — gatilho: qualquer pedido de titular (direito de acesso, art. 18 LGPD) ou fiscalização ANPD
- [ ] **RIPD** (Relatório de Impacto à Proteção de Dados) — gatilho: ANPD recomenda quando o tratamento de legítimo interesse envolver alto risco; para prospecção em base fria isso é discutível mas defensável

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---|---|---|---|
| Conexão Baileys + QR + watchdog | HIGH | MEDIUM | P1 |
| Guardrails de handoff em runtime | HIGH (é o produto) | HIGH | P1 |
| Notificação local de handoff | HIGH | LOW | P1 |
| 1ª msg manual → assunção | HIGH | LOW | P1 |
| Persona LLM + contexto | HIGH | MEDIUM | P1 |
| Janela 7h-17h + limite 20-30/dia | HIGH (protege o número) | LOW | P1 |
| Humanização de envio | HIGH (anti-detecção) | LOW | P1 |
| Opt-out + LGPD | HIGH (obrigatório) | MEDIUM | P1 |
| Follow-up 1h/1d/3d/7d | HIGH | LOW | P1 |
| CRM intermediário (status/histórico/busca/tags/notas) | HIGH | MEDIUM | P1 |
| PostgreSQL + backup + logs | HIGH (operação) | LOW | P1 |
| Import via API caça-leads | HIGH | LOW | P1 |
| Kill switch global | HIGH | LOW | P1 (recomendado) |
| Shadow mode | HIGH (de-risking) | MEDIUM | P1 (recomendado) |
| Status automático por IA | MEDIUM | MEDIUM | P2 |
| Modo copiloto pós-handoff | MEDIUM | MEDIUM | P2 |
| Painel dividido completo | MEDIUM | HIGH | P2 |
| Confirmação/lembrete pós-agendamento | MEDIUM | MEDIUM | P2 |
| Apuração mensal R-061/R-062 | MEDIUM | LOW | P2 |
| Qualificação BANT-lite (verba+decisão) | MEDIUM | MEDIUM | P2 |
| Anti-features (todas as 20+) | — | — | Nunca |

**Priority key:** P1 = must have for launch · P2 = should have, add when possible · P3 = future.

---

## Competitor Feature Analysis

| Feature | LeadCNPJ (all-in-one BR) | BotConversa / AiSensy / Wati (API of.) | ZAPFire / ProspectaMax / LEAD AI (não of.) | Nossa Abordagem |
|---|---|---|---|---|
| Primeiro contato | Automático (dispara, extrai CNAE) | Template aprovado (broadcast) | Automático em massa | **Humano manual, sempre** (R-001) |
| Canal | API oficial (cold bloqueado) + QR não oficial (cold liberado) | API oficial, templates | QR/Baileys | **Não oficial no MVP, adaptador p/ migrar** (R-016) |
| Volume | Tiers 1K/10K/100K | 250 → ilimitado por tier | "disparo ilimitado" | **20–30/dia, 20 leads/dia, trava dura** (R-023) |
| Preço/negociação | IA oferece produtos e agenda | "AI fecha vendas", "agenda compromissos" | "IA para copy e respostas automáticas" | **Proibido, handoff imediato** (AR-001, AR-012) |
| Handoff | "Multi-atendente, encaminhamento" | "Smooth Bot→Human Transfer" | — | **Fronteira projetada + silêncio total** (R-012, R-057, R-066) |
| Copiloto | "Lead Copilot IA" (resumo em bullets) | "Wati AI Copilot" | — | **Modo copiloto pós-handoff (R-014)** — parcial no MVP |
| Mídia | Webviews, catálogo | Carousel, imagens, áudio, vídeo | Push com mídia | **Nenhuma, só texto e links** (AR-004) |
| Opt-out | Segmentação/broadcast, políticas Meta | Templates & quality rating | Limites manuais | **Detecção automática + registro LGPD + irreversibilidade** (R-024) |
| Aquecimento | "maturação do número" (automático) | Warm-up nativo Meta | "modo seguro, aquecimento, cooldown" | **Sugere, não aplica; Admin controla** (R-039, R-040) |
| Multi-conta | Até 2–4 números | Portfólio de números | Multi-chip / granjas | **Um número** (R-059) |
| Relatórios | Dashboard, funil, ticket médio | Analytics, ROI, funil | Taxa entrega/abertura/response | **Apuração mensal mínima só** (R-061) |

**Leitura:** a tabela acima mostra que **todo concorrente de alta maturidade é explicitamente anti-feature para nós**. Nossa diferenciação não está em "ter mais features" — está em fazer **um sistema muito menor cujo comportamento é garantido**. Isso é coerente com o Core Value e com as invariantes do PROJECT.md, e significa que a proposta de valor não pode ser "mais automação" e sim "automação que não queima o número nem a operação".

---

## Riscos & Recomendações (achados da pesquisa)

### 1. Tensão entre AR-006 (não revelar automação) e o direito de saber do titular — RISCO, não feature

Achado mais relevante da pesquisa, e não estava nos requisitos:

- **Air Canada (BC Civil Resolution Tribunal, fev/2024)**: empresa foi condenada a pagar indenização porque o chatbot deu informação incorreta. O tribunal **rejeitou** o argumento de que "o chatbot é uma entidade separada" — a empresa responde pelo que o bot diz. (HIGH — decisão pública)
- **Hamm, Higher Regional Court (Alemanha, jun/2026)**: mesma linha — os tribunais recusam tratar o output do chatbot como diferente de conteúdo estático para fins de responsabilidade. (HIGH)
- **AI disclosure laws em chatbot comercial** estão em alta em várias jurisdições. (MEDIUM — comentário de firmas de advocacia, não texto de lei)
- **ANPD / PL 2338**: o marco legal de IA em tramitação (não sancionado) reforça transparência e direito a saber/intervenção humana. (LOW-MEDIUM — projeto de lei, não vigente)

**Implicação para AR-006:** o sistema atual (não revela espontaneamente; silêncio total + handoff se perguntar direto) é **a única postura defensável** — mas apenas seCombined com:
1. Nunca fabricar fatos pessoais/biográficos do Admin (anti-feature nova acima)
2. Nunca negar/admitir/desviar quando perguntado (R-056 — já coberto)
3. Nunca construir features que aproximem a IA de um humano real de formaDetectável (sem clonar voz, sem detalhes inventados)
4. Documentar o risco no AGENTS.md/ADR (recomendação, não requisito)

**Não recomendo relaxar AR-006.** Recomendo **adicionar** a anti-feature de impersonação profunda e registrar o risco jurídico. Isso é feature work (= não construir algo), então entra no roadmap como decisão explícita, não como requisito.

### 2. R-060 in numbers vs. R-061 timeline

R-061 (5 reuniões/mês, 30% qualificação/mês) e R-062 (apuração mensal) exigem **30+ dias de operação contínua com risco de banimento em cada um**. R-059 avisa: "se banido, operação inteira para, sem redundância." → **Shadow mode P1** (recomendado acima) é o mecanismo que permite avaliar qualidade de fala e guarda-corpo **sem** consumir a janela de tolerância do número.

### 3. "Sem redundância" é o maior risco do projeto e nenhuma feature o mitiga

R-059 é explícito. Nenhuma feature de software evita a queda do número dedicado. O que **pode** ser feito: (a) shadow mode para reduzir chance de comportamento robótico, (b) kill switch, (c) notificação de desconexão, (d) leap de canal. A redundância (número 2) é explicitamente proibida (R-059). → Aceitar e documentar.

### 4. R-050 (sobreposição com equipe) não é problema de software

A feature "lista de leads não compartilhada" (R-050) é um **controle de processo humano**, não de software. Nenhuma feature impede o Admin de verbalmente dizer à equipe "falei com a X". O software pode apenas tornar a lista visível apenas ao Admin eapoiar a coordenação — o resto é processo. Roadmap deve aceitar isso e não prometer feature de "prevenir sobreposição".

### 5. Gap crítico: follow-up de 1h depende de detecção de resposta que não está nos requisitos

R-003 diz "**se lead não responde**, bot aguarda e envia follow-up". Isso **requer** saber se houve resposta. Os requisitos nunca especificam esse mecanismo (e Baileys expõe recibos de leitura, "seen"). Sem ele, a cadência 1h/1d/3d/7d é cega. → **Requisito ausente** que bloqueia R-003. Notar também que a cadência canônica BR usa Dia 0/3/7/14, não 1h/1d/3d/7d — a de 1h é agressiva demais para canal não oficial em base fria, mas está em R-004/R-005 (decisão do usuário, não questionada aqui).

### 6. Gap: conteúdo da 1ª mensagem do Admin não é requisito

R-001 lista "lead, mensagem inicial, timestamp, número" como dados. Mas R-002/R-008 (bot assume e conduz) **não têm** o texto da 1ª mensagem como contexto declarado. Sem ele, o bot assume com zero do que o Admin quis dizer — o caso mais grave de "parece robô". → Requisito ausente, baixa complexidade, alto impacto na qualidade percebida.

### 7. R-004 vs R-005: contradição ainda viva em `docs/01-requisitos-funcionais.md`

R-004 lista cadência "1h → 1d → 3d → 7d → 15d"; R-005 diz "15d NÃO deve ser executado". O PROJECT.md já resolveu (cadência de 15d removida), mas o **documento de requisitos ainda tem as duas versões**. → Defeito de documentação a corrigir antes do roadmap.

### 8. R-058 é citado no anti-requisito AR-007 mas não existe no doc de requisitos

Varredura de `01-requisitos-funcionais.md` não encontra R-058. AR-007 referencia "R-058". → R-058 (janela) é na prática R-006. Corrigir referência.

### 9. R-026 × R-025: segunda classe de handoff não mapeada

R-026 diz que o bot envia "lembrete antes da reunião" e o lead pode "confirmar/remarcar/cancelar". **"Remarcar" é uma ação de agendamento** — deveria acionar handoff (R-012/AR-003) se vier do lead, não ser tratado pelo bot. Os requisitos não especificam. → Gap a fechar na definição.

### 10. Retenção e balance test — formalizar

R-024 exige "política de retenção" sem definir prazos. A ANPD (guia de legítimo interesse, fev/2024) define balance test em 3 fases: **finalidade / necessidade / balanceamento e salvaguardas**, e art. 37 LGPD exige registro das operações. Recommendation: o sistema deve **gerar um documento de teste de balanceamento versionado** (uma vez, por finalidade), não apenas campos "origem/base legal/finalidade". → Feature de compliance, LOW-MEDIUM custo, valor alto para fiscalização e para direito de acesso do titular (art. 18).

### 11. Cadência de mercado vs. cadência do projeto (nota, não mudança)

Mercado BR canônico (LeadCNPJ, MEDIUM): Dia 0 → 3 → 7 → 14 (break-up), 4 toques, e "acima de 4 vira assédio". Projeto: 1h → 1d → 3d → 7d, 4 toques, encerra. **Coincide em "4 toques" e "parar"** — bom sinal. A diferença: 1h de follow-up é mais agressivo; e o mercado valoriza uma **break-up message** como o toque de maior taxa de resposta. R-005 hoje **encerra sem break-up** ("sem resposta"). Isso é uma escolha; deixo como questão aberta (§Roadmap) e não como erro.

---

## Feature Gaps (requisitos ausentes que a pesquisa revelou)

| Gap | Requisito a criar | Prioridade |
|---|---|---|
| Detecção de não-resposta (para R-003 funcionar) | novo | P1 |
| Texto da 1ª mensagem do Admin como contexto do bot (para R-002/R-008) | novo | P1 |
| Kill switch global | novo | P1 |
| Shadow mode / simulação | novo (recomendado) | P1 |
| Drip de follow-up vencido na abertura (suavizar rajada de R-007) | complemento de R-007 | P1 |
| Documento de teste de balanceamento LGPD | complemento de R-024/R-064 | P2 |
| Motivos de "Perdido" enumerados | complemento de R-021 | P2 |
| Anti-feature de impersonação profunda (registro explícito) | novo (decisão) | P2 |
| Mapeamento "reagendar/cancelar" → handoff | complemento de R-026 | P2 |
| Correção de R-004/R-005 em `01-requisitos-funcionais.md` | defeito doc | P1 (doc) |
| Correção de referência R-058 em AR-007 | defeito doc | P1 (doc) |

---

## Fontes

### Políticas e Regulamentação (HIGH)
- WhatsApp Business Messaging Policy — https://business.whatsapp.com/policy (opt-in obrigatório; template para iniciar; automação permitida dentro da janela de 24h **com caminho de escalonamento humano**; respeitar opt-out on/off WhatsApp)
- WhatsApp Messaging Guidelines — https://www.whatsapp.com/legal/messaging-guidelines ("unofficial clients, bulk messaging, auto-messaging, auto-dialing, or automation to harm"; revisão automatizada + humana)
- WhatsApp Business Terms of Service — https://www.whatsapp.com/legal/business-terms
- Ajuda WhatsApp: limites de novas conversas (não se aplica a ferramentas de Business/API) — faq.whatsapp.com
- Ajuda WhatsApp: banimento de apps não oficiais — faq.whatsapp.com
- ANPD — Guia Orientativo: Hipóteses legais de tratamento — Legítimo Interesse (fev/2024) — teste de balanceamento em 3 fases; art. 37 (registro); art. 10 (não aplica a sensíveis) — gov.br/anpd
- Meta/360dialog/Twilio/Infobip docs — messaging limits (tiers 250/2K/10K/100K/unlimited), quality rating (bloqueios, denúncias, engajamento; downgrade automático)
- Best Practices for Marketing Messages on WhatsApp (Meta) — opt-in, categorias separadas, não agrupar promocional com transacional

### Ferramentas / Mercado (MEDIUM — sites de marketing, não documentação técnica)
- LeadCNPJ (leadcnpj.com.br) — all-in-one BR; documenta que API oficial **não autoriza** prospecção fria, canal QR **autoriza**; cadência BR Dia 0/3/7/14 break-up; Lead Copilot
- BotConversa (botconversa.com.br) — planos segmentados por canal; "API Oficial: não incluso" no plano básico; 50+ integrações; CRM Kanban
- AiSensy (aisensy.com) — AI Agents, Broadcast, human handoff, AI Copilot, WhatsApp Payments, multimodal
- Wati (wati.io) — AI Copilot no Team Inbox
- ChatFlux (chatflux.ai) — agentes de IA, multi-canal, orquestração multiagente
- Clickmassa, Zappy, SocialHub, ZAPFire, ProspectaMax, LEAD AI, Redrive, AvisaApp — prospecção fria/disparo em massa/warm-up/anti-ban

### Técnica/Antiban (MEDIUM-LOW)
- `baileys-antiban` (npm) — PresenceChoreographer, modelo WPM 45±15, jitter Gaussiano, ritmo circadiano; detecção baseada em reply-ratio, contact-graph distance, padrões temporais
- WasenderApi / OnCloudAPI — guias de risco de ban com Evolution API/Baileys
- LeadNotifi / checkleaked — comparativos Baileys/whatsapp-web.js vs Cloud API (risco ToS)

### CRM B2B (MEDIUM)
- PipeRun, Pipely, Mia CRM, Zopkit, CRM Whats Pro, TatvaCRM, CRMONA — padrões: pipeline kanban, tags, notes, timeline, tarefas+responsável, lembretes, search, filtros, owner, forecast
- Salesforce BANT vs MEDDICC; TechTarget BANT; meddicc.com —profundidade de frameworks de qualificação

### LGPD / IA (variada)
- Eesier/LeadCNPJ blog — LGPD na prospecção B2B (art. 7 IX, art. 7 §4 dados públicos)
- DLA Piper / JDSupra (jun/2026) — Hamm (Alemanha): chatbot não é terceiro, empresa responde
- Business Law Today / ABA (fev/2024) — Air Canada (BC): empresa responsável pelo chatbot
- modeloinicial.com.br, juridico.ai, velip.com.br — PL 2338/2023 (não vigente), CDC/Código Civil aplicáveis
- ANPD — Nota Técnica sobre política de privacidade do WhatsApp (2022)

---

*Feature research for: WhatsApp B2B prospecting automation (local, monousuário)*
*Researched: 2026-09-28*
*Confiança: HIGH em políticas/tecnologia, MEDIUM em diferenciação/posicionamento*
