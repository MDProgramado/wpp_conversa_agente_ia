# ADR-011 — Painel Único com Modo em Tempo Real e Kill Switch

- **Status:** Aceito
- **Data:** 2026-09-28
- **Decisores:** Admin (você), System Architect
- **Contexto:** Fase 3 — Cadência, Operação e Painel
- **Relacionado a:** R-046, R-013, R-014, R-034, R-045, R-021, R-043

---

## 1. Contexto

O Admin precisa controlar toda a operação em tempo real:

- Ver leads e conversas.
- Assumir conversas manualmente.
- Pausar e retomar a automação.
- Ver sugestões da IA.
- Acompanhar status do pipeline.
- Ser notificado de handoffs e falhas críticas.
- Alternar entre modos (automático, copiloto, pausado, silêncio).

Existem várias formas de organizar essa interface:

1. **Múltiplas telas** (uma para leads, uma para chat, uma para CRM, uma para configurações).
2. **Painel único** com todas as informações em uma tela.
3. **Painel dividido** (lista + chat + sugestões + histórico + ações).
4. **Modo inbox** (fila priorizada por urgência).

A escolha afeta diretamente a velocidade de reação a handoffs, o risco de perder leads quentes e a usabilidade geral.

---

## 2. Decisão

Implementar **painel único** dividido em três colunas, com:

### Estrutura visual
- **Coluna esquerda:** lista de leads com status, tags e indicador de modo.
- **Coluna central:** chat ativo com histórico, campo de digitação e indicador de handoff.
- **Coluna direita:** sugestões da IA, histórico do lead, notas e ações rápidas.

### Modo em tempo real
- Indicador de modo do bot em destaque (AUTO, COPILOTO, PAUSADO, SILÊNCIO).
- Notificação local (som + pop-up) para handoff e falhas críticas.
- Atualização em tempo real do status do lead e do pipeline.

### Kill switch (trava de emergência)
- Botão visível para **parar toda a automação** imediatamente.
- Pausa global: nenhuma mensagem sai até o Admin retomar.
- Útil em caso de comportamento estranho, banimento ou incidente.

### Ações rápidas
- Pausar bot (lead específico).
- Assumir conversa (modo copiloto).
- Devolver ao bot (modo automático).
- Aceitar/editar/descartar sugestão da IA.
- Criar nota, tarefa, tag.

### Atalhos de teclado
- `Ctrl+Shift+K`: kill switch (pausa global).
- `Ctrl+Shift+A`: assumir conversa ativa.
- `Ctrl+Shift+D`: devolver ao bot.
- `Ctrl+Shift+Enter`: aceitar sugestão.
- `Esc`: cancelar ação.

---

## 3. Justificativa

### Por que painel único?

- **Velocidade de reação:** o Admin vê tudo em uma tela, sem trocar de janela.
- **Contexto completo:** chat + histórico + sugestões + status ao mesmo tempo.
- **Menos erros:** menos cliques, menos navegação, menos chance de perder algo.
- **Foco operacional:** o Admin opera como um "cockpit" — não precisa procurar informação.
- **Alinhamento com R-046:** o requisito pede explicitamente painel dividido com esses elementos.
- **Notificação integrada:** handoffs e falhas aparecem no próprio painel, não em janela separada.

### Por que modo em tempo real?

- **Handoff rápido:** o Admin precisa agir em segundos, não em minutos.
- **Contexto atualizado:** status, modo e mensagens mudam o tempo todo.
- **Confiança:** o Admin sabe exatamente o que o bot está fazendo.
- **Alinhamento com R-013:** notificação local em tempo real.

### Por que kill switch?

- **Emergência:** se o bot começar a se comportar estranho, o Admin para tudo imediatamente.
- **Banimento:** se houver suspeita de bloqueio, o Admin para antes de piorar.
- **Debug:** útil durante desenvolvimento e testes.
- **Compliance:** em caso de incidente, o Admin tem controle total.
- **Simplicidade:** um único botão resolve "parar tudo".

### Por que não múltiplas telas?

