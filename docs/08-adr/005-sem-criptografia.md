# ADR-005 — Sem Criptografia Local de Dados e Sessão

- **Status:** Aceito (com risco assumido)
- **Data:** 2026-09-28
- **Decisores:** Admin (você), System Architect
- **Contexto:** Fase 1 — Fundação, Canal e Gate de Envio
- **Relacionado a:** R-033, R-024, R-031, R-032, R-064

---

## 1. Contexto

O sistema armazena localmente dados sensíveis:

- **Leads:** nome, telefone, endereço.
- **Conversas:** mensagens trocadas com leads.
- **Sessão do WhatsApp:** credenciais que permitem enviar/receber mensagens em nome do número dedicado.
- **Backups:** cópia do banco e da sessão.
- **Logs:** eventos de operação (com dados mascarados).
- **Dados de compliance:** base legal, opt-out, exclusões.

O usuário escolheu **(a)** não implementar criptografia adicional: confiar no controle de acesso do PC (login do Windows) para proteger esses dados.

---

## 2. Decisão

**Não implementar criptografia adicional** nos dados, na sessão do WhatsApp ou nos backups.

A proteção fica por conta de:

- **Login do Windows** (controle de acesso ao usuário).
- **Disco local** (sem compartilhamento em rede).
- **Firewall do Windows** (bloqueio de acesso externo).
- **Responsabilidade do Admin** (não compartilhar a máquina, não instalar malware).

**Não haverá:**
- Criptografia em repouso do banco PostgreSQL.
- Criptografia de campos sensíveis (telefone, endereço).
- Criptografia de arquivos de backup.
- Criptografia da sessão do WhatsApp.
- Criptografia de disco implementada pelo sistema (BitLocker/LUKS ficam a critério do usuário, fora do escopo).

---

## 3. Justificativa

### Por que o usuário escolheu sem criptografia?

- **Simplicidade:** sem senhas adicionais, sem chaves, sem complexidade.
- **Velocidade:** sem overhead de criptografia em operações.
- **Recuperação:** backup e restauração mais simples.
- **Ambiente:** PC pessoal, sem compartilhamento, uso individual.
- **Piloto:** validar o fluxo primeiro, endurecer depois, se necessário.

### Por que isso é aceitável no piloto?

- **Single-user:** apenas você acessa a máquina.
- **Sem exposição externa:** o sistema não abre portas na internet.
- **Dados locais:** nada é enviado para servidores externos além da API de IA (com mascaramento).
- **Volume baixo:** 20–30 mensagens/dia, poucos leads.
- **Risco controlado:** em caso de incidente, o impacto é limitado ao piloto.

### Por que isso é um risco?

- **LGPD:** dados pessoais (nome, telefone, endereço) e conversas são tratados sem criptografia. Em caso de vazamento, a responsabilidade é do controlador.
- **Malware:** qualquer software malicioso no PC pode ler o banco e a sessão.
- **Roubo/perda:** se o PC for roubado, os dados ficam expostos.
- **Sessão do WhatsApp:** sem proteção, pode ser copiada e usada para sequestrar a conta.
- **Backups:** se salvos em pasta sincronizada (OneDrive, Google Drive), os dados saem do controle local sem criptografia.

---

## 4. Consequências

### Positivas

- **Simplicidade:** setup imediato, sem configuração de chaves.
- **Performance:** sem overhead de criptografia.
- **Recuperação:** backup e restauração triviais.
- **Sem senhas adicionais:** menos fricção operacional.
- **Sem risco de perder a chave:** não há chave para perder.

### Negativas

- **Exposição em caso de acesso indevido:** qualquer pessoa com acesso ao PC lê tudo.
- **Exposição em caso de malware:** dados podem ser exfiltrados.
- **Exposição em caso de roubo:** PC roubado = dados vazados.
- **Sessão do WhatsApp vulnerável:** pode ser sequestrada.
- **Risco LGPD:** vazamento pode gerar sanções e responsabilização.
- **Backups inseguros:** se em nuvem, expostos.

### Riscos residuais

| Risco | Probabilidade | Impacto | Mitigação recomendada |
|---|---|---|---|
| Malware no PC | Média | Alto | Antivírus atualizado + não instalar software suspeito |
| Roubo do PC | Baixa | Alto | BitLocker (criptografia de disco do SO) |
| Acesso indevido por terceiros | Baixa | Alto | Senha forte no Windows + bloqueio automático |
| Backup em nuvem exposto | Média | Alto | Salvar backup fora do OneDrive/Drive |
| Sessão do WhatsApp copiada | Baixa | Alto | Bloquear acesso físico + antivírus |
| Vazamento por engenharia social | Baixa | Alto | Não compartilhar credenciais |

---

## 5. Mitigações recomendadas (não implementadas no sistema, mas sugeridas)

