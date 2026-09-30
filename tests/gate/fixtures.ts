/**
 * Fixtures do gate: um `GateInput` VÁLIDO por padrão.
 *
 * A regra que sustenta estes fixtures: cada teste varia **uma** dimensão. Um default
 * já bloqueante (fora da janela, cota estourada, opt-out ligado) faz o teste passar
 * por acidente — o `expect` veria `block` e não saberia dizer se foi a regra testada
 * ou o default. Por isso o default é um estado em que tudo liberaria, e o que está
 * sob teste é a única coisa quebrada.
 */
import type { OutboundPart } from "../../src/domain/ports/ChannelPort.js";
import type { GateInput } from "../../src/domain/gate/types.js";

export const TZ = "America/Sao_Paulo";

/** Terça-feira, 29/09/2026, 13h00 em São Paulo — dentro da janela e dia útil. */
export const DIA_UTIL_DENTRO_DA_JANELA = "2026-09-29T16:00:00.000Z";

/**
 * Texto neutro por padrão: passa em AR-001 (preço), AR-003 (agendamento), AR-004
 * (mídia), AR-006 (revelação) e AR-011 (base legal). Se o default fosse viciado,
 * o teste da germinação de R-001 passaria por acidente.
 */
export const TEXTO_NEUTRO = "Boa tarde! Posso ajudar em alguma coisa?";

type ZonedParts = {
	year: number;
	month: number;
	day: number;
	hour: number;
	minute: number;
	second: number;
};

const partesEm = (instante: Date, tz: string): ZonedParts => {
	const fmt = new Intl.DateTimeFormat("en-US", {
		timeZone: tz,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hourCycle: "h23",
	});
	const partes = fmt.formatToParts(instante);
	const n = (tipo: Intl.DateTimeFormatPartTypes) =>
		Number(partes.find((p) => p.type === tipo)?.value ?? "0");
	return {
		year: n("year"),
		month: n("month"),
		day: n("day"),
		hour: n("hour"),
		minute: n("minute"),
		second: n("second"),
	};
};

/**
 * Converte um horário de PAREDE no fuso em instante UTC — o inverso de `partesEm`.
 *
 * Um `new Date(y, m, d, h)` construiria o instante no fuso da MÁQUINA, e o teste
 * viraria dependente de onde roda (aqui a máquina pode estar em UTC). Duas passadas
 * de correção resolvem o offset real do fuso, então continua exato mesmo se algum
 * dia o Brasil voltar ao horário de verão.
 */
export const instanteEmZona = (
	tz: string,
	ano: number,
	mes: number,
	dia: number,
	hora = 0,
	minuto = 0,
): Date => {
	const alvo = Date.UTC(ano, mes - 1, dia, hora, minuto, 0);
	const primeira = new Date(alvo);
	const p = partesEm(primeira, tz);
	const comoUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
	return new Date(alvo - (comoUtc - alvo));
};

/** Dia da semana a partir de componentes de calendário puros (0=domingo). */
export const diaDaSemanaDe = (ano: number, mes: number, dia: number): number =>
	new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay();

export const EH_FIM_DE_SEMANA = (ano: number, mes: number, dia: number): boolean => {
	const dow = diaDaSemanaDe(ano, mes, dia);
	return dow === 0 || dow === 6;
};

export const validOutbound = (
	text: string,
	parts?: readonly OutboundPart[],
): GateInput["outbound"] => ({ text, parts: parts ?? [{ kind: "text" }] });

export type GateInputOverrides = {
	lead?: Partial<GateInput["lead"]>;
	conversation?: Partial<GateInput["conversation"]>;
	outbound?: Partial<GateInput["outbound"]>;
	context?: Partial<GateInput["context"]>;
};

export const validInbound = (overrides: GateInputOverrides = {}): GateInput => ({
	lead: {
		id: "11111111-1111-4111-8111-111111111111",
		// Telefone PLACEHOLDER de fixture: nunca o número real do Admin (R-064).
		phoneNumber: "+5511999999999",
		optOut: false,
		originSource: "cacaleads",
		legalBasis: "legitimo_interesse",
		purpose: "prospecao_b2b_servicos_digitais",
		// Passado, e não `null`: AR-011 exige registro, e um fixture sem registro
		// bloquearia por AR-011 em vez da regra sob teste.
		legalRegisteredAt: "2026-09-01T12:00:00.000Z",
		firstContactByHuman: true,
		waValidationState: "valid",
		...overrides.lead,
	},
	conversation: {
		id: "22222222-2222-4222-8222-222222222222",
		state: "bot_active",
		engagementMode: "bot_active",
		handoffActive: false,
		pendingMediaBlock: false,
		...overrides.conversation,
	},
	outbound: { ...validOutbound(TEXTO_NEUTRO), ...overrides.outbound },
	context: {
		killSwitch: false,
		now: new Date(DIA_UTIL_DENTRO_DA_JANELA),
		tz: TZ,
		windowStartHour: 7,
		windowEndHour: 17,
		// 25 operacional, 30 teto físico: dá para testar os dois lados do `min`.
		dailyMessageLimit: 25,
		dailyMessageCap: 30,
		sentToday: 0,
		newContactsToday: 0,
		...overrides.context,
	},
});
