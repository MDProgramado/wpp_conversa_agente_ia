# ADR-007 — Backup Manual com Versionamento por Data/Hora

- **Status:** Aceito
- **Data:** 2026-09-28
- **Decisores:** Admin (você), System Architect
- **Contexto:** Fase 1 — Fundação, Canal e Gate de Envio
- **Relacionado a:** R-032, R-033, R-031, R-045

---

## 1. Contexto

O sistema armazena dados críticos localmente:

- **Banco PostgreSQL:** leads, conversas, mensagens, status, follow-ups, notas, tarefas, tags, logs, auditoria, contadores diários.
- **Sessão do WhatsApp:** credenciais que permitem enviar/receber mensagens.
- **Configurações:** preferências do Admin, links aprovados, parâmetros do gate.

A perda desses dados significa:

- Perda de histórico de conversas e leads.
- Perda da sessão do WhatsApp (exige novo pareamento via QR Code).
- Perda de configurações (exige reconfiguração).
- Perda de auditoria e logs.

É necessário um mecanismo de backup e restauração. As opções são:

1. **Backup automático** (diário, semanal etc.) — agendado, sem intervenção.
2. **Backup manual** — acionado pelo Admin quando quiser.
3. **Backup híbrido** — automático + manual.

O usuário escolheu **(a)** backup **manual**, quando quiser, para pasta local.

---

## 2. Decisão

Implementar **backup manual** com:

- **Acionamento:** pelo Admin, via botão no painel.
- **Versionamento:** arquivos nomeados por data/hora (`YYYY-MM-DD_HH-MM`).
- **Escopo:** banco PostgreSQL + sessão do WhatsApp + configurações.
- **Destino:** pasta local escolhida pelo Admin (fora do OneDrive/Drive).
- **Formato:** dump PostgreSQL (`pg_dump`) + cópia da pasta de sessão + JSON de configurações, tudo dentro de um arquivo `.zip`.
- **Sem criptografia:** o backup não é criptografado (R-033).
- **Sem agendamento automático:** o Admin decide quando fazer.
- **Alerta opcional:** se o último backup estiver muito antigo, o sistema exibe aviso.

---

## 3. Justificativa

### Por que backup manual?

- **Simplicidade:** sem agendador, sem serviço extra, sem complexidade.
- **Controle:** o Admin decide o momento ideal (ex.: após atingir volume importante).
- **Flexibilidade:** o Admin pode fazer backup antes de operações críticas (migração, exclusão em massa).
- **Recuperação:** processo simples, sem dependência de automação.
- **Alinhamento com R-032:** o requisito diz explicitamente "backup manual".

### Por que não backup automático?

- **Complexidade:** exige agendador, tratamento de falhas, log de execução.
- **Recursos:** consome CPU, disco e tempo em horários que podem competir com a operação.
- **Risco de sobrescrita:** se mal configurado, pode sobrescrever backups bons.
- **Sem urgência:** o volume do piloto é baixo; backups manuais frequentes são suficientes.
- **Controle:** o Admin prefere decidir quando fazer.

### Por que versionar por data/hora?

- **Histórico:** permite restaurar de diferentes pontos no tempo.
- **Sem sobrescrita:** cada backup é único.
- **Auditoria:** fácil identificar quando foi feito.
- **Recuperação seletiva:** possibilita escolher o backup mais adequado.

### Por que salvar fora do OneDrive/Drive?

- **Segurança:** pastas sincronizadas enviam dados para a nuvem, sem criptografia (R-033).
- **LGPD:** dados pessoais não devem sair do controle local sem base legal.
- **Controle:** o Admin mantém os dados sob sua custódia.
- **Recomendação:** pasta local + HD externo periódico.

---

## 4. Consequências

### Positivas

- **Simplicidade operacional:** apenas um botão.
- **Controle total:** o Admin decide quando e onde.
- **Sem overhead contínuo:** backup só consome recursos quando acionado.
- **Versionamento:** múltiplos pontos de restauração.
- **Portabilidade:** o `.zip` pode ser copiado para HD externo, pen drive etc.
- **Sem criptografia:** restauração trivial, sem senhas.

