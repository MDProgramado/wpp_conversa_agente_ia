# 09 — Critérios de Aceitação

> Critérios em formato EARS e Gherkin, mapeados 1:1 com requisitos funcionais e anti-requisitos.
> Cada critério pode virar teste automatizado no GSD (Fase 1: property tests dos 12 AR; Fases 2–4: testes E2E).

---

## Formato EARS (Easy Approach to Requirements Syntax)

| Padrão | Estrutura | Uso |
|---|---|---|
| **Ubíquo** | O sistema deve `<resposta>`. | Regras permanentes |
| **Dirigido por evento** | Quando `<gatilho>`, o sistema deve `<resposta>`. | Reações a eventos |
| **Dirigido por estado** | Enquanto `<estado>`, o sistema deve `<resposta>`. | Comportamento durante estados |
| **Opção** | Onde `<feature>`, o sistema deve `<resposta>`. | Recursos opcionais |
| **Indesejado** | Se `<condição indesejada>`, então o sistema deve `<resposta>`. | Tratamento de falhas |

---

## Formato Gherkin (Dado / Quando / Então)

```
Cenário: <nome>
  Dado <contexto>
  Quando <ação>
  Então <resultado esperado>
  E <resultado adicional>
```

---

## AC-001 — Assunção imediata do bot (R-001, R-002)

**EARS:**
- Quando o usuário envia a primeira mensagem manualmente, o sistema deve assumir a conversa imediatamente.
- Enquanto o lead não responder, o sistema deve aguardar sem enviar mensagem até o follow-up de 1h.

**Gherkin:**
```gherkin
Cenário: Bot assume após primeira mensagem manual
  Dado um lead importado com status NOVO
  Quando o Admin envia a primeira mensagem manualmente
  Então o sistema deve assumir a conversa
  E o status do lead deve mudar para CONTATADO
  E o timestamp do envio deve ser registrado
  E o modo de operação deve ser AUTOMÁTICO TOTAL
```

---

## AC-002 — Janela de envio (R-006)

**EARS:**
- Enquanto o horário estiver fora de dias úteis ou das 7h–17h, o sistema não deve enviar mensagens automáticas.
- Se uma mensagem estiver agendada fora da janela, então o sistema deve enfileirá-la.

**Gherkin:**
```gherkin
Cenário: Bloqueio de envio fora da janela
  Dado que o horário atual é sábado às 10h
  Quando o bot tenta enviar uma mensagem automática
  Então a mensagem não deve ser enviada
  E deve ser enfileirada para o próximo dia útil às 7h

Cenário: Resposta fora da janela aguarda decisão manual
  Dado que o horário atual é 22h de segunda-feira
  Quando o lead envia uma mensagem
  Então o bot NÃO deve responder automaticamente
  E deve notificar o Admin localmente
  E deve aguardar decisão manual
```

---

## AC-003 — Follow-ups vencidos ao abrir o app (R-007)

**EARS:**
- Quando o app for aberto após um período fechado, o sistema deve enviar follow-ups vencidos com delays humanizados.

**Gherkin:**
```gherkin
Cenário: Follow-ups vencidos enviados ao abrir o app
  Dado que o app ficou fechado por 3 dias
  E existem 5 follow-ups vencidos na fila
  Quando o app é aberto
  Então o sistema deve enviar os follow-ups vencidos
  E cada envio deve ter delay humanizado de 3–12 segundos
  E o sistema deve respeitar o limite diário de 20–30 mensagens
  E se o limite for atingido, os restantes ficam para o próximo dia útil
```

---

## AC-004 — Limite diário de mensagens (R-023, AR-008)

**EARS:**
- O sistema não deve enviar mais de 20–30 mensagens por dia no número dedicado.
- Se o limite for atingido, então o sistema deve parar de enviar e enfileirar o restante.

**Gherkin:**
```gherkin
Cenário: Bloqueio ao atingir limite diário
  Dado que o sistema já enviou 30 mensagens hoje
  Quando tenta enviar uma nova mensagem automática
  Então a mensagem não deve ser enviada
  E deve ser enfileirada para o próximo dia útil
  E o Admin deve ser notificado

Cenário: Contagem de mensagens por dia
  Dado que o dia é útil
  Quando o sistema envia mensagens automáticas
  Então cada envio deve incrementar o contador diário
  E o contador deve ser reiniciado à 00:00 do próximo dia útil
```

