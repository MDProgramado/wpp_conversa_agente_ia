/**
 * `src/domain/business-hours.ts` — a janela operacional isolada e testável.
 *
 * Fica em módulo próprio, sem dependência de I/O, porque a mesma pergunta é feita
 * em dois lugares: o guard AR-007 (decidir) e a fila (quando reprocessar). Se fosse
 * código inline dentro do guard, as duas perguntas divergiriam com o tempo.
 */
import { describe, expect, it } from "vitest";
import {
	ehDiaUtil,
	formatarHoraLocal,
	isWithinWindow,
} from "../../src/domain/business-hours.js";
import { instanteEmZona } from "../gate/fixtures.js";

const TZ = "America/Sao_Paulo";
const emSP = (dia: number, hora: number, minuto = 0) =>
	instanteEmZona(TZ, 2026, 9, dia, hora, minuto);

describe("business-hours — janela de dias úteis 7h–17h", () => {
	it("aceita os dias úteis dentro da janela", () => {
		for (const dia of [21, 22, 23, 24, 25, 28, 29, 30]) {
			expect(ehDiaUtil(emSP(dia, 12), TZ), `2026-09-${dia} 12h`).toBe(true);
		}
	});

	it("rejeita sábado e domingo", () => {
		expect(ehDiaUtil(emSP(26, 12), TZ)).toBe(false); // sábado
		expect(ehDiaUtil(emSP(27, 12), TZ)).toBe(false); // domingo
	});

	it("trata a janela como [7, 17): 6h59 e 17h00 ficam de fora", () => {
		expect(isWithinWindow(emSP(29, 6, 59), TZ, 7, 17)).toBe(false);
		expect(isWithinWindow(emSP(29, 7, 0), TZ, 7, 17)).toBe(true);
		expect(isWithinWindow(emSP(29, 16, 59), TZ, 7, 17)).toBe(true);
		expect(isWithinWindow(emSP(29, 17, 0), TZ, 7, 17)).toBe(false);
		expect(isWithinWindow(emSP(29, 23, 59), TZ, 7, 17)).toBe(false);
	});

	it("o meio-dia de São Paulo continua meio-dia com a máquina em UTC", () => {
		// 12h em São Paulo = 15hZ. Se alguém usasse a hora local do processo, isto
		// viraria 15hUTC e a janela mudaria de tamanho ao longo do dia.
		const meioDia = emSP(29, 12);
		expect(meioDia.toISOString()).toBe("2026-09-29T15:00:00.000Z");
		expect(formatarHoraLocal(meioDia, TZ)).toBe("12:00");
	});

	it("aceita a janela como parâmetros, sem hardcode", () => {
		// 7h–17h é a do plano, mas o parâmetro existe para o 01-05 mover a janela sem
		// editar o guard.
		expect(isWithinWindow(emSP(29, 9), TZ, 7, 12)).toBe(true);
		expect(isWithinWindow(emSP(29, 13), TZ, 7, 12)).toBe(false);
	});
});