### Negativas

- **Dependência da disciplina do Admin:** se esquecer, pode perder dados.
- **Sem backup automático:** não há proteção contra falhas súbitas.
- **Sem criptografia:** o `.zip` fica exposto se armazenado em local inseguro.
- **Risco de esquecimento:** pode passar semanas sem backup.
- **Manual:** não há registro automático de tentativas falhas.

### Riscos residuais

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Admin esquece de fazer backup | Alta | Alto | Alerta de backup antigo (RNF-026) |
| Backup salvo em pasta sincronizada | Média | Alto | Aviso na UI + verificação do caminho |
| Backup corrompido | Baixa | Alto | Validação do `.zip` após criação |
| Disco falha antes do backup | Média | Alto | Rotina semanal + HD externo |
| Restauração mal feita | Baixa | Alto | Backup antes de restaurar + confirmação |
| Perda do `.zip` | Média | Alto | Manter cópia em HD externo |

---

## 5. Alternativas consideradas

### Alternativa A — Backup automático diário

- **Prós:** sem dependência do Admin, proteção contínua.
- **Contras:** complexidade, consumo de recursos, risco de sobrescrita.
- **Por que não:** o usuário escolheu manual.

### Alternativa B — Backup automático semanal + manual

- **Prós:** equilíbrio entre automação e controle.
- **Contras:** mais complexo que o manual puro.
- **Por que não:** foge do escopo escolhido; pode ser adicionado no futuro.

### Alternativa C — Backup em nuvem (Drive, Dropbox, S3)

- **Prós:** redundância geográfica, acesso remoto.
- **Contras:** viola R-033 (sem criptografia), risco LGPD, dependência de terceiros.
- **Por que não:** o usuário quer dados locais.

### Alternativa D — Backup com criptografia

- **Prós:** segurança mesmo em pasta sincronizada.
- **Contras:** senha para gerenciar, complexidade de recuperação.
- **Por que não:** o usuário escolheu sem criptografia (R-033).

### Alternativa E — Replicação em tempo real (streaming replication)

- **Prós:** proteção contínua, baixo RPO.
- **Contras:** complexidade altíssima, recursos, overkill.
- **Por que não:** incompatível com o escopo do piloto.

---

## 6. Implementação

### 6.1. Fluxo de backup

```
Admin clica em "Fazer backup agora"
        │
        ▼
┌─────────────────────────────────────────────┐
│  1. Validar caminho de destino              │
│     (alertar se for OneDrive/Drive)         │
│                                             │
│  2. Criar pasta temporária                  │
│     tmp/backup_YYYY-MM-DD_HH-MM/            │
│                                             │
│  3. Executar pg_dump                        │
│     pg_dump -F c -f dump.pgdump             │
│                                             │
│  4. Copiar sessão do WhatsApp               │
│     cp -r sessions/baileys/ tmp/.../sessions│
│                                             │
│  5. Copiar configurações                    │
│     cp settings.json tmp/.../               │
│                                             │
│  6. Compactar em .zip                       │
│     backup_YYYY-MM-DD_HH-MM.zip             │
│                                             │
│  7. Mover para pasta de destino             │
│                                             │
│  8. Registrar em backup_history             │
│                                             │
│  9. Validar integridade do .zip             │
│                                             │
│ 10. Notificar Admin (sucesso/falha)         │
└─────────────────────────────────────────────┘
```

### 6.2. Fluxo de restauração

```
Admin clica em "Restaurar backup"
        │
        ▼
┌─────────────────────────────────────────────┐
│  1. Listar backups disponíveis              │
│     (da pasta de destino + histórico)       │
│                                             │
│  2. Admin seleciona um backup               │
│                                             │
│  3. Confirmar operação (aviso: substitui)   │
│                                             │
│  4. Fazer backup automático do estado atual │
│     (segurança antes de restaurar)          │
│                                             │
│  5. Parar aplicação                         │
│                                             │
│  6. Descompactar .zip em pasta temporária   │
│                                             │
│  7. Dropar e recriar banco                  │
│     pg_restore --clean -d whatsapp_automation│
│                                             │
│  8. Restaurar sessão do WhatsApp            │
│                                             │
│  9. Restaurar configurações                 │
│                                             │
│ 10. Reiniciar aplicação                     │
│                                             │
│ 11. Validar integridade                     │
│                                             │
│ 12. Notificar Admin                        │
└─────────────────────────────────────────────┘
```