---

## AC-005 — Cadência de follow-up (R-003, R-004, R-005)

**EARS:**
- Quando o lead não responder, o sistema deve agendar follow-ups em 1h, 1d, 3d e 7d.
- Após o follow-up de 7d sem resposta, o sistema deve encerrar a cadência e marcar o lead como PERDIDO.

**Gherkin:**
```gherkin
Cenário: Cadência completa sem resposta
  Dado um lead com status CONTATADO
  E que o lead não respondeu à primeira mensagem
  Quando passam 1 hora
  Então o sistema deve enviar o follow-up 1h
  Quando passa 1 dia
  Então o sistema deve enviar o follow-up 1d
  Quando passam 3 dias
  Então o sistema deve enviar o follow-up 3d
  Quando passam 7 dias
  Então o sistema deve enviar o follow-up 7d
  Quando passa 1 dia após o follow-up 7d
  Então o sistema deve encerrar a cadência
  E marcar o lead como PERDIDO

Cenário: Interrupção da cadência por resposta
  Dado um lead em cadência de follow-up
  Quando o lead responde
  Então a cadência deve ser interrompida imediatamente
  E o status deve mudar para RESPONDEU
  E a IA deve assumir a conversa
```

---

## AC-006 — Qualificação (R-051, R-052)

**EARS:**
- O sistema só deve marcar um lead como QUALIFICADO quando identificar verba/interesse E poder de decisão.
- Se um dos critérios não for identificado, então o lead não deve ser qualificado.

**Gherkin:**
```gherkin
Cenário: Lead qualificado com sucesso
  Dado um lead em conversa com a IA
  Quando a IA identifica verba/interesse em investir
  E identifica poder de decisão (dono, sócio ou autonomia)
  Então o status deve mudar para QUALIFICADO
  E a nota automática deve registrar os critérios identificados

Cenário: Lead sem poder de decisão
  Dado um lead em conversa com a IA
  Quando a IA identifica verba/interesse
  Mas NÃO identifica poder de decisão
  Então o status NÃO deve mudar para QUALIFICADO
  E o lead deve continuar em aquecimento

Cenário: Validação híbrida
  Dado um lead em conversa
  Quando a IA tenta inferir verba/decisão por contexto
  E não consegue
  Então a IA pode fazer uma pergunta direta e educada
  E deve evitar tom de interrogatório
```

---

## AC-007 — Handoff por pedido de preço (R-012, AR-001, AR-002, AR-012)

**EARS:**
- Quando o lead pedir preço, proposta ou orçamento, o sistema deve acionar handoff imediato.
- O sistema não deve informar, sugerir ou calcular valores.

**Gherkin:**
```gherkin
Cenário: Handoff por pedido de preço
  Dado um lead em conversa ativa com a IA
  Quando o lead envia "Quanto custa um site?"
  Então a IA NÃO deve responder com valor
  E o handoff deve ser acionado imediatamente
  E a notificação local deve ser emitida com som e pop-up
  E o motivo do handoff deve ser "PEDIDO DE PREÇO"
  E a IA deve ficar em silêncio até o Admin assumir

Cenário: Bloqueio de negociação
  Dado um lead em conversa
  Quando o lead pergunta "Você pode fazer um desconto?"
  Então a IA NÃO deve mencionar desconto
  E o handoff deve ser acionado
```

---

## AC-008 — Handoff por intenção de agendamento (R-012, AR-003, R-025)

**EARS:**
- Quando o lead demonstrar intenção de agendar reunião ou chamada, o sistema deve acionar handoff imediato.
- O sistema não deve sugerir horários, confirmar datas ou criar eventos.

**Gherkin:**
```gherkin
Cenário: Handoff por intenção de agendamento
  Dado um lead em conversa
  Quando o lead diz "Podemos marcar uma call?"
  Então a IA NÃO deve sugerir horário
  E NÃO deve confirmar data
  E o handoff deve ser acionado imediatamente
  E o Admin deve ser notificado localmente
  E o Admin agenda manualmente
```

---

## AC-009 — Handoff por suspeita de automação (R-056, R-057, AR-006)

**EARS:**
- Quando o lead perguntar diretamente se é bot/robô/IA, o sistema deve acionar handoff prioritário e ficar em silêncio total.

