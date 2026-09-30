/**
 * A janela operacional (AR-007 / R-006 / R-058): dias úteis, 7h–17h.
 *
 * Módulo separado e sem I/O porque a mesma pergunta é feita em dois lugares: o
 * guard AR-007 decide, e a fila pergunta "quando reprocessar?". Se fosse código
 * inline no guard, os dois divergiriam com o tempo.
 *
 * **A janela é do negócio, não da máquina.** Se o código usasse `getHours()`,
 * o mesmo instante aprobaria ou barraria dependendo do TZ do processo. Tudo aqui
 * formata explicitamente no fuso recebido.
 */

const WEEKDAY_INDEX: Record<string, number> = {
	Sun: 0,
	Mon: 1,
	Tue: 2,
	Wed: 3,
	Thu: 4,
	Fri: 5,
	Sat: 6,
};

const partesEmZona = (
	instante: Date,
	tz: string,
): { hora: number; minuto: number; diaDaSemana: number } => {
	const fmt = new Intl.DateTimeFormat("en-US", {
		timeZone: tz,
		hour: "2-digit",
		minute: "2-digit",
		weekday: "short",
		hourCycle: "h23",
	});
	const partes = fmt.formatToParts(instante);
	const n = (tipo: Intl.DateTimeFormatPartTypes) =>
		partes.find((p) => p.type === tipo)?.value ?? "";
	return {
		hora: Number(n("hour")),
		minuto: Number(n("minute")),
		diaDaSemana: WEEKDAY_INDEX[n("weekday")] ?? -1,
	};
};

/** Segunda (1) a sexta (5). Sábado e domingo fora. */
export const ehDiaUtil = (instante: Date, tz: string): boolean => {
	const { diaDaSemana } = partesEmZona(instante, tz);
	return diaDaSemana >= 1 && diaDaSemana <= 5;
};

/**
 * Janela **half-open** `[inicio, fim)`: 7h00 entra, 17h00 não.
 *
 * O half-open não é detalhe: com `fim` inclusivo, uma mensagem disparada às
 * 17h00:00 entraria e outra às 17h00:30 não — a fronteira viraria uma decisão
 * de sub-segundo. Com `[inicio, fim)`, 16h59:59 é o último instante aceito.
 */
export const isWithinWindow = (
	instante: Date,
	tz: string,
	inicio: number,
	fim: number,
): boolean => {
	const { hora, minuto } = partesEmZona(instante, tz);
	const minutosDoDia = hora * 60 + minuto;
	return minutosDoDia >= inicio * 60 && minutosDoDia < fim * 60;
};

/** `HH:MM` no fuso do negócio — para a fila calcular o próximo instante válido. */
export const formatarHoraLocal = (instante: Date, tz: string): string => {
	const { hora, minuto } = partesEmZona(instante, tz);
	return `${String(hora).padStart(2, "0")}:${String(minuto).padStart(2, "0")}`;
};

/** Janela completa, já combinada: dia útil E dentro do horário. */
export const dentroDaJanelaOperacional = (
	instante: Date,
	tz: string,
	inicio: number,
	fim: number,
): boolean =>
	ehDiaUtil(instante, tz) && isWithinWindow(instante, tz, inicio, fim);
