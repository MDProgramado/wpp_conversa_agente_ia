import {
	primeiroTermoQueCasa,
	SCHEDULE_TERM,
} from "../patterns/automation-disclosure.js";
import type { GateInput } from "../types.js";

/**
 * AR-003 — agendar reunião sozinho.
 *
 * `\bmarcar\b` e `\breunião\b` entram na lista porque a intenção proibida se
 * manifesta como "posso marcar um café" e "te mando o horário", mesmo sem a
 * palavra "agendar". Bloquear é fail-closed de propósito (D-11): o gate não pode
 * tentar distinguir "vou agendar" de "já agendei".
 */
export const evaluate = (input: GateInput) => {
	const achado = primeiroTermoQueCasa(input.outbound.text, [SCHEDULE_TERM]);
	return achado === null ? null : ("ar003_agendamento" as const);
};
