import {
	CURRENCY_TERM,
	DISCOUNT_TERM,
	PERCENT_TERM,
	primeiroTermoQueCasa,
} from "../patterns/automation-disclosure.js";
import type { GateInput } from "../types.js";

/**
 * AR-001 — preço.
 *
 * Corre sobre o TEXTO de saída, não sobre a intenção declarada pelo LLM. A
 * confiança na intenção é exatamente o que o 01-04 ainda não pode ter: um
 * `intent: "conversa"` com "R$ 3.500" no corpo é o caso que mata o número.
 */
export const evaluate = (input: GateInput) => {
	const { text } = input.outbound;
	const achado =
		primeiroTermoQueCasa(text, [CURRENCY_TERM, PERCENT_TERM, DISCOUNT_TERM]) ??
		null;
	return achado === null ? null : ("ar001_preco" as const);
};
