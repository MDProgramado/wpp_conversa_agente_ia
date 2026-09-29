# 02 — Requisitos Não Funcionais

> Consolidação dos requisitos não funcionais: sistema operacional, persistência, logs, backup, criptografia, desempenho, usabilidade, portabilidade e restrições técnicas.
> Cada requisito é rastreável a um R-XXX.

---

## 1. Sistema Operacional e Ambiente

| ID | Requisito | Valor | R-XXX |
|---|---|---|---|
| **RNF-001** | Sistema operacional alvo | Windows 10/11 (64 bits) | R-047 |
| **RNF-002** | Runtime | Node.js 20+ | — |
| **RNF-003** | Linguagem principal | TypeScript | — |
| **RNF-004** | Banco de dados | PostgreSQL 15+ local | R-031 |
| **RNF-005** | Interface | Electron, Tauri ou Web local (a definir) | R-046 |
| **RNF-006** | Notificações | Nativas do Windows (som + pop-up) | R-013, R-045 |
| **RNF-007** | Inicialização | Manual ou com o Windows (a definir) | R-047 |
| **RNF-008** | Sem servidor externo | Tudo roda localmente | R-031 |
| **RNF-009** | Sem dependência de cloud para operação | Apenas APIs externas (caça-leads e LLM) | R-044 |

---

## 2. Persistência de Dados

| ID | Requisito | Valor | R-XXX |
|---|---|---|---|
| **RNF-010** | Banco de dados | PostgreSQL local | R-031 |
| **RNF-011** | Schema versionado | Migrações automatizadas | R-031 |
| **RNF-012** | Dados persistidos | Leads, conversas, mensagens, status, notas, tarefas, tags, logs, opt-out, follow-ups, backups | R-031 |
| **RNF-013** | Integridade referencial | Foreign keys ativas | R-031 |
| **RNF-014** | Índices | Telefone, status, opt-out, timestamps | R-031 |
| **RNF-015** | Retenção de dados | Definida por política de LGPD (a detalhar) | R-024 |
| **RNF-016** | Exclusão de dados | Comando manual + política de retenção | R-024 |
| **RNF-017** | Sem criptografia em repouso | Risco assumido pelo Admin | R-033 |
| **RNF-018** | Sem criptografia de campos sensíveis | Risco assumido pelo Admin | R-033 |
| **RNF-019** | Sem criptografia de backup | Risco assumido pelo Admin | R-033 |

---

## 3. Backup e Recuperação

| ID | Requisito | Valor | R-XXX |
|---|---|---|---|
| **RNF-020** | Tipo de backup | Manual, acionado pelo Admin | R-032 |
| **RNF-021** | Frequência | Sob demanda | R-032 |
| **RNF-022** | Versionamento | Por data/hora | R-032 |
| **RNF-023** | Conteúdo do backup | Banco + sessão do WhatsApp + configurações | R-032 |
| **RNF-024** | Destino | Pasta local escolhida pelo Admin | R-032 |
| **RNF-025** | Restauração | Substitui banco atual, com confirmação | R-032 |
| **RNF-026** | Alerta de backup antigo | Opcional (a definir) | R-032 |
| **RNF-027** | Sem backup automático | Responsabilidade do Admin | R-032 |
| **RNF-028** | Sem backup em nuvem | Apenas local | R-032 |

---

## 4. Logs e Auditoria

| ID | Requisito | Valor | R-XXX |
|---|---|---|---|
| **RNF-029** | Logs detalhados | Arquivo local + painel | R-045 |
| **RNF-030** | Campos de log | Timestamp, severidade, módulo, mensagem, contexto, lead_id | R-045 |
| **RNF-031** | Níveis de log | INFO, WARN, ERROR, CRITICAL | R-045 |
| **RNF-032** | Rotação de logs | A definir (evitar ocupar disco) | R-045 |
| **RNF-033** | Retenção de logs | A definir | R-045 |
| **RNF-034** | Auditoria de status | Toda transição registrada | R-022 |
| **RNF-035** | Auditoria de ações | Toda ação registrada com timestamp | R-022, R-029 |
| **RNF-036** | Auditoria de opt-out | Data, hora e conteúdo registrados | R-024 |
| **RNF-037** | Auditoria de exclusão | Registro de exclusão de dados | R-024 |

---

## 5. Desempenho

| ID | Requisito | Valor | R-XXX |
|---|---|---|---|
| **RNF-038** | Baixo consumo de recursos | Roda em background sem travar o PC | R-047 |
| **RNF-039** | Tempo de resposta da IA | Aceitável para conversa em tempo real (a definir, ex.: < 5s) | R-009 |
| **RNF-040** | Tempo de resposta do painel | < 1s para ações comuns | R-046 |
| **RNF-041** | Suporte a volume | Até 20 leads/dia, 20–30 mensagens/dia | R-023 |
| **RNF-042** | Suporte a histórico | Mínimo de 6 meses de conversas (a definir) | R-031 |
| **RNF-043** | Reconexão automática | Backoff exponencial em caso de queda | R-045 |
| **RNF-044** | Fila de mensagens | Suporta acúmulo de follow-ups vencidos | R-007 |
| **RNF-045** | Delays humanizados | 3–12 segundos entre mensagens | R-067 |

