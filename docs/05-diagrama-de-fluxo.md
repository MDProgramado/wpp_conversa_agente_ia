# 05 — Diagrama de Fluxo Completo

> Fluxo macro do sistema, estados do lead, transições, pontos de handoff e gatilhos.
> Este documento é a referência visual e lógica para implementação e testes.

---

## 1. Visão Macro do Fluxo

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         SISTEMA DE CAÇA-LEADS                           │
│  (API externa — parâmetros: estado, cidade, região, nicho, nome-chave)  │
│  Retorna: nome, telefone, endereço (apenas números com WhatsApp ativo)  │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    IMPORTAÇÃO E REGISTRO DO LEAD                        │
│  • Origem registrada (R-064)                                            │
│  • Base legal: legítimo interesse (R-064)                               │
│  • Finalidade: contato comercial B2B (R-064)                            │
│  • Duplicidade sinalizada (R-020)                                       │
│  • Status inicial: NOVO (R-021)                                         │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    VOCÊ SELECIONA E ABORDA MANUALMENTE                  │
│  • Você clica "Abordar no WhatsApp"                                     │
│  • Você envia a 1ª mensagem manualmente (R-001)                         │
│  • Status muda para: CONTATADO (R-021)                                  │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    BOT ASSUME IMEDIATAMENTE (R-002)                     │
│  • Modo: AUTOMÁTICO TOTAL (R-034)                                       │
│  • Aguarda resposta do lead                                             │
│  • Se não responder: agenda follow-up 1h → 1d → 3d → 7d (R-004)        │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    ▼                         ▼
        ┌───────────────────┐     ┌───────────────────────┐
        │  LEAD RESPONDEU   │     │  LEAD NÃO RESPONDEU   │
        │  Status: RESPONDEU│     │  Follow-up agendado   │
        └─────────┬─────────┘     └───────────┬───────────┘
                  │                           │
                  ▼                           ▼
        ┌───────────────────┐     ┌───────────────────────┐
        │  IA CONDUZ        │     │  FOLLOW-UP 1h         │
        │  CONVERSA (R-008) │     │  Status: CONTATADO    │
        │  Tom consultivo   │     └───────────┬───────────┘
        │  (R-010, R-011)   │                 │
        └─────────┬─────────┘                 ▼
                  │               ┌───────────────────────┐
                  │               │  FOLLOW-UP 1d         │
                  │               └───────────┬───────────┘
                  │                           │
                  │                           ▼
                  │               ┌───────────────────────┐
                  │               │  FOLLOW-UP 3d         │
                  │               └───────────┬───────────┘
                  │                           │
                  │                           ▼
                  │               ┌───────────────────────┐
                  │               │  FOLLOW-UP 7d         │
                  │               │  Última tentativa     │
                  │               └───────────┬───────────┘
                  │                           │
                  │                           ▼
                  │               ┌───────────────────────┐
                  │               │  SEM RESPOSTA         │
                  │               │  Encerra (R-005)      │
                  │               │  Status: PERDIDO      │
                  │               └───────────────────────┘
                  │
                  ▼
        ┌─────────────────────────────────────────────────────────┐
        │              IA CONDUZ E QUALIFICA (R-051)              │
        │  • Verba/interesse em investir                          │
        │  • Poder de decisão                                     │
        │  • Contorna objeções comuns (R-041, R-042)              │
        │  • Atualiza status automaticamente (R-022)              │
        │  • Status: QUALIFICADO / AQUECIDO                       │
        └────────────────────────┬────────────────────────────────┘
                                 │
        ┌────────────────────────┼────────────────────────┬──────────────┐
        ▼                        ▼                        ▼              ▼
┌───────────────┐   ┌──────────────────┐   ┌────────────────┐  ┌──────────────┐
│  PEDIU PREÇO  │   │  QUER AGENDAR    │   │  IRRITAÇÃO/    │  │  DÚVIDA      │
│  / PROPOSTA   │   │  REUNIÃO/CHAMADA │   │  AMEAÇA        │  │  TÉCNICA     │
│  (R-012)      │   │  (R-012)         │   │  (R-065, R-066)│  │  (R-065)     │
└───────┬───────┘   └────────┬─────────┘   └───────┬────────┘  └──────┬───────┘
        │                    │                     │                  │
        │                    │                     │                  │
        └────────────────────┴─────────────────────┴──────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    HANDOFF HUMANO ACIONADO (R-012, R-065)               │
