# Canal de Atendimento ao Titular

**Projeto:** Automação Local de WhatsApp para Prospecção B2B

## Recebimento de Requisições
O próprio canal de WhatsApp utilizado para a prospecção atua como interface primária para solicitações relacionadas à LGPD. 

Quando um lead exercer seus direitos previstos no Art. 18 da LGPD (ex: perguntar "onde conseguiram meu número?", "por favor, apague meus dados", etc.), o sistema de IA acionará o **Handoff Humano** imediato.

## Procedimentos de Resposta

1. **Informação sobre Origem (R-064):**
   O operador humano deverá consultar no painel local a origem da captação do lead e informar ao titular, bem como reforçar a base legal do Legítimo Interesse.

2. **Revogação/Opt-out (R-024):**
   Se o titular solicitar que não se entre mais em contato, o sistema aciona o bloqueio permanente (`opt_out = true`). Nenhuma automação poderá contornar esta trava (anti-requisito).

3. **Confirmação:**
   Toda ação de eliminação ou bloqueio deve ser prontamente confirmada ao titular no próprio chat.
