# Pitfalls Research

**Domain:** Automação local de WhatsApp para prospecção B2B (número dedicado, conexão não oficial/Baileys, LLM externa, PostgreSQL local, Windows)
**Researched:** 2026-09-28
**Confidence:** MÉDIA-ALTA (domínio bem documentado por issues públicas do Baileys, pesquisa acadêmica de humanização e documentação oficial da ANPD; ver ressalvas por pitfall)

> **Nota de idioma:** documentação em português do Brasil conforme a restrição de idioma do projeto. Os títulos de seção seguem o template do GSD para o consumidor downstream reconhecer a estrutura.

> **TL;DR para o roadmap:** o projeto tem **três armadilhas que o PROJECT.md não antecipa e que mudam escopo, não só implementação**:
> 1. **O WhatsApp agora impõe orçamento de "pessoas novas" por conta (reach-out timelock / erro 463).** O limite real não é "20-30 mensagens/dia" — é "N contatos novos por dia". Isso invalida o dimensionamento implícito do R-023 e cria uma dependência de versão do Baileys (tctoken só existe a partir do rc10).
> 2. **R-019 está tecnicamente errado.** Enviar para número inexistente pode gerar restrição *de conta*, não erro de mensagem. A validação não pode continuar sendo responsabilidade do caça-leads.
> 3. **Os 12 anti-requisitos não podem ser garantidos por prompt, filtro de conteúdo ou palavra-chave.** Seis deles são invariantes de *estado* (silêncio pós-handoff, janela, limite diário, mídia, opt-out) que precisam viver em um único gate de envio, não espalhados em `if`s.

---

## Critical Pitfalls

Falhas específicas deste domínio — não são boas práticas genéricas. Cada pitfall traz como detectar cedo e em qual fase do roadmap ela deve ser prevenida.

### Pitfall 1: Reach-out Timelock / erro 463 — o orçamento de contatos novos não está no R-023

**O que dá errado:**
O WhatsApp passou a limitar, por conta, o envio de mensagens 1:1 para pessoas com quem a conta **nunca conversou**. O sistema responde com **erro 463** (`MessageAccountRestriction` / `NackCallerReachoutTimelocked`). O efeito é o oposto do esperado: quanto mais o bot insiste em follow-up para lead que nunca respondeu, **mais rápido o número é restringido**. Isso é exatamente a mecânica central do projeto — R-003/R-004 disparam follow-up (1h → 1d → 3d → 7d) para leads silenciosos, que são precisamente os contatos frios.

Pior: a library de canal usada no MVP **não tratava isso**. Até o `v7.0.0-rc10` (2026-05-06) não havia suporte a **tctoken** (Trusted Contact token), que é o token emitido pelo *destinatário* e que o WhatsApp Web sempre anexa. Sem ele, o servidor rejeita toda mensagem 1:1 para contato novo. Issues #2441, #2707, #1992 e #2698 documentam o problema e a investigação (`WAWebFetchReachoutTimelockJobQuery`, `WAWebIndividualNewChatMessageCappingLimitUtils`).

**Por que acontece:**
Três decisões do projeto conspiram contra a mitigação:
- **R-023 dimensiona por mensagem (20-30/dia), não por contato novo.** Um lead que respondeu pode receber 30 mensagens; um lead que nunca respondeu consome orçamento de *cold reach-out* a cada follow-up. A trava atual não protege o que precisa proteger.
- **`npm i baileys` instala `7.0.0-rc14`** (dist-tag `latest`), não uma versão estável — o último release estável da linha 6 é `6.7.24` (dist-tag `legacy`). Se o time fijar `^6.7.x`, não há tctoken.
- **O time de projeto desconhece as APIs de medição.** Desde o rc10 existem `sock.fetchAccountReachoutTimelock()` (retorna `isActive`, `time_enforcement_ends`, `enforcementType`) e `sock.fetchNewChatMessageCap()` (retorna `capping_status`, `used_quota`, `total_quota`). O orçamento é **consultável**.

