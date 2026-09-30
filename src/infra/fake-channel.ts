/**
 * Dublê de `ChannelPort` para testes e para o esqueleto rodar sem parear o número.
 *
 * **Não importa Baileys e não toca a rede.** É isso que permite aos property tests
 * exercitarem o gate milhares de vezes em milissegundos, e que permite o esqueleto
 * da fase subir sem o número dedicado estar pareado.
 */
import type { ChannelPort } from "../domain/ports/ChannelPort.js";
import { logger } from "./logger.js";

/** O que foi enviado, para o teste afirmar. Em memória e descartável. */
export interface EnvioFake {
	readonly conversationId: string;
	readonly text: string;
	readonly idempotencyKey: string;
}

/**
 * Cota de diagnóstico por dia: o teto físico de R-023 (30). O `cap` do servidor
 * (`fetchNewChatMessageCap`) entra em `readQuota`; aqui é a constante que o esqueleto
 * usa antes de existir canal pareado.
 */
export const DIAGNOSTICA_POR_DIA = 30;

export const criarFakeChannel = (
	quotas: Map<string, { sent: number; cap: number }> = new Map(),
	enviados: EnvioFake[] = [],
): ChannelPort & { enviados: EnvioFake[] } => ({
	enviados,

	async sendText(conversationId, text, idempotencyKey) {
		enviados.push({ conversationId, text, idempotencyKey });
		// `char_count` e nunca o corpo: o log é o lugar que sobrevive à rotação
		// (STACK.md §Logging), e o corpo pertence só à tabela `messages` (R-043).
		logger.info(
			{
				event: "channel_fake_send",
				conversation_id: conversationId,
				char_count: text.length,
			},
			"envio simulado",
		);
	},

	async readQuota(today) {
		const chave = today.toISOString().slice(0, 10);
		return quotas.get(chave) ?? { sent: 0, cap: DIAGNOSTICA_POR_DIA };
	},

	async markNumberInvalid() {
		// O fake não tem canal, então não há estado de número para marcar. Fica
		// declarado porque a interface exige; LEAD-03 é responsabilidade do
		// adaptador real (01-03).
	},
});
