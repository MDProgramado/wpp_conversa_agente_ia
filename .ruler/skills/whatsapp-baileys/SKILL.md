---
name: whatsapp-baileys
description: Conexão local com WhatsApp via Baileys/WPPConnect, sessão, reconexão, QR Code e limites. Use quando precisar implementar ou depurar a camada de canal.
---

# WhatsApp Baileys/WPPConnect

## Quando usar
- Implementar conexão local com WhatsApp
- Tratar sessão, QR Code, reconexão
- Respeitar limites diários e janela de envio

## O que faz
- Inicializa sessão local (auth state)
- Gera QR Code para pareamento
- Reconecta automaticamente com backoff
- Enfileira mensagens respeitando 20–30/dia
- Bloqueia envio fora de dias úteis, 7h–17h
- Detecta mídia recebida e aciona handoff (não processa)

## Limites
- NÃO processar mídia
- NÃO enviar mais que o limite diário
- NÃO responder fora da janela
- NÃO revelar automação

## Exemplos
Entrada: `sendText(phone, "Olá, tudo bem?")`
Saída: mensagem enviada com delay humanizado + "digitando..."

Entrada: áudio recebido
Saída: registrar evento, notificar usuário, acionar handoff