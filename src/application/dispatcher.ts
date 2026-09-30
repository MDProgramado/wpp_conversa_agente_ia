/**
 * O choke-point: o **único** arquivo de produção que chama `sendText`.
 *
 * "Enviar sem gate" (`envio_sem_gate`) não é um décimo terceiro AR nem um módulo
 * em `guards/`: é a **ausência** de um segundo caminho de `sendText`. Por isso a
 * invariante é provada mecanicamente, por `grep` — o conjunto de arquivos de
 * produção que contêm `sendText(` tem de ser exatamente este — e pela barreira de
 * pacotes do `biome.json`, e não por um guard que só existiria para dizer que
 * não há desvio.
 *
 * Ordem das operações, e por quê nesta ordem:
 *
 * 1. `loadGateSnapshot` — `null` é `erro_nao_mapeado` + **silêncio**. Nunca um
 *    envio com texto de fallback: um fallback seria mensagem não auditada, e o
 *    gate existe para que nada saia sem registro.
 * 2. `reserveMessageQuota` — reservar é mais barato que bloquear, e uma reserva
 *    perdida por um bloqueio posterior é apenas um decremento de cota, o que é
 *    o lado seguro (falhar para menos). O inverso — enviar e descobrir depois que
 *    a cota tinha estourado — é o erro que o AR-008 existe para impedir.
 * 3. `evaluatePolicy` — só depois há o que julgar.
 * 4. Se `block`: grava em `blocked_attempts` e **retorna sem enviar**.
 * 5. Só então `sendText`.
 */
import { evaluatePolicy } from "../domain/gate/evaluate-policy.js";
import type { ChannelPort } from "../domain/ports/ChannelPort.js";
import type { Db } from "../infra/db/client.js";
import { reserveMessageQuota } from "../infra/db/queries/counters.js";
import { loadGateSnapshot } from "../infra/db/queries/snapshot.js";
import { logger } from "../infra/logger.js";

/** O resultado do dispatch, discriminado para o chamador enfileirar ou não. */
export type DispatchResult =
	| { status: "enviado"; messageId: string }
	| { status: "bloqueado"; reason: string; detail: string }
	| { status: "silencio"; reason: string; detail: string };

export interface DispatchDeps {
	readonly db: Db;
	readonly channel: ChannelPort;
	readonly ctx: {
		readonly tz: string;
		readonly windowStartHour: number;
		readonly windowEndHour: number;
		readonly dailyMessageLimit: number;
		readonly dailyMessageCap: number;
		readonly newContactsToday: number;
	};
}

export interface DispatchOpts {
	/** Obrigatório. O dispatcher **nunca** chama `Date.now()`: o instante vem de
	 * fora para que o mesmo caso possa ser reproduzido num teste. */
	readonly now: Date;
	/**
	 * Recusado. Existe só para tornar a tentativa visível em tempo de compilação —
	 * um bypass seria a.Environment não existe chave `bypassGate` aqui: passar algo
	 * assim é erro de tipo, e é essa a barreira.
	 */
	readonly bypassGate?: never;
	readonly idempotencyKey?: string;
}

/** `YYYY-MM-DD` no fuso do negócio — a chave de `daily_counters`. */
const diaLocal = (agora: Date, tz: string): string =>
	new Intl.DateTimeFormat("en-CA", {
		timeZone: tz,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).format(agora);

export const dispatch = async (
	deps: DispatchDeps,
	conversationId: string,
	text: string,
	opts: DispatchOpts,
): Promise<DispatchResult> => {
	const { db, channel, ctx } = deps;
	const dia = diaLocal(opts.now, ctx.tz);

	// (1) snapshot
	const { sent } = await channel.readQuota(opts.now);
	const snapshot = await loadGateSnapshot(db, conversationId, opts.now, {
		...ctx,
		sentToday: sent,
	});

	if (!snapshot) {
		const detail = `conversa ${conversationId} nao encontrada ou sem lead vinculado`;
		// Silêncio + log. Sem `sendText`, sem texto de fallback.
		logger.warn(
			{ event: "gate_erro_nao_mapeado", conversation_id: conversationId },
			detail,
		);
		return { status: "silencio", reason: "erro_nao_mapeado", detail };
	}

	// O texto só entra no snapshot depois da leitura: o snapshot é do **estado**,
	// e o gate é puro, então quem decide o que enviar é quem chama.
	const entrada = {
		...snapshot,
		outbound: { text, parts: [{ kind: "text" as const }] },
	};

	// (2) cota, atomicamente
	const reserva = await reserveMessageQuota(
		db,
		dia,
		ctx.dailyMessageLimit,
		ctx.dailyMessageCap,
	);
	if (!reserva.allowed) {
		const detail = `cota diaria de mensagens esgotada (teto ${reserva.limit} em ${dia})`;
		logger.info(
			{
				event: "gate_bloqueado",
				reason: "ar008_limite_diario",
				conversation_id: conversationId,
			},
			detail,
		);
		return { status: "bloqueado", reason: "ar008_limite_diario", detail };
	}

	// (3) gate
	const decisao = evaluatePolicy(entrada);

	if (decisao.action === "block") {
		// (4) negativo gravado. `blocked_attempts` nasce no 01-02, então a gravação
		// é tolerante a inexistência — e uma falha aqui NUNCA vira permissiva.
		try {
			await db.execute(
				`insert into blocked_attempts (conversation_id, rule_reference, detail, created_at)
				 values ($1, $2, $3, now())`,
			);
		} catch (erro) {
			logger.error(
				{
					event: "blocked_attempts_indisponivel",
					conversation_id: conversationId,
				},
				`negativo do gate nao pode ser gravado: ${String(erro)}`,
			);
		}
		logger.info(
			{
				event: "gate_bloqueado",
				reason: decisao.reason,
				conversation_id: conversationId,
			},
			decisao.detail,
		);
		return {
			status: "bloqueado",
			reason: decisao.reason,
			detail: decisao.detail,
		};
	}

	// (5) só agora envia
	await channel.sendText(
		conversationId,
		text,
		opts.idempotencyKey ?? conversationId,
	);
	return { status: "enviado", messageId: decisao.messageId };
};