Estas mitigações **não fazem parte do sistema**, mas são recomendadas para reduzir o risco:

1. **BitLocker (Windows):** criptografia de disco do sistema operacional.
2. **Senha forte no Windows:** evitar acesso por terceiros.
3. **Bloqueio automático de tela:** após 5 minutos de inatividade.
4. **Antivírus atualizado:** Windows Defender ou similar.
5. **Backup fora do OneDrive/Drive:** pasta local, não sincronizada.
6. **Não compartilhar a máquina:** uso exclusivo do Admin.
7. **Não instalar software desconhecido:** reduz risco de malware.
8. **Firewall do Windows ativo:** bloqueia acessos externos.
9. **Rotina de backup:** pelo menos semanal, em HD externo.
10. **Documentar avaliação de legítimo interesse:** reduz risco LGPD.

---

## 6. Alternativas consideradas

### Alternativa A — Criptografia do banco PostgreSQL

- **Prós:** dados em repouso protegidos.
- **Contras:** complexidade, perda de performance, chave para gerenciar.
- **Por que não:** o usuário escolheu simplicidade no piloto.

### Alternativa B — Criptografia de campos sensíveis

- **Prós:** telefone e endereço protegidos mesmo se o banco vazar.
- **Contras:** complexidade de busca, ordenação, joins.
- **Por que não:** impacta consultas e relatórios.

### Alternativa C — Criptografia de backup

- **Prós:** backup protegido em caso de perda.
- **Contras:** senha para gerenciar, dificuldade de recuperação.
- **Por que não:** o usuário quer recuperação simples.

### Alternativa D — BitLocker (criptografia de disco)

- **Prós:** protege tudo, transparente para o sistema, sem código.
- **Contras:** requer configuração do SO, senha de recuperação.
- **Por que não:** fora do escopo do sistema, mas **recomendado** como mitigação.

### Alternativa E — Criptografia da sessão do WhatsApp

- **Prós:** protege a sessão contra cópia.
- **Contras:** complexidade, chave para gerenciar.
- **Por que não:** o usuário escolheu sem criptografia.

---

## 7. Implementação

### 7.1. Nenhuma mudança no código

O sistema não implementa criptografia. Os dados são armazenados em texto claro.

### 7.2. PostgreSQL

Sem configuração de TDE (Transparent Data Encryption) ou `pgcrypto`. Colunas são `TEXT` normais.

### 7.3. Sessão do WhatsApp

Arquivos de sessão do Baileys são salvos em disco sem criptografia adicional.

```
sessions/
└── baileys/
    ├── creds.json
    ├── app-state-sync-key-*.json
    └── ...
```

### 7.4. Backup

O backup é um dump do PostgreSQL + cópia da pasta de sessão, salvos em pasta local, sem senha.

```bash
pg_dump -U whatsapp_bot -d whatsapp_automation -F c -f backup.dump
cp -r sessions/baileys backup/sessions/
```

### 7.5. Alerta ao usuário

O sistema deve exibir um **aviso claro** na tela de configurações:

```
⚠ AVISO DE SEGURANÇA

Os dados do sistema (leads, conversas, sessão do WhatsApp)
NÃO estão criptografados.

A proteção depende do controle de acesso ao seu PC.
Recomendamos:
- Ativar BitLocker (criptografia de disco do Windows)
- Usar senha forte no Windows
- Não compartilhar a máquina
- Manter antivírus atualizado
- Salvar backups fora de pastas sincronizadas (OneDrive, Drive)
```

---

## 8. Configuração

```typescript
// src/config/settings.ts

export interface SecuritySettings {
  encryptionEnabled: false;       // R-033
  bitlockerRecommended: true;     // apenas alerta
  showSecurityWarning: true;      // exibir aviso ao abrir
  backupPath: string;             // pasta local (não sincronizada)
}
```

---

## 9. Critérios de sucesso da decisão

- **Simplicidade:** o Admin consegue operar sem gerenciar chaves.
- **Recuperação:** backup e restauração funcionam sem senha.
- **Performance:** sem overhead de criptografia.
- **Consciência:** o Admin está ciente do risco e das mitigações recomendadas.
- **LGPD:** avaliação de legítimo interesse documentada.

---

## 10. Aviso legal

Esta decisão **não isenta** o Admin das obrigações da LGPD. Em caso de vazamento de dados pessoais, a responsabilidade é do controlador (Admin).

**Recomendação forte:** validar com advogado especializado em LGPD antes de operar em produção.

---

## 11. Referências

- `docs/02-requisitos-nao-funcionais.md` — RNF-017, RNF-018, RNF-019, RNF-057 a RNF-065
- `docs/03-regras-de-negocio.md` — RN-106
- `docs/08-adr/003-postgresql-local.md` — ADR do banco
- R-033, R-024, R-031, R-032, R-064