**Gherkin:**
```gherkin
Cenário: Silêncio total em suspeita de automação
  Dado um lead em conversa com a IA
  Quando o lead pergunta "Você é um robô?"
  Então a IA NÃO deve enviar NENHUMA mensagem
  E o handoff deve ser acionado com prioridade máxima
  E o Admin deve ser notificado localmente
  E a conversa deve ficar em silêncio total até o Admin assumir
  E o modo do bot deve ser SILÊNCIO TOTAL
```

---

## AC-010 — Handoff por irritação ou ameaça (R-065, R-066)

**EARS:**
- Quando o lead demonstrar irritação ou ameaçar denúncia/bloqueio, o sistema deve pausar a automação, notificar o Admin e ficar em silêncio total.

**Gherkin:**
```gherkin
Cenário: Silêncio total em irritação
  Dado um lead em conversa com a IA
  Quando o lead envia "Isso é spam? Vou denunciar!"
  Então a IA NÃO deve enviar NENHUMA mensagem
  E o handoff deve ser acionado com prioridade máxima
  E a conversa deve ficar em silêncio total até o Admin assumir
```

---

## AC-011 — Opt-out (R-024, AR-005, AR-011)

**EARS:**
- Quando o lead pedir para não receber mais mensagens, o sistema deve marcar o lead como "não contatar" e interromper toda automação.
- O sistema não deve tentar reverter o pedido.

**Gherkin:**
```gherkin
Cenário: Opt-out detectado automaticamente
  Dado um lead em conversa com a IA
  Quando o lead envia "Não quero mais receber mensagens"
  Então o lead deve ser marcado como "NÃO CONTATAR"
  E toda automação deve ser interrompida
  E a data, hora e conteúdo do pedido devem ser registrados
  E nenhuma mensagem posterior deve ser enviada
  E a IA NUNCA deve tentar reverter o pedido

Cenário: Bloqueio de nova tentativa após opt-out
  Dado um lead com opt-out registrado
  Quando o sistema tenta agendar um follow-up
  Então o agendamento deve ser bloqueado
  E o log deve registrar a tentativa bloqueada
```

---

## AC-012 — Mídia recebida (R-038, AR-009)

**EARS:**
- Quando o lead enviar mídia (áudio, imagem, PDF, vídeo), o sistema não deve processar o conteúdo, apenas registrar e acionar handoff.

**Gherkin:**
```gherkin
Cenário: Áudio recebido
  Dado um lead em conversa com a IA
  Quando o lead envia um áudio
  Então a IA NÃO deve transcrever
  E NÃO deve interpretar
  E NÃO deve responder ao conteúdo
  E deve registrar o evento
  E deve acionar handoff
  E deve notificar o Admin localmente

Cenário: PDF recebido
  Dado um lead em conversa
  Quando o lead envia um PDF
  Então a IA NÃO deve processar o arquivo
  E o handoff deve ser acionado
```

---

## AC-013 — Envio de mídia pelo bot (R-037, AR-004)

**EARS:**
- O sistema deve enviar apenas mensagens de texto e links.
- O sistema não deve enviar imagens, PDFs, áudios, vídeos ou documentos.

**Gherkin:**
```gherkin
Cenário: Bloqueio de envio de mídia
  Dado que a IA gerou uma resposta
  Quando a resposta contém uma imagem, PDF, áudio ou vídeo
  Então o envio deve ser bloqueado
  E o evento deve ser registrado no log
  E o Admin deve ser notificado

Cenário: Envio de link permitido
  Dado que a IA gerou uma resposta com link aprovado
  Quando o link está na lista de links permitidos
  Então o envio deve ser permitido
```

---

## AC-014 — Identidade do bot (R-055, AR-006)

**EARS:**
- O sistema não deve se identificar como IA, bot ou assistente virtual espontaneamente.
- O sistema não deve usar linguagem que denuncie automação.

**Gherkin:**
```gherkin
Cenário: Bloqueio de revelação espontânea
  Dado que a IA está gerando uma resposta
  Quando a resposta contém "sou uma IA", "sou um bot" ou "assistente virtual"
  Então a resposta deve ser bloqueada
  E o Admin deve ser notificado
  E a IA deve regenerar a resposta

Cenário: Resposta consistente com persona humana
  Dado um lead em conversa
  Quando a IA responde
  Então a resposta deve ser consistente com a persona do Admin
  E não deve mencionar automação
```

---

## AC-015 — Humanização do envio (R-067)

**EARS:**
- O sistema deve humanizar o envio com delays aleatórios, simulação de digitação e quebra de mensagens longas.

