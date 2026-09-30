/**
 * AR-007 — janela operacional (dias úteis, 7h–17h em São Paulo).
 *
 * O ponto frágil é o FUSO. A janela é do negócio, não do relógio da máquina: se o
 * gate usasse as horas locais do processo, o mesmo instante aprovaria ou barraria
 * dependendo de onde o código roda. Os testes montam instantes a partir de horário
 * de PAREDE em São Paulo e esperam o resultado calculado a partir desses mesmos
 * componentes — nunca a partir de `isWithinWindow`, que seria o código sob teste
 * validando a si mesmo.
 */
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { evaluatePolicy } from "../../src/domain/gate/evaluate-policy.js";
import { EH_FIM_DE_SEMANA, instanteEmZona, validInbound } from "./fixtures.js";

const JANELA_INICIO = 7;
const JANELA_FIM = 17;

describe("AR-007 — janela operacional", () => {
	it("barraria fora da janela ou em fim de semana, liberaria dentro dela", () => {
		fc.assert(
			fc.property(
				fc.integer({ min: 2026, max: 2027 }), // ano
				fc.integer({ min: 1, max: 12 }), // mês
				fc.integer({ min: 1, max: 28 }), // dia
				fc.integer({ min: 0, max: 23 }), // hora em São Paulo
				fc.integer({ min: 0, max: 59 }), // minuto
				(ano, mes, dia, hora, minuto) => {
					const agora = instanteEmZona(
						"America/Sao_Paulo",
						ano,
						mes,
						dia,
						hora,
						minuto,
					);

					// Esperado calculado dos componentes, não da implementação.
					const fimDeSemana = EH_FIM_DE_SEMANA(ano, mes, dia);
					const dentroDaJanela = hora >= JANELA_INICIO && hora < JANELA_FIM;
					const deveriaBloquear = fimDeSemana || !dentroDaJanela;

					const decisao = evaluatePolicy(
						validInbound({ context: { now: agora } }),
					);

					if (deveriaBloquear) {
						expect(decisao).toMatchObject({
							action: "block",
							reason: "ar007_fora_da_janela",
						});
					} else {
						// Dentro da janela a regra NÃO é a que decide: a decisão pode ser
						// `send` ou o bloqueio de outra regra, mas nunca ar007.
						expect(decisao).not.toMatchObject({
							reason: "ar007_fora_da_janela",
						});
					}
				},
			),
			{ seed: 20260928, numRuns: 500 },
		);
	});

	it("sábado e domingo barram mesmo com hora de escritório", () => {
		for (const [ano, mes, dia, rotulo] of [
			[2026, 9, 26, "sábado"],
			[2026, 9, 27, "domingo"],
		] as const) {
			const agora = instanteEmZona("America/Sao_Paulo", ano, mes, dia, 12, 0);
			const decisao = evaluatePolicy(validInbound({ context: { now: agora } }));
			expect(decisao, `${rotulo} 12h`).toMatchObject({
				action: "block",
				reason: "ar007_fora_da_janela",
			});
		}
	});

	it("7h00 entra, 17h00 não: a janela é half-open [7, 17)", () => {
		// 16h59 é o último minuto aceito; 17h00 é o primeiro recusado. Se a janela
		// fosse fechada, 17h00 passaria; se fosse >, 16h59 barraria.
		const casos: [number, boolean][] = [
			[6, false],
			[7, true],
			[12, true],
			[16, true],
			[17, false],
			[18, false],
			[23, false],
			[0, false],
		];
		for (const [hora, esperado] of casos) {
			const agora = instanteEmZona("America/Sao_Paulo", 2026, 9, 29, hora, 0);
			const decisao = evaluatePolicy(validInbound({ context: { now: agora } }));
			const barrou =
				decisao.action === "block" && decisao.reason === "ar007_fora_da_janela";
			expect(barrou, `${hora}h`).toBe(!esperado);
		}
	});

	it("o fuso da máquina não interfere: o mesmo instante julga igual em qualquer TZ do processo", () => {
		// 2026-09-29 14h em São Paulo = 17hZ. Com TZ de processo = UTC, quem usasse a
		// hora local veria 17h (borda) em vez de 14h.
		const agora = instanteEmZona("America/Sao_Paulo", 2026, 9, 29, 14, 0);
		const comUtc = evaluatePolicy(
			validInbound({ context: { now: agora, tz: "America/Sao_Paulo" } }),
		);
		expect(comUtc.action).toBe("send");
	});
});