### 6.3. Interface de backup

```
┌─────────────────────────────────────────────────────────────────┐
│  BACKUP E RESTAURAÇÃO                                           │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  Último backup: 28/09 08:00 — 2,3 MB                            │
│  Caminho: C:\Users\...\backups\2026-09-28_08-00.zip             │
│                                                                 │
│  Backups recentes:                                              │
│  • 28/09 08:00 — 2,3 MB                                         │
│  • 27/09 08:00 — 2,2 MB                                         │
│  • 26/09 08:00 — 2,1 MB                                         │
│                                                                 │
│  Pasta de destino: C:\Users\...\backups  [Alterar]              │
│                                                                 │
│  [Fazer backup agora]   [Restaurar backup]                      │
│                                                                 │
│  ⚠ A restauração substitui o banco atual.                       │
│  ⚠ Sem criptografia — proteja a pasta de destino.               │
│  ⚠ Não salve em OneDrive, Google Drive ou similares.            │
└─────────────────────────────────────────────────────────────────┘
```

### 6.4. Estrutura do arquivo `.zip`

```
backup_2026-09-28_08-00.zip
├── database.pgdump           # Dump do PostgreSQL
├── sessions/
│   └── baileys/              # Sessão do WhatsApp
│       ├── creds.json
│       └── ...
├── settings.json             # Configurações
└── manifest.json             # Metadados
```

**manifest.json:**
```json
{
  "version": "1.0",
  "created_at": "2026-09-28T08:00:00-03:00",
  "database_version": "15.4",
  "app_version": "0.1.0",
  "files": {
    "database": "database.pgdump",
    "session": "sessions/baileys/",
    "settings": "settings.json"
  },
  "checksum": "sha256:..."
}
```

### 6.5. Código de backup

```typescript
// src/backup/backupService.ts

import { exec } from 'child_process';
import { promisify } from 'util';
import archiver from 'archiver';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

export async function createBackup(destPath: string): Promise<BackupResult> {
  // 1. Validar caminho
  if (isSyncedFolder(destPath)) {
    await notifyAdmin('⚠ Pasta de backup é sincronizada. Recomendamos pasta local.', 'WARN');
  }

  const timestamp = formatTimestamp(new Date());
  const tmpDir = path.join(os.tmpdir(), `backup_${timestamp}`);
  await fs.mkdir(tmpDir, { recursive: true });

  try {
    // 2. pg_dump
    const dumpPath = path.join(tmpDir, 'database.pgdump');
    await execAsync(`pg_dump -U ${DB_USER} -d ${DB_NAME} -F c -f "${dumpPath}"`);

    // 3. Copiar sessão
    await fs.cp(SESSION_PATH, path.join(tmpDir, 'sessions/baileys'), { recursive: true });

    // 4. Copiar settings
    await fs.copyFile(SETTINGS_PATH, path.join(tmpDir, 'settings.json'));

    // 5. Manifest
    await fs.writeFile(
      path.join(tmpDir, 'manifest.json'),
      JSON.stringify(buildManifest(), null, 2)
    );

    // 6. Zipar
    const zipName = `backup_${timestamp}.zip`;
    const zipPath = path.join(destPath, zipName);
    await zipDirectory(tmpDir, zipPath);

    // 7. Validar
    const stats = await fs.stat(zipPath);

    // 8. Registrar
    await db.insert('backup_history', {
      path: zipPath,
      size_bytes: stats.size,
      created_at: new Date(),
    });

    // 9. Limpar tmp
    await fs.rm(tmpDir, { recursive: true, force: true });

    // 10. Notificar
    await notifyAdmin(`Backup concluído: ${zipName} (${formatBytes(stats.size)})`, 'INFO');

    return { success: true, path: zipPath, size: stats.size };
  } catch (err) {
    await fs.rm(tmpDir, { recursive: true, force: true });
    await notifyAdmin(`Falha no backup: ${err.message}`, 'CRITICAL');
    throw err;
  }
}
```