**Gherkin:**
```gherkin
Cenário: Delay aleatório entre mensagens
  Dado que a IA gerou uma resposta
  Quando o sistema envia a mensagem
  Então deve aplicar um delay aleatório entre 3 e 12 segundos
  E deve simular "digitando…" antes do envio

Cenário: Quebra de mensagem longa
  Dado que a IA gerou uma resposta com mais de 200 caracteres
  Quando o sistema prepara o envio
  Então a mensagem deve ser quebrada em 2 ou 3 mensagens curtas
  E cada parte deve ter delay humanizado
```

---

## AC-016 — Atualização automática de status (R-022)

**EARS:**
- O sistema deve atualizar automaticamente o status do lead com base na conversa.
- Toda transição deve ser auditável com timestamp e motivo.

**Gherkin:**
```gherkin
Cenário: Transição automática de status
  Dado um lead com status CONTATADO
  Quando o lead responde
  Então o status deve mudar para RESPONDEU
  E o timestamp e o motivo devem ser registrados

Cenário: Correção manual de status
  Dado um lead com status incorreto atribuído pela IA
  Quando o Admin corrige manualmente
  Então o novo status deve ser registrado
  E a correção deve ser auditada
```

---

## AC-017 — Base legal e LGPD (R-063, R-064, AR-011)

**EARS:**
- O sistema não deve contatar lead sem registrar origem, base legal e finalidade.

**Gherkin:**
```gherkin
Cenário: Bloqueio de contato sem base legal
  Dado um lead importado da API
  Quando o Admin tenta abordar o lead
  E o lead não tem origem, base legal e finalidade registradas
  Então o envio deve ser bloqueado
  E o Admin deve ser notificado
  E o sistema deve exigir o preenchimento antes de prosseguir

Cenário: Registro automático de base legal
  Dado um lead importado da API
  Quando o lead é criado no sistema
  Então a origem, base legal (legítimo interesse) e finalidade (contato comercial B2B) devem ser registradas automaticamente
```

---

## AC-018 — Notificação local de handoff (R-013)

**EARS:**
- Quando o handoff for acionado, o sistema deve emitir notificação local com som e pop-up.

**Gherkin:**
```gherkin
Cenário: Notificação de handoff
  Dado que um gatilho de handoff foi detectado
  Quando o handoff é acionado
  Então o sistema deve emitir som distinto
  E deve exibir pop-up no topo da tela
  E o pop-up deve conter: nome do lead, motivo, última mensagem, status
  E o pop-up não deve poder ser fechado sem ação
```

---

## AC-019 — Modo copiloto (R-014, AR-010)

**EARS:**
- Após o handoff e assunção do Admin, o sistema deve entrar em modo copiloto e não enviar mensagens sem ação explícita.

**Gherkin:**
```gherkin
Cenário: Bot em copiloto após assunção
  Dado que o handoff foi acionado
  Quando o Admin assume a conversa
  Então o bot deve entrar em modo COPILOTO
  E deve sugerir respostas visíveis apenas para o Admin
  E NÃO deve enviar nenhuma mensagem automaticamente
  E o Admin deve ter total autonomia

Cenário: Bloqueio de envio em copiloto
  Dado que o bot está em modo COPILOTO
  Quando a IA gera uma sugestão
  Então a sugestão deve ser exibida apenas no painel
  E nenhuma mensagem deve ser enviada ao lead sem ação explícita do Admin
```

---

## AC-020 — Falhas críticas (R-045)

**EARS:**
- Quando uma falha crítica for detectada, o sistema deve registrar log detalhado e notificar o Admin localmente.

**Gherkin:**
```gherkin
Cenário: WhatsApp desconectado
  Dado que o sistema está operando normalmente
  Quando a conexão com o WhatsApp cai
  Então o log deve registrar a falha com timestamp e severidade
  E o Admin deve ser notificado localmente com som e pop-up
  E o sistema deve tentar reconexão automática

Cenário: API de IA fora do ar
  Dado que a IA está em uso
  Quando a API externa falha
  Então o log deve registrar a falha
  E o Admin deve ser notificado
  E a conversa deve entrar em modo de espera até a API voltar
```

---

## AC-021 — Anti-requisitos como invariantes (AR-001 a AR-012)

**EARS:**
- O sistema deve tratar os 12 anti-requisitos como invariantes de código, bloqueando qualquer resposta que os viole.

