import type { GateInput } from "./types.js";

/**
 * Kill switch — passo 1 da ordem canônica, antes de qualquer AR.
 *
 * Deliberadamente **não** é um AR numerado: é um controle de operação, o botão
 * de emergência que o Admin aciona quando algo parece errado. Ele precede tudo
 * porque não faz sentido auditar "por qual regra foi barrado" quando a resposta
 * é "o sistema estava desligado".
 */
export const evaluate = (input: GateInput) =>
	input.context.killSwitch ? ("kill_switch_ativo" as const) : null;