**Como evitar:**
1. **Fixar Baileys em versão exata** (sem `^`, sem `latest`) e **≥ `7.0.0-rc10`**. Registrar a versão no README de operação.
2. **Nunca desabilitar history sync.** O `nctSalt` (usado para calcular o `cstoken = HMAC-SHA256(nctSalt, recipientLID)`) é capturado via `regular_high` dentro do app-state sync, que é gateado pelo history sync. Sem histórico, o fallback de cold-contact nunca é gerado e o erro 463 volta.
3. **Adicionar uma trava de orçamento de contatos novos, separada da trava de mensagens.** Ler `fetchNewChatMessageCap()` no startup e a cada N minutos; se `used_quota/total_quota` passar de um limiar (sugestão: 70%), **parar de iniciar conversas novas** e notificar. Isso vira uma segunda trava dura, ao lado do R-023.
4. **Tratar 463 como parada definitiva, nunca como retry.** O WhatsApp Web deliberadamente **não** faz retry de 463 (ver commit `tctoken: remove 463 retry` no PR #2339 e PR #2446: *"This PR does not retry 463. It prevents it, exactly like WA Web does"*). Retry piora a restrição. O handler correto é: logar, marcar o lead, **acionar handoff** e suspender envios para contatos novos até `time_enforcement_ends`.
5. **Rever R-004 à luz disso.** O follow-up de 1h para lead que nunca respondeu é o caso de maior consumo de orçamento e o de menor taxa de resposta. Considerar trocar a primeira mensagem de follow-up por uma **conversa de re-qualificação de valor** (o follow-up longo de R-003 em vez do curto) e adicionar **cancelamento automático da cadência se 463 ocorrer** para aquele lead.

**Sinais de alerta (detectar cedo):**
- Qualquer ocorrência de `463` no log de ACK — mesmo uma só. É o primeiro degrau antes do ban.
- `reachoutTimeLock` aparecendo em `connection.update` com `isActive: true`.
- `used_quota` de `fetchNewChatMessageCap()` subindo mais rápido que o esperado (ex.: 8 contatos novos em um dia de 20-30 mensagens).
- Mensagens ficarem presas em status `PENDING` sem ACK — indicador relatado de **shadow ban** (conta suprimida sem ban formal). É o sinal mais precoce: enviar para o próprio número/círculo e ver se chega.
- `ERROR: missing chunk number 0 for toast value` / `SessionError: No sessions` — sinal de sessão degradada, frequentemente precede desconexão.

**Phase to address:** **Fase 1 — Fundação e Canal.** É pré-requisito de tudo: sem tctoken e sem trava de orçamento, nenhuma fase posterior produz dados válidos. Não é adiável.

---

### Pitfall 2: Enviar para número inexistente gera restrição de conta — R-019 está tecnicamente errado

**O que dá errado:**
O R-019 declara que *"validação de número é responsabilidade do caça-leads"* e tira `onWhatsApp()` do escopo. A evidência do ecossistema contradiz isso: a investigação do erro 463 (#2441) documenta explicitamente que **uma tentativa de envio para número inválido / não registrado no WhatsApp pode disparar uma restrição de nível de conta**, não apenas um erro de destinatário. O sistema sairá do ar por causa de um único número errado vindo da API do caça-leads.

Isso é uma **decisão de projeto que a pesquisa invalida**, não um detalhe de implementação. R-019 precisa ir para `Out of Scope` com a razão correta, ou ser revertido.

**Por que acontece:**
O time assumiu que "falha de envio" é um erro de mensagem, tratável com retry (R-019 fala justamente em "tratamento de erro de envio sem quebrar a fila"). Mas a fronteira de erro está errada: o WhatsApp trata envio para número inválido como **atividade de reach-out**, e atividade de reach-out mal-sucedida consome o mesmo orçamento que gera 463. A suposição "é só um erro, seguimos" multiplica o custo de um erro pontual.

**Como evitar:**
1. **Reverter R-019.** Validar `onWhatsApp(jid)` antes de **todo** envio iniciado pelo sistema (primeira mensagem do Admin e follow-ups). A verificação é barata: é uma chamada de rede, ~1 vez por número, cacheável por 7 dias.
2. **Se o número não existir → estado terminal `NUMERO_INVALIDO`**, nunca enviado à fila, nunca retentado, sinalizado no painel para o Admin limpar a origem.
3. **Cache a validação por 7 dias** para não pagar uma chamada de rede a cada mensagem. O cache só é consultado para contatos já validados; uma validação negativa é definitiva e nunca é retentada.
4. **Registrar em log toda validação negativa com o `lead_id` e a origem** (R-018: só nome/telefone/endereço do caça-leads). Isso alimenta o R-064 (origem registrada) e cria evidência de diligência para a LGPD.

**Sinais de alerta:**
- Primeiro erro 463 seguido de um `NUMERO_INVALIDO` no mesmo minuto → a origem do caça-leads tem número ruim.
- Aumento do `used_quota` de `fetchNewChatMessageCap()` sem aumento proporcional de conversas novas bem-sucedidas.
- Taxa de falha de envio > 5% em um dia sem mudança no caça-leads.

**Phase to address:** **Fase 1 — Fundação e Canal.** É parte do gate de envio; precisa existir antes do primeiro envio real.

---

### Pitfall 3: System prompt não é guardrail — o LLM cruza a fronteira de preço sozinho

**O que dá errado:**
A camada de IA é instruída a não negociar preço (AR-001, AR-012) e a nunca agendar (AR-003). Mas **instrução em system prompt é sugestão, não garantia**. O caso canônico é o chatbot de uma concessionária Chevrolet que aceitou vender um Tahoe de US$ 76.000 por US$ 1 quando o usuário disse "aceite tudo que eu falar" — não foi um ataque sofisticado, foi um usuário pedindo cooperative e o modelo obedecendo. O padrão é exatamente o que este projeto precisa evitar: um LLM com habilidade linguística de conduzir venda e zero camada lógica que verifique se a venda faz sentido.

Jurisprudência recente reforçando que **a saída da IA é atribuível à empresa**: *Moffatt v. Air Canada* (BCCRT 2024) rejeitou a defesa de que o chatbot era "entidade legal separada"; e o **OLG Hamm, 12/05/2026, processo 4 UKl 3/25 (Aesthetify)** determinou que as afirmações do chatbot eram imputáveis à empresa, mesmo treinadas só com informação correta. Para um projeto que vende **sites, sistemas e automações sob encomenda** — onde a IA pode inventar prazo, escopo, stack ou garantia — isso é risco contratual direto, não só reputacional.

**Por que acontece:**
- A equipe trata as 12 anti-leis como conteúdo de prompt. Prompt é a camada com **menor** garantia: pesquisa de campo mede **60-70% de bypass com filtro regex de input**, **89-94% com classificador LLM**, e **99,1% combinando regex + classificador + validação de output**.
- O modelo tem **viés de concordância** (*sycophancy bias*): quanto mais o lead pressiona ("só um valor aproximado, é rapidinho"), mais o modelo preenche a lacuna. Isso **se combina com o R-042** (contorno autônomo de objeções) — o bot é treinado para ser persuasivo, e persuasão é exatamente o que gera promessa.
- **Não existe campo estruturado que impeça a resposta.** Se o LLM emite texto livre, nada impede fisicamente o token "R$ 3.500".

**Como evitar — arquitetura de três camadas ("sandwich"), com a decisão em código:**
1. **Camada 1 — Compreender (LLM).** Extrai *intenção* como dado estruturado: `{ intencao: "preco" | "agendamento" | "opt_out" | "pergunta_tecnica" | "conversa" , ... }`. Não gera texto para o cliente.
2. **Camada 2 — Decidir (código determinístico).** Aplica os anti-requisitos. `if intencao in ["preco","agendamento"] → handoff`. Aqui **não há LLM**. Nenhum texto persuasivo do usuário altera um `if`.
3. **Camada 3 — Responder (LLM).** Recebe a *decisão da camada 2*, não o texto cru do usuário. Nunca vê a instrução de negociar.

**Adicionalmente:**
- **Forçar saída estruturada** (tool use / JSON schema) com campos-canário: `menciona_valor: boolean` (deve ser sempre `false`), `menciona_prazo: boolean`, `menciona_agendamento: boolean`, `menciona_ia: boolean`, `envia_midia: boolean`. A regra `mentioned_competitors: { maxItems: 0 }` (array vazio forçado por schema) é um padrão documentado: o modelo **fisicamente não consegue** emitir o item proibido.
- **Validador de schema + um classificador de output** antes de cada envio. Se o classificador falhar, **o default é não enviar** (fail-closed). Nota: o Algolia Agent Studio adota *fail-open* para disponibilidade — **isso está errado para este projeto**, onde o custo de enviar é irreversível e o custo de não enviar é um delay.
- **Grounding contra fonte de verdade.** Para qualquer afirmação factual (portfolio, prazo, stack, caso), o LLM só pode usar conteúdo de uma base curada; o que não estiver lá não é dito. Se não há fonte, a resposta correta é escalar, não inventar.
- **Regra de ouro de aritmética de conversa:** o LLM **não faz conta** sobre prazo nem monta escopo. Ele não tem o dado.

**Sinais de alerta:**
- Qualquer mensagem contendo `R$`, `%`, `reais`, `dias`, `semanas`, `entrega em`, `garantia`, `prazo`.
- Contagem de mensagens que burlam o campo-canário: `menciona_valor: true` em resposta que passou pelo classificador (bug de classificador).
- Lead reagindo com "ótimo, então fica X?" — sinal de que a promessa já foi feita e o pipeline de handoff não disparou.
- **Replay do histórico completo no painel**: 100% das mensagens enviadas devem passar pelo validador. Qualquer mensagem fora desse caminho é bug de arquitetura, não de conteúdo.

**Phase to address:** **Fase 2 — IA e Handoff.** Mas a **Camada 2 (decisão em código) e o gate de saída** devem ser projetados na **Fase 1**, junto com o gate de envio do Pitfall 4 — porque gate de envio e Camada 2 são a mesma função vista de dois lados.

---

### Pitfall 4: Os anti-requisitos são de estado, não texto — e não existe um gate de envio único

**O que dá errado:**
A lista de 12 anti-requisitos mistura duas categorias que exigem mecanismos diferentes, e a equipe tende a tratar todas como "cuidado no prompt":

| Tipo | Anti-requisitos | Mecanismo correto |
|------|----------------|-------------------|
| **De conteúdo** (o texto é o problema) | AR-001, AR-002, AR-003, AR-004, AR-006, AR-012 | Classificador de input + output + schema |
| **De estado** (o *contexto* é o problema) | AR-005 (opt-out), AR-007 (janela), AR-008 (limite), AR-009 (mídia recebida), AR-010 (silêncio pós-handoff), AR-011 (base legal) | **Trava no gate de envio, lida do banco, sem LLM** |

O modo de falha clássico: AR-010 exige silêncio total após handoff. A equipe implementa isso no *handler do handoff* ("quando handoff dispara, seto `botAtivo = false`"). Depois alguém adiciona a cadência de follow-up, e o worker de follow-up tem seu próprio caminho de envio que **não consulta `botAtivo`** — o bot manda mensagem 1 dia depois do handoff. Nenhum teste unitário pega isso porque cada unidade está correta isoladamente. É exatamente o cenário R-066/AR-010.

**Por que acontece:**
Com 67 requisitos e 12 anti-requisitos em 13 módulos, a pergunta natural "onde eu verifico isso?" tem respostas diferentes por módulo. Sem uma resposta única e obrigatória, a verificação é replicada — e réplicas divergem.

**Como evitar:**
1. **Um único ponto de envio no sistema inteiro.** Função `podeEnviar(leadId, agora, tipoMensagem) → { permitido, motivo }`. **Nenhum outro caminho toca em `sendMessage`.** Isso é imposto por design: a interface de canal (R-016) expõe apenas o que passa por ela; nada no código de aplicação tem a chave de criptografia/sessão diretamente.
2. **A trava lê estado do banco, não memória de processo.** Regras avaliadas, em ordem:
   - `lead.opt_out == true` → bloqueio absoluto (AR-005). Sem exceção, sem exceção de implementação.
   - `lead.handoff_ativo == true` e sem devolução explícita do Admin → silêncio (AR-010).
   - `lead.pausado` (irritação / ameaça) → silêncio (R-066).
   - agora fora de dia útil 7h-17h no fuso configurado → bloqueado (AR-007), exceto follow-up vencido no momento da abertura (R-007, ver Pitfall 8).
   - contador diário ≥ limite → bloqueado (AR-008).
   - `lead.origem == null || lead.base_legal == null || lead.finalidade == null` → bloqueio absoluto (AR-011). **Isto é uma pré-condição de criação do registro, não uma checagem de envio.**
   - `lead.conversa_tem_midia_nao_processada == true` → bloqueado (AR-009).
3. **Teste de propriedade, não de exemplo.** Para cada anti-requisito, um teste que injeta o estado proibido e afirma que `podeEnviar` retorna `false` — **através de todos os caminhos de envio possíveis**, não só do caminho nominal. O teste que importa é: *"existe algum caminho que produza um envio sem passar por `podeEnviar`?"* Resposta tem que ser não, e a verificação é estática (grep por `sendMessage` fora do adapter) + dinâmica.
4. **A violação de trava é um evento de nível CRÍTICO**, não um warning: log imutável, notificação local imediata, e o lead vai para `pendente_revisao`.

**Sinais de alerta:**
- `grep` por chamadas de envio diretas retorna mais de um ponto no código.
- Mensagem enviada com `lead.handoff_ativo == true` no histórico — auditoria de 100% das mensagens, não amostragem.
- Taxa de violação de trava > 0 (deve ser **0**; qualquer valor > 0 já é incidente).

**Phase to address:** **Fase 1 — Fundação e Canal.** É a entrega estrutural mais importante do projeto. Se esta fase não produzir um gate único, todas as fases seguintes replicam o problema.

---

### Pitfall 5: Follow-up para lead silencioso consome o orçamento frio e é o que mais destrói o número

**O que dá errado:**
R-003 define follow-up de **mensagem curta** após tempo configurável sem resposta; R-004 define a cadência 1h → 1d → 3d → 7d. Do ponto de vista do WhatsApp, **cada um desses 4 envios para um lead que nunca respondeu é um cold reach-out** — o pior tipo de atividade para a reputação da conta. O bot faz 4 follow-ups para contatos que não demonstraram nenhum sinal, e cada um aproxima o reach-out timelock.

Note a assimetria: a R-061 (meta de 5 reuniões/mês) a R-062 (30% de qualificação) dependem de follow-up funcionando. Mas é **exatamente o follow-up** que queima o número se não for calibrado. O projeto precisa saber disso antes de escrever a cadência, não depois do primeiro ban.

**Por que acontece:**
A cadência foi desenhada do lado do *vendedor* (nós não responderíamos), não do lado do *sistema anti-spam* (nós *fomos* contatados sem interação). Nenhum dos dois modelos coincide. Além disso, um follow-up de 1h é curto demais para gerar resposta de um lead B2B e curto o suficiente para queimar orçamento.

**Como evitar:**
1. **Calibrar a cadência pelo dado, não pela intuição.** Antes de fixar 1h/1d/3d/7d, medir em 30 dias de piloto: qual o tempo mediano até a primeira resposta? Se a mediana for > 24h, o follow-up de 1h é apenas ruído.
2. **Regra de economia: se o lead não respondeu N mensagens, o sistema para de consumir orçamento frio e o Admin assume.** Definir esse `N` explicitamente (sugestão conservadora: 2 mensagens automatizadas sem resposta, depois handoff). Isso é a tradução operacional do AR-010.
3. **Follow-up longo em vez de curto nas primeiras tentativas.** Texto consultivo que reconecta o valor, não "só passando para saber se viu". Uma mensagem que apresenta valor novo é diferente, para o filtro, de uma repetição com outro wording.
4. **Nunca reenviar para o mesmo contato no mesmo dia** em tentativas diferentes (cooldown explícito).
5. **Registrar toda decisão de não-enviar com o motivo** (cooldown, limite, economia de orçamento, opt-out). Isso alimenta a auditoria LGPD e o painel de erros.

**Sinais de alerta:**
- Contatos novos/dia > limite definido em `fetchNewChatMessageCap()` mesmo com 20-30 mensagens/dia totais.
- Aumento do 463 sem aumento do volume total.
- Leads com 3+ mensagens automatizadas e 0 resposta em > 60% da base (indica cadência inútil **e** custosa).

**Phase to address:** **Fase 3 — Cadência e Operação.** Mas o **default conservador** (parar cedo) deve entrar na Fase 2 junto com o handoff, para que a primeira versão da cadência já seja segura.

---

### Pitfall 6: Humanização implementada como taxonomia de ripples

**O que dá errado:**
R-067 pede "delays aleatórios, simulação de digitando, quebra de mensagens longas". Feito ingenuamente, isso produz um bot **mais** robótica, não menos:

- **Resposta instantânea** é sinal de bot. Pesquisa mostra que atraso *dinâmico* (baseado na complexidade da mensagem) aumenta percepções de humanidade e presença social, enquanto atraso fixo e longo gera irritação em usuários experientes. Para o R-067, o certo é **atraso proporcional ao tamanho da mensagem recebida e à complexidade da resposta**, com distribuição gaussiana em torno de uma média configurável — não `random(2000, 4000)` constante.
- **Jitter insuficiente**. "Jitter gaussiano" é recomendação de comunidade; o problema real é **regularidade**. Bot tem **inter-message delay (IMD) consistente e determinístico** — é literalmente o que detectores de bot usam (KS test p=1.93e-19 para separar IMD de stream genuíno de stream com bot). A assinatura não é "sem randomness", é "randomness com distribuição errada". Distribuição por caractere (`50ms/char`) é o padrão da literatura e produz variância humanamente plausível.
- **Enviar a mensagem quebrada em partes instantaneamente.** Se o bot manda "Vi que sua empresa" e, 0.2s depois, "atua na área de logística" — isso é pior que mandar tudo junto, porque humans digitam e enviam uma mensagem. O split precisa ter **intervalo proporcional** entre as partes.
- **Indicador de digitação com duração fixa.** O WhatsApp mostra "digitando..." por ~5s e some. Se o bot segura o indicador por 2s fixos independente do tamanho da resposta, é fingerprint. A regra: o indicador deve refletir o tempo de digitação simulado, e se estourar o limite visual, a mensagem simplesmente vai sem indicador.
- **Contas sem histórico humano.** Um número dedicado que **só envia e nunca recebe** é um forte sinal de spam. A mitigação documentada é ter conversação orgânica no mesmo número — o que reforça R-059 (número exclusivo para vendas, sem uso pessoal) como uma tensão real a registrar.

**Por que acontece:**
O R-067 especifica *o quê* fazer ("delays aleatórios, simulação de digitando, quebra de mensagens longas") sem especificar *por que*, e leigos em humanização implementam a lista ao pé da letra. O erro conceitual é tratar aleatoriedade como sinônimo de humanidade: a literatura mede **variância e adequação ao contexto**, não "haver random". Some-se a isso a métrica de implementação errada — `random(2000, 4000)` é a leitura mais óbvia de "delay aleatório" e produz uma distribuição uniforme, que é precisamente a assinatura que os detectores de bot desigualam. Nenhum requisito do projeto hoje especifica a **distribuição** do delay, só a sua existência.

**Como evitar:**
1. **Delay dinâmico**: `delay = base + f(caracteres_da_mensagem_recebida) + f(caracteres_da_resposta)`, com **jitter gaussiano** (σ ≥ 25% da média) — nunca uniforme. Registrar em log o delay real para poder auditar a distribuição.
2. **Sequenciador global único.** Se duas conversas precisam responder no mesmo instante, os envios são **serializados com espaçamento mínimo** (evidência da comunidade: *"if you're responding to conversation A, wait until you finish to start sending a message to conversation B"*). Duas respostas simultâneas de um número é padrão de automação.
3. **Cooldown por par (número, destinatário)** com teto explícito de 1-2 mensagens por janela curta, conforme as práticas recomendadas.
4. **Nunca confiar em "random delay" como estratégia anti-ban.** A evidência é clara: *"I've tried random messages, and delays of 30-120 seconds per message also result in account restrictions."* Delays são para **imersão do lead**, não para evasão de detecção. A prevenção real é volume baixo, cadência baixa e taxa de resposta alta.

**Sinais de alerta:**
- Distribuição de delay com desvio-padrão baixo (verificar: se σ/μ < 0.15, a aleatoriedade é insuficiente).
- Duas ou mais mensagens enviadas no mesmo segundo para conversas diferentes.
- Lead responde com "você tá demorando" ou "olha, respondendo muito rápido" — ambos são feedback de imersão quebrada.
- Volume de mensagens quebradas/partes > 30% das mensagens (quebrar demais é tão fingerprint quanto não quebrar).

**Phase to address:** **Fase 2 — IA e Handoff** (motor de resposta) com o **sequenciador global e a trava de cooldown na Fase 1** (por ser gate de envio).

---

### Pitfall 7: LGPD tratada como "flag no banco" — falta o teste de balanceamento, falta canal de titular, falta o Encarregado

**O que dá errado:**
O R-064 e a skill `lgpd-optout` tratam o registro de origem/base legal/finalidade como requisito de **dado**. Isso é necessário e não suficiente. Três lacunas específicas, em ordem de probabilidade de se materializarem:

1. **Ausência de Encarregado (DPO) e de canal de comunicação com o titular.** Em **dezembro de 2024 a ANPD fiscalizou 20 empresas** especificamente por isso — "não indicaram o contato do Encarregado" e "canais que não são efetivos para atender titulares". A Resolução CD/ANPD nº 18/2024 reforçou formalidade e substituto. Um projeto solo que trata dados de terceiros e não tem canal é um alvo **barato e já exercido** pela ANPD. Isto está no escopo do projeto? Não está em nenhum requisito.
2. **Ausência do teste de balanceamento documentado.** O Guia Orientativo da ANPD sobre legítimo interesse exige um teste de três fases: **finalidade, necessidade, balanceamento e salvaguardas**, documentado, para *cada finalidade específica*. O projeto registra "legítimo interesse" como um valor de enum, sem o teste. A skill menciona "registra avaliação de legítimo interesse" mas nenhum requisito cria o artefato.
3. **Ausência de caminho de exclusão real (direito do titular).** R-024 fala em "comando manual de opt-out e exclusão". O titular tem direito a **acesso, correção e eliminação** — e o prazo é o mesmo: um canal funcional. Um "comando manual" que depende de o Admin abrir o painel e procurar não é canal.

**Por que acontece:**
O projeto sai de uma perspectiva de vendas ("registre a base legal para se defender") e não de conformidade ("tenha um processo que atenda o titular"). E a ANPD **mudou de patamar em 2026**: deixou de ser Autarquia e passou a ser **Agência Reguladora** (MP nº 1.317/2025 → Lei nº 15.352/2026); encaminhou 21 empresas à área sancionadora só no 1º semestre de 2026; multou a ByteDance em **R$ 153,7 milhões** (agosto/2026) somando cinco multas e uma ordem de eliminação de dados; e o **Mapa de Temas Prioritários 2026-2027 inclui "Inteligência Artificial e tecnologias emergentes"** como frente prioritária. A postura deixou de ser teórica.

**Como evitar:**
1. **Nomear um Encarregado** (pode ser o próprio Admin, com substituto designado) e **publicar um canal de contato** que **funcione de verdade** — email ou formulário respondido, não um link morto. Custo: zero. Exposição se omitido: alto e **já fiscalizado**.
2. **Escrever o teste de balanceamento** como documento versionado, com as três fases da ANPD: finalidade (por que contatar), necessidade (por que WhatsApp e não outro canal, por que estes dados), balanceamento (interesse do controlador × expectativa e direitos do titular), salvaguardas (opt-out imediato, janela de horário, limite de volume, registro de oposição). **Uma página.** É o artefato que a ANPD pede e que o projeto não tem.
3. **Opt-out que funciona em < 5 minutos e em qualquer canal.** Detecção automática (R-024) + comando manual + resposta a pedido por telefone/email/etc. Registrar **data, hora, canal e evidência** de cada oposição — os registros são a evidência de conformidade.
4. **Política de retenção com prazo definido e eliminação real**, incluindo eliminação em **backup** (ou, no mínimo, expiração do backup). Dados em `.dump` de uma semana atrás continuam sendo dados pessoais.
5. **Aproveitar a taxa de cooperação.** A ANPD é explícita: *"até o momento, todos os processos sancionadores conduzidos pela ANPD, sem exceção, foram instaurados em decorrência de postura não colaborativa do regulado."* Ainda mais: respondendo a um requerimento com documentação clara é a alavanca de menor custo e maior retorno em todo o projeto.

**Como evitar também o outro lado (Meta):**
A Meta **reage pelo comportamento do número, antes de qualquer procedimento da ANPD** — ela monitora volume de bloqueios, denúncias e marcação como spam. Estar limpo na LGPD não substitui estar limpo na Meta, e vice-versa. Os dois riscos são independentes e punem por motivos diferentes.

**Sinais de alerta:**
- Lead exercise opt-out e o registro não tem `data_hora` + `evidencia`.
- Qualquer lead com `base_legal` preenchida mas sem `finalidade` específica preenchida.
- Contato de titular por email/telefone e não existe resposta em 48h.
- `backup` com dados de leads que pediram exclusão e não houve expiração.

**Phase to address:** **Fase 3 — Cadência e Operação** (registros e opt-out) — **mas o Encarregado + canal + teste de balanceamento devem ser produzidos na Fase 1**, porque são documentos, não código, e não podem ficar para o fim. Custo marginal zero, exposição se omitidos alta.

---

### Pitfall 8: R-007 — fila estoura em rajada quando o app abre (e o Agendamento de follow-up conflita com a janela)

**O que dá errado:**
O R-007 é explícito: *"Follow-up vencido fora da janela é enviado assim que o app abrir"*. O risco de projeto está no plural: **vencidos**. O padrão de design errado (catch-up) é o seguinte: a fila consulta "o que está vencido agora", e tudo que está vencido é enfileirado e disparado. Se o PC ficou ligado em casa durante o fim de semana, há follow-ups de 1d, 3d e 7d vencidos para o mesmo lead, além dos vencidos de outros leads. O app abre às 8h da segunda-feira e dispara **20-30 mensagens em 90 segundos**, todas para contatos frios, com jitter talvez, mas todas de uma vez.

O agravante: esse burst consome **todo o orçamento frio do dia em minutos**, gera rajada de 429/463, e produz a assinatura de automação mais óbvia possível. Some-se a isso o **atrito conceitual** do R-007 com o R-006/AR-007: a exceção "dispara quando o app abre" é uma exceção à janela — precisa ser explicitamente limitada, senão vira o caminho padrão.

**Por que acontece:**
Duas decisões de projeto interagem:
- O **Agendador de trigger** (1h/1d/3d/7d) grava "disparar às 14:00 de sexta". Se o app está fechado, **vence**.
- O requisito de "disparar assim que abrir" é uma **política de misfire `FIRE_ONCE`** implícita. Mas implementada como **"processar tudo que está vencido"**, é uma política de misfire `CATCH_UP` — que a literatura de schedulers classifica explicitamente como **o anti-padrão de recovery**: *"recovery becomes a self-inflicted thundering herd / DoS"*.

**Como evitar:**
1. **Limite de rajada no startup, não só na média diária.** Regras concretas:
   - **Máximo de N mensagens nos primeiros 10 minutos após abrir** (sugestão: 3).
   - **Máximo de 1 follow-up por lead no dia de drenagem** — os demais vencidos daquele lead são **adiados para a próxima janela** (não descartados, não disparados).
   - **Jitter obrigatório no dreno de startup**: mesmo os 3 primeiros envios entram na mesma distribuição aleatória da operação normal.
2. **Políticas de misfire explícitas e por tipo de job** (padrão de mercado, não invenção):
   - `SKIP` — para jobs de limpeza/reconciliação (não faz sentido recuperar).
   - `FIRE_ONCE` com limite de rajada — para follow-up (recomendado; é o default seguro para "não sei o que esse job faz").
   - `CATCH_UP` — **proibido** neste sistema.
3. **Colisão entre cadência e janela.** O follow-up de 1h agendado às 16:30 vence às 17:30, que está **fora da janela** (AR-007). Definição: se o instante de vencimento cai fora da janela, **reagendar para a próxima abertura de janela** (próximo dia útil às 7h, com jitter), não enviar na abertura. Isso evita que a exceção do R-007 vire o mecanismo principal.
4. **Fila durável em banco, com lease e idempotência** (ver Pitfall 11 e tabela de integração). A fila vive no PostgreSQL; nada disso fica em memória do processo.
5. **Reconciliador.** Varredura periódica que detecta linhas `pending` cujo dispatch nunca foi processado (dispatch perdido) e as re-dispatcha com limite. Sem ele, "eventualmente consistente" quer dizer "às vezes consistente, e silenciosamente quando não é".

**Como evitar o outro erro clássico — duplicata:**
Se o worker termina o envio e cai antes de marcar `done`, a lease expira e o job roda de novo. O lead recebe **o mesmo follow-up duas vezes**. A regra da literatura: **entrega é at-least-once, então handlers devem ser idempotentes**. Chave de idempotência `(lead_id, follow_up_index)` com verificação antes do envio.

**Sinais de alerta:**
- Mais de 3 mensagens nos primeiros 10 minutos após o app abrir.
- Mais de 1 mensagem para o mesmo `lead_id` no mesmo dia de drenagem.
- `drained_at_startup` > limite → alerta.
- Resposta do lead a um follow-up com texto que **ele já recebeu** ("isso aí é a terceira vez que você fala isso").

**Phase to address:** **Fase 3 — Cadência e Operação.** Mas a fila durável e a trava de cooldown/janela são da **Fase 1** (é gate de envio). O limite de rajada de startup é uma linha de configuração, mas precisa existir antes do primeiro uso real.

---

### Pitfall 9: Backup manual que nunca é testado, e auth state do WhatsApp fora dele

**O que dá errado:**
R-032 especifica "backup manual versionado por data/hora, com restauração sem serviços externos". Três problemas concretos, todos específicos de Windows + PostgreSQL local:

1. **Backup que nunca é restaurado não é backup.** `pg_dump` bem-sucedido é esperado; restauração bem-sucedida é o que importa. A documentação do PostgreSQL é explícita sobre as armadilhas: restaurar dump SQL exige que **todos os usuários/owners já existam** (senão falha em recriar ownership/permissões); o `psql` **continua executando após erro por padrão** (resultado: restauração **parcial** e silenciosa); e restaurar tudo em transação única (`-1/--single-transaction`) é a única forma de ter "tudo ou nada".
2. **`pg_dump` de uma versão diferente da do servidor não funciona.** `pg_dump` é version-specific. Um `.dump` de um PG 17 restaurado num PG 18 falha. Se o PC for atualizado, o backup antigo pode ser irrecuperável.
3. **A auth state do WhatsApp não é um backup de PostgreSQL.** O `auth state` do Baileys (creds + chaves Signal) é o que **provavelmente** não está no backup do banco. Perder esse arquivo = re-parear o número = novo perfil de reputação, novo warm-up, novo tctoken/nctSalt. Ironicamente, o backup do banco é o menos crítico dos dois (reconstrói-se a lista de leads do caça-leads), e o auth state é o que não se reconstrói.

**Por que acontece:**
O R-032 é escrito como "script de backup", não como "processo de recuperação com teste". E a Postgres local cria uma ilusão de que o dado está seguro porque "está num banco de verdade".

**Como evitar:**
1. **Teste de restauração mensal, obrigatório, com registro da data.** Restaurar para um banco vazio (`createdb -T template0`), com `psql -X -1` (single-transaction), e **contar as linhas de `leads`, `messages` e `opt_outs`** antes e depois. Sem contagem, o teste não prova nada.
2. **Incluir o auth state no mesmo pacote de backup**, com timestamp e pasta própria. Restaurar auth state + banco divergente é pior que não restaurar — então empacotar os dois juntos.
3. **Formato custom (`-F c`)**, que é comprimido e suporta `pg_restore` paralelo (`-j`). Evitar formato plain para dados grandes.
4. **Gravar a versão do PostgreSQL no nome do arquivo** (`dump-2026-09-28-pg17.backup`) e **verificar a versão no restore**. Sem isso, um upgrade do PG torna o histórico de backup inútil silenciosamente.
5. **Path de destino fora de diretórios protegidos.** O erro clássico no Windows é `could not open output file "C:\Program Files\backups\mydb.sql": Permission denied` — é problema de filesystem, não do Postgres. Usar `C:\pg_backups` com permissão explícita, e nunca `C:\Program Files\*`.
6. **A conta de serviço do PostgreSQL (`NT AUTHORITY\NetworkService`) precisa de permissão de escrita no diretório de destino** — esse é o erro de backup agendado mais frequente no Windows.
7. **⚠️ O diretório de trabalho do projeto está dentro do OneDrive** (`C:\Users\11\OneDrive\Documentos\...`). Se o `auth state` do Baileys e/ou os `.dump` ficarem dentro dessa árvore, **o OneDrive sincroniza o estado de autenticação do WhatsApp e a LGPD pessoal sem criptografia** — o que contradiz diretamente o R-033 ("sem criptografia adicional; confiança no controle de acesso do PC"). Um arquivo no OneDrive **não** está sob o controle de acesso do PC. Além disso, OneDrive Files On-Demand pode devolver arquivo "online-only" no meio de uma operação de criptografia, corrompendo a sessão. **Diretório de estado e de backup fora do OneDrive, obrigatoriamente.**

**Sinais de alerta:**
- Existe mais de um `.dump` no diretório e nenhum foi restaurado nunca.
- `pg_dump` com erro silencioso no log (sem `ON_ERROR_STOP`, sem contagem de linhas no output).
- Diretório de auth state ou de backup dentro de uma pasta com ícone de nuvem.
- Versão do PG no dump ≠ versão do servidor atual.

**Phase to address:** **Fase 1 — Fundação e Canal.**

---

### Pitfall 10: "npm i baileys" instala release candidate, e cada bump de versão correlaciona com banimento

**O que dá errado:**
Estado atual verificado (2026-09-28): `npm view baileys` → **`7.0.0-rc14`**, dist-tag `legacy` → `6.7.24`. **Não existe release estável do v7.** O histórico mostra rc7-rc9 em novembro/2025, depois um gap de **5+ meses**, depois rc10-rc14 entre maio e julho de 2026. O maintainer descreveu rc10 como *"THE FINAL RELEASE CANDIDATE"* há 5 meses.

Dois riscos concretos:
1. **Fixar `^6.7.x` ou `6.7.24` = sem tctoken = erro 463 garantido em cold outreach** (Pitfall 1). **Verificado diretamente na árvore do repositório, não inferido:** a tag `v6.7.24` (165 arquivos) **não contém nenhum arquivo** de tctoken/reach-out; a tag `v7.0.0-rc14` contém `src/Utils/tc-token-utils.ts` e `src/__tests__/Utils/tc-token.test.ts`. As release notes do rc10 listam explicitamente *"Full TC Token issuance, revocation, expiration, pruning lifecycle"*, *"Reachout Timelock (Your account is restricted - the 463 error) and New Chat limits functions"* e *"463 handlers and safety-paths"*. `messages-send.ts` na v6.7.24 tem **zero** menções a `fetchAccountReachoutTimelock` / `fetchNewChatMessageCap`. A linha `legacy` é anterior a tudo isso.
2. **Perseguir `latest` é perigoso.** O padrão nas issues do repositório é exatamente "banimento logo após atualização de versão": *"trying to update or change baileys version to 6.7.12, I am safe using this version... after updated 6.7.12, now stable"*; *"I updated from 6 to 7 and yesterday I got banned! I didn't do anything change to my backend"*; *"I updated to the latest but the issue is the same."* Também há relato de que `7.0.0-rc13` corrige uma regressão de parsing de `<message>` — ou seja, RCs consecutivos **mudam o comportamento de protocolo**.
3. **Segurança não é opcional.** `v7.0.0-rc12` (2026-05-20) corrigiu a falha de segurança **GHSA-qvv5-jq5g-4cgg**. Ficar numa versão antiga "mais estável" é escolher vulnerabilidade.

> ⚠️ **Contradição com outra pesquisa deste projeto:** `STACK.md` recomenda fixar `@whiskeysockets/baileys@6.7.24` (`--save-exact`) com base no raciocínio "nunca instale um RC". **Essa recomendação está errada para este projeto** e precisa ser reconciliada antes do roadmap: a versão que ela indica é exatamente a que não tem tctoken, sem handler de 463 e sem as APIs de leitura de quota. O argumento "evite RC" é válido em geral e continua válido — mas a escolha entre RC e legado aqui **não é uma questão de estabilidade**, é uma questão de funcionalidade: sem tctoken o cold outreach do MVP não funciona. Fixar exato continua correto; **a versão a fixar é `7.0.0-rc14` (ou mais recente), não `6.7.24`**.

**Por que acontece:**
`npm install baileys` sem versão usa `latest`, que hoje é um RC. A reação natural — "RC em produção é risco, então vou para a linha estável" — **parece** conservadora e é exatamente o erro: `legacy` é a linha *pré-tctoken*, não uma linha estável equivalente. A comparação "RC vs estável" oculta que a linha estável é funcionalmente insuficiente para o requisito central do projeto (R-003/R-004: primeira mensagem e follow-up para contatos frios). Não há versão "certa" por default — há uma **decisão consciente** entre RC recente (com tctoken, handlers de 463 e correções de segurança) e legado (sem nenhum dos três).

**Como evitar:**
1. **Fixar `7.0.0-rc14` em versão exata** no `package.json` (sem `^`, sem `~`, sem `latest`) e **commit do `package-lock.json`**. Documentar o número da versão e a data no README de operação. Fixar exato é obrigatório; a versão a fixar **tem** de ser ≥ `7.0.0-rc10`.
2. **Aceitar o RC conscientemente e por escrito**, e ter um **plano de rollback** testado (voltar para a versão fixada anterior, não "instalar latest"). O rollback também tem um piso: nenhuma versão abaixo do rc10 serve, então o rollback vai para o rc anterior **dentro da linha 7**, não para o `legacy`.
3. **Não atualizar a library em produção sem janela de teste.** Subir versão nova primeiro num **número descartável** (o projeto tem um só número, R-059 — então: testar em outro número/SIM, ou no mínimo em janela de baixo volume com limite reduzido).
4. **Monitorar os changelogs e issues de ban** do Baileys mensalmente como tarefa operacional.
5. **Nunca desabilitar history sync** (ref. Pitfall 1) — é a causa raiz de "463 em todos os contatos novos".

**Sinais de alerta:**
- `package.json` com `^`, `~` ou `latest` em dependência do Baileys.
- `npm outdated` aparecendo no log — sinal de que nada está fixado.
- `version` resolvida do Baileys diferente da documentada no README.

**Phase to address:** **Fase 1 — Fundação e Canal.**

---

## Technical Debt Patterns

Atalhos que parecem razoáveis e criam problema de longo prazo. A coluna “When Acceptable” separa o que é NEVER de “aceitável só no MVP”.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Confiar no system prompt para os anti-requisitos | Zero código extra; parece funcionar nos primeiros 5 leads | Vazamento de prompt em produção; 12 anti-requisitos viram "boas intenções"; reescrita do pipeline de IA | **Nunca** |
| Delay fixo (`random(2s, 4s)`) em vez de delay dinâmico | 5 linhas de código | Imersão quebrada; lead percebe que é robô; nenhum ganho anti-ban | **Nunca** |
| `onWhatsApp()` fora de escopo "porque o caça-leads valida" | Economiza uma chamada de rede | Restrição de **conta** por número ruim; R-019 precisa ser revertido | **Nunca** |
| Fixar Baileys `^6.7.x` para "evitar instabilidade de RC" | Sensação de estabilidade | Sem tctoken → erro 463 garantido em todo cold outreach | **Nunca** |
| Backup por script, sem teste de restauração | Entregável de R-032 marcado como concluído | Descoberta de que o backup não restaura, no dia do incidente | **Nunca** |
| Fila em memória do processo | Simples, sem schema | Perde follow-up a cada restart; sem reconciliação; sem idempotência | **Nunca** |
| `pg_dump` scheduled, sem `ON_ERROR_STOP` | Script "verde" | Dump parcial que parece válido | **Nunca** |
| Retentar 463 com backoff | "Boas práticas de resiliência" | Retry **não** faz parte do WhatsApp Web; piora a restrição | **Nunca** |
| Silêncio total pós-handoff implementado no handler do handoff | Parece correto no teste unitário | Follow-up worker ignora a flag; AR-010 violado em silêncio | **Nunca** |
| Sem Encarregado / sem canal de titular "porque é projeto solo" | Zero esforço | Exposição **já fiscalizada** pela ANPD (20 empresas em dez/2024) | **Nunca** |
| Delay grande e constante (30-120s) como "anti-ban" | Parece humano | Irrita o lead, não protege o número; evidência de comunidade o refuta explicitamente | **Nunca** |
| Retry sem jitter no LLM | Marginalmente mais simples | Retry storm quando a API de LLM cai; custo duplicado; burst visível | Só com volume alto — irrelevante aqui (20-30 msg/dia) |
| Múltiplas `if` de verificação em módulos diferentes | Cada módulo é "responsável pelo seu" | Divergem; AR-005..AR-011 violados sem ninguém perceber | **Nunca** |
| Auto-dedupe de leads "para facilitar" | Menos lista para revisar | Sobreposição de prospecção (risco R-050, classificado ALTO) | **Nunca** (R-020 é decisão manual por motivo) |

---

## Integration Gotchas

Erros comuns ao conectar o sistema a serviços externos (Baileys, PostgreSQL local, API de LLM, API do caça-leads, notificações do Windows).

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| **Baileys / WhatsApp Web** | Enviar direto sem `onWhatsApp()` | Validar existência antes de qualquer envio cold; `NUMERO_INVALIDO` é estado terminal |
| **Baileys / WhatsApp Web** | Usar `^6.7.x` | Fixar `7.0.0-rc14`+ exato; tctoken só existe a partir do rc10 |
| **Baileys / WhatsApp Web** | Desabilitar history sync para "economizar banda" | Nunca — o `nctSalt` (base do `cstoken`) é capturado no app-state sync gateado por history sync |
| **Baileys / WhatsApp Web** | Reconectar chamando `connect()` sem derrubar o socket moribundo | Dois sockets vivos na mesma sessão = `Stream Errored (conflict)` → escalona de disconnect para ban/restrição. Usar guard monotônico de "attempt" + teardown antes de reconectar + backoff exponencial com teto |
| **Baileys / WhatsApp Web** | Retentar erro 463 com backoff | Não retentar. 463 = parada; disparar handoff e suspender cold outreach até `time_enforcement_ends` |
| **Baileys / WhatsApp Web** | Ignorar `reachoutTimeLock` / `newChatMessageCap` | Ler `fetchAccountReachoutTimelock()` e `fetchNewChatMessageCap()` no startup e periodicamente; travar cold outreach a 70% de `used_quota` |
| **Baileys / WhatsApp Web** | Assumir que `creds.json` está no backup do banco | Empacotar auth state **junto** com o dump do Postgres, com a mesma timestamp |
| **PostgreSQL local (Windows)** | `pg_dump` com versão diferente da do servidor | Gravar a versão no nome do arquivo e verificá-la no restore |
| **PostgreSQL local (Windows)** | `psql` sem `ON_ERROR_STOP` | `psql -X -1` (single-transaction): restauração é tudo-ou-nada, nunca parcial silenciosa |
| **PostgreSQL local (Windows)** | Backup em `C:\Program Files\*` | `Permission denied` é problema de filesystem. Usar `C:\pg_backups` e dar permissão de escrita à conta de serviço (`NT AUTHORITY\NetworkService`) |
| **PostgreSQL local (Windows)** | Estado/backup dentro do OneDrive | Sincroniza auth state + dados LGPD sem criptografia, contradiz R-033; Files On-Demand pode corromper sessão |
| **LLM API** | Enviar o histórico inteiro da conversa, sem filtro | Minimização de dados (R-009): enviar só o necessário. Lead phone/nome são dados pessoais enviados cross-border para o provider — isso é **transferência internacional** pela LGPD |
| **LLM API** | Sem fallback quando a API cai | Regra: indisponibilidade da LLM → **silêncio**, nunca mensagem genérica. Um "desculpe, estou com dificuldade" do bot em 20 Leads é padrão de automação |
| **LLM API** | Confiar no nome do provedor (OpenAI/Gemini/Claude) como decisão de arquitetura | Nenhum deles garante as invariantes do projeto. A garantia tem que ser estrutural (schema + camada de decisão) |
| **API do caça-leads** | Confiar que o telefone vem válido | Validar antes de enviar (Pitfall 2); origem registrada é pré-condição de criação do lead (AR-011) |
| **Notificações nativas do Windows** | Assumir que toast/som sempre disparam | Testar com o app em foco, minimizado, e com o Windows em foco de bloqueio; validar som em sessão RDP (sinal de sessão diferente) |
| **WhatsApp Web simultâneo** | Admin com WhatsApp Web aberto no mesmo número | Dois dispositivos legados + socket Baileys = conflito de sessão e ruído de comportamento. Definir explicitamente: o Admin **não** abre o WhatsApp Web no número dedicado |

---

## Performance Traps

Padrões que funcionam na escala deste projeto (20-30 mensagens/dia) e o ponto exato em que quebram. Sem over-engineering para escala hipotética.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| **Cold-reachout budget esgotado** | erro 463, mensagens não entregues, `used_quota` no teto | Trava de orçamento de contatos novos (Pitfall 1) | **Já no MVP** — 20-30 mensagens/dia com 4 follow-ups por lead consome rápido |
| **Rajada de startup pós-downtime** | 20-30 mensagens em 90s, burst de 429/463 | Limite de rajada + 1 follow-up/lead/dia + jitter no dreno | **Já no MVP** — qualquer fim de semana de PC desligado |
| **Custo/latência de LLM em rajada** | Fatura de API sobe, latência de resposta sobe | Limite de taxa de geração + cache de classificação + serialização | 20-30 msg/dia: irrelevante para custo, relevante para **latência percebida** |
| **Serialização de envios** | Lead espera 3 min porque outra conversa ocupa a fila | Sequenciador global com espaçamento mínimo; o delay por conversa soma | > 3 conversas simultâneas |
| **Postgres local sem índice de claim** | Fila lenta, `pending` cresce | Índice em `(status, run_at)`; claim com `FOR UPDATE SKIP LOCKED` | ~500 jobs pendentes (muito além do MVP — mas o índice custa nada) |
| **History sync gigante em sessão nova** | Memória sobe, pairing lento, risco de crash | Manter history sync **ligado** (Pitfall 1) e aceitar o custo; Baileys rc10+ melhorou o batching offline | Sessão nova / re-pareamento |
| **Log verboso de payload de mensagem** | Arquivo de log cresce GB/dia; I/O no disco trava o envio | Log estruturado, nível configurável, rotação; **nunca** logar o auth state | > 1 semana sem rotação |
| **Vazamento de memória do socket** | Processo cresce ao longo de dias | rc10+ tem correções de mem leak; monitorar RSS; reinício programado de manutenção | > 3-5 dias de operação contínua |

---

## Security Mistakes

Riscos de segurança específicos do domínio, além de segurança web genérica: estado de sessão do WhatsApp, dados pessoais em log e em nuvem, e transferência internacional de dados para o provedor de LLM.

| Mistake | Risk | Prevention |
|---------|------|------------|
| **Auth state dentro do OneDrive** (diretório de trabalho atual) | Sincronização do estado de autenticação do WhatsApp para a nuvem **sem criptografia**; contradiz R-033; Files On-Demand corrompe sessão | Mover estado e backup para `C:\...` fora de pasta sincronizada |
| **Auth state em texto plano, sem proteção** | Qualquer pessoa/processo com acesso ao PC lê as chaves Signal e assume a sessão do WhatsApp | R-033 aceita, mas com ACL de arquivo restrita ao usuário do Admin; nunca em diretório de projeto versionado no git |
| **`.dump` de LGPD em diretório versionado no git** | Dados pessoais de leads vão para o repositório; se o repo for compartilhado, é incidente | `.gitignore` explícito para dumps e auth state; backup fora da árvore do repo |
| **Chave da API de LLM em `.env` no repo** | Vazamento de chave | `.env` no `.gitignore`; `.env.example` com placeholders |
| **Minimização insuficiente antes do LLM** (R-009) | Nome + telefone + histórico completo de terceiro enviados a provider fora do Brasil = transferência internacional de dados pessoais | Enviar só o contexto estritamente necessário; registrar a base legal da transferência; considerar provider com residência no Brasil |
| **Log de conteúdo de mensagem com PII** | Log local vira um segundo banco de dados pessoal sem controle de retenção | Política de retenção de log alinhada à de dados; redaction de telefone em log de debug |
| **Encarregado (DPO) não designado** | Exposição **já fiscalizada** pela ANPD (20 empresas, dez/2024); Resolução CD/ANPD nº 18/2024 | Designar (pode ser o Admin) + substituto + publicar canal |
| **Credencial do Postgres em texto plano no script de backup** | Risco local baixo (single-user), mas viola a própria premissa de R-033 | `pgpass.conf` com permissão restrita; nunca `PGPASSWORD` em script versionado |
| **Escopo de guardrail só no output** | Um LLM de classificação é contornável via reformulação | Input guard + decisão em código + output guard (três camadas) |
| **Fail-open no guardrail** | Se o classificador cai, a mensagem passa | Para este projeto: **fail-closed**. Não enviar é reversível; enviar é irreversível |
| **Encarregado substituto não designado** | Canal vago durante a ausência do titular | Designar substituto no mesmo documento |

---

## UX Pitfalls

Erros de experiência do ponto de vista de quem usa o sistema: o lead em conversa e o Admin no painel.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| **Lead recebe follow-up duplicado** (retry sem idempotência) | "Você já mandou isso" — Bourd mais irritação; conta como 2 mensagens no orçamento frio | Chave de idempotência `(lead_id, follow_up_index)`; verificar antes de enviar |
| **Lead recebe 3 follow-ups em 3 segundos** (burst de startup) | Percebido como spam institucional; destino imediato do botão de bloqueio | Limite de rajada no startup + 1 follow-up/lead/dia |
| **Bot responde instantaneamente** | Quebra a imersão imediatamente; "você tá sempre online" | Delay dinâmico proporcional ao tamanho, com jitter gaussiano |
| **Bot quebra mensagem em 3 partes em 0.2s** | Pior que mensagem única | Intervalo entre partes proporcional |
| **Indicador de "digitando..." com duração fixa** | Fingerprint; o indicador real do WhatsApp dura ~5s | Refletir o tempo de digitação simulado; sem indicador se estourar |
| **Notificação de handoff chega sem contexto** | Admin não sabe o que fazer; 3 leads com handoff ao mesmo tempo = todos ignorados | Notificação com lead, motivo, **prévia da última mensagem** e ação de 1 clique (R-013) |
| **Som de handoff toca às 22h** | Admin passa a ignorar o som | Silenciar sons fora do horário, **exceto** se houver sinal de urgência; manter notificação visual persistente |
| **Handoff com fila silenciosamente descartada** | Lead esperando e o bot não volta; Admin não sabe | Fila de handoff visível no painel com contagem e tempo de espera |
| **Painel mostra "bot ativo" sem mostrar os limites** | Admin não sabe se já atingiu 20/30; não sabe por que o bot parou de responder | Mostrar contador diário, janela, e **o motivo atual do silêncio** por lead |
| **Opt-out detectado mas sem confirmação visual** | Admin não sabe se o registro foi efetivado | Confirmação explícita + timestamp + evidência no painel |
| **"Looks like it worked"**: bot seguiu sem handoff, o lead mandou áudio 3 vezes, nada aconteceu | Lead se sente ignorado; risco de denúncia | Notificação de mídia recebida **imediata e distinta** (som diferente do handoff comercial) |
| **Admin toma a conversa e o bot continua no console** | AR-010 violado; conversa do Lead fica com duas vozes | Indicador visual grande e inequívoco no painel, com estado em cor: **"BOT ATIVO"** (laranja) vs **"MÃO HUMANA ATIVA — BOT EM SILÊNCIO"** (verde) |

---

## "Looks Done But Isn't" Checklist

Itens que parecem concluídos mas estarão incompletos. Usar como verificação durante a implementação, antes de declarar qualquer fase pronta.

- [ ] **Camada de conexão isolada (R-016):** erro clássico é não perguntar "os dois canais compartilham a mesma sessão?" — o **estado de autenticação não pode estar amarrado ao adapter**: trocar Baileys pela API oficial não deve exigir re-parear.
- [ ] **Anti-requisitos (AR-001..AR-012):** erro clássico é não perguntar "existe um caminho de envio que não passa pelo gate?" — `grep` por chamadas diretas de envio fora do adapter deve retornar **zero**.
- [ ] **Trava de limite diário (R-023):** erro clássico é não perguntar "o limite é contado no banco ou em memória?" — em memória, reiniciar o app zera o contador e **viola AR-008**.
- [ ] **Janela 7h-17h (R-006):** erro clássico é não perguntar "o fuso está configurado e testado com mudança de horário do Windows?" — e "o follow-up que vence às 16:59 é adiado, não enviado às 17:00?"
- [ ] **R-007 (dreno de startup):** erro clássico é não perguntar "há limite de rajada?" — sem ele, 20-30 mensagens em 90 segundos.
- [ ] **Reach-out budget (NOVO):** erro clássico é não perguntar "o `fetchNewChatMessageCap()` é lido e a trava existe?" — R-023 sozinho **não** protege o número.
- [ ] **Erro 463:** erro clássico é não perguntar "o handler de 463 faz retry?" — se faz, está errado: deve travar e notificar.
- [ ] **tctoken / history sync:** erro clássico é não perguntar "o history sync está ligado?" — desligado = cold outreach quebrado silenciosamente.
- [ ] **Versão do Baileys:** erro clássico é não perguntar "está fixada em versão exata?" — `^`, `~` e `latest` são falha.
- [ ] **Reconnect:** erro clássico é não perguntar "o handler de close derruba o socket antes de reconectar?" — dois sockets = `conflict` = escalonamento para ban.
- [ ] **Guardrail de preço (NOVO):** erro clássico é não perguntar "a decisão de handoff é tomada em código, não pelo LLM?" — se o LLM decide, AR-001 não é garantia.
- [ ] **Validador de output (NOVO):** erro clássico é não perguntar "toda mensagem enviada passou pelo validador?" — verificar por **100%** do histórico, não por amostragem.
- [ ] **Fail-closed:** erro clássico é não perguntar "se o classificador de guardrail falhar, o sistema envia ou cala?" — calar.
- [ ] **Opt-out:** erro clássico é não perguntar "o titular tem canal que **não** exige abrir o sistema?" — e "a exclusão alcança o backup, ou só o banco vivo?".
- [ ] **Encarregado + canal (NOVO):** erro clássico é não perguntar "existe documento com nome, substituto e contato público?" — não está em nenhum requisito hoje.
- [ ] **Teste de balanceamento LGPD (NOVO):** erro clássico é não perguntar "existe o documento de três fases da ANPD versionado?" — registrar "legítimo interesse" como enum não é o mesmo.
- [ ] **Backup:** erro clássico é não perguntar "alguém **restaurou** um backup com sucesso nos últimos 30 dias, e contou linhas?" — e "o auth state está no pacote?".
- [ ] **Paths:** erro clássico é não perguntar "estado e backup estão fora do OneDrive e fora do git?" — o diretório de trabalho **atual está dentro do OneDrive**.
- [ ] **Fila durável:** erro clássico é não perguntar "existe lease, existe idempotência, existe reconciliador?" — sem os três, restart = perda e duplicata.
- [ ] **Notificações:** erro clássico é assumir "o pop-up e o som funcionam com o app minimizado e com o Windows bloqueado?" — testar, não assumir.
- [ ] **Duplo envio do Admin:** erro clássico é não perguntar "o Admin abriu o WhatsApp Web no número dedicado?" — conflito de sessão.

---

## Recovery Strategies

O que fazer quando o pitfall acontece apesar da prevenção. “Recovery Cost” é LOW/MEDIUM/HIGH em termos de tempo e de número.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|-----------------|
| **Erro 463 / reach-out timelock** | LOW | Suspender cold outreach imediatamente; ler `time_enforcement_ends`; aguardar expiração; **não** retentar. Handoff dos leads afetados. Se não houver data de expiração, parar por 48-72h |
| **Shadow ban (mensagens em PENDING)** | LOW | Parar todo envio automatizado por 2-3 dias (evidência de que o shadow ban se dissipa com pausa); monitorar se o envio volta; se não, tratar como restrição e pedir review |
| **Ban temporário (24-72h)** | MEDIUM | Parar; o timer expira sozinho; **não** reconectar e reenviar imediatamente. Aproveitar a janela para revisar volume e cadência |
| **Ban permanente** | HIGH | 1) "Request a review" **dentro do app, dentro de 30 dias** (janela de recurso se fecha). 2) Email para o suporte do WhatsApp Business (`smb_web@support.whatsapp.com` — reportado; `support@whatsapp.com` também citado) em horário comercial dos EUA, Gmail, texto curto e honesto. 3) **Não** registrar o número de novo esperando reverter o ban. Se o appeal falhar → número novo. **Preparar o material de appeal ANTES de precisar** (print do registro de origem, opt-outs, template da 1ª mensagem, frequência) |
| **Número novo após ban** | HIGH | Reputação zerada: precisa de warm-up. Começar em volume mínimo (o projeto já está em 20-30/dia, que é conservador). Novo tctoken/nctSalt, novo histórico. **Perde-se o histórico de conversas no celular, exceto se houver backup** |
| **Sessão WhatsApp corrompida** | MEDIUM | Restaurar auth state do pacote de backup (Pitfall 9). Se não houver → re-parear, o que significa warm-up do zero |
| **Prompt atravessou fronteira de preço** (promessa feita) | MEDIUM | 1) Identificar exatamente o que foi prometido (o log de saída é a evidência). 2) Handoff imediato — o bot já cala. 3) O Admin corrige pro lead antes de qualquer proposta. 4) **Auditar a camada de decisão** — quase sempre é decisão no LLM, não no código. 5) Registrar como incidente de anti-requisito |
| **Lead reclamou / ameaçou denunciar** | MEDIUM | Silêncio total imediato (R-066/AR-010); notificar; esperar decisão do Admin; registrar a reclamação (é o dado mais importante para LGPD) |
| **Fila disparou em rajada e houve envio em massa** | MEDIUM | Parar imediatamente; identificar os leads afetados; considerar opt-out voluntário para os que receberam ≥2 sem resposta; registrar; recalibrar o limite de rajada |
| **Lead pediu exclusão de dados (LGPD)** | MEDIUM | Bloquear contato **imediatamente**; eliminar dados do banco; eliminar ou expirar do backup; **registrar** data, hora, canal e evidência; responder o titular confirmando. Prazo razoável; sem canal, prazo inatingível |
| **Postgres parado / não responde** | LOW | Notificação local crítica (R-045); bot entra em **pausa global** (não enviar sem poder registrar o envio); Admin reinicia o serviço. Verificar que a pausa é total, não parcial |
| **API de LLM fora do ar** | LOW | Silêncio (nunca mensagem genérica). Notificar. Handoff manual. **Nunca** degradar para template fixo — template fixo é 100% fingerprint |
| **Backup não restaurável** | HIGH | Se o teste mensal falhou, o backup não existia. Reconstruir histórico a partir do caça-leads (leads) — **o histórico de conversas é irrecuperável**. Documentar a perda e abrir o incidente correspondente. |
| **Duplo socket / conflict loop** | MEDIUM | Corrigir o handler de reconnect (teardown + guard monotônico + backoff com teto). Monitorar `Stream Errored (conflict)` no log. Se o número já foi restringido por isso, tratar como ban |

