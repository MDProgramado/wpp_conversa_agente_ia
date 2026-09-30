import type { GateInput } from "../types.js";

/**
 * AR-011 — base legal e registro (R-064, LGPD).
 *
 * Quatro campos obrigatórios: origem, base legal, finalidade e a data do
 * registro. Falta qualquer um e o envio para.
 *
 * A data é comparada com `now`, não só checada como não-nula: um registro
 * **no futuro** é tão invalido quanto um ausente — indicaria que a base legal
 * foi "registrada" antes de existir. A comparação é estrita (`>=`), então um
 * registro no mesmo instante do envio também barra.
 */
export const evaluate = (input: GateInput) => {
	const { originSource, legalBasis, purpose, legalRegisteredAt } = input.lead;
	if (!originSource || !legalBasis || !purpose || !legalRegisteredAt) {
		return "ar011_base_legal" as const;
	}

	const registrado = Date.parse(legalRegisteredAt);
	if (Number.isNaN(registrado)) return "ar011_base_legal" as const;

	return registrado >= input.context.now.getTime()
		? ("ar011_base_legal" as const)
		: null;
};
