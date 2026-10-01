# ADR-003: Higiene do PostgreSQL (listen_addresses e scram-sha-256)

## Status
Decisão registrada; aplicação pendente de verificação humana.

## Contexto
A Fase 01-02 (T-01-01) determinou fechar a exposição de rede do PostgreSQL local, movendo `listen_addresses` de `*` para `localhost`, sem alterar o `pg_hba.conf` global. O papel da aplicação (`whatsapp_bot`) deve usar autenticação com `scram-sha-256`.

## Decisão
- O script `scripts/pg-hba-apply.ps1` realiza **apenas** as mudanças necessárias em `postgresql.conf` (Scope 1: `listen_addresses`) e garante a senha do role de aplicação com `scram-sha-256` (Scope 2: `ALTER ROLE`), **nunca** tocando no `pg_hba.conf` global.
- O dry-run (`-WhatIf`, padrão) descreve exatamente o que seria feito, sem gravar ou reiniciar o serviço. A aplicação efetiva requer `-Apply` e ocorre **após** confirmação humana (checkpoint da Task 3).
- Backup datado de `postgresql.conf` é criado **antes** da escrita; em caso de falha de `pg_isready` após restart, o rollback automático restaura o backup e não deixa o arquivo corrompido.

## Risco residual aceito
Enquanto o `pg_hba.conf` local permitir `trust`, qualquer processo na conta do Admin conecta sem senha; esse risco é aceito por ser de comprometimento **local** (único usuário da máquina) e não haver segundo usuário na estação.

## Por que não alterar o pg_hba.conf global
Alterar o `pg_hba.conf` global quebraria instalações existentes (`auth`, `pizzaria_db`, `vidracaria` e `vidracaria_test`), possivelmente sem senha. Para preservar compatibilidade com esses ambientes locais e evitar efeitos colaterais não mapeados, **o escopo deliberadamente exclui** qualquer modificação no `pg_hba.conf` global.

## Consequências
- Exposição de rede reduzida (somente `localhost`).
- Credenciais do role `whatsapp_bot` reforçadas com `scram-sha-256`.
- Superfície de mudança restrita a `postgresql.conf`, com plano de rollback testável em dry-run.
- Aplicação pendente de verificação humana (checkpoint:human-verify) conforme previsto no plano 01-02-PLAN.md (Task 3).
