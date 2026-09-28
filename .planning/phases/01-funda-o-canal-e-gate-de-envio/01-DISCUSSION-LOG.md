# Phase 1: Fundação, Canal e Gate de Envio - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-28
**Phase:** 1-Fundação, Canal e Gate de Envio
**Areas discussed:** Armazenamento COMP-05, Captura 1ª mensagem R-001, Janela operacional, Limites diários, Pureza do gate, Notificação local, API caça-leads, Delegação pós-Fase-1

> **Modo:** `--auto` — todas as áreas auto-selecionadas e auto-resolvidas com a opção recomendada. Sem prompts interativos.

---

## Armazenamento fora do OneDrive (COMP-05)

| Option | Description | Selected |
|--------|-------------|----------|
| Raiz única `C:\whatsapp_prospecao\` (auth/backups/logs), via `.env` | Raiz fora do OneDrive/git, subpastas dedicadas, default claro | ✓ |
| Dentro do projeto | Fácil, mas OneDrive sincroniza dados LGPD sem criptografia (R-033) | |

**User's choice:** Auto — opção recomendada (raiz única fora do OneDrive)
**Notes:** `DATA_ROOT` no `.env`. Auth state nunca commitada nem na rotação de logs.

## Captura da 1ª mensagem manual (OPRE-01, CONV-01, R-001)

| Option | Description | Selected |
|--------|-------------|----------|
| Evento `key.fromMe` do Baileys | Admin envia no app do WhatsApp; a mensagem de saída do próprio número transiciona o lead | ✓ |
| Botão / comando específico | Requer painel ou CLI dedicado; não existe na Fase 1 | |

**User's choice:** Auto — opção recomendada (detecção `fromMe`)
**Notes:** Sem botão na Fase 1; painel chega na Fase 3. R-001 segue como guard AR-001 no gate.

## Janela operacional na Fase 1 (WHS-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Só dias úteis (semana) na Fase 1 | Mecânica de janela pronta; feriados BR adiados | ✓ |
| Feriados BR já na Fase 1 | Requer `business-hours.ts` completo — carga antecipada | |

**User's choice:** Auto — opção recomendada (dias úteis; feriados na Fase 3)
**Notes:** Compromisso registrado em `<deferred>`.

## Limites diários (R-023*/WHS-04)

| Option | Description | Selected |
|--------|-------------|----------|
| `min(25 configurado, cap lido)` + 20 leads/dia + 463 sem retry | Default 25 (meio do intervalo 20–30); cap do Baileys como 3ª trava | ✓ |
| Hardcoded 20/30 nos códigos | Simples, mas não reconfigurável sem deploy | |

**User's choice:** Auto — opção recomendada (configurável + cap lido + 463 físico)
**Notes:** Contadores com `CHECK (count <= limite)`; limite efetivo = min.

## Pureza do gate (CONV-14)

| Option | Description | Selected |
|--------|-------------|----------|
| `evaluatePolicy(pure)` com snapshot injetado | 12 property tests determinísticos; I/O fora da função | ✓ |
| Gate com I/O embutido | Simples, mas testes frágeis e acoplamento | |

**User's choice:** Auto — opção recomendada (gate puro, snapshot injetado)
**Notes:** Dispatcher lê via `FOR UPDATE` na mesma transação do enfileiramento. Lint `no-restricted-imports` bloqueia import do canal fora do dispatcher.

## Notificação local (NFRQ-04, NFRQ-06)

| Option | Description | Selected |
|--------|-------------|----------|
| `notify.ps1` (PowerShell + WinRT), smoke test na máquina | Sem `node-notifier` (stale); validar Focus Assist/ExecutionPolicy/som | ✓ |
| Chime Web Audio | Redundância só com painel (Fase 3) | |

**User's choice:** Auto — opção recomendada (notify.ps1 + smoke test na Fase 1)
**Notes:** Chime Web Audio delegado à Fase 3.

## Integração da API do caça-leads (LEAD-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Port `LeadSourcePort` + Fake + esqueleto HTTP | API não especificada; arquitetura nunca bloqueada; contrato real em pesquisa | ✓ |
| Esperar especificação para começar | Travaria a Fase 1 inteira | |

**User's choice:** Auto — opção recomendada (port + fake adapter)
**Notes:** AR-011 ainda vale: lead só entra com origem, base legal e finalidade.

---

## the agent's Discretion

--auto com recomendação padrão em todas — nenhuma área deixada 100% em aberto; a recomendação foi seguida em cada caso.

## Deferred Ideas

- Feriados brasileiros no calendário de janela → Fase 3 (FLUP-03).
- Chime Web Audio como redundância de notificação → Fase 3 (com o painel).
- Detecção de opt-out / mídia recebida / handoff → Fase 2 (matcher + LLM).
- Break-up message (FLUP-11 v2) e appeal de ban → Fase 4.
- Multiusuário operacional (R-029/R-030) → v2 (schema apenas prepara na Fase 1).
- Spec real da API do caça-leads → pesquisa/STATE.md, não arquitetura.