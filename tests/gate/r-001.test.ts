/**
 * R-001 / Guard 0 — "a primeira mensagem foi enviada por uma pessoa".
 *
 * R-001 fica FORA de AR-001..AR-012 de propósito: AR-001 é preço e R-001 é canal.
 * São eixos ortogonais — um lead que já comprou continua sendo novo para o bot — e
 * tratá-los como o mesmo controle faria um bloquear o outro indevidamente.
 */
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { evaluatePolicy } from "../../src/domain/gate/evaluate-policy.js";
import {
	DIA_UTIL_DENTRO_DA_JANELA,
	TEXTO_NEUTRO,
	validInbound,
} from "./fixtures.js";

/** Textos que não devem disparar nenhum AR de conteúdo. */
const textosInocuos = [
	"Boa tarde! Posso ajudar em alguma coisa?",
	"Entendi, me conta um pouco mais sobre o seu caso.",
	"Você trabalha com o que exatamente na sua empresa?",
] as const;

/** 2026-09-29 02:00Z = 23h00 de terça em São Paulo: fora da janela. */
const FORA_DA_JANELA = new Date("2026-09-29T02:00:00.000Z");

describe("R-001 — primeiro contato humano", () => {
	it("bloqueia SEMPRE que firstContactByHuman for false, venha o que vier no resto", () => {
		fc.assert(
			fc.property(
				fc.boolean(), // kill switch
				fc.integer({ min: 0, max: 99 }), // cota já
				fc.constantFrom(...textosInocuos), // texto
				fc.boolean(), // dentro ou fora da janela
				(killSwitch, sentToday, texto, foraDaJanela) => {
					const decisao = evaluatePolicy(
						validInbound({
							lead: { firstContactByHuman: false },
							outbound: { text: texto },
							context: {
								killSwitch,
								sentToday,
								now: foraDaJanela
									? FORA_DA_JANELA
									: new Date(DIA_UTIL_DENTRO_DA_JANELA),
							},
						}),
					);

					// O kill switch é o passo 1 da ordem canônica e leva a precedência
					// por desenho. O que NÃO pode é a causa ser qualquer outra regra.
					if (killSwitch) {
						expect(decisao.action).toBe("block");
						return;
					}
					expect(decisao).toMatchObject({
						action: "block",
						reason: "r001_primeiro_contato_nao_humano",
					});
				},
			),
			{ seed: 20260928, numRuns: 500 },
		);
	});

	it("germina: com firstContactByHuman true e nada mais disparando, envia", () => {
		// Sem este teste, uma guarda que devolvesse `block` sempre passaria no
		// teste anterior. É o que prova que a guarda NÃO é "always block".
		const decisao = evaluatePolicy(validInbound());
		expect(decisao.action).toBe("send");
	});

	it("o texto neutro do default não dispara nenhum AR de conteúdo", () => {
		// Trava o fixture: se alguém inserir "preço" ou "IA" em TEXTO_NEUTRO, este
		// teste avisa antes de os outros começarem a passar por acidente.
		const decisao = evaluatePolicy(
			validInbound({ outbound: { text: TEXTO_NEUTRO } }),
		);
		expect(decisao.action).toBe("send");
	});
});
