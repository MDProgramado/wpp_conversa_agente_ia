# ADR-001 — Canal Híbrido: Conexão Não Oficial → API Oficial

- **Status:** Aceito
- **Data:** 2026-09-28
- **Decisores:** Admin (você), System Architect
- **Contexto:** Fase 1 — Fundação, Canal e Gate de Envio
- **Relacionado a:** R-015, R-016, R-059, AR-007, AR-008

---

## 1. Contexto

O sistema precisa se conectar ao WhatsApp para enviar e receber mensagens. Existem três caminhos principais:

1. **API oficial do WhatsApp Business (Meta)** — estável, sem risco de banimento, mas com custo por mensagem e exigência de opt-in para mensagens iniciadas pelo negócio.
2. **Biblioteca não oficial** (Baileys, WPPConnect, Venom) — gratuita, sem tarifa por mensagem, mas com **alto risco de banimento** por violar os Termos de Uso.
3. **WhatsApp Web automatizado** (Puppeteer/Selenium) — gratuito, frágil, quebra com frequência e também com alto risco de banimento.

O usuário está em **fase de piloto**, com número dedicado exclusivo para vendas, volume baixo (até 20 leads/dia, 20–30 mensagens/dia), e precisa validar a operação antes de investir em infraestrutura oficial.

---

## 2. Decisão

Adotar **estratégia híbrida em duas fases**:

### Fase 1 — Piloto (agora)
- Conexão **não oficial** via **Baileys** (ou WPPConnect como alternativa).
- **Número dedicado** exclusivo para vendas (R-059).
- Volume conservador: **20–30 mensagens/dia** (R-023).
- Janela restrita: **dias úteis, 7h–17h** (R-006).
- **Aquecimento sugerido** (R-039) com controle manual (R-040).
- Gate de envio aplicando os 12 anti-requisitos como invariantes.

### Fase 2 — Expansão (quando houver resultados)
- Migração para **API oficial do WhatsApp Business** (Meta).
- Número dedicado **homologado** com selo de verificação.
- Custo por mensagem + franquia gratuita de 1.000 conversas de serviço/mês.
- **Zero risco de banimento** por uso comercial (dentro das políticas).
- **Opt-in obrigatório** para mensagens iniciadas pelo negócio — o que exige ajuste no fluxo (a definir).

A migração é **planejada**, não imediata. O gatilho é o atingimento dos critérios de sucesso do piloto (R-061, R-062).

---

## 3. Justificativa

### Por que não começar direto com a API oficial?

- **Custo:** a API oficial tem tarifa por mensagem. No piloto, com volume baixo e sem validação de conversão, o custo pode não se justificar.
- **Opt-in:** a API oficial exige opt-in explícito para mensagens iniciadas pelo negócio. O sistema atual opera com **legítimo interesse** (R-064) e **sem opt-in** (R-063), o que **impossibilita** o uso da API oficial para prospecção ativa neste momento.
- **Complexidade:** a API oficial exige número homologado, verificação de negócio e configuração de templates aprovados — overhead alto para um piloto.
- **Validação primeiro:** o objetivo do piloto é **provar que o fluxo funciona** (qualificação, follow-up, handoff, conversão). A API oficial não muda a lógica de negócio; ela só troca o canal.

### Por que aceitar o risco da conexão não oficial no piloto?

- **Custo zero:** sem tarifa por mensagem, sem custo de homologação.
- **Velocidade:** setup imediato via QR Code, sem burocracia.
- **Controle:** volume conservador + janela restrita + aquecimento reduzem (mas não eliminam) o risco de banimento.
- **Número dedicado:** se o número for banido, a operação é interrompida, mas **não há perda de dados** (PostgreSQL local) e o número pode ser trocado.
- **Aprendizado:** o piloto vai gerar dados reais de conversão, objeções, taxas de resposta e qualificação — insumos para decidir se vale migrar.

### Por que isolar o canal em um adaptador?

- **Troca sem refatoração:** a lógica de negócio (IA, CRM, follow-up, handoff) não conhece o canal. A troca de Baileys para API oficial é feita no adapter.
- **Testabilidade:** o adapter pode ser mockado em testes.
- **Evolução:** permite adicionar outros canais no futuro (Telegram, e-mail) sem tocar no núcleo.

---

## 4. Consequências

### Positivas

- **Custo zero no piloto** — sem tarifa por mensagem.
- **Setup rápido** — QR Code e pronto.
- **Validação real** — o fluxo é testado em condições reais antes de investir.
- **Flexibilidade** — troca de canal sem refatoração.
- **Controle de risco** — volume conservador, janela restrita, aquecimento.
- **Dados locais** — PostgreSQL local preserva histórico mesmo se o número for banido.

### Negativas

