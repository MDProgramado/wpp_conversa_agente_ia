import {
	AUTOMATION_TERM,
	primeiroTermoQueCasa,
} from "../patterns/automation-disclosure.js";
import type { GateInput } from "../types.js";

/**
 * AR-006 — revelar a automação.
 *
 * O risco aqui é o inverso do habitual: um regex frouxo calaria o bot em metade
 * das frases, porque "dia" contém "ia" e "javascript" contém "script". Todos os
 * termos de AUTOMATION_TERM usam fronteira de palavra, e os testes de passagem
 * cobrem exatamente essas falsas-positivas.
 */
export const evaluate = (input: GateInput) => {
	const achado = primeiroTermoQueCasa(input.outbound.text, AUTOMATION_TERM);
	return achado === null ? null : ("ar006_revelacao_automacao" as const);
};
