# ADR-001: Pin exato do `@whiskeysockets/baileys` em `7.0.0-rc14`

- **Status:** Aceito
- **Data:** 2026-09-28
- **Registrado em:** 2026-09-29 (Task 1 do plano `01-01`)

## Registro de ambiente (verificado no preflight)

| Item | Valor verificado |
|---|---|
| `node --version` | `v24.21.0` (LTS "Krypton") |
| `psql --version` | `18.3` (`C:\Program Files\PostgreSQL\18\bin`) |
| `pg_dump --version` | `18.3` (`C:\Program Files\PostgreSQL\18\bin`) |
| `DATA_ROOT` | `C:\whatsapp_prospecao` (atributo `Directory`, sem `ReparsePoint`) |
| `npm --version` | `11.19.0` |

O Node 24 LTS foi instalado e **não** via `npx node@24`: usar o binário real é condição para o
`launch.cmd` funcionar e para que o pin de runtime corresponda à validação do stack.

## Contexto

A escolha entre a linha `legacy` (`6.7.x`) e a linha `7.x` do Baileys **não é uma questão de
estabilidade**. É uma questão de funcionalidade.

A linha `6.7.x` é **pré-tctoken**. Verificado diretamente na árvore do repositório, não inferido:
a tag `v6.7.24` não contém nenhum arquivo de tctoken/reach-out, e `messages-send.ts` nessa tag
tem **zero** menções a `fetchNewChatMessageCap` nem a `fetchAccountReachoutTimelock`. As release
notes da linha 7 a partir do rc10 listam explicitamente *"Full TC Token issuance, revocation,
expiration, pruning lifecycle"*, *"Reachout Timelock (Your account is restricted - the 463 error)
and New Chat limits functions"* e *"463 handlers and safety-paths"*.

Consequência direta para este projeto: **sem tctoken, sem leitura de quota e sem o tratamento do
erro 463, o cold outreach do MVP não funciona.** Especificamente:

- **WHS-04** (travas duras de cota) fica sem implementação — não há como ler o teto de contatos novos.
- **WHS-04** (463 jamais retryado) fica sem implementação — o erro 463 é o sinal de
  "Sua conta está restrita em contatos novos" e precisa ser classificado, não repetido.
- **LEAD-03** (estado terminal `NUMERO_INVALIDO`) fica sem implementação — o único sinal de que
  um número está inválido é o 463, e ele não existe na linha `legacy`.

A comparação "RC vs linha estável" oculta esse fato e produz o erro de escolher a versão
funcionalmente insuficiente. A linha `6.7.x` não é "a versão estável equivalente": é a linha
**anterior** a tudo o que o protocolo de reach-out passou a exigir.

Há ainda um segundo risco na linha `6.7.x`: `v7.0.0-rc12` (2026-05-20) corrigiu a falha de
segurança **GHSA-qvv5-jq5g-4cgg**. Ficar numa versão antiga "mais estável" é escolher
vulnerabilidade conhecida.

Resta o risco real do RC: RCs consecutivos mudam comportamento de protocolo, e há relatos no
repositório de banimento logo após atualização de versão. Esse risco é **real e aceito** — e é
mitigado por construção, como segue.

## Decisão

Fixar **`@whiskeysockets/baileys@7.0.0-rc14`** em **versão exata** no `package.json`, instalada
com `--save-exact`.

- **Sem `^`, sem `~`, sem `latest`.** `latest` é proibido porque a tag pode se mover a qualquer
  momento — o pin é o que torna a decisão reproduzível.
- O `package-lock.json` é **commitado**, para que a resolução transitiva também fique travada.
- A **linha `6.7.x` é a que não deve ser usada** (dist-tag `legacy`). Nenhuma hipótese deste projeto
  autoriza instalá-la.
- O piso de versão é **`>= 7.0.0-rc10`**: abaixo disso não há tctoken, nem quota, nem 463.
- Toda a superfície de dependência do Baileys fica confinada a `src/channel/baileys/**`, e a regra
  é imposta por `biome.json` (`noRestrictedImports`) desde o primeiro commit.

A decisão é registrada aqui **por escrito e de forma consciente**, conforme exige o Pitfall 10 da
pesquisa deste projeto: aceitar um RC é uma escolha, não um acidente de `npm i`.

## Consequências

### Negativas, aceitas

1. **Dependência de release candidate.** Um RC pode conter regressão de protocolo não documentada,
   e pode ser **despublicado** do registro npm. Um `npm ci` em uma máquina nova pode falhar.
2. **Superfície de mudança.** RCs consecutivos alteram parsing de `<message>` (há relato de
   `7.0.0-rc13` corrigindo uma regressão). Um bump pode mudar comportamento sem aviso.

### Mitigações