- **Risco de banimento** — o número dedicado pode ser bloqueado a qualquer momento. Mitigação: volume conservador, janela restrita, aquecimento, backup de sessão.
- **Instabilidade da biblioteca** — Baileys pode quebrar com atualizações do WhatsApp. Mitigação: logs detalhados + notificação local + plano de migração.
- **Migração futura pode exigir novo número** — a API oficial pode não aceitar o mesmo número usado na conexão não oficial. Mitigação: planejar a migração com antecedência.
- **Opt-in obrigatório na API oficial** — o fluxo atual não coleta opt-in. Mitigação: ajustar o fluxo na fase de migração (a definir).
- **Sem criptografia local (R-033)** — a sessão do WhatsApp fica exposta. Mitigação: controle de acesso ao PC.

### Riscos residuais

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Banimento do número | Média | Alto | Volume conservador + aquecimento + janela restrita |
| Quebra da biblioteca | Média | Médio | Logs + notificação + plano de migração |
| Migração exigir novo número | Alta | Médio | Planejamento antecipado + backup de histórico |
| API oficial exigir opt-in | Alta | Alto | Ajuste de fluxo na fase de migração |

---

## 5. Alternativas consideradas

### Alternativa A — API oficial desde o início

- **Prós:** estável, sem risco de banimento, conformidade.
- **Contras:** custo por mensagem, opt-in obrigatório, complexidade de homologação.
- **Por que não:** o sistema não tem opt-in (R-063), o que inviabiliza a prospecção ativa pela API oficial. Além disso, o custo não se justifica antes de validar conversão.

### Alternativa B — WhatsApp Web automatizado (Puppeteer/Selenium)

- **Prós:** gratuito, sem biblioteca de terceiros.
- **Contras:** frágil, quebra com atualizações da UI, alto risco de banimento, difícil de manter.
- **Por que não:** Baileys é mais robusto e tem comunidade ativa. O risco de banimento é semelhante, mas a manutenção é menor.

### Alternativa C — Não automatizar; apenas CRM manual

- **Prós:** zero risco de banimento.
- **Contras:** não atende ao objetivo do projeto (automação de conversa).
- **Por que não:** o problema central é a escala e a consistência do follow-up.

### Alternativa D — Usar múltiplos números não oficiais

- **Prós:** distribui risco.
- **Contras:** complexidade operacional, mais sessões, mais risco agregado.
- **Por que não:** o usuário escolheu número único (R-059). Múltiplos números ficam para o futuro, se necessário.

---

## 6. Implementação

### 6.1. Interface do adapter

```typescript
// src/channel/adapter.interface.ts

export interface ChannelAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  onMessage(handler: (msg: IncomingMessage) => void): void;
  onDisconnect(handler: () => void): void;

  sendText(to: string, text: string): Promise<SendResult>;
  // NÃO existe sendMedia() — AR-004

  getSession(): Promise<SessionData>;
  restoreSession(data: SessionData): Promise<void>;
}
```

### 6.2. Implementações

| Arquivo | Implementação | Status |
|---|---|---|
| `src/channel/baileys.adapter.ts` | Baileys | **Fase 1 (agora)** |
| `src/channel/official.adapter.ts` | API oficial | Fase 2 (futuro) |

### 6.3. Configuração

```typescript
// src/config/settings.ts

export interface ChannelSettings {
  type: 'baileys' | 'official';
  phoneNumber: string;
  sessionPath: string;
  dailyLimit: number;      // 20–30
  windowStart: string;     // "07:00"
  windowEnd: string;       // "17:00"
  windowDays: number[];    // [1,2,3,4,5] — seg a sex
  warmupPhase: number;     // 1–5
}
```

### 6.4. Migração para API oficial

Passos (quando decidido):

1. Criar conta no Meta Business Suite.
2. Verificar negócio.
3. Homologar número dedicado (pode ser novo).
4. Configurar templates aprovados.
5. Implementar `official.adapter.ts` seguindo a mesma interface.
6. Trocar `channel.type` para `'official'`.
7. Validar que histórico, status e agendamentos foram preservados.
8. Manter o adapter não oficial como fallback, se necessário.

---

## 7. Critérios de sucesso da decisão

- **Fase 1:** operar 30 dias sem banimento, atingindo 5 reuniões agendadas/mês e 30% de qualificação (R-061, R-062).
- **Fase 2:** migrar para API oficial sem perda de histórico, status ou agendamentos (AC-024).

Se a Fase 1 falhar por banimento antes de atingir os critérios:
- Ativar número de backup.
- Reduzir volume e revisar aquecimento.
- Antecipar migração para API oficial, se viável.

---

## 8. Referências

- `docs/04-arquitetura.md` — camadas e adapter
- `docs/09-criterios-de-aceitacao.md` — AC-024 (migração)
- `docs/10-anti-requisitos.md` — AR-007, AR-008
- `.planning/research/STACK.md` — pesquisa de stack (GSD)
- R-015, R-016, R-023, R-039, R-040, R-059, R-061, R-062