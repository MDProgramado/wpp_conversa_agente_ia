/**
 * Mídia é um branded type sem construtor exportado: nenhum código de produção
 * consegue fabricar um valor de mídia para enviar. Não existe `sendMedia`.
 */
export type OutboundPart =
	| { readonly kind: "text" }
	| { readonly kind: "link"; readonly href: string };

export interface ChannelPort {
	sendText(
		conversationId: string,
		text: string,
		idempotencyKey: string,
	): Promise<void>;
	readQuota(today: Date): Promise<{ sent: number; cap: number }>;
	markNumberInvalid(
		phoneE164: string,
		reason: "invalid" | "unreachable",
	): Promise<void>;
}
