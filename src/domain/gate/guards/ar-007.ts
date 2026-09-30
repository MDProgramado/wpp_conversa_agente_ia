import { dentroDaJanelaOperacional } from "../../business-hours.js";
import type { GateInput } from "../types.js";

/**
 * AR-007 — janela operacional (R-006, R-058): dias úteis, 7h–17h em São Paulo.
 *
 * A decisão é calculada no fuso de `context.tz`, nunca na hora local da máquina.
 *
 * O guard devolve só a razão, sem montar texto de `detail`: o `detail` é
 * responsabilidade de quem chama o gate, e um segundo export aqui seria uma
 * segunda superfície a manter em sincronia com a regra. A formatação do horário
 * local vive em `formatarHoraLocal` (business-hours.ts) para quem precisar.
 *
 * Exatamente um export por arquivo de guard — é o que `guard-order.ts` assume ao
 * montar o pipeline.
 */
export const evaluate = (input: GateInput) => {
	const { now, tz, windowStartHour, windowEndHour } = input.context;
	const dentro = dentroDaJanelaOperacional(
		now,
		tz,
		windowStartHour,
		windowEndHour,
	);
	if (dentro) return null;
	return "ar007_fora_da_janela" as const;
};
