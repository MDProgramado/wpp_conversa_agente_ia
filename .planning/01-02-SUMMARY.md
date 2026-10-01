# Summary da Fase 01-02

## Desvios documentados

### COMP-04 (segurança PostgreSQL)

- **BOM UTF-8 em postgresql.conf:** o script `pg-hba-apply.ps1` reescreveu o arquivo via PowerShell, que adicionou BOM `EF BB BF`. O PostgreSQL 18 recusou subir com "erro de sintaxe na linha 1". Corrigido manualmente com `[System.IO.File]::WriteAllText` usando `UTF8Encoding($false)`.
  - **Ação preventiva:** proibir `Set-Content`, `Out-File`, `>` para editar `postgresql.conf`. Usar Notepad, VSCode ou `[System.IO.File]::WriteAllText`.
  - **Registrar em AGENTS.md.**

- **Falha do `icacls.exe` no script:** `pg-hba-apply.ps1` criou arquivo temporário em `%TEMP%`, chamou `icacls.exe` para restringir ACL, mas o arquivo já não existia (deletado antes). O script abortou o Scope 2.
  - **Ação corretiva:** `ALTER ROLE whatsapp_bot WITH PASSWORD` executado manualmente via `psql`.
  - **Bug para correção futura:** reordenar ou capturar erro do `icacls`.

- **`Restart-Service` exige PowerShell elevado:** o plano não documentava elevação. Falhou silenciosamente como não-admin.
  - **Ação corretiva:** executado em PowerShell Admin.
  - **Ação preventiva:** documentar no plano que `Restart-Service postgresql-x64-18` exige elevação.

### Estado final verificado

- `SHOW listen_addresses` = `localhost`
- `migrations_applied` = 5 no app.log
- 4 bancos intactos (`auth`, `pizzaria_db`, `vidracaria`, `vidracaria_test`)
- Backup do `postgresql.conf` preservado: `postgresql.conf.20261001-100404.bak`