- **Fricção:** trocar de tela para ver chat, depois CRM, depois sugestões é lento.
- **Perda de contexto:** o Admin pode esquecer detalhes ao navegar.
- **Risco:** em handoff, cada segundo conta.

### Por que não modo inbox?

- **Fila priorizada é útil**, mas o Admin também precisa ver conversa ativa, sugestões e histórico.
- **Pode ser adicionado depois** como filtro ou visualização alternativa.
- **O painel dividido é mais completo** para operação em tempo real.

---

## 4. Consequências

### Positivas

- **Reação rápida a handoffs:** tudo visível em uma tela.
- **Contexto completo:** chat + histórico + sugestões + ações.
- **Kill switch simples:** um botão para parar tudo.
- **Modo em tempo real:** Admin sabe o que o bot está fazendo.
- **Atalhos:** operação mais rápida.
- **Notificação integrada:** menos chance de perder handoff.

### Negativas

- **Densidade de informação:** tela pode parecer carregada.
- **Responsividade:** otimizado para desktop, não para mobile.
- **Complexidade de UI:** implementar painel dividido é mais trabalhoso que telas simples.
- **Curva de aprendizado:** Admin precisa aprender atalhos e fluxo.

### Riscos residuais

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Tela sobrecarregada | Média | Médio | Design limpo + filtros + colapsar colunas |
| Handoff perdido no meio de outras conversas | Média | Alto | Indicador visual forte + som + pop-up + ordenação por prioridade |
| Kill switch acionado por engano | Baixa | Médio | Confirmação + log + retomada fácil |
| Atalhos conflitarem com o SO | Baixa | Baixo | Configuráveis |
| Performance degradada com muitas conversas | Média | Médio | Paginação + virtualização de lista |
| Admin não perceber mudança de modo | Média | Alto | Indicador visual destacado + transição animada |

---

## 5. Alternativas consideradas

### Alternativa A — Múltiplas telas

- **Prós:** cada tela focada, menos densidade.
- **Contras:** fricção, perda de contexto, reação lenta.
- **Por que não:** inviável para operação em tempo real com handoff.

### Alternativa B — Modo inbox (fila priorizada)

- **Prós:** foco no urgente, fila clara.
- **Contras:** falta contexto do chat ativo, sugestões e histórico.
- **Por que não:** o painel dividido é mais completo. O inbox pode ser um filtro futuro.

### Alternativa C — Painel apenas com chat

- **Prós:** simples, foco na conversa.
- **Contras:** falta lista de leads, sugestões, histórico e ações rápidas.
- **Por que não:** incompleto para a operação.

### Alternativa D — Painel único sem divisão (scroll vertical)

- **Prós:** mais simples de implementar.
- **Contras:** Admin precisa rolar para ver tudo, perde contexto.
- **Por que não:** dificulta a operação em tempo real.

### Alternativa E — Múltiplas janelas (uma por lead)

- **Prós:** paralelismo, cada lead em sua janela.
- **Contras:** caos visual, difícil gerenciar, perde a visão global.
- **Por que não:** inviável para operação com 20–30 leads/dia.

---

## 6. Implementação

