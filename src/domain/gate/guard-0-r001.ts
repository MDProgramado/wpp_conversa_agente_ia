import { leadNumeroInvalido } from "../number-validation.js";
import type { GateInput } from "./types.js";

/**
 * Guard 0 — R-001, "a primeira mensagem foi enviada por uma pessoa".
 *
 * Fica **fora** de AR-001..AR-012 de propósito: AR-001 é preço, R-001 é canal.
 * Um lead que já comprou continua sendo novo para o bot, então tratá-los como o
 * mesmo controle faria um bloquear o outro indevidamente.
 *
 * `firstContactByHuman` é alimentado só por evento Admin com `key.fromMe ===
 * true` (01-03) — nunca pela fila, pela API REST nem por job.
 */
export const evaluate = (input: GateInput) =>
	input.lead.firstContactByHuman
		? null
		: ("r001_primeiro_contato_nao_humano" as const);

/**
 * `lead_numero_invalido` (LEAD-03 / R-019) fica entre R-001 e AR-011 na ordem
 * canônica: um número que o WhatsApp rejeitou é estado **terminal**, então não
 * adianta o gate aprovar o resto da conversa. A severidade (`invalido` vs
 * `desconhecido`) é do adaptador; aqui o guard só consulta o snapshot.
 */
export const evaluateNumeroInvalido = (input: GateInput) =>
	leadNumeroInvalido(input.lead.waValidationState)
		? ("lead_numero_invalido" as const)
		: null;