### 6.6. Código de restauração

```typescript
// src/backup/restoreService.ts

export async function restoreBackup(zipPath: string): Promise<RestoreResult> {
  // 1. Confirmar com o Admin
  const confirmed = await askConfirmation(
    'A restauração substitui o banco atual. Fazer backup do estado atual antes?'
  );

  if (confirmed) {
    await createBackup(DEFAULT_BACKUP_PATH);
  }

  // 2. Parar aplicação
  await stopApp();

  const tmpDir = path.join(os.tmpdir(), `restore_${Date.now()}`);
  await fs.mkdir(tmpDir, { recursive: true });

  try {
    // 3. Descompactar
    await unzip(zipPath, tmpDir);

    // 4. Restaurar banco
    const dumpPath = path.join(tmpDir, 'database.pgdump');
    await execAsync(`pg_restore -U ${DB_USER} -d ${DB_NAME} --clean --if-exists "${dumpPath}"`);

    // 5. Restaurar sessão
    await fs.rm(SESSION_PATH, { recursive: true, force: true });
    await fs.cp(path.join(tmpDir, 'sessions/baileys'), SESSION_PATH, { recursive: true });

    // 6. Restaurar settings
    await fs.copyFile(path.join(tmpDir, 'settings.json'), SETTINGS_PATH);

    // 7. Validar
    await validateDatabase();

    // 8. Reiniciar app
    await startApp();

    await notifyAdmin('Restauração concluída', 'INFO');
    return { success: true };
  } catch (err) {
    await notifyAdmin(`Falha na restauração: ${err.message}`, 'CRITICAL');
    throw err;
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}
```

### 6.7. Alerta de backup antigo

```typescript
// src/backup/stalenessChecker.ts

export async function checkBackupStaleness() {
  const last = await db.query(
    'SELECT created_at FROM backup_history ORDER BY created_at DESC LIMIT 1'
  );

  if (!last) {
    await notifyAdmin('Nenhum backup encontrado. Recomendamos fazer um agora.', 'WARN');
    return;
  }

  const daysSince = daysBetween(last.created_at, new Date());
  if (daysSince >= 7) {
    await notifyAdmin(`Último backup há ${daysSince} dias. Recomendamos fazer um novo.`, 'WARN');
  }
}
```

---

## 7. Configuração

```typescript
// src/config/settings.ts

export interface BackupSettings {
  backupPath: string;                    // pasta local
  autoBackupEnabled: false;              // R-032: manual
  stalenessAlertDays: 7;                 // alertar após 7 dias
  encryptBackup: false;                  // R-033
  syncedFoldersWarnList: string[];       // ['OneDrive', 'Google Drive', 'Dropbox']
  retentionPolicy: {                     // opcional
    keepLast: 30,                        // manter últimos 30 backups
  };
}
```

---

## 8. Critérios de sucesso da decisão

- **Funcionalidade:** backup gera `.zip` válido e restaurável.
- **Versionamento:** múltiplos backups coexistem, nomeados por data/hora.
- **Integridade:** o `.zip` é validado após criação.
- **Recuperação:** restauração funciona sem perda de dados.
- **Segurança:** alerta exibido se o caminho for pasta sincronizada.
- **Disciplina:** alerta após 7 dias sem backup.

---

## 9. Referências

- `docs/02-requisitos-nao-funcionais.md` — RNF-020 a RNF-028
- `docs/03-regras-de-negocio.md` — RN-101 a RN-106
- `docs/08-adr/003-postgresql-local.md` — ADR do banco
- `docs/08-adr/005-sem-criptografia.md` — ADR de criptografia
- R-031, R-032, R-033, R-045