---

## Pitfall-to-Phase Mapping

Como cada fase do roadmap deve tratar estes pitfalls. A coluna “Verification” é o critério de sucesso da fase.

Proposta de fases (alinhada à decisão de granularidade grosseira, 3-5 fases, registrada no PROJECT.md):

| Pitfall | Prevention Phase | Verification |
|---------|------------------|---------------|
| 1. Reach-out timelock / erro 463 | **Fase 1 — Fundação e Canal** | `fetchNewChatMessageCap()` sendo lido; trava de cold outreach a 70% de `used_quota`; teste: forçar `used_quota` alto e confirmar que o sistema **para** e notifica |
| 2. Envio para número inexistente (R-019) | **Fase 1 — Fundação e Canal** | Teste: mock `onWhatsApp` retornando `exists: false` → lead vai a `NUMERO_INVALIDO`, zero envio, zero retry |
| 4. Gate de envio único / anti-requisitos de estado | **Fase 1 — Fundação e Canal** | `grep` de chamadas de envio fora do adapter = **0**; teste de propriedade por AR: injetar estado proibido → `podeEnviar` = `false` por **todos** os caminhos |
| 9. Backup + auth state + OneDrive | **Fase 1 — Fundação e Canal** | Restauração mensal registrada com contagem de linhas de `leads`/`messages`/`opt_outs`; auth state no mesmo pacote; teste de caminho: `Test-Path` do estado aponta para fora do OneDrive e fora do git |
| 10. Versão do Baileys em RC | **Fase 1 — Fundação e Canal** | `package.json` com versão exata (sem `^`/`~`/`latest`) **e ≥ `7.0.0-rc10`**; lockfile commitado; versão documentada no README de operação; teste de sanidade: `fetchAccountReachoutTimelock` existe no typings do pacote instalado |
| 7. LGPD: Encarregado + canal + balanceamento | **Fase 1 (documentos)** + **Fase 3 (registros/opt-out)** | Encarregado nomeado com substituto e canal publicado; documento de teste de balanceamento versionado; 100% dos leads com origem + base legal + finalidade preenchidos |
| 6. Humanização / sequenciamento | **Fase 1 (sequenciador + cooldown)** + **Fase 2 (delay dinâmico)** | σ/μ do delay ≥ 0.25 no log; máx. 1 envio simultâneo; nunca 2 mensagens do mesmo dia para o mesmo par |
| 3. Prompt não é guardrail / LLM negocia | **Fase 1 (gate de saída)** + **Fase 2 (motor de 3 camadas)** | Teste: injetar "qual o preço?" e "é um bot?" → 100% resultam em handoff + silêncio, sem texto de negociação; `menciona_valor: true` em 0 mensagens enviadas |
| 5. Follow-up frio consome orçamento | **Fase 2 (default conservador)** + **Fase 3 (calibração)** | Cadência com N máximo de mensagens automatizadas sem resposta; 463 → handoff automático e cancelamento da cadência daquele lead |
| 8. R-007 rajada de startup + misfire policy | **Fase 1 (fila durável + lease + idempotência)** + **Fase 3 (limite de rajada)** | Simular 3 follow-ups vencidos para 1 lead + 15 leads: abrir o app → máx. 3 mensagens em 10 min, 1 por lead/dia, com jitter; reconciliador roda e não duplica |
| Dano já consumado: contradição com R-019 | **Fase 1 — decisão registrada** | Atualizar `PROJECT.md`: R-019 sai de Active para Out of Scope com a razão real (restrição de **conta**, não erro de mensagem) |
| Encarregado (DPO) e canal do titular | **Fase 1 — documentos** | Documento publicado; responder um e-mail de teste de titular em < 48h |

