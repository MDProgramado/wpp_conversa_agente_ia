/**
 * Regressões de segurança da task 5.
 *
 * Cada teste aqui existe porque o gate tinha um bug que NENHUM outro teste
 * pegava, e cada um é o inverso de um anti-requisito:
 *
 * - `kill switch` — conta ATIVA bloqueava toda mensagem do sistema. Um gate que
 *   bloqueia tudo não "falha em silêncio": ele inutiliza o produto, e o conserto
 *   tentador, como parece, é relaxar o gate em vez de arrumar a inversão.
 * - `link` — AR-004 bloqueava todo link. Isso viola R-042 (texto e links são
 *   permitidos) e tornaria impossível responder "olha este site".
 * - `blocked_attempts` — o INSERT mandava $1..$3 sem parâmetros, então todo
 *   negativo do gate era perdido no log. Negativo perdido é trilha de auditoria
 *   perdida (R-022).
 */
import { describe, expect, it } from "vitest";
import { evaluatePolicy } from "../../src/domain/gate/evaluate-policy.js";
import { paraGateInput } from "../../src/infra/db/queries/snapshot.js";
import { validInbound, validOutbound } from "./fixtures.js";

/** Uma linha de snapshot com todos os defaults que liberam envio. */
const linhaValida = {
	lead_id: "11111111-1111-4111-8111-111111111111",
	phone_number: "+5511999999999",
	opt_out: false,
	origin_source: "cacaleads",
	legal_basis: "legitimo_interesse",
	purpose: "prospecao_b2b_servicos_digitais",
	legal_registered_at: new Date("2025-01-01T12:00:00.000Z"),
	first_contact_by_human: true,
	wa_validation_state: "valid",
	conversation_id: "22222222-2222-4222-8222-222222222222",
	conversation_state: "bot_active",
	engagement_mode: "bot_active",
	handoff_active: false,
	pending_media_block: false,
	kill_switch: false,
};

const ctx = {
	tz: "America/Sao_Paulo",
	windowStartHour: 7,
	windowEndHour: 17,
	dailyMessageLimit: 25,
	dailyMessageCap: 30,
	sentToday: 0,
	newContactsToday: 0,
};

describe("kill switch (o botão de emergência não pode estar invertido)", () => {
	it("conta inativa bloqueia o envio", () => {
		// kill_switch = true é "conta desativada", no SQL `not is_active`.
		const entrada = paraGateInput(
			{ ...linhaValida, kill_switch: true },
			new Date("2026-09-29T16:00:00.000Z"),
			ctx,
		);
		const decisao = evaluatePolicy(entrada);
		expect(decisao.action).toBe("block");
		expect(decisao.action === "block" && decisao.reason).toBe(
			"kill_switch_ativo",
		);
	});

	it("conta ATIVA envia — a inversão que transformava o sistema em muro", () => {
		const entrada = paraGateInput(
			linhaValida,
			new Date("2026-09-29T16:00:00.000Z"),
			ctx,
		);
		expect(entrada.context.killSwitch).toBe(false);
		expect(evaluatePolicy(entrada).action).toBe("send");
	});

	it("o kill switch vence o resto: bloqueia mesmo com tudo mais liberado", () => {
		const entrada = paraGateInput(
			{ ...linhaValida, kill_switch: true },
			new Date("2026-09-29T16:00:00.000Z"),
			ctx,
		);
		const decisao = evaluatePolicy(entrada);
		expect(decisao.action).toBe("block");
		// Não é qualquer bloqueio: tem que ser o kill switch, senão o teste
		// passaria por uma regra vizinha.
		expect(decisao.action === "block" && decisao.reason).toBe(
			"kill_switch_ativo",
		);
	});
});

describe("AR-004 — link normal é permitido (R-042)", () => {
	it("link de página comum passa", () => {
		const entrada = validInbound({
			outbound: validOutbound("Dá uma olhada no nosso site", [
				{ kind: "text" },
				{ kind: "link", href: "https://exemplo.com.br" },
			]),
		});
		expect(evaluatePolicy(entrada).action).toBe("send");
	});

	it("link com caminho e query string ainda passa", () => {
		const entrada = validInbound({
			outbound: validOutbound("Veja o case", [
				{ kind: "link", href: "https://exemplo.com.br/cases/automacao?id=7" },
			]),
		});
		expect(evaluatePolicy(entrada).action).toBe("send");
	});

	it("link de PDF é barrado mesmo sem o texto nomear mídia", () => {
		const entrada = validInbound({
			outbound: validOutbound("Material para você ver", [
				{ kind: "link", href: "https://exemplo.com.br/proposta.pdf" },
			]),
		});
		const decisao = evaluatePolicy(entrada);
		expect(decisao.action).toBe("block");
		expect(decisao.action === "block" && decisao.reason).toBe(
			"ar004_midia_saida",
		);
	});

	it("link de imagem é barrado", () => {
		const entrada = validInbound({
			outbound: validOutbound("olha", [
				{ kind: "link", href: "https://exemplo.com.br/logo.png" },
			]),
		});
		expect(evaluatePolicy(entrada).action).toBe("block");
	});
});