│  • Automação pausada para aquele lead                                   │
│  • Notificação local: som + pop-up (R-013)                              │
│  • Silêncio total em: suspeita de bot (R-057), irritação/ameaça (R-066) │
│  • Sem mensagem até você assumir (AR-010)                               │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    VOCÊ ASSUME A CONVERSA                               │
│  • Bot entra em MODO COPILOTO (R-014)                                   │
│  • Bot sugere respostas, mas NUNCA envia sozinho (AR-010)               │
│  • Você tem total autonomia                                             │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    ▼                         ▼
        ┌───────────────────┐     ┌───────────────────────┐
        │  VOCÊ AGENDA      │     │  VOCÊ NEGOCIA /       │
        │  MANUALMENTE      │     │  RESPONDE             │
        │  (R-025)          │     │                       │
        └─────────┬─────────┘     └───────────┬───────────┘
                  │                           │
                  ▼                           ▼
        ┌───────────────────┐     ┌───────────────────────┐
        │  BOT ENVIA        │     │  CONVERSA CONTINUA    │
        │  CONFIRMAÇÃO +    │     │  Status atualizado    │
        │  LEMBRETE (R-026) │     │  pela IA (R-022)      │
        └─────────┬─────────┘     └───────────────────────┘
                  │
                  ▼
        ┌───────────────────┐
        │  REUNIÃO          │
        │  REALIZADA        │
        │  Status: FECHADO  │
        │  ou PERDIDO       │
        └───────────────────┘
```

---

## 2. Estados do Lead (Pipeline)

```
┌──────┐   ┌───────────┐   ┌───────────┐   ┌─────────────┐   ┌──────────┐
│ NOVO │──▶│ CONTATADO │──▶│ RESPONDEU │──▶│ QUALIFICADO │──▶│ AQUECIDO │
└──────┘   └───────────┘   └───────────┘   └─────────────┘   └────┬─────┘
                                                                  │
                                                                  ▼