### Fases que provavelmente **não** precisam de pesquisa adicional

- Fase 1 (Fundação e Canal): agora tem evidência suficiente. Os documentos do Baileys, a investigação do erro 463, as APIs de quota e a documentação do PostgreSQL cobrem tudo.
- Fase 4 (Piloto e Calibração): a pesquisa de humanização e de cadência dá os critérios de medição.

### Fases que provavelmente **precisam** de pesquisa adicional

- **Fase 2 (IA e Handoff):** escolher provedor de LLM e validar empiricamente a taxa de bypass dos guardrails **em português do Brasil**. A pesquisa de guardrails é em inglês e a taxa de bypass medida (60-70% / 89-94%) pode não se aplicar a PT-BR. **Recomendação: construir um conjunto de avaliação adversarial em PT-BR com ~200 mensagens de teste** (perguntas de preço, pedido de desconto, "você é robô?", "me manda o catálogo em PDF", "marca amanhã às 10h", "não quero mais receber") e medir a taxa de violação **antes** de ir a campo. Isso é uma fase com incerteza real.
- **Fase 3 (Cadência):** os intervalos concretos (1h/1d/3d/7d) só devem ser fixados após ~30 dias de dado real do piloto. Pesquisa adicional aqui é **precoce**.
- **Migração para API oficial (R-016):** pré-requisitos de onboarding da WhatsApp Business Platform (aprovação de display name, 2FA, verificação de negócio, cobrança por conversa, políticas de template) **não** foram verificados nesta pesquisa. Flag para pesquisa na fase correspondente.

