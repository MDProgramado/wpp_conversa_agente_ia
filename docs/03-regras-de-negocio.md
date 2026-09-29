# 03 — Regras de Negócio

> Consolidação de todas as regras de negócio do sistema em um único documento operacional.
> Cada regra é rastreável a um requisito funcional (R-XXX) e/ou anti-requisito (AR-XXX).

---

## 1. Regras de abordagem e primeiro contato

| ID | Regra | Requisito |
|---|---|---|
| **RN-001** | A primeira mensagem é **sempre enviada manualmente** pelo Admin. O sistema nunca inicia a conversa. | R-001 |
| **RN-002** | O bot assume a conversa **imediatamente** após o envio da primeira mensagem, mesmo sem resposta do lead. | R-002 |
| **RN-003** | A automação não deve abordar lead sem que a origem, base legal e finalidade estejam registradas. | R-064, AR-011 |
| **RN-004** | O sistema não deduplica leads automaticamente. O Admin decide qual abordar, com base em sinalizações de duplicidade. | R-020 |
| **RN-005** | Leads já abordados por outros meios (ex.: prospecção manual da equipe) devem ser sinalizados, mas não bloqueados automaticamente. | R-050 |

---

## 2. Regras de janela e limites

| ID | Regra | Requisito |
|---|---|---|
| **RN-006** | A automação opera apenas em **dias úteis, das 7h às 17h**. | R-006 |
| **RN-007** | Fora da janela, nenhuma mensagem automática é enviada. | R-006 |
| **RN-008** | Se o lead responder fora da janela, o bot **não responde automaticamente**. Apenas notifica o Admin e aguarda decisão manual. | R-058 |
| **RN-009** | Follow-ups agendados para fora da janela são **enfileirados** e enviados **ao abrir o app**, mesmo fora da janela. | R-007 |
| **RN-010** | O limite diário é de **até 20 leads abordados** e **20–30 mensagens enviadas** no número dedicado. | R-023 |
| **RN-011** | Ao atingir o limite diário, o sistema para de enviar e enfileira o restante para o próximo dia útil. | R-023, AR-008 |
| **RN-012** | O limite pode ser ajustado manualmente pelo Admin, mas nunca ultrapassado sem confirmação explícita. | R-023 |
| **RN-013** | Respostas a mensagens recebidas **não contam** para o limite diário de mensagens proativas (a definir com mais precisão na implementação). | R-023 |
| **RN-014** | O contador diário é reiniciado à 00:00 do próximo dia útil. | R-023 |

---

## 3. Regras de follow-up

| ID | Regra | Requisito |
|---|---|---|
| **RN-015** | A cadência de follow-up é **1h → 1d → 3d → 7d**. | R-004 |
| **RN-016** | O máximo é de **4 tentativas**. Após o follow-up de 7d sem resposta, a cadência é encerrada. | R-005 |
| **RN-017** | O follow-up de 15 dias **não** deve ser executado. | R-005 |
| **RN-018** | A cadência é **interrompida imediatamente** se o lead responder, pedir opt-out, houver handoff ou pausa manual. | R-004 |
| **RN-019** | As mensagens de follow-up devem ser **variadas** — nunca repetir o mesmo texto. | R-067 |
| **RN-020** | Follow-ups vencidos ao abrir o app devem ser enviados com **delays humanizados** para evitar rajada. | R-007, R-067 |
| **RN-021** | Após o encerramento da cadência sem resposta, o lead é marcado como **PERDIDO**. | R-005 |
| **RN-022** | O lead pode ser reativado manualmente pelo Admin, voltando ao status NOVO. | R-021 |

---

## 4. Regras de condução da conversa