---

## 6. Usabilidade

| ID | Requisito | Valor | R-XXX |
|---|---|---|---|
| **RNF-046** | Painel dividido | Lista + chat + sugestões + histórico + ações | R-046 |
| **RNF-047** | Indicador de modo | Bot, copiloto, pausado, silêncio — em tempo real | R-046 |
| **RNF-048** | Notificação local | Som + pop-up para handoff e falhas críticas | R-013, R-045 |
| **RNF-049** | Ações rápidas | Pausar, assumir, devolver, copiloto, nota, tarefa | R-046 |
| **RNF-050** | Busca | Por nome, telefone, endereço, conteúdo | R-043 |
| **RNF-051** | Filtros | Status, tag, nicho, região, data, responsável, número | R-043 |
| **RNF-052** | Atalhos de teclado | A definir (assumir, pausar, aceitar sugestão) | R-046 |
| **RNF-053** | Tema | Claro/escuro, padrão escuro | R-046 |
| **RNF-054** | Fonte | Sans-serif, mínimo 14px | R-046 |
| **RNF-055** | Responsividade | Otimizado para desktop (Windows) | R-047 |
| **RNF-056** | Exportação | CSV/Excel para leads e relatórios | R-035 |

---

## 7. Segurança

| ID | Requisito | Valor | R-XXX |
|---|---|---|---|
| **RNF-057** | Controle de acesso | Depende do SO (login do Windows) | R-033 |
| **RNF-058** | Sem autenticação local | Single-user na fase piloto | R-027 |
| **RNF-059** | Sem criptografia de sessão | Risco assumido | R-033 |
| **RNF-060** | Sem criptografia de banco | Risco assumido | R-033 |
| **RNF-061** | Sem criptografia de backup | Risco assumido | R-033 |
| **RNF-062** | Minimização de dados na API de IA | Mascarar dados sensíveis antes do envio | R-009 |
| **RNF-063** | Logs sem dados sensíveis | Evitar telefone completo, endereço completo | R-045 |
| **RNF-064** | Proteção contra acesso indevido | Responsabilidade do Admin (SO) | R-033 |
| **RNF-065** | Sessão do WhatsApp | Armazenada localmente, sem proteção extra | R-033 |

---

## 8. Portabilidade

| ID | Requisito | Valor | R-XXX |
|---|---|---|---|
| **RNF-066** | SO principal | Windows | R-047 |
| **RNF-067** | Portabilidade para Linux/macOS | Não prioritária nesta fase | R-047 |
| **RNF-068** | Adapter de canal | Isolado, permite troca sem refatoração | R-016 |
| **RNF-069** | Adapter de IA | Isolado, permite troca de provedor | R-009 |
| **RNF-070** | Migração para API oficial | Sem quebra de histórico, status ou agendamentos | R-016 |
| **RNF-071** | Preparação para multiusuário | Campos e arquitetura preparados | R-028 |
| **RNF-072** | Preparação para múltiplos números | Arquitetura preparada (não ativa) | R-059 |

---

## 9. Manutenibilidade

| ID | Requisito | Valor | R-XXX |
|---|---|---|---|
| **RNF-073** | Código modular | Camadas isoladas (canal, IA, CRM, gate) | R-016 |
| **RNF-074** | Testes automatizados | Property tests para os 12 AR | AR-001 a AR-012 |
| **RNF-075** | Testes E2E | Fluxo completo: ingestão → abordagem → handoff | R-060 |
| **RNF-076** | Documentação | `docs/` com especificação completa | — |
| **RNF-077** | ADRs | Decisões técnicas documentadas | — |
| **RNF-078** | Versionamento | Git | — |
| **RNF-079** | Migrações de banco | Scripts versionados | R-031 |
| **RNF-080** | Configuração externa | Variáveis de ambiente + settings | — |

---

## 10. Confiabilidade

| ID | Requisito | Valor | R-XXX |
|---|---|---|---|
| **RNF-081** | Reconexão automática | WhatsApp e API de IA | R-045 |
| **RNF-082** | Tratamento de falhas | Log + notificação + fallback | R-045 |
| **RNF-083** | Fila persistente | Follow-ups não se perdem se o app fechar | R-007 |
| **RNF-084** | Recuperação de sessão | Restaurar sessão do WhatsApp | R-032 |
| **RNF-085** | Integridade de dados | Transações no PostgreSQL | R-031 |
| **RNF-086** | Idempotência | Evitar envio duplicado em caso de retry | R-023 |
| **RNF-087** | Falha segura (fail-closed) | Se o gate não puder validar, não envia | AR-001 a AR-012 |

---

## 11. Compliance e Privacidade