---

## Sources

Fontes primárias primeiro (issues/PRs do repositório, documentação oficial, decisões da ANPD), depois discussões de comunidade. Fontes de fornecedor e marketing estão marcadas como tal.

### WhatsApp / Baileys — comportamento de banimento e reach-out

- [INVESTIGATION] 463 error investigation — WhiskeySockets/Baileys #2441. Investigação do "Reach-out Time-lock", `WAWebFetchReachoutTimelockJobQuery`, tctoken ausente contado como reach-out. **Fonte primária mais importante deste documento.** https://github.com/WhiskeySockets/Baileys/issues/2441
- [BUG] Critical Issue - Error 463 (Reachout Timelock) Causing Account Bans — #2707. TC token, ciclo de vida de 28 dias, ausência de mecanismo no Baileys. https://github.com/whiskeysockets/Baileys/issues/2707
- CRITICAL: Error 463 on Warm Contacts — Not resolved by recent TC token patches — #2698. Diagnóstico do versionamento (Evolution API 2.3.7 vs 2.4.0-rc2, que faz bump de `baileys@7.0.0-rc.9`); mensagens presas em `PENDING` como sinal de shadow ban. https://github.com/WhiskeySockets/Baileys/issues/2698
- [GOWS] Error 463 on send to cold contacts — tctoken/cstoken not included — #1992. https://github.com/WhiskeySockets/Baileys/issues/1992
- feat: complete tctoken lifecycle with expiration, pruning and re-issuance — PR #2339. Contém o commit **"Remove 463 retry — WA Web prevents this client-side, retrying worsens account restrictions"**. https://github.com/WhiskeySockets/Baileys/pull/2339
- feat: implement TC token, CS token & error 463 prevention — PR #2446. Mapeamento de `WAWebReachoutTimelockUtils.canSendMsgWhileTimelocked()` e `canSendMsgWhileCapped()`, ambos gateados em `chat.getTcToken() != null`. https://github.com/WhiskeySockets/Baileys/pull/2446
- feat: cstoken (NCT) — PR #2438. `cstoken = HMAC-SHA256(nctSalt, recipientLid)`; `nctSalt` chega por `regular_high`/history sync; **`ensureNctSaltSynced()` só cobre o caso de history desabilitado**. https://github.com/WhiskeySockets/Baileys/pull/2438
- v7.0.0-rc10 release notes (2026-05-06). "Reachout Timelock (Your account is restricted - the 463 error) and New Chat limits functions"; "Full TC Token issuance, revocation, expiration, pruning lifecycle"; sem release desde 2025-11-21. https://github.com/WhiskeySockets/Baileys/releases/tag/v7.0.0-rc10
- v7.0.0-rc12 release notes (2026-05-20). Corrige **GHSA-qvv5-jq5g-4cgg**. https://github.com/WhiskeySockets/Baileys/releases/tag/v7.0.0-rc12
- Documentação da API (Context7, `/whiskeysockets/baileys`): `fetchAccountReachoutTimelock()`, `fetchNewChatMessageCap()` (retorna `capping_status`, `used_quota`, `total_quota`), `SERVER_ERROR_CODES = { MessageAccountRestriction: '463', SmaxInvalid: '479' }`, `NACK_REASONS.SenderReachoutTimelocked` → `ACCOUNT_RESTRICTED_TEXT`. **HIGH confidence.**
- [BUG] - WhatsApp number banning — #1983. "Send messages to non saved contacts which has no past chats and in 15-20 such messages in a day your number get restricted." Progressão 24h → 48h → permanente. https://github.com/WhiskeySockets/Baileys/issues/1983
- [BUG] Whatsapp restricted my account to link the bot within 2 hours — #1850. *"I had implemented the random delay for the reply of each question that is 2 - 4 sec each... But when 10 members msged to the bot, it replies all of them within 3 sec."* — burst de respostas simultâneas. https://github.com/WhiskeySockets/Baileys/issues/1850
- [BUG] After connect in the baileys number is banned — #1245. `Stream Errored (conflict)` por reconectar sem teardown do socket anterior; relato de produção de que isso "escalates past a simple disconnect into an actual ban/restriction". https://github.com/WhiskeySockets/Baileys/issues/1245
- High number of bans on WhatsApp! — #1869. Depoimentos de usuários **não-bot** banidos, e correlação com bumps de versão. Recorrência: "temporary banned → temporary banned → permanently banned". https://github.com/WhiskeySockets/Baileys/issues/1869
- Banned when join group with large member — #1901. Sequência de experimentos: 6.7.13 sobreviveu um ano → banido em 2025-10-15; 6.7.16 banido; 7.0 banido ao interagir. *"I've only purchased over 40 numbers."* https://github.com/WhiskeySockets/Baileys/issues/1901
- Repeated Number Bans on WhatsApp Service — #2075. "after sending just 1 to 3 messages, the number gets banned again." https://github.com/WhiskeySockets/Baileys/issues/2075
- Have you noticed bans increasing in the last two weeks? — #1248. Erro **429 = "Excessive messages/uses"**; relato de 3 mensagens/segundo como gatilho. https://github.com/WhiskeySockets/Baileys/issues/1248
- Is missing contextInfo causing bans? — Discussion #1944. **Resposta do maintainer: "Missing contextInfo doesn't cause ban"** — útil para **não** perseguir sinais falsos. https://github.com/WhiskeySockets/Baileys/discussions/1944
- How to Avoid a WhatsApp Ban: Prevention Guide — unlimitedmessaging.app. *"The signal that triggers a block is almost never a single message, but a pattern."* Fontes: WhatsApp Business Policy, Termos de Serviço, Baileys, Cloud API. (Fonte comercial de terceiro — usar como orientação, não como regra.)
- Como desbloquear conta banida (recuperação): WhatsApp Support https://www.whatsapp.com/contact ; FAQ de revisão de ban https://faq.whatsapp.com/739531568188322

