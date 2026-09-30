/**
 * Porta de relógio (01-PATTERNS §5.1, ARCHITECTURE §Padrão 6).
 *
 * **Por que existe.** A janela 7h–17h × dias úteis (R-006/AR-007), a cota diária
 * (R-023/AR-008) e a cadência de follow-up (R-004) são, juntas, a maior superfície
 * de bug do sistema — e quase todo bug delas é um bug de *instante*: mensagem
 * enfileirada às 16h59 e enviada às 7h do dia seguinte, cota do dia anterior
 * consumida no dia certo, follow-up disparando no fim de semana.
 *
 * Nenhuma delas pode ler `Date.now()` diretamente. O instante é lido **uma vez** no
 * topo do tick e injetado. Com isso, um caso vira uma data fixa e reexecutar um dia
 * inteiro é reproduzível — o que é a diferença entre um bug de fuso que se
 * manifesta uma vez por mês e um bug de fuso que um teste pega na primeira vez.
 *
 * **O fuso é do relógio, não do processo.** `NowToken` carrega a zona junto do
 * instante: `isWithinWindow` decide em `America/Sao_Paulo` (D-05) mesmo quando a
 * máquina roda em UTC, e um teste não depende de `TZ` do ambiente. Um `new Date(y, m, d, h)`
 * construiria o instante no fuso da máquina e o teste viraria dependente de onde roda.
 *
 * **Por que é interface e não função.** O `FakeClock` de teste precisa ser
 * determinístico **e** o `SystemClock` precisa ser o único lugar do processo que
 * toca no relógio do SO. Se os dois fossem a mesma função com um parâmetro booleano,
 * `isWithinWindow` acabaria importando a implementação real e o `fc.date()` do
 * property test passaria a ler o relógio de verdade por acidente.
 */

/**
 * O instante, com o fuso em que as regras de negócio devem ser avaliadas.
 *
 * Não é um `Date` puro de propósito: um `Date` não sabe de fuso, e o erro de
 *timezone mais comum deste projeto é exatamente tratar o instante como se estivesse
 * no fuso do processo.
 */
export interface NowToken {
	/** O instante absoluto. O que se compara, o que se grava, o que aparece no log. */
	readonly instant: Date;
	/** Zona IANA do negócio (D-05: `America/Sao_Paulo`). */
	readonly tz: string;
}

/** Fonte de tempo. Uma implementação de produção, uma de teste. */
export interface ClockPort {
	/** Lê o instante **uma vez** por tick. Não é um getter: é uma chamada explícita. */
	now(): NowToken;

	/**
	 * Atraso em **tempo de processo**, não de relógio de parede: serve para a
	 * humanização (Padrão 9) e para o cooldown entre duas mensagens do mesmo par.
	 *
	 * Aceitar um `abort` é o que permite que um handoff (R-012/R-066) cancele um
	 * atraso já iniciado — sem isso, o bot ficaria esperando um atraso de 40 s para
	 * então enviar, e o silêncio exigido pelo AR-010 seria só adiando.
	 *
	 * `ClockPort` não é a porta de *cancelamento*, e não precisa ser: a interface de
	 * humanização da Fase 01-05 recebe o `AbortSignal` pelo seu próprio contrato.
	 */
	sleep(ms: number, signal?: AbortSignal): Promise<void>;
}

/**
 * Relógio de produção. O **único** lugar do código que chama `new Date()` "agora".
 *
 * A zona não é lida do processo: vem de `TZ` (D-05), para que a regra de negócio seja
 * a mesma em qualquer máquina, e não a zona acidental de quem rodou o boot.
 */
export const systemClock = (tz: string): ClockPort => ({
	now: () => ({ instant: new Date(), tz }),
	sleep: (ms, signal) =>
		new Promise<void>((resolve, reject) => {
			if (signal?.aborted) {
				reject(new Error("sleep cancelado antes de comecar"));
				return;
			}
			const timer = setTimeout(() => {
				signal?.removeEventListener("abort", onAbort);
				resolve();
			}, ms);
			const onAbort = () => {
				clearTimeout(timer);
				reject(new Error("sleep cancelado"));
			};
			signal?.addEventListener("abort", onAbort, { once: true });
		}),
});

/**
 * Relógio de teste. `sleep` resolve na hora e registra quanto tempo foi pedido.
 *
 * Não faz *skip* do `sleep` existir: a humanização precisa de um relógio que sabe
 * dizer "esperei 4 s" sem esperar 4 s, e o teste precisa poder **afirmar** que o
 * delay pedido estava dentro da faixa — um `sleep` que resolve sem registrar nada
 * transforma a humanização em `await Promise.resolve()`, que passa em todo teste.
 */
export const fakeClock = (
	tz: string,
	initial: Date,
): ClockPort & {
	/** Avança o relógio. Não faz `sleep` passar mais rápido — `sleep` é instantâneo. */
	advance(ms: number): void;
	/** Durações pedidas por `sleep`, em ordem. */
	readonly slept: number[];
} => {
	let current = initial;
	const slept: number[] = [];
	return {
		get slept() {
			return [...slept];
		},
		now: () => ({ instant: new Date(current.getTime()), tz }),
		advance: (ms) => {
			current = new Date(current.getTime() + ms);
		},
		sleep: async (ms, signal) => {
			if (signal?.aborted) throw new Error("sleep cancelado antes de comecar");
			slept.push(ms);
		},
	};
};