┌──────────┐   ┌──────────┐   ┌───────────────────┐   ┌──────────────────┐
│ PERDIDO  │◀──│ FECHADO  │◀──│ PROPOSTA          │◀──│ REUNIÃO AGENDADA │
└──────────┘   └──────────┘   └───────────────────┘   └──────────────────┘
```

### 2.1. Definição dos estados

| Estado | Descrição | Como entra | Como sai |
|---|---|---|---|
| **NOVO** | Lead importado, ainda não abordado | Importação via API | Você envia 1ª mensagem → CONTATADO |
| **CONTATADO** | 1ª mensagem enviada, aguardando resposta | Envio manual | Lead responde → RESPONDEU; 7d sem resposta → PERDIDO |
| **RESPONDEU** | Lead respondeu à 1ª mensagem ou follow-up | Resposta do lead | IA qualifica → QUALIFICADO |
| **QUALIFICADO** | Verba/interesse + poder de decisão identificados | IA detecta critérios (R-051) | Conversa avança → AQUECIDO; handoff → REUNIÃO AGENDADA |
| **AQUECIDO** | Lead engajado, dor clara, interesse demonstrando | IA conduz e aquece | Handoff por preço/agendamento → REUNIÃO AGENDADA |
| **REUNIÃO AGENDADA** | Você agendou manualmente (R-025) | Você registra agendamento | Reunião realizada → PROPOSTA ou FECHADO; no-show → PERDIDO |
| **PROPOSTA** | Proposta enviada (por você, manualmente) | Você registra | Lead aceita → FECHADO; recusa → PERDIDO |
| **FECHADO** | Negócio fechado | Você registra | Estado final |
| **PERDIDO** | Lead não converteu | Sem resposta, recusa, opt-out, etc. | Estado final (pode ser reativado manualmente) |

---

## 3. Transições e Gatilhos

### 3.1. Transições automáticas (IA)

| De | Para | Gatilho | Requisito |
|---|---|---|---|
| NOVO | CONTATADO | Você envia 1ª mensagem manualmente | R-001, R-021 |
| CONTATADO | RESPONDEU | Lead responde | R-022 |
| RESPONDEU | QUALIFICADO | IA identifica verba/interesse + poder de decisão | R-051, R-022 |
| QUALIFICADO | AQUECIDO | IA identifica dor clara e engajamento | R-022 |
| AQUECIDO | REUNIÃO AGENDADA | Handoff por intenção de agendamento + você registra | R-012, R-025 |
| CONTATADO | PERDIDO | 7 dias sem resposta após cadência completa | R-005 |
| QUALQUER | PERDIDO | Opt-out, recusa explícita, ameaça | R-024, R-066 |

### 3.2. Transições manuais (você)

| De | Para | Como |
|---|---|---|
| QUALQUER | QUALQUER | Você corrige o status manualmente (R-022) |
| REUNIÃO AGENDADA | FECHADO | Você registra fechamento |
| REUNIÃO AGENDADA | PROPOSTA | Você registra proposta |
| PROPOSTA | FECHADO | Você registra aceite |
| PROPOSTA | PERDIDO | Você registra recusa |
| PERDIDO | NOVO | Você reativa lead manualmente |

---

## 4. Pontos de Handoff (fronteiras do bot)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    GATILHOS DE HANDOFF HUMANO                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. PEDIDO DE PREÇO/PROPOSTA/ORÇAMENTO (R-012, AR-001, AR-002, AR-012)  │
│     → Handoff imediato                                                  │
│     → IA não informa valores                                            │
│                                                                         │
│  2. INTENÇÃO DE AGENDAMENTO (R-012, AR-003)                             │
│     → Handoff imediato                                                  │
│     → IA não sugere horários nem confirma datas                         │
│                                                                         │
│  3. SUSPEITA DE AUTOMAÇÃO (R-056, R-057, AR-006)                        │
│     → Handoff prioritário                                               │
│     → SILÊNCIO TOTAL até você assumir                                   │
│                                                                         │
│  4. IRRITAÇÃO OU AMEAÇA (R-065, R-066)                                  │
│     → Handoff prioritário                                               │
│     → SILÊNCIO TOTAL até você assumir                                   │
│                                                                         │
│  5. PEDIDO DE OPT-OUT (R-024, AR-005)                                   │
│     → Marca "não contatar"                                              │
│     → Interrompe toda automação                                         │
│     → NUNCA tenta reverter                                              │
│                                                                         │
│  6. MÍDIA RECEBIDA (R-038, AR-009)                                      │
│     → Registra e notifica                                               │
│     → NÃO processa mídia                                                │
│     → Handoff para você assumir                                         │
│                                                                         │
│  7. DÚVIDA TÉCNICA COMPLEXA (R-065)                                     │
│     → Handoff                                                           │
│     → IA não arrisca resposta incorreta                                 │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.1. Comportamento do bot em cada gatilho

| Gatilho | Bot envia mensagem? | Silêncio total? | Notificação local? | Modo após assumir |
|---|---|---|---|---|
| Preço/proposta | Não | Não (só pausa) | Sim (som + pop-up) | Copiloto |
| Agendamento | Não | Não (só pausa) | Sim (som + pop-up) | Copiloto |
| Suspeita de bot | **Não** | **Sim** | Sim (prioritário) | Copiloto |
| Irritação/ameaça | **Não** | **Sim** | Sim (prioritário) | Copiloto |
| Opt-out | **Não** | **Sim** | Sim | Encerrado |
| Mídia recebida | Não | Não (só pausa) | Sim | Copiloto |
| Dúvida técnica | Não | Não (só pausa) | Sim | Copiloto |

---

## 5. Fluxo de Follow-up (detalhado)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    LEAD NÃO RESPONDEU À 1ª MENSAGEM                     │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
                    ┌────────────────────────┐
                    │  Follow-up 1h          │
                    │  (agendado)            │
                    └───────────┬────────────┘
                                │
                    ┌───────────┴───────────┐
                    ▼                       ▼
        ┌───────────────────┐   ┌───────────────────────┐
        │  Lead respondeu   │   │  Lead não respondeu   │
        │  → RESPONDEU      │   │  → agenda 1d          │
        └───────────────────┘   └───────────┬───────────┘
                                            │
                                            ▼
                                ┌────────────────────────┐
                                │  Follow-up 1d          │
                                └───────────┬────────────┘
                                            │
                                ┌───────────┴───────────┐
                                ▼                       ▼
                    ┌───────────────────┐   ┌───────────────────────┐
                    │  Lead respondeu   │   │  Lead não respondeu   │
                    │  → RESPONDEU      │   │  → agenda 3d          │
                    └───────────────────┘   └───────────┬───────────┘
                                                        │
                                                        ▼
                                            ┌────────────────────────┐
                                            │  Follow-up 3d          │
                                            └───────────┬────────────┘
                                                        │
                                            ┌───────────┴───────────┐
                                            ▼                       ▼
                                ┌───────────────────┐   ┌───────────────────────┐
                                │  Lead respondeu   │   │  Lead não respondeu   │
                                │  → RESPONDEU      │   │  → agenda 7d          │
                                └───────────────────┘   └───────────┬───────────┘
                                                                    │
                                                                    ▼
                                                        ┌────────────────────────┐
                                                        │  Follow-up 7d          │
                                                        │  (última tentativa)    │
                                                        └───────────┬────────────┘
                                                                    │
                                                        ┌───────────┴───────────┐
                                                        ▼                       ▼
                                            ┌───────────────────┐   ┌───────────────────────┐
                                            │  Lead respondeu   │   │  Lead não respondeu   │
                                            │  → RESPONDEU      │   │  → PERDIDO (R-005)    │
                                            └───────────────────┘   └───────────────────────┘
```