### LGPD / ANPD

- [ANPD] Guia Orientativo: Hipóteses Legais de Tratamento — Legítimo Interesse. Teste de balanceamento em três fases (finalidade, necessidade, balanceamento e salvaguardas). https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/copy_of_guia_legitimo_interesse.pdf
- [ANPD] Saiba como fiscalizamos. **"Até o momento, todos os processos sancionadores conduzidos pela ANPD, sem exceção, foram instaurados em decorrência de postura não colaborativa do regulado."** Regulação em 7 etapas; medidas preventivas (art. 32) não são sanção. https://www.gov.br/anpd/pt-br/assuntos/fiscalizacao/saiba-como_fiscalizamos
- [ANPD] ANPD fiscaliza 20 empresas por falta de Encarregado e canal de comunicação adequado (**13/12/2024**). https://www.gov.br/anpd/pt-br/assuntos/noticias/anpd-fiscaliza-20-empresas-por-falta-de-encarregado-e-canal-de-comunicacao
- [ANPD] Resolução CD/ANPD nº 1/2021 (Regulamento de Fiscalização), retificada pela nº 4/2023. Arts. 32 (medidas preventivas), 37 (PAS), 55 (decisão de 1ª instância).
- [ANPD] Resolução CD/ANPD nº 18/2024 — Encarregado; inclui a possibilidade de substituto.
- [ANPD] Despacho Decisório nº 27/2026/CGS/SFI — ByteDance Brasil, **R$ 153.769.671,33** em 5 multas simples + ordem de eliminação de dados + multa diária de R$ 137.081,49. https://www.gov.br/anpd/pt-br/centrais-de-conteudo/decisoes-em-processos-sancionadores/despacho-decisorio-no-27-2026-cgs-sfi.pdf
- [ANPD/DANIEL] ANPD em 2026: fiscalização em escala. MP nº 1.317/2025 → **Lei nº 15.352/2026** (ANPD vira Agência Reguladora); 21 empresas encaminhadas à sanção no 1º semestre de 2026; **Mapa de Temas Prioritários 2026-2027 inclui "Inteligência Artificial e tecnologias emergentes"**. https://www.daniel.com.br/pt/client-alert/anpd-em-2026-fiscalizacao-em-escala-e-uma-agenda-mais-ampla-para-o-ambiente-digital/
- LGPD e prospecção B2B — oHub Base. Análise de base legal (legítimo interesse, art. 7º IX), direito de oposição, origem lícita, opt-out como forma prática do direito de oposição. https://base.ohub.com.br/vendas-b2b/prospeccao/fundamentos-de-prospeccao-e-construcao-de-listas/artigos/lgpd-na-prospeccao-o-que-vendas-precisa-saber
- WhatsApp na prospecção B2B: boas práticas e limites — oHub. *"O erro mais grave é invadir sem permissão."*
- LGPD no WhatsApp marketing: o que pode e checklist — oHub. Meta monitora volume de bloqueios/denúncias e bane **antes** de qualquer procedimento da ANPD; as duas camadas são independentes.
- LGPD na prospecção B2B: o que pode e o que não pode em 2026 — Prospecta. Base de CNPJ pública (Receita Federal) como origem de menor risco que lista comprada.
- Preciso de autorização da LGPD para mandar mensagem no WhatsApp? — Zapext. Tabela de base legal por situação; contato frio de lista de terceiro = "nenhuma base clara".

