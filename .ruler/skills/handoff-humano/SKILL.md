---
name: handoff-humano
description: Gatilhos de handoff, silêncio obrigatório, notificação local e modo copiloto. Use quando precisar interromper a automação e chamar o usuário.
---

# Handoff Humano

## Quando usar
- Lead pede preço, proposta ou orçamento (R-012)
- Lead demonstra intenção de agendar (R-012)
- Lead pergunta se é bot (R-056)
- Lead demonstra irritação ou ameaça denúncia/bloqueio (R-066)
- Lead pede opt-out (R-024)
- Dúvida técnica complexa (R-065)
- Mídia recebida (R-038)

## O que faz
- Pausa automação para aquele lead
- Em caso de pergunta sobre bot: silêncio total (R-057)
- Em caso de irritação/ameaça: silêncio total (R-066)
- Notifica localmente com som + pop-up (R-013)
- Coloca bot em modo copiloto após você assumir (R-014)

## Limites
- NUNCA enviar mensagem após handoff
- NUNCA tentar contornar opt-out
- NUNCA negar/admitir automação sozinho