**Gherkin:**
```gherkin
Cenário: Bloqueio de resposta com valor (AR-001)
  Dado que a IA gerou uma resposta
  Quando a resposta contém "R$", "valor", "preço" ou "custo"
  Então a resposta deve ser bloqueada
  E o Admin deve ser notificado
  E o handoff deve ser acionado

Cenário: Bloqueio de agendamento autônomo (AR-003)
  Dado que a IA gerou uma resposta
  Quando a resposta contém sugestão de horário ou data
  Então a resposta deve ser bloqueada
  E o handoff deve ser acionado

Cenário: Bloqueio de envio após handoff (AR-010)
  Dado que o handoff foi acionado
  Quando a IA tenta gerar uma resposta
  Então a resposta deve ser bloqueada
  E nenhuma mensagem deve ser enviada
```

---

## AC-022 — Critérios de sucesso do piloto (R-061, R-062)

**EARS:**
- O sistema deve apurar mensalmente: 5 reuniões agendadas e 30% de taxa de qualificação.

**Gherkin:**
```gherkin
Cenário: Apuração mensal
  Dado que o mês terminou
  Quando o sistema apura os indicadores
  Então deve calcular o total de reuniões agendadas no mês
  E deve calcular a taxa de qualificação (qualificados / abordados)
  E deve comparar com as metas: 5 reuniões e 30% de qualificação
  E deve exibir no painel de relatórios
```

---

## AC-023 — Backup manual (R-032)

**EARS:**
- O sistema deve permitir backup manual do banco e da sessão do WhatsApp.

**Gherkin:**
```gherkin
Cenário: Backup manual
  Dado que o Admin clica em "Fazer backup agora"
  Então o sistema deve gerar um arquivo versionado com data/hora
  E deve incluir banco e sessão do WhatsApp
  E deve salvar na pasta local escolhida
  E deve registrar o evento no log

Cenário: Restauração
  Dado que o Admin seleciona um arquivo de backup
  Quando confirma a restauração
  Então o sistema deve substituir o banco atual
  E deve restaurar a sessão do WhatsApp
  E deve registrar o evento no log
```

---

## AC-024 — Migração para API oficial (R-016)

**EARS:**
- O sistema deve permitir migração da conexão não oficial para a API oficial sem quebrar histórico, status ou agendamentos.

**Gherkin:**
```gherkin
Cenário: Troca de canal sem perda de dados
  Dado que o sistema opera com conexão não oficial
  Quando o Admin migra para a API oficial
  Então o histórico de mensagens deve ser preservado
  E os status dos leads devem ser preservados
  E os agendamentos devem ser preservados
  E as configurações devem ser preservadas
```

---

## Mapa de rastreabilidade

| Critério | Requisitos | Anti-requisitos | User Story |
|---|---|---|---|
| AC-001 | R-001, R-002 | — | US-004, US-005 |
| AC-002 | R-006, R-058 | AR-007 | US-011 |
| AC-003 | R-007 | AR-007, AR-008 | US-012 |
| AC-004 | R-023 | AR-008 | US-011 |
| AC-005 | R-003, R-004, R-005 | — | US-011 |
| AC-006 | R-051, R-052 | — | US-007 |
| AC-007 | R-012 | AR-001, AR-002, AR-012 | US-014 |
| AC-008 | R-012, R-025 | AR-003 | US-015 |
| AC-009 | R-056, R-057 | AR-006 | US-016 |
| AC-010 | R-065, R-066 | — | US-017 |
| AC-011 | R-024, R-064 | AR-005, AR-011 | US-018, US-027, US-028 |
| AC-012 | R-038 | AR-009 | US-010 |
| AC-013 | R-037 | AR-004 | US-010 |
| AC-014 | R-055 | AR-006 | US-009 |
| AC-015 | R-067 | — | US-006 |
| AC-016 | R-022 | — | US-022 |
| AC-017 | R-063, R-064 | AR-011 | US-003 |
| AC-018 | R-013 | — | US-014, US-015, US-016, US-017 |
| AC-019 | R-014 | AR-010 | US-020 |
| AC-020 | R-045 | — | US-029 |
| AC-021 | — | AR-001 a AR-012 | Todos |
| AC-022 | R-061, R-062 | — | — |
| AC-023 | R-032 | — | US-030 |
| AC-024 | R-016 | — | US-032 |