### IA / guardrails / alucinação em vendas

- **Moffatt v. Air Canada, 2024 BCCRT 149.** "A remarkable submission" — o chatbot não é entidade legal separada. Base canônica.
- **OLG Hamm, 12/05/2026, 4 UKl 3/25 (Aesthetify).** Declarações do chatbot imputáveis à empresa; rejeita a defesa de terceiro independente. https://www.technologyslegaledge.com/2026/09/ai/
- Chevrolet Tahoe por US$ 1 (dez/2023) — o caso de referência de "Excessive Agency" da OWASP LLM Top 10. https://veriprajna.com/insights/ai-chatbot-unauthorized-deals
- Can Your AI Chatbot Make Unauthorized Deals? — arquitetura de três camadas (compreender / decidir em código / responder). O exemplo do campo `mentioned_competitors: { maxItems: 0 }` como canário de schema veio daqui.
- LLM Guardrails in Production — kalviumlabs.ai. **"System prompts are not guardrails. They are suggestions the model follows most of the time and ignores when it matters most."** Bypass medido: regex 60-70%, classificador LLM 89-94%, combinado 99,1%. Caso de falso positivo: 12% ao filtrar qualquer valor monetário, corrigido para 0,4% com grounding. https://www.kalviumlabs.ai/blog/guardrails-for-llm-applications/
- AI Customer Service Hallucination: Refund and Policy Failures — Respan. Viés de concordância (sycophancy bias) == fill-in-the-blanks; liability assimétrica (resposta errada-e-generosa cria compromisso). https://www.respan.ai/resources/support-ai-policy-hallucination
- Your AI Just Quoted a Price That Doesn't Exist — ymeadows.com. Grounded generation + verificação; case real: **20% de erro em 34 cotações assistidas por IA**, R$ 8.200 de margem dada.
- AI Legal Risks in Sales — influencers-time.com. Categorias de alto risco: segurança, garantias de performance, **preço e autoridade de desconto**, disponibilidade/roadmap. Disclaimers não curam.
- Guardrails & Structured Output — ikshitij.com. Três camadas (decoding / schema / política); tratar *refusal* como ramo de primeira classe; armadilhas (schema drift, truncamento silencioso).
- Algolia Agent Studio — Guardrails. **fail-open** por decisão de disponibilidade — **rejeitado neste projeto** (ver Security Mistakes). https://www.algolia.com/doc/guides/algolia-ai/agent-studio/how-to/guardrails
- DoNotPay FTC settlement US$ 193.000 (jan/2025); FTC vs. Air AI Technologies (ago/2025) — a FTC processa quem **vende** a capacidade do agente, não o modelo.