### 6.1. Layout do painel

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│  AUTOMAÇÃO WHATSAPP  │  Status: ● Conectado  │  Número: +55 11 9XXXX-XXXX  │  Modo: AUTO     │
│  ─────────────────────────────────────────────────────────────────────────────────────────  │
│  [🔍 Buscar...]  [Filtros ▼]  [Tags ▼]  [Status ▼]  [⚠ 2 handoffs]  [🛑 KILL SWITCH]         │
├─────────────────────┬────────────────────────────────────────────┬───────────────────────────┤
│  LEADS              │  CHAT                                      │  PAINEL LATERAL           │
│  ─────────────────  │  ────────────────────────────────────────  │  ───────────────────────  │
│  🟢 João Silva      │  [14:32] Você: Olá, tudo bem? ...          │  💡 SUGESTÕES DA IA       │
│     Qualificado     │  [14:35] João: Opa, pode sim               │                           │
│  ─────────────────  │  [14:36] Você: Você já tem site?           │  "Entendi! Muitas..."     │
│  🟡 Maria Souza     │  [14:40] João: Não tenho, só Instagram     │  [✓] [✎] [🗑]             │
│     Respondeu       │  [14:42] Você: Entendi. E o que te impede? │                           │
│  ─────────────────  │  [14:45] João: Falta de tempo              │  ───────────────────────  │
│  🔴 Carlos Lima     │  [14:46] João: Quanto custa um site?       │  HISTÓRICO DO LEAD        │
│     Handoff ⚠       │  ⚠ GATILHO: PEDIDO DE PREÇO                │  Status: Qualificado      │
│  ─────────────────  │                                            │  Origem: Busca SP         │
│  ⚪ Ana Costa       │  ──────────────────────────────────────    │  Base legal: Legítimo     │
│     Novo            │  [ Digite sua resposta... ]                │  interesse                │
│  ─────────────────  │  [📎] [😊] [Enviar]                        │                           │
│  ⚪ Pedro Alves      │                                            │  ───────────────────────  │
│     Novo            │  ⚠ HANDOFF ACIONADO — Motivo: Preço        │  NOTAS                    │
│                     │  Bot em silêncio até você assumir.         │  • 14:45 IA: Sem site     │
│                     │  [ASSUMIR CONVERSA]                        │  • 14:40 IA: Qualificado  │
│                     │                                            │                           │
│                     │                                            │  ───────────────────────  │
│                     │                                            │  AÇÕES RÁPIDAS            │
│                     │                                            │  [⏸ Pausar bot]          │
│                     │                                            │  [👤 Assumir]             │
│                     │                                            │  [🤖 Devolver ao bot]     │
│                     │                                            │  [📋 Copiloto]            │
│                     │                                            │  [📝 Nova nota]           │
│                     │                                            │  [✅ Nova tarefa]         │
└─────────────────────┴────────────────────────────────────────────┴───────────────────────────┘
```

### 6.2. Indicadores de modo

| Modo | Indicador visual | Cor | Comportamento |
|---|---|---|---|
| AUTO | 🤖 AUTO | Azul | Bot conduz tudo |
| COPILOTO | 👤 COPILOTO | Amarelo | Bot sugere, não envia |
| PAUSADO | ⏸ PAUSADO | Cinza | Bot não envia |
| SILÊNCIO | 🔇 SILÊNCIO | Vermelho | Bot em silêncio total |
| HANDOFF | ⚠ HANDOFF | Laranja | Aguardando Admin |

### 6.3. Kill switch

```typescript
// src/ui/killSwitch.ts

let globalPause = false;

export async function activateKillSwitch(reason: string) {
  const confirmed = await askConfirmation(
    'Isso pausará TODA a automação imediatamente. Continuar?'
  );
  if (!confirmed) return;

  globalPause = true;
  await db.insert('logs', {
    level: 'CRITICAL',
    module: 'killSwitch',
    message: `Kill switch ativado: ${reason}`,
    context: { activatedAt: new Date(), activatedBy: 'ADMIN' },
  });

  await notifyAdmin('🛑 Kill switch ativado. Toda automação pausada.', 'CRITICAL');
}

export async function deactivateKillSwitch() {
  globalPause = false;
  await db.insert('logs', {
    level: 'INFO',
    module: 'killSwitch',
    message: 'Kill switch desativado',
    context: { deactivatedAt: new Date() },
  });
  await notifyAdmin('✅ Automação retomada.', 'INFO');
}

export function isKillSwitchActive(): boolean {
  return globalPause;
}
```

### 6.4. Integração com o gate

```typescript
// src/gate/evaluatePolicy.ts

export function evaluatePolicy(input: PolicyInput): PolicyResult {
  // Verificação prioritária: kill switch
  if (isKillSwitchActive()) {
    return { allowed: false, action: 'block', reason: 'KILL_SWITCH_ACTIVE' };
  }

  // ... demais verificações dos 12 AR
}
```

### 6.5. Atualizações em tempo real

Tecnologia sugerida:
- **WebSocket** (se UI for web ou Electron).
- **IPC** (se UI for Electron/Tauri).
- **Polling curto** (fallback, menos eficiente).

```typescript
// src/ui/realtime.ts