**Regras:**
- Máximo 4 tentativas (R-005).
- Interrupção imediata se: lead responder, opt-out, handoff, pausa manual (R-004).
- Follow-ups fora da janela são enviados ao abrir o app (R-007).
- Delays humanizados entre mensagens (R-067).

---

## 6. Fluxo de Mídia Recebida

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    LEAD ENVIA ÁUDIO/IMAGEM/PDF/VÍDEO                    │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  BOT DETECTA MÍDIA (R-038, AR-009)                                      │
│  • NÃO transcreve                                                       │
│  • NÃO interpreta                                                       │
│  • NÃO responde                                                         │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  REGISTRA EVENTO + NOTIFICA VOCÊ + HANDOFF                              │
│  • Status da conversa: pausada                                          │
│  • Notificação local com som + pop-up                                   │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  VOCÊ ASSUME E RESPONDE MANUALMENTE                                     │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Fluxo de Opt-out

```
┌─────────────────────────────────────────────────────────────────────────┐
│  LEAD PEDE PARA NÃO RECEBER MAIS MENSAGENS                              │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  DETECÇÃO AUTOMÁTICA (R-024, AR-005)                                    │
│  • Registra data, hora e conteúdo                                       │
│  • Marca lead como "NÃO CONTATAR"                                       │
│  • Interrompe TODA automação                                            │
│  • NUNCA tenta reverter                                                 │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  POLÍTICA DE RETENÇÃO E EXCLUSÃO                                        │
│  • Dados mantidos apenas pelo tempo mínimo legal                        │
│  • Exclusão mediante solicitação (comando manual)                       │
│  • Registro da exclusão                                                 │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Fluxo de Falhas Críticas

```
┌─────────────────────────────────────────────────────────────────────────┐
│  FALHA DETECTADA                                                        │
│  • WhatsApp desconectado                                                │
│  • API de IA fora do ar                                                 │
│  • PostgreSQL parado                                                    │
│  • Erro repetido de envio                                               │
│  • Banimento do número                                                  │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  LOG DETALHADO (R-045)                                                  │
│  • Timestamp                                                           │
│  • Severidade                                                          │
│  • Módulo afetado                                                      │
│  • Mensagem                                                            │
│  • Contexto                                                            │
│  • ID do lead/conversa (se aplicável)                                  │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  NOTIFICAÇÃO LOCAL IMEDIATA (R-045)                                     │
│  • Som + pop-up                                                        │
│  • Indica módulo e ação necessária                                     │
│  • Tentativa de reconexão automática (quando aplicável)                │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 9. Modos de Operação do Bot

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    MODOS DE OPERAÇÃO                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  AUTOMÁTICO TOTAL (R-034)                                               │
│  • Após 1ª mensagem manual, bot conduz tudo                             │
│  • Só chama em handoffs                                                 │
│  • Modo padrão do sistema                                               │
│                                                                         │
│  COPILOTO (R-014)                                                       │
│  • Após handoff, quando você assume                                     │
│  • Bot sugere respostas, NUNCA envia sozinho                            │
│  • Você tem total autonomia                                             │
│                                                                         │
│  PAUSADO (manual)                                                       │
│  • Você pausa a automação para um lead específico                       │
│  • Bot não envia nada                                                   │
│  • Você pode devolver ao automático quando quiser                       │
│                                                                         │
│  SILÊNCIO TOTAL (R-057, R-066)                                          │
│  • Ativado em: suspeita de bot, irritação, ameaça                       │
│  • Bot NÃO envia NENHUMA mensagem                                       │
│  • Aguarda você assumir                                                 │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 10. Diagrama de Camadas (arquitetura lógica)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    PAINEL LOCAL (R-046)                                 │
│  Lista de leads │ Chat │ Sugestões IA │ Histórico │ Botões de ação      │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
┌────────────────────────────────┴────────────────────────────────────────┐
│                    ORQUESTRADOR / GATE DE ENVIO                         │
│  • evaluatePolicy: 12 AR como invariantes de código                     │
│  • Janela de envio (R-006)                                              │
│  • Limite diário (R-023)                                                │
│  • Fila de mensagens com delays humanizados (R-067)                     │
│  • Detecção de gatilhos de handoff (R-012, R-065)                       │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        ▼                        ▼                        ▼
┌───────────────┐   ┌───────────────────┐   ┌───────────────────────┐
│  CANAL        │   │  IA (API EXTERNA) │   │  CRM LOCAL            │
│  WhatsApp     │   │  LLM              │   │  PostgreSQL           │
│  (Baileys/    │   │  (R-009)          │   │  (R-031)              │
│  WPPConnect)  │   │                   │   │                       │
│  (R-016)      │   │  • Respostas      │   │  • Leads              │
│               │   │  • Qualificação   │   │  • Status             │
│  • Sessão     │   │  • Objeções       │   │  • Mensagens          │
│  • QR Code    │   │  • Resumo         │   │  • Notas              │
│  • Reconexão  │   │  • Sugestões      │   │  • Tags               │
│  • Envio      │   │                   │   │  • Tarefas            │
│  • Recebimento│   │                   │   │  • Opt-out            │
└───────────────┘   └───────────────────┘   └───────────────────────┘
        │                        │                        │
        └────────────────────────┼────────────────────────┘
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    SISTEMA DE CAÇA-LEADS (API EXTERNA)                  │
│  • Parâmetros: estado, cidade, região, nicho, nome-chave                │
│  • Retorna: nome, telefone, endereço                                    │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 11. Referências cruzadas

