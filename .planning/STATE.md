---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
last_updated: "2026-10-01T11:47:39.555Z"
progress:
  total_phases: 4
  completed_phases: 0
  total_plans: 5
  completed_plans: 1
  percent: 0
---

# Estado do Projeto

## Referência do Projeto

Ver: `.planning/PROJECT.md` (atualizado 2026-09-28)

**Valor central:** Quando o bot assume uma conversa, conduz com naturalidade suficiente para gerar reuniões agendadas sem nunca cruzar uma fronteira proibida — e para no instante exato em que o humano precisa assumir.
**Foco atual:** Phase 1 — Fundação, Canal e Gate de Envio

## Posição Atual

Fase: 1 de 4 (Fundação, Canal e Gate de Envio)
Plano: 1 de 5 na fase atual (01-01 concluído)
Status: Executing Phase 01
Última atividade: 2026-09-30 — Wave 1 executada: plano 01-01 (walking skeleton) com 6/6 tasks implementadas e 9 commits. Task 6 (notificação visual) implementada mas **pendente de revalidação** — `WpnUserService` parado nesta máquina impede exibição de toast.

Progresso: [██░░░░░░░░] 20% (1 de 5 planos executados; 5 de 5 planejados)

## Métricas de Desempenho

**Velocidade:**

- Planos concluídos: 1
- Duração média: 150 min
- Tempo total de execução: ~150 min

**Por Fase:**

| Fase | Planos | Planejados | Executados | Média/Plano |
|------|--------|-------------|------------|-------------|
| 1. Fundação, Canal e Gate | 5 | 5 | 1 | 150 min |
| 2. IA, Handoff e Shadow | 3 | 0 | 0 | — |
| 3. Cadência, Operação e Painel | 3 | 0 | 0 | — |
| 4. Piloto, Calibração e Apuração | 2 | 0 | 0 | — |

*Atualizado após cada plano concluído*

## Contexto Acumulado

### Decisões

Decisões completas em PROJECT.md (tabela Key Decisions). Recentes que afetam o trabalho atual:

- **Gate antes do LLM, sem exceção:** `PolicyGate` (Fase 1) precede `LlmPort` (Fase 2); CONV-14 corrigido para a Fase 1 no roadmap.
- **R-001 é restrição transversal:** primeira mensagem sempre manual — mitigação técnica primária anti-463; nenhuma fase automatiza primeiro contato.
- **Baileys `7.0.0-rc14` pin exato** (`--save-exact`): a linha 6.7.x não tem tctoken/463/APIs de quota.
- **Auth state + backups fora do OneDrive** (COMP-05): path concreto a decidir no plano 01-01 (ex.: `C:\whatsapp_prospecao\`).
- **Shadow mode é gate de P1:** Fase 2 valida fala e guardrails sem consumir a tolerância do número; saída da F2 exige relatório shadow.
- **R-019 corrigido pela pesquisa:** `onWhatsApp()` volta ao escopo; estado terminal NUMERO_INVALIDO.
- **R-023 com 2ª trava dura:** contatos novos/dia via `fetchNewChatMessageCap()`; 463 nunca retryado.
- **Ambiente resolvido 2026-09-28 (pós-pesquisa Fase 1):**
  - **Baileys `7.0.0-rc14` confirmado** despite `AGENTS.md` §STACK.md fixar a linha `6.7.x`. As fontes do projeto (PROJECT.md Key Decisions, STATE.md, 01-CONTEXT.md D-01/specifics) decidem rc14 porque a linha `6.7.x` não tem tctoken/erro-463/APIs de quota — sem elas, WHS-04 e LEAD-03 ficam sem implementação. `AGENTS.md` é snapshot de pesquisa pré-projeto. **✅ RESOLVIDO em 2026-09-29 (preflight do plano 01-01):** bloco `GSD:stack-*` de `AGENTS.md` corrigido (zero ocorrências de `6.7.24`), nota de pin de projeto inserida no topo do bloco, e decisão registrada em `docs/adr/001-pin-baileys-rc14.md` (ADR-001, Aceito).
  - **PostgreSQL 18.3 é o alvo** (o STACK.md autoriza "17.x **ou 18.x se já instalado**"; 18.3 está instalado e `pg_dump`/`pg_restore` são 18.3 = mesma major do servidor). Sem migração de dados. **✅ Confirmado em 2026-09-29:** `psql` e `pg_dump` reportam `18.3`; os outros bancos da máquina (`auth`, `pizzaria_db`, `vidracaria`, `vidracaria_test`) não foram tocados.
  - **Node 24 LTS é o alvo.** **✅ RESOLVIDO em 2026-09-29:** instalado e ativo `v24.21.0` (via `fnm`, com o diretório de instalação na `PATH` do usuário). Registrado em ADR-001 §"Registro de ambiente".
- **`DATA_ROOT` definido: `C:\whatsapp_prospecao`** (2026-09-29, preflight do plano 01-01). Subpastas `auth\`, `backups\` e `logs\` criadas; `(Get-Item 'C:\whatsapp_prospecao').Attributes` = `Directory`, **sem** `ReparsePoint` nem `Offline` — ou seja, fora do OneDrive. A guarda `DATA_ROOT_ON_ONEDRIVE` aborta o boot se isso mudar.

### Decisões do Plano 01-01 (2026-09-30, walking skeleton)

- **Guard 0 (R-001) fica FORA da numeração AR-001..AR-012.** AR-001 é preço; R-001 é primeiro contato. Numerar R-001 como AR-000 inventaria uma categoria que não existe em `docs/10-anti-requisitos.md`.
- **A ordem de avaliação do gate é invariante, não detalhe:** kill switch → Guard 0 (R-001) → AR-001..AR-011 na ordem de `docs/10-anti-requisitos.md`. A ordem mora em `src/domain/gate/guard-order.ts` e é **testada**, não documentada.
- **`sendText` tem exatamente um chamador de produção:** `src/application/dispatcher.ts:164`. O invariante é a *ausência* de um segundo caminho, e a barreira de lint o mantém. Daqui saem os 12 anti-requisitos.
- **Registro do AUMID é best-effort e não-fatal.** AUMID controla o *nome* do toast, não a emissão. Um registro de branding que bloqueia o alerta é risco maior que o nome genérico que ele evita — e R-013 exige que o Admin seja avisado.
- **Som toca ANTES do toast** no `notify.ps1`: se a sessão de áudio estiver em erro, o script falharia depois de já ter emitido o toast e R-013 perderia a notificação silenciosamente.
- **Título nunca vai para o log de notificações.** Pode carregar trecho de conversa com o lead (R-064) e o arquivo sobrevive à rotação de retenção. O log registra `title_chars` — quanto, nunca o quê.
- **3 defeitos graves encontrados por leitura e travados em `tests/gate/regressoes.test.ts`** (nenhum era coberto por teste do plano):
  1. **Kill switch invertido** — `coalesce(is_active) as kill_switch` ligava o botão de emergência na conta ativa, e o gate **bloqueava toda mensagem do sistema**. Era o pior possível: o produto inteiro mudo.
  2. **AR-004 barrava todo link** — `p.kind !== "text"` tratava `link` como mídia, violando R-042.
  3. **`blocked_attempts` perdia todo negativo** — `db.execute` com string solta deixava `$1..$3` sem bind, e nenhuma rejeição do gate ia para a trilha de auditoria (R-022).

### Todos Pendentes

De `.planning/todos/pending/`:

Nenhum ainda.

### Bloqueios/Preocupações

- ⚠️ **API do caça-leads não especificada** (schema, auth, rate limit) — bloqueia LEAD-01 na integração (não a arquitetura); decidir forma do insert antes (AR-011 exige `legal_registered_at` na criação).
- ⚠️ **R-059 (número único, sem redundância)** — risco dominante aceito e documentado; mitigação: shadow mode, kill switch, appeal preparado, exportação contínua do CRM.
- 🔴 **R-013 (notificação local) — `WpnUserService` PARADO nesta máquina (2026-09-30).** A Task 6 do plano 01-01 está implementada e verificada por código, mas a **exibição** não acontece: a gravação passa (`Show()` sem erro, linha criada em `wpndatabase.db`, log `toast_sent`) e a entrega nunca ocorre (`LastNotificationAddedTime` não é atualizado). Evidência de que é do Windows e não do código: **nem o toast com AUMID nativo do PowerShell aparece, nem um balloon via `NotifyIcon`**, que nem passa pela camada WPN. Foco Assistente desligado, nenhuma política, sessão `console` local (não RDP), toggle de Notificações ligado (confirmado pelo Admin), `explorer`/`ShellExperienceHost`/`StartMenuExperienceHost`/`RuntimeBroker` todos rodando. `Start-Service WpnUserService` é recusado — é serviço *template* por usuário. `notify.ps1` está correto; o defeito é do SO. **Decisão do Admin: reiniciar o Windows e revalidar depois.** Comando de revalidação: `npm run notify -- -Title "Teste R-013" -Message "Verificacao" -Urgent`.
  - **Consequência de projeto se o reboot não resolver:** R-013 é load-bearing (handoff, opt-out e mídia recebida dependem de o Admin *saber* que precisa agir). O **som** é o único canal já verificado como independente do WPN (`Hand.Play()` sem exceção, áudio OK) e já toca com `-Urgent`. Decisão pendente: tornar o som o sinal primário de alerta, com o toast como complemento.
- ⚠️ **`CHANNEL_PHONE_E164` no `.env` está com o placeholder `+5511999999999`.** O número dedicado real precisa entrar **antes do pareamento QR** (Task 3 do plano 01-03). O CHECK do banco aceita o placeholder, então nada quebra até lá — mas número errado no canal é erro sem recuperação barata.
- ⚠️ **`fetchNewChatMessageCap()` / `fetchAccountReachoutTimelock()`** — precisam ser confirmados nos typings do `@whiskeysockets/baileys@7.0.0-rc14` instalado. Sem eles, WHS-04 e LEAD-03 ficam sem implementação (ADR-001). Verificar no início do plano 01-03.

### Resolvidos em 2026-09-29 (preflight do plano 01-01, Task 1)

- ✅ **Node 24.21.0 LTS instalado e ativo** — era bloqueante de qualquer `npm install`. `node --version` = `v24.21.0`; `npm --version` = `11.19.0`; diretório do fnm inserido na `PATH` do usuário para que shells novos resolvam o runtime correto (o `launch.cmd` depende do binário real, não de `npx node@24`).
  - Armadilha de `PATH` (reproduzida em 2026-09-29, custo ~10 min): um processo já aberto **antes** da mudança de `PATH` continua resolvendo `C:\Program Files\nodejs\node.exe` (**v22.14.0**) e reporta a versão errada — foi assim que o preflight pareceu ter falhado quando não falhou. Shell novo resolve v24.21.0. Antes de concluir que o Node 24 "não está instalado", rodar `fnm list` e conferir a `PATH` do usuário no registro; se o `PATH` do processo estiver desatualizado, prefixar os comandos com `C:\Users\11\AppData\Roaming\fnm\node-versions\v24.21.0\installation`. `C:\Program Files\nodejs` (v22.14.0) continua instalado porque é o runtime de outros projetos da máquina — **não desinstalar**.
- ✅ **`AGENTS.md` §STACK.md corrigido** — o bloco `GSD:stack-start..GSD:stack-end` passou a instruir o pin `7.0.0-rc14`; nenhuma seção fora do bloco foi alterada; as 10 regras não negociáveis ficaram intactas. Risco "agente futuro reverter o pin" eliminado pelo ADR-001 + nota de pin no topo do bloco.
- ✅ **`DATA_ROOT` criado fora do OneDrive** — `C:\whatsapp_prospecao\{auth,backups,logs}`, sem atributo `ReparsePoint`.
- ✅ **PostgreSQL 18.3 confirmado** sem tocar nos outros bancos da máquina; `psql` e `pg_dump` do mesmo major.

- ✅ **Skills do Ruler distribuídas** (2026-09-29, Task 1 step 6) — resolvido após aprovação humana explícita para instalar o pacote. O pacote correto é **`@intellectronica/ruler@0.3.44`** (MIT, `github.com/intellectronica/ruler`). Os dois nomes que o plano traziam estão errados e **não devem ser tentados de novo**: `npx ruler` resolve para `composable assertions` (pacote de outro projeto, "could not determine executable to run") e `npx @kirobil/ruler` retorna **404 — o pacote não existe**.
- ✅ **`.ruler/ruler.toml` corrigido (bug de config, não de pacote).** O arquivo usava duas chaves que o schema do Ruler 0.3.44 **rejeita**, e por isso `ruler apply` abortava com *"Invalid configuration file format (Errors: agents.opencode.skills_dir, merge)"*:
  - `agents.opencode.skills_dir` — `skills_dir` não existe no schema `[agents.<nome>]` (que é `.strict()`: só aceita `enabled`, `output_path`, `output_path_instructions`, `output_path_config`, `mcp`, `mcp_servers`). O destino do OpenCode é a constante `OPENCODE_SKILLS_PATH = '.opencode/skills'` e **não é configurável** — a chave era redundante e inválida ao mesmo tempo.
  - `[merge] strategy = "merge"` — seção inexistente no nível raiz. A intenção (mesclar, não sobrescrever) corresponde a `[mcp] merge_strategy`, que só importa se houver `.ruler/mcp.json`; o projeto não tem MCP, então a chave foi removida em vez de recriada como config inventada.
  - `.opencode/skills/whatsapp-baileys/SKILL.md` e `.opencode/skills/lgpd-optout/SKILL.md` confirmados em disco após o apply.
- ✅ **`ruler apply` escopado ao OpenCode.** Um `ruler apply` sem escopo escreveria em **60+ caminhos** de ~20 integrações de agente (`.roo/`, `.trae/`, `.amazonq/`, `firebender.json`, `CLAUDE.md`, `.codex/`, `.aider.conf.yml`, `.openhands/`, `CRUSH.md`, `WARP.md`…) e acrescentaria **60 entradas ao `.gitignore`**, incluindo a própria `.opencode/skills`. O comando usado foi `npx @intellectronica/ruler apply --agents opencode --no-gitignore --no-mcp`.
- ✅ **`AGENTS.md` preservado byte a byte.** O Ruler reescreve o arquivo de instruções do agente (`AGENTS.md` para o OpenCode) com um cabeçalho `<!-- Source: AGENTS.md -->` **fora** de qualquer bloco `GSD:stack-*`. O arquivo foi snapshotado antes do apply e restaurado por hash após, porque as 10 regras não negociáveis são load-bearing. Consequência a conhecer: **cada `ruler apply` volta a prepender esse cabeçalho** — quem rodar o comando precisa repetir o snapshot/restauração, ou aceitar o cabeçalho de forma consciente.

## Itens Adiados

| Categoria | Item | Status | Adiado Em |
|-----------|------|--------|-----------|
| Pesquisa | Procedimento de appeal de ban (fonte secundária) — confirmar antes de depender | Aberto | 2026-09-28 |
| Pesquisa | Onboarding da API oficial (migração R-016) — não pesquisado | Aberto | 2026-09-28 |
| Produto | Break-up message (FLUP-11 v2) — decidir com dado do piloto | Aberto | 2026-09-28 |

## Continuidade de Sessão

Última sessão: 2026-09-30
Parou em: Fase 1, wave 1 concluída. Plano 01-01 executado (6/6 tasks implementadas, 9 commits, `01-01-SUMMARY.md` escrito) com a **Task 6 pendente de revalidação** — o `WpnUserService` está parado na máquina e a notificação é gravada mas não exibida. Decisão do Admin: reiniciar o Windows e revalidar depois; o plano não fica bloqueado. STATE e ROADMAP sincronizados (`completed_plans: 1`, 20%).
Próximo passo: `/gsd-execute-phase 1` (wave 2: 01-02 e 01-03, serializados — este runtime não expõe isolamento por worktree)
Pós-reboot: revalidar com `npm run notify -- -Title "Teste R-013" -Message "Verificacao" -Urgent` e fechar a Task 6
Arquivo de retomada: `.planning/phases/01-funda-o-canal-e-gate-de-envio/01-01-SUMMARY.md`

---
*Atualizado: 2026-09-30*