export function subscribeToUpdates(handlers: {
  onMessage: (msg: Message) => void;
  onStatusChange: (lead: Lead) => void;
  onHandoff: (handoff: Handoff) => void;
  onModeChange: (mode: BotMode) => void;
  onFailure: (failure: Failure) => void;
}) {
  // WebSocket / IPC
  socket.on('message', handlers.onMessage);
  socket.on('statusChange', handlers.onStatusChange);
  socket.on('handoff', handlers.onHandoff);
  socket.on('modeChange', handlers.onModeChange);
  socket.on('failure', handlers.onFailure);
}
```

### 6.6. Atalhos de teclado

```typescript
// src/ui/shortcuts.ts

const SHORTCUTS = {
  'Ctrl+Shift+K': () => activateKillSwitch('Atalho de teclado'),
  'Ctrl+Shift+A': () => assumeActiveConversation(),
  'Ctrl+Shift+D': () => returnToBot(),
  'Ctrl+Shift+Enter': () => acceptActiveSuggestion(),
  'Ctrl+Shift+P': () => pauseActiveBot(),
  'Ctrl+Shift+N': () => createNoteForActiveLead(),
  'Ctrl+Shift+T': () => createTaskForActiveLead(),
  'Esc': () => cancelCurrentAction(),
};

export function registerShortcuts() {
  document.addEventListener('keydown', (e) => {
    const key = `${e.ctrlKey ? 'Ctrl+' : ''}${e.shiftKey ? 'Shift+' : ''}${e.key}`;
    if (SHORTCUTS[key]) {
      e.preventDefault();
      SHORTCUTS[key]();
    }
  });
}
```

### 6.7. Notificações integradas

- **Handoff:** banner no topo do painel + som + pop-up do SO.
- **Falha crítica:** banner vermelho + som + pop-up do SO.
- **Sucesso:** toast discreto no canto.
- **Erro não crítico:** toast amarelo.
- **Kill switch ativo:** banner fixo no topo.

### 6.8. Filtros e ordenação

- **Filtros:** status, tag, nicho, região, data, responsável, número.
- **Ordenação:** por prioridade (handoff > não respondido > recente), por status, por data.
- **Prioridade visual:** handoffs pendentes sempre no topo.
- **Virtualização:** lista virtualizada para performance com muitos leads.

---

## 7. Configuração

```typescript
// src/config/settings.ts

export interface UISettings {
  layout: 'three-columns';        // fixo na Fase 1
  theme: 'dark' | 'light';        // padrão dark
  fontSize: number;               // 14
  shortcuts: ShortcutsConfig;     // atalhos configuráveis
  notifications: {
    handoffSound: true;
    handoffPopup: true;
    failureSound: true;
    failurePopup: true;
    toastDuration: 3000;
  };
  killSwitch: {
    requireConfirmation: true;
    shortcut: 'Ctrl+Shift+K';
  };
  listVirtualization: true;
  maxVisibleConversations: 50;
}
```

---

## 8. Critérios de sucesso da decisão

- **Visibilidade:** Admin vê tudo em uma tela sem navegação.
- **Reação rápida:** handoff acionado e Admin assume em menos de 30 segundos.
- **Kill switch funcional:** pausa global em menos de 2 segundos.
- **Modo claro:** Admin sabe em qual modo está cada conversa.
- **Sem erros:** nenhuma ação inadvertida por falta de indicador.
- **Atalhos funcionais:** atalhos respondem sem conflitar com o SO.

---

## 9. Referências

- `docs/06-wireframes.md` — wireframes detalhados
- `docs/04-arquitetura.md` — camadas, gate, IA
- `docs/08-adr/004-gate-invariantes.md` — gate de envio
- `docs/08-adr/010-shadow-mode.md` — sugestões em shadow mode
- R-013, R-014, R-021, R-034, R-043, R-045, R-046