| Fluxo | Requisitos | Anti-requisitos | User Stories |
|---|---|---|---|
| Importação | R-017, R-018, R-019, R-020 | AR-011 | US-001, US-002, US-003 |
| Primeira abordagem | R-001, R-002, R-059 | — | US-004, US-005 |
| Condução IA | R-008, R-010, R-011, R-067 | AR-006 | US-006, US-009 |
| Qualificação | R-051, R-052 | — | US-007 |
| Objeções | R-041, R-042, R-012 | AR-001, AR-002, AR-012 | US-008 |
| Follow-up | R-003, R-004, R-005, R-006, R-007 | AR-007, AR-008 | US-011, US-012 |
| Handoff | R-012, R-013, R-065, R-066 | AR-010 | US-014, US-015, US-016, US-017, US-019 |
| Opt-out | R-024, R-064 | AR-005, AR-011 | US-018, US-027, US-028 |
| Mídia | R-038 | AR-009 | US-010 |
| Modo copiloto | R-014 | AR-010 | US-020 |
| CRM | R-021, R-022, R-043 | — | US-021, US-022, US-023, US-024 |
| Painel | R-046 | — | US-025, US-026 |
| Falhas | R-045 | — | US-029 |
| Backup | R-032 | — | US-030 |
| Multiusuário | R-029, R-030 | — | US-031 |
| Migração API oficial | R-016 | — | US-032 |