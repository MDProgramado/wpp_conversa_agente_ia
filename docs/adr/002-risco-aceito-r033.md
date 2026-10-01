# ADR-002: Risco Aceito de Segurança de Dados em Repouso (R-033)

**Data:** 2026-10-01
**Status:** Aceito
**Contexto:**
A aplicação processará e armazenará dados de leads e históricos de conversas via WhatsApp em um banco de dados PostgreSQL rodando localmente na máquina do administrador (SO Windows). A exigência é de garantir segurança razoável, mas o requisito R-033 permite assumir risco sobre encriptação adicional nesta fase do MVP.

**Decisão:**
- Não aplicaremos encriptação de banco de dados em repouso (Data at Rest Encryption / Transparent Data Encryption - TDE) na fase inicial do MVP.
- O banco de dados PostgreSQL escutará apenas em `localhost` (127.0.0.1), protegendo-o de acessos via rede externa/LAN.
- A máquina Windows onde a automação roda deve contar com os recursos de segurança nativos do SO (Windows Hello, senha forte, BitLocker ativo se possível) para proteção física e de acesso ao disco.
- Senhas de acesso ao BD e chaves de API ficarão em arquivos `.env` locais, sem encriptação adicional.

**Consequências / Risco:**
- Caso a máquina seja fisicamente comprometida (roubo) e o disco não esteja encriptado pelo BitLocker, os dados poderão ser lidos do disco.
- Este risco foi avaliado como aceitável para um MVP operado por um único usuário e com dados majoritariamente de prospecção B2B pública.
- A limitação a `localhost` mitiga vetores de ataque remotos.