| ID | Requisito | Valor | R-XXX |
|---|---|---|---|
| **RNF-088** | Base legal | Legítimo interesse | R-064 |
| **RNF-089** | Finalidade | Contato comercial B2B | R-064 |
| **RNF-090** | Transparência | Mencionar origem do contato, se aplicável | R-064 |
| **RNF-091** | Opt-out | Detecção automática + comando manual | R-024 |
| **RNF-092** | Retenção | Definida por política (a detalhar) | R-024 |
| **RNF-093** | Exclusão | Comando manual + política | R-024 |
| **RNF-094** | Avaliação de legítimo interesse | Documentada (simplificada) | R-064 |
| **RNF-095** | Registro de origem | Toda importação registra parâmetros | R-064 |
| **RNF-096** | Sem opt-in explícito | Risco assumido e documentado | R-063 |
| **RNF-097** | Minimização de dados | Apenas o necessário para o contato | R-009 |
| **RNF-098** | Sem compartilhamento com terceiros | Exceto API de LLM (com minimização) | R-044 |

---

## 12. Restrições Técnicas

| ID | Restrição | Valor | R-XXX |
|---|---|---|---|
| **RNF-099** | Sem envio de mídia pelo bot | Apenas texto e links | R-037 |
| **RNF-100** | Sem processamento de mídia recebida | Apenas registra e aciona handoff | R-038 |
| **RNF-101** | Sem agendamento automático | Sempre manual | R-025 |
| **RNF-102** | Sem negociação de preço | Sempre handoff | R-012 |
| **RNF-103** | Sem revelação de automação | Silêncio total se perguntado | R-055, R-057 |
| **RNF-104** | Sem resposta fora da janela | Dias úteis, 7h–17h | R-006 |
| **RNF-105** | Sem ultrapassar limite diário | 20–30 mensagens | R-023 |
| **RNF-106** | Sem múltiplos números | Um número dedicado | R-059 |
| **RNF-107** | Sem integrações externas além das essenciais | Caça-leads + LLM + WhatsApp | R-044 |
| **RNF-108** | Sem criptografia local | Risco assumido | R-033 |
| **RNF-109** | Sem servidor externo | Tudo local | R-031 |

---

## 13. Matriz de rastreabilidade (RNF → R)

| RNF | R-XXX relacionado |
|---|---|
| RNF-001 a RNF-009 | R-047, R-046, R-031, R-044 |
| RNF-010 a RNF-019 | R-031, R-024, R-033 |
| RNF-020 a RNF-028 | R-032 |
| RNF-029 a RNF-037 | R-045, R-022, R-029, R-024 |
| RNF-038 a RNF-045 | R-047, R-009, R-046, R-023, R-031, R-007, R-067 |
| RNF-046 a RNF-056 | R-046, R-013, R-045, R-043, R-035, R-047 |
| RNF-057 a RNF-065 | R-033, R-027, R-009, R-045 |
| RNF-066 a RNF-072 | R-047, R-016, R-009, R-028, R-059 |
| RNF-073 a RNF-080 | R-016, AR-001 a AR-012, R-060, R-031 |
| RNF-081 a RNF-087 | R-045, R-007, R-032, R-031, R-023, AR-001 a AR-012 |
| RNF-088 a RNF-098 | R-064, R-024, R-063, R-009, R-044 |
| RNF-099 a RNF-109 | R-037, R-038, R-025, R-012, R-055, R-057, R-006, R-023, R-059, R-044, R-033, R-031 |

---

## 14. Resumo executivo

| Categoria | Qtd. de RNFs | Status |
|---|---|---|
| Sistema operacional e ambiente | 9 | Definido |
| Persistência | 10 | Definido |
| Backup | 9 | Definido |
| Logs e auditoria | 9 | Definido |
| Desempenho | 8 | Parcialmente definido |
| Usabilidade | 11 | Definido |
| Segurança | 9 | Definido (risco assumido) |
| Portabilidade | 7 | Definido |
| Manutenibilidade | 8 | Definido |
| Confiabilidade | 7 | Definido |
| Compliance e privacidade | 11 | Parcialmente definido |
| Restrições técnicas | 11 | Definido |
| **Total** | **109** | — |

---

## 15. Pendências

| ID | Pendência | Impacto |
|---|---|---|
| PD-001 | Definir tempo de resposta aceitável da IA | RNF-039 |
| PD-002 | Definir política de rotação de logs | RNF-032 |
| PD-003 | Definir retenção de logs | RNF-033 |
| PD-004 | Definir retenção de dados de leads | RNF-015, RNF-092 |
| PD-005 | Definir UI (Electron, Tauri ou Web local) | RNF-005 |
| PD-006 | Definir se o app inicia com o Windows | RNF-007 |
| PD-007 | Definir atalhos de teclado | RNF-052 |
| PD-008 | Definir tempo de suporte a histórico | RNF-042 |
| PD-009 | Definir alerta de backup antigo | RNF-026 |
| PD-010 | Validar LGPD com advogado | RNF-088 a RNF-098 |