| ID | Regra | Requisito |
|---|---|---|
| **RN-023** | A IA deve conduzir a conversa em **tom consultivo, educado e direto**. | R-010 |
| **RN-024** | A IA deve priorizar **entender a dor** do lead antes de ofertar. | R-010 |
| **RN-025** | A IA **não deve seguir script rígido** — a condução é dinâmica e adaptativa. | R-011 |
| **RN-026** | A IA **não deve fazer muitas perguntas seguidas** — a conversa deve fluir como uma conversa humana. | R-011 |
| **RN-027** | A IA deve **quebrar mensagens longas** em várias mensagens curtas. | R-067 |
| **RN-028** | A IA deve **simular digitação** antes de enviar. | R-067 |
| **RN-029** | A IA deve aplicar **delays aleatórios** entre mensagens (3–12 segundos). | R-067 |
| **RN-030** | A IA **não deve se identificar como IA, bot ou assistente virtual** espontaneamente. | R-055, AR-006 |
| **RN-031** | Se o lead perguntar diretamente se é bot, a IA deve ficar em **silêncio total** e acionar handoff. | R-056, R-057 |
| **RN-032** | A IA deve **evitar emojis em excesso** (máx. 1–2 por conversa). | R-067 |

---

## 5. Regras de qualificação

| ID | Regra | Requisito |
|---|---|---|
| **RN-033** | Um lead só é considerado **QUALIFICADO** quando tiver **verba/interesse em investir** E **poder de decisão**. | R-051 |
| **RN-034** | A validação de verba/decisão é **híbrida**: indireta por contexto → pergunta direta educada, se necessário. | R-052 |
| **RN-035** | A IA **não deve perguntar valor exato** de verba. | R-052 |
| **RN-036** | A IA **não deve transformar a qualificação em interrogatório**. | R-011, R-052 |
| **RN-037** | Se um dos critérios não for identificado, o lead **não é qualificado** e continua em aquecimento. | R-051 |
| **RN-038** | Leads desqualificados devem ser encerrados com educação, sem insistência. | R-041 |

---

## 6. Regras de objeções

| ID | Regra | Requisito |
|---|---|---|
| **RN-039** | A IA pode contornar objeções comuns (preço, tempo, fornecedor, "vou pensar") autonomamente. | R-041, R-042 |
| **RN-040** | A IA **nunca** deve tratar pedido de preço como objeção comum. | R-012, AR-012 |
| **RN-041** | Pedido de preço/proposta/orçamento aciona **handoff imediato**. | R-012 |
| **RN-042** | A IA **não deve** negociar valores, prometer prazos, oferecer descontos ou enviar proposta. | AR-001, AR-002 |
| **RN-043** | Se a objeção persistir, a IA aciona handoff. | R-041 |
| **RN-044** | A IA **nunca** deve usar argumentos que prometam resultado não verificável. | R-042 |

---

## 7. Regras de handoff humano

| ID | Regra | Requisito |
|---|---|---|
| **RN-045** | Handoff é acionado quando o lead pede **preço/proposta/orçamento**. | R-012 |
| **RN-046** | Handoff é acionado quando o lead demonstra **intenção de agendar** reunião/chamada. | R-012 |
| **RN-047** | Handoff é acionado quando o lead pergunta se é **bot/robô/IA**. | R-056 |
| **RN-048** | Handoff é acionado quando o lead demonstra **irritação** ou **ameaça de denúncia/bloqueio**. | R-065, R-066 |
| **RN-049** | Handoff é acionado quando o lead pede **opt-out**. | R-024 |
| **RN-050** | Handoff é acionado quando o lead envia **mídia** (áudio, imagem, PDF, vídeo). | R-038 |
| **RN-051** | Handoff é acionado quando há **dúvida técnica complexa**. | R-065 |
| **RN-052** | Após o handoff, a automação é **pausada** para aquele lead. | R-014, AR-010 |
| **RN-053** | Em casos de **suspeita de bot**, **irritação** e **ameaça**, a IA fica em **silêncio total** até o Admin assumir. | R-057, R-066 |
| **RN-054** | Após o Admin assumir, o bot entra em **modo copiloto** — sugere respostas, nunca envia sozinho. | R-014 |
| **RN-055** | O Admin tem **total autonomia** para aceitar, editar, ignorar ou enviar as sugestões. | R-014 |
| **RN-056** | O bot só volta ao modo automático quando o Admin **devolver explicitamente**. | R-014, R-034 |

---

## 8. Regras de agendamento