1. **A superfície de risco é o adaptador, e o adaptador é pequeno.** Toda a incompatibilidade de
   API que justifica esta decisão mora no `JidResolver` e no `normalizeJid()` do adaptador
   (`src/channel/baileys/**`). O `WhatsAppPort` é a interface de saída: trocar a implementação
   do canal toca **um** módulo, e o domínio não conhece Baileys. A decisão de versão fica contida
   no adaptador — é por isso que a troca futura para o 7.0.0 estável é barata.
2. **O número dedicado é o recurso insubstituível (R-059, risco ALTO, "sem redundância").** O risco
   não é a versão — é a perda do número. Mitiga-se com:
   - **validação do par de código antes de qualquer mensagem automatizada** (checkpoint de
     pareamento no plano `01-03`, antes do primeiro envio automatizado);
   - `DATA_ROOT` **fora** do OneDrive, com guarda `DATA_ROOT_ON_ONEDRIVE` que aborta o boot se o
     caminho tiver atributo `ReparsePoint` — uma pasta de sessão sincronizada é o vetor conhecido
       de corrupção do `useMultiFileAuthState`;
   - backup da pasta `auth/` feito **fora** do OneDrive antes de qualquer uso piloto;
   - exportação contínua do CRM para CSV: perder o número custa o canal, não o pipeline.
3. **Não atualizar a biblioteca em produção sem janela de teste.** Qualquer bump passa primeiro por
   um SIM descartável, ou no mínimo por janela de baixo volume com cota reduzida.
4. **Monitoramento mensal** dos changelogs e das issues de ban do Baileys, como tarefa operacional.
5. **Nunca desabilitar history sync** — é a causa raiz de "463 em todos os contatos novos".

### Sinais de alerta desta decisão

- `package.json` com `^`, `~` ou `latest` em dependência do Baileys.
- `npm outdated` aparecendo em log — sinal de que nada está fixado.
- A versão **resolvida** do Baileys diferente de `7.0.0-rc14`.
- `fetchNewChatMessageCap`, `fetchAccountReachoutTimelock` ou o caminho de erro 463 ausentes dos
  typings do pacote instalado. Sem os três, WHS-04 e LEAD-03 perderam a implementação e este ADR
  deve ser reaberto.

## Rollback

O rollback tem **dois níveis**, e o piso de versão é `rc10` — nenhuma versão abaixo disso serve,
porque não possui tctoken, quota nem 463.

1. **Rollback primário — RC anterior dentro da linha 7.** Reverter para o RC imediatamente
   anterior a `7.0.0-rc14`, ainda com tctoken, quota e 463. É o caminho de rotina: o problema
   indicado é "este RC regrediu", não "a linha 7 é ruim".
2. **Rollback secundário — linha `legacy` (`6.7.x`).** Reservado para **incapacidade total do
   canal** com a linha 7. Só é aceitável com a revalidação explícita de **LEAD-03 e WHS-04**, que
   ficarão **sem implementação** — o que significa:
   - sem leitura de cap de contatos novos,
   - sem leitura de timelock de reach-out,
   - sem classificação de 463 (um 463 pode ser tratado como erro transitório e **retryado**, o
     que é exatamente o comportamento que causa restrição de conta — Pitfall 2).

   Se a incapacidade total for a razão, a decisão correta **não** é o rollback: é declarar o canal
   insubstituível indisponível e mover para o adapter alternativo (`whatsmeow` via bridge Go, ou
   WPPConnect aceitando LGPL + Chromium), reavaliando R-059.

Em nenhum dos níveis o rollback é "instalar `latest`". É sempre voltar para uma **versão fixada**,
testada, e registrada neste ADR.

## Referências

- `.planning/phases/01-funda-o-canal-e-gate-de-envio/01-PATTERNS.md` §2.1 (P2) — pin exato de canal
  e a regra de que a decisão de versão fica confinada ao adaptador.
- `.planning/phases/01-funda-o-canal-e-gate-de-envio/01-RESEARCH.md` §Fontes — dados do registro
  npm, GitHub e das tags verificadas.
- `.planning/research/PITFALLS.md` §10 — "npm i baileys instala release candidate". Contém a
  contradição explícita entre o `STACK.md` original e a Functionalidade, já reconciliada por este ADR.
- `.planning/research/PITFALLS.md` §1 (Reach-out Timelock / erro 463) e §2 (número inexistente) —
  por que 463 e quota são requisito, não otimização.
- `.planning/phases/01-funda-o-canal-e-gate-de-envio/01-CONTEXT.md` D-02 — decisão de fixar versão
  exata, sem `^`/`~`/`latest`.
- `AGENTS.md` §Technology Stack — o bloco foi corrigido para refletir esta decisão; a nota de pin
  no topo do bloco prevalece sobre qualquer texto residual.
- `GHSA-qvv5-jq5g-4cgg` — falha de segurança corrigida em `7.0.0-rc12`.
