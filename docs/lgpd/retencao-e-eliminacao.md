# Política de Retenção e Eliminação de Dados

**Projeto:** Automação Local de WhatsApp para Prospecção B2B

## Retenção

- **Dados de Contato (Leads):** Mantidos enquanto houver potencial comercial ativo ou contrato firmado. 
- **Histórico de Conversas (Mensagens):** Armazenado imutavelmente no PostgreSQL (`messages`) para fins de auditoria, treinamento e comprovação legal, durante o prazo prescricional para exercício regular de direitos (Art. 7º, VI da LGPD) que normalmente corresponde a 5 anos (Código de Defesa do Consumidor / Responsabilidade Civil).
- **Logs do Sistema:** Retidos temporariamente via rotatividade (`pino-roll`), voltados exclusivamente à resolução de incidentes técnicos.

## Eliminação

- **Pedidos de Opt-Out / Eliminação:** 
  Caso o titular solicite a eliminação, a chave primária de contato do lead e seu nome serão anonimizados ou deletados fisicamente do banco de dados (tabela `leads`), exceto nos casos em que a retenção for obrigatória para o cumprimento de obrigação legal ou regulatória pelo controlador (Art. 16, I da LGPD).
  
- O bloqueio de envio de mensagens (opt-out) entra em vigor de imediato, travando no banco de dados a flag `opt_out = true`.