| ID | Regra | Requisito |
|---|---|---|
| **RN-057** | O bot **nunca** sugere horário, data ou agendamento. | AR-003 |
| **RN-058** | O agendamento é **sempre manual**, feito pelo Admin. | R-025 |
| **RN-059** | Após o Admin registrar o agendamento, o bot pode enviar **confirmação** e **lembrete**. | R-026 |
| **RN-060** | A confirmação/lembrete deve conter data, hora e canal. | R-026 |
| **RN-061** | O lead pode confirmar, remarcar ou cancelar via resposta. | R-026 |
| **RN-062** | Remarcações acionam handoff para o Admin confirmar novo horário. | R-026, AR-003 |

---

## 9. Regras de opt-out e LGPD

| ID | Regra | Requisito |
|---|---|---|
| **RN-063** | Pedido de opt-out é **detectado automaticamente** e interrompe toda automação. | R-024 |
| **RN-064** | O lead com opt-out é marcado como **"NÃO CONTATAR"**. | R-024 |
| **RN-065** | A IA **nunca** deve tentar reverter um pedido de opt-out. | AR-005 |
| **RN-066** | Data, hora e conteúdo do pedido de opt-out devem ser **registrados**. | R-024 |
| **RN-067** | Dados de lead com opt-out são mantidos apenas pelo **tempo mínimo legal** e depois excluídos. | R-024 |
| **RN-068** | A base legal padrão é **legítimo interesse**, com finalidade **contato comercial B2B**. | R-064 |
| **RN-069** | Origem, base legal e finalidade devem ser registradas em **todo** lead. | R-064, AR-011 |
| **RN-070** | O sistema deve ter **comando manual** para marcar opt-out e excluir dados. | R-024 |
| **RN-071** | O Admin deve poder **excluir dados** de um lead mediante solicitação. | R-024 |
| **RN-072** | Nenhuma mensagem pode ser enviada a lead sem base legal registrada. | R-064, AR-011 |

---

## 10. Regras de mídia

| ID | Regra | Requisito |
|---|---|---|
| **RN-073** | O bot **nunca** envia mídia (imagem, PDF, áudio, vídeo, documento). Apenas texto e links. | R-037, AR-004 |
| **RN-074** | Portfólio, proposta e arquivos são enviados **manualmente** pelo Admin. | R-037 |
| **RN-075** | O bot **não processa** mídia recebida — apenas registra, notifica e aciona handoff. | R-038, AR-009 |
| **RN-076** | O bot **não finge** que entendeu mídia recebida. | R-038 |
| **RN-077** | A conversa fica **pausada** até o Admin assumir após mídia recebida. | R-038 |

---

## 11. Regras de status e pipeline

| ID | Regra | Requisito |
|---|---|---|
| **RN-078** | O pipeline tem 9 status: NOVO, CONTATADO, RESPONDEU, QUALIFICADO, AQUECIDO, REUNIÃO AGENDADA, PROPOSTA, FECHADO, PERDIDO. | R-021 |
| **RN-079** | Cada lead está em **um único status** por vez. | R-021 |
| **RN-080** | A IA atualiza o status **automaticamente** com base na conversa. | R-022 |
| **RN-081** | Toda transição de status é **auditável** com timestamp e motivo. | R-022 |
| **RN-082** | Status críticos (REUNIÃO AGENDADA, PROPOSTA, FECHADO, PERDIDO) registram **justificativa**. | R-022 |
| **RN-083** | O Admin pode **corrigir manualmente** o status a qualquer momento. | R-022 |
| **RN-084** | "PERDIDO" deve exigir ou sugerir um **motivo**. | R-021 |
| **RN-085** | Lead PERDIDO pode ser reativado manualmente para NOVO. | R-021 |

---

## 12. Regras de notificação e falhas

| ID | Regra | Requisito |
|---|---|---|
| **RN-086** | Handoff é notificado localmente com **som + pop-up**. | R-013 |
| **RN-087** | Falhas críticas são notificadas localmente com **som + pop-up**. | R-045 |
| **RN-088** | Falhas críticas incluem: WhatsApp desconectado, API de IA fora, PostgreSQL parado, banimento, erro repetido de envio. | R-045 |
| **RN-089** | Logs devem conter timestamp, severidade, módulo, mensagem e contexto. | R-045 |
| **RN-090** | Handoffs de suspeita de bot, irritação e ameaça têm **prioridade máxima**. | R-056, R-057, R-065, R-066 |