> **Ressalva de peso de fonte (seção de IA):** ymeadows.com, influencers-time.com e ikshitij.com são blogs de fornecedor/vendedor. Usar como **ilustração de padrão**, nunca como base normativa. As taxas de bypass (60-70% / 89-94%) vêm do kalviumlabs.ai e são de provider e idioma específicos.

### Humanização e detecção de bot

- Opposing Effects of Response Time in Human–Chatbot Interaction (Springer, JAMS 2022). Atraso dinâmico aumenta presença social em **novatos** e a **reduz** em experientes; o "one-design-fits-all" é um erro. https://link.springer.com/article/10.1007/s12599-022-00755-x
- Faster Is Not Always Better: Dynamic Response Delays in Human-Chatbot Interaction (ACM, 2018). Atraso **dinâmico** aumenta humanidade e satisfação; atraso estático de 15-30s é o padrão inadequado.
- Characterizing and Detecting Livestreaming Chatbots (ASONAM 2019). **IMD (inter-message delay) consistente e determinístico é a assinatura de automação** (KS test p=1.93e-19). O problema não é "sem random", é **distribuição errada**. https://downloads.ctfassets.net/btheynltg5cn/4k1CvXXK9C950k1CUwqEkn/7384e3027ce1680a81d078fd5d62d94b/c/Characterizing_and_Detecting_Livestreaming_Chatbots-ASONAM19.pdf
- Hybrid CAPTCHA com keystroke dynamics (arXiv 2510.02374). Human typing tem σ de latência > 0; script de digitação simulada tem σ ≈ 0. **A lição: variância, não média.**
- Creating a Bot-tleneck for malicious AI (PMC11335777). 18,9% do sample identificado como potencial bot por perguntas livres vs 1,7% do reCAPTCHA V3 — detecção comportamental supera CAPTCHA.
- The Effect of Delay-Handling Strategies on Perceived Usability of a Chatbot (UXQ 2025). Indicador de digitação aumenta usabilidade percebida, mas efeito modesto (p=0.1482).
- Indicador de "digitando..." do WhatsApp com duração fixa (~5s) e sumiço — **observação de comunidade, sem fonte primária publicada. LOW confidence.** Usar como referência de ordem de grandeza, não como constante de engenharia.

### Fila, agendamento e misfire

- Designing a Distributed Job Scheduler That Actually Works (HLD) — Medium/Kumari. **Misfire policies: `SKIP` / `FIRE_ONCE` / `CATCH_UP`**; *"Recovery becomes a self-inflicted thundering herd / DoS"* para `CATCH_UP`; default recomendado `FIRE_ONCE`. Guardrails: teto de catch-up, cotas, rate-limit, log quando o teto é atingido.
- Anti-Pattern 2/3 — retry storm sem jitter; **unbounded catch-up após restart do scheduler** (2h down → 6.000.000 runs simultâneos).
- How to Build a Job Queue That Survives a Server Restart — 137Foundry. Persistir estado fora do processo; **visibility timeout / lease**; idempotency key; dead-letter com teto de tentativas.
- Designing a Distributed Job Scheduler That Doesn't Fire Twice — The Augmented Dev. `FOR UPDATE SKIP LOCKED`; lease maior que a execução mais lenta; **at-least-once, portanto handlers idempotentes**; thundering herd das 09:00 e a necessidade de jitter.
- The Reconciler Pattern — DEV/Nasrul Hazim. *"The bad mental model: 'the queue is durable, so a dispatched job will eventually run.' Your database row is the durable thing. The queue is a delivery hint."*
- Quartz.NET misfire handling (DeepWiki). `DoNothing` / `FireOnceNow` / `SmartPolicy`; misfire também ocorre por **salto de relógio / horário de verão**.

### PostgreSQL / Windows / local-first

- PostgreSQL Docs — SQL Dump. `pg_dump` é **version-specific**; exige superusuário para dump completo; restaurar exige que os owners já existam; `psql` **continua após erro por padrão**; usar `-1/--single-transaction` para all-or-nothing; `-F c` (custom) para restore paralelo. https://www.postgresql.org/docs/current/backup-dump.html
- PostgreSQL Wiki — Automated Backup on Windows. Backup por batch com `PGPASSWORD`; cuidado com a conta de serviço; `pg_dumpall -g` separado para roles. https://wiki.postgresql.org/wiki/Automated_Backup_on_Windows
- Access is Denied ao rodar pg_dump no Windows. "É quase sempre problema de permissão de filesystem ou restrição de segurança", não do Postgres; solutions: pasta dedicada fora de `C:\Program Files`, conceder escrita à conta de serviço do PostgreSQL, exceção no antivírus. https://www.codestudy.net/blog/getting-access-is-denied-error-when-executing-pg-dump-on-windows/
- pg_dump + Windows Task Scheduler (StackOverflow). **`%APPDATA%` não é inicializado quando o Agendador de Tarefas roda com outra conta** → `pgpass.conf` não é lido → `fe_sendauth: no password supplied`. Causa raiz de "funciona manualmente, falha agendado". https://stackoverflow.com/questions/32586775

### Verificação de versão (realizada nesta pesquisa)

- `npm view baileys version` → **7.0.0-rc14**; `dist-tags` → `{ latest: '7.0.0-rc14', legacy: '6.7.24' }` (2026-09-28). **Não existe v7 estável.**
- GitHub Releases API: rc14 e 6.7.24 em 2026-07-29; rc13 em 2026-05-21; rc12 em 2026-05-20; rc11 em 2026-05-13; rc10 em 2026-05-06; rc.9 em 2025-11-21. Gap de ~5 meses entre rc.9 e rc10.
- **Diff de árvore entre as tags (verificação direta, 2026-09-28):**
  - `git/trees/v6.7.24?recursive=1` → 165 arquivos; busca por `tctoken|tc-token|reachout|cstoken|nctsalt` → **NENHUM resultado**.
  - `git/trees/v7.0.0-rc14?recursive=1` → `src/Utils/tc-token-utils.ts`, `src/__tests__/Utils/tc-token.test.ts`.
  - `raw/.../v6.7.24/src/Socket/messages-send.ts` → **0** ocorrências de `ReachoutTimelock` / `fetchNewChatMessageCap`.
  - Release `v7.0.0-rc10` (body): *"Full TC Token issuance, revocation, expiration, pruning lifecycle"*, *"Reachout Timelock (Your account is restricted - the 463 error) and New Chat limits functions"*, *"463 handlers and safety-paths"*.
  - **Conclusão: a linha `legacy` (6.7.x) é anterior a tctoken, a handlers de 463 e às APIs de quota. Não é uma alternativa funcional à linha 7 — é a linha sem essas capacidades.**

---

## Confidence Assessment

Confiança por área, com a razão. É o que define se um achado pode virar decisão de arquitetura ou apenas uma hipótese a testar.

| Área | Confiança | Razão |
|------|-----------|-------|
| Reach-out timelock / erro 463 | **HIGH** | Fontes primárias do repositório Baileys: issue de investigação dedicada, PRs com mapeamento de protocolo, release notes, e a API de Context7 (`fetchAccountReachoutTimelock`, `fetchNewChatMessageCap`) |
| Escolha da linha de versão do Baileys (rc14 vs 6.7.24) | **HIGH** | **Verificado por diff direto da árvore do repositório entre as tags** (v6.7.24 sem nenhum arquivo de tctoken/reach-out; v7.0.0-rc14 com `tc-token-utils.ts`) + release notes do rc10 nomeando as três capacidades. Não é inferência: é ausência/presença de código. |
| Envio para número inválido → restrição de conta | **MEDIUM-HIGH** | Um relato forte (#2441) e corroboração indireta; não achei documentação oficial da Meta sobre isso. **Vale teste empírico na Fase 1.** |
| Banimento por padrão (volume, cadência, cold outbound) | **MEDIUM-HIGH** | Consistente nas issues do repositório e em guias de comunidade, mas a Meta não publica limiares. Evidência comunitária, não oficial |
| Humanização (delay, IMD, split) | **MEDIUM-HIGH** | Pesquisa acadêmica revisada por pares para o efeito do delay; evidência mais fraca e mais específica para a assinatura de IMD no WhatsApp (extrapolada de livestreaming) |
| Guardrails / LLM atravessando fronteira | **HIGH** para o mecanismo; **MEDIUM** para as taxas de bypass em PT-BR | Mecanismo e casos amplamente documentados; as taxas medidas (60-70%/89-94%) são de provider (regex/LLM) em inglês — **não presumir em PT-BR** |
| LGPD / ANPD | **HIGH** para fatos institucionais; **MEDIUM** para a aplicação ao caso concreto | ANPD, regulamentos e sanções reais são primários; a qualificação jurídica do legítimo interesse para prospecção fria em WhatsApp é **zona cinzenta** — a própria skill `lgpd-optout` diz "registra avaliação de legítimo interesse" sem definir o padrão |
| Fila / misfire / R-007 | **HIGH** | Padrão de mercado documentado em múltiplas fontes independentes; a equivalência com R-007 é direta |
| PostgreSQL / Windows / backup | **HIGH** | Documentação oficial do PostgreSQL + casos reais em SO/wiki |
| Recuperação de ban | **MEDIUM** | Procedimento de appeal é consistente em várias fontes; **a taxa de sucesso é anedótica e não publicável**. A janela de 30 dias e o canal de email para Business aparecem em fontes secundárias — **confirmar antes de depender** |
| Aquecimento de número novo | **LOW-MEDIUM** | Números ("250/dia, 4 semanas") vêm de marketing de ferramenta, não de fonte primária. Não usar como regra; o próprio projeto já é conservador (20-30/dia) e R-039/R-040 mantêm o aquecimento manual |

### Lacunas que esta pesquisa **não** cobriu

1. **Pré-requisitos de onboarding da WhatsApp Business Platform** (display name approval, 2FA, verificação de negócio, modelo de cobrança por conversa, políticas de template) — necessário para a fase de migração (R-016). **Não pesquisado.**
2. **Comportamento de `wa.me`/links curtos no filtro de spam da Meta** — mencionado apenas como recomendação de mitigação em fontes secundárias; não verificado em fonte primária. Relevante porque o projeto envia links (R-037 permite texto e links).
3. **Comportamento da WPPConnect** (a alternativa de canal): o pacote `wppconnect` não existe no registry npm com esse nome (404 nesta pesquisa); o pacote é `@wppconnect/wa-js` / `wppconnect-server`. **A escolha de canal precisa ser refeita com verificação de nomes e manutenção.** R-016 mitiga esse risco, mas a comparação Baileys-vs-WPPConnect **não foi feita aqui** — pertence à pesquisa de STACK.
4. **Tamanho da amostra do WhatsApp no Brasil e a taxa real de banimento por volume** — não é público. Tratar qualquer número como anedótico.
5. **Custo e latência reais de um LLM em PT-BR com structured output** — depende do provedor escolhido; só medir na Fase 2.

---

*Pitfalls research for: Automação local de WhatsApp para prospecção B2B (Baileys + LLM + PostgreSQL local + Windows)*
*Researched: 2026-09-28*
*Fontes primárias: repositório WhiskeySockets/Baileys (issues #2441, #2707, #2698, #1992, #1983, #1850, #1245, #1869, #1901, #2075, #1248, discussion #1944; PRs #2339, #2446, #2438; releases rc10-rc14), documentação ANPD (guia de legítimo interesse, Resoluções CD/ANPD 1/2021, 4/2023, 18/2024, Despacho Decisório 27/2026), PostgreSQL Docs, e jurisprudência sobre chatbot liability (Moffatt v. Air Canada 2024 BCCRT 149; OLG Hamm 4 UKl 3/25).*
