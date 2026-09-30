import {
	dentroDaJanelaOperacional,
	formatarHoraLocal,
} from "../../business-hours.js";
import type { GateInput } from "../types.js";

/**
 * AR-007 — janela operacional (R-006, R-058): dias úteis, 7h–17h em São Paulo.
 *
 * A decisão é calculada no fuso de `context.tz`, nunca na hora local da máquina.
 * `detail` carrega o horário local para o Admin entender o motivo no painel sem
 * precisar fazer a conversão mental.
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

/** Usado pelo dispatcher para a mensagem de `detail` (o guard puro não monta texto). */
export const descreverJanela = (input: GateInput): string =>
	`fora da janela ${input.context.windowStartHour}h-${input.context.windowEndHour}h em ${input.context.tz}; agora sao ${formatarHoraLocal(input.context.now, input.context.tz)}`;