---

## 13. Regras de humanização

| ID | Regra | Requisito |
|---|---|---|
| **RN-091** | Delays entre mensagens: **3 a 12 segundos**, aleatórios. | R-067 |
| **RN-092** | Simulação de digitação proporcional ao tamanho do texto. | R-067 |
| **RN-093** | Quebra de mensagens longas em 2–3 mensagens curtas. | R-067 |
| **RN-094** | Mensagens de handoff e notificações **não** seguem humanização. | R-067 |
| **RN-095** | Humanização deve ser **ajustável** pelo Admin. | R-067 |

---

## 14. Regras de aquecimento

| ID | Regra | Requisito |
|---|---|---|
| **RN-096** | O sistema **sugere** uma estratégia de aquecimento em 5 fases. | R-039 |
| **RN-097** | O sistema **não bloqueia automaticamente** o volume. | R-040 |
| **RN-098** | O Admin controla o volume manualmente. | R-040 |
| **RN-099** | O sistema **alerta** quando o volume sugerido é ultrapassado. | R-039 |
| **RN-100** | Bloqueios e denúncias devem ser registrados e considerados para pausa. | R-045 |

---

## 15. Regras de backup e persistência

| ID | Regra | Requisito |
|---|---|---|
| **RN-101** | O backup é **manual**, acionado pelo Admin. | R-032 |
| **RN-102** | O backup é **versionado** por data/hora. | R-032 |
| **RN-103** | O backup inclui **banco** e **sessão do WhatsApp**. | R-032 |
| **RN-104** | O backup é salvo em **pasta local** escolhida pelo Admin. | R-032 |
| **RN-105** | A restauração substitui o banco atual — backup prévio é recomendado. | R-032 |
| **RN-106** | Não há criptografia adicional nos dados locais (risco assumido). | R-033 |

---

## 16. Regras de escopo do MVP

| ID | Regra | Requisito |
|---|---|---|
| **RN-107** | O MVP inclui: importação, 1ª mensagem manual, bot assumindo, IA respondendo, follow-up, handoff, notificação, CRM básico/intermediário. | R-060 |
| **RN-108** | Fora do MVP: relatórios avançados, financeiro completo, multiusuário ativo, aquecimento controlado, painel completo. | R-060 |
| **RN-109** | O piloto é considerado bem-sucedido com **5 reuniões agendadas/mês** E **30% de qualificação/mês**. | R-061 |
| **RN-110** | A apuração é **mensal**. | R-062 |

---

## 17. Mapa de rastreabilidade

| Grupo de regras | Requisitos cobertos | Anti-requisitos cobertos |
|---|---|---|
| Abordagem e 1º contato | R-001, R-002, R-020, R-050, R-064 | AR-011 |
| Janela e limites | R-006, R-007, R-023, R-058 | AR-007, AR-008 |
| Follow-up | R-004, R-005, R-007, R-067 | — |
| Condução | R-010, R-011, R-055, R-056, R-057, R-067 | AR-006 |
| Qualificação | R-011, R-051, R-052 | — |
| Objeções | R-012, R-041, R-042 | AR-001, AR-002, AR-012 |
| Handoff | R-012, R-014, R-024, R-038, R-056, R-057, R-065, R-066 | AR-010 |
| Agendamento | R-025, R-026 | AR-003 |
| Opt-out e LGPD | R-024, R-064 | AR-005, AR-011 |
| Mídia | R-037, R-038 | AR-004, AR-009 |
| Status e pipeline | R-021, R-022 | — |
| Notificação e falhas | R-013, R-045, R-056, R-057, R-065, R-066 | — |
| Humanização | R-067 | — |
| Aquecimento | R-039, R-040, R-045 | — |
| Backup e persistência | R-032, R-033 | — |
| MVP | R-060, R-061, R-062 | — |