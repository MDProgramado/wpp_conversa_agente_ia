import type { GateInput } from "../types.js";

/**
 * AR-008 — limite diário (R-023).
 *
 * O teto é `min(limite configurado, cap físico)`: o Admin pode baixar o limite
 * (25 no piloto) mas nunca acima do cap (30, a trava dura de R-023). Se
 * config e cap divergissem, o cap vence — é a única ordem que garante que
 * nenhuma configuração possa afrouxar a trava.
 *
 * `>=`, não `>`: com limite 25, a 26ª mensagem é a que viola. `sentToday` é o
 * que já foi reservado, então ele já vai para 25.
 */
export const evaluate = (input: GateInput) => {
	const { sentToday, dailyMessageLimit, dailyMessageCap } = input.context;
	const teto = Math.min(dailyMessageLimit, dailyMessageCap);
	return sentToday >= teto ? ("ar008_limite_diario" as const) : null;
};
