/**
 * AR-006 — revelar a automação.
 *
 * O risco real deste guard não é bloquear a palavra "bot": é o inverso. Um regex
 * ingênuo como `/ia/i` casa "dia", "seria", "faria" — e o bot calaria a si mesmo
 * em metade das frases. Por isso os termos usam fronteira de palavra (`\b`) e os
 * testes de passagem usam frases que deviam ser liberadas.
 */
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { evaluatePolicy } from "../../src/domain/gate/evaluate-policy.js";
import { validInbound } from "./fixtures.js";

/** O vocabulário que precisa ser barrado, com e sem acento, em qualquer caixa. */
const TERMOS = [
	"bot",
	"automação",
	"automacao",
	"IA",
	"ia",
	"GPT",
	"gpt",
	"assistente virtual",
	"script",
	"robô",
	"robo",
	"sistema automático",
	"sistema automatico",
] as const;

/** Frases que NÃO são revelação e que um regex preguiçoso barraria. */
const FRASES_LIVRES = [
	"Entendi, me conta um pouco mais sobre o seu caso.",
	"Você trabalha com o que exatamente na sua empresa?",
	"A gente tem clientes no interior também, sim.",
	"Isso pode ser feito para o seu segmento.",
	"Vamos por partes, então.",
	"Prefere que eu retome o assunto amanhã?",
] as const;

const moldura = (termo: string) =>
	fc.constantFrom(
		`Sou um ${termo} de atendimento.`,
		`Aqui é falar com um ${termo}?`,
		`trabalho como ${termo} automático`,
		`meu ${termo} responde rápido`,
		`${termo}`,
	);

/**
 * Um termo e a frase que o contém. `chain` (e não um `fc.property` de dois
 * arbitraries) porque a moldura DEPENDE do termo — passar a função direto para
 * `property` a trataria como um arbitrário e o tipo seria `unknown`.
 */
const termoComMoldura = fc
	.constantFrom(...TERMOS)
	.chain((termo) =>
		fc
			.tuple(fc.constant(termo), moldura(termo))
			.map(([t, texto]) => ({ termo: t, texto })),
	);

describe("AR-006 — revelação de automação", () => {
	it("bloqueia o termo em qualquer caixa e com ou sem acento", () => {
		fc.assert(
			fc.property(termoComMoldura, ({ texto }) => {
				const decisao = evaluatePolicy(
					validInbound({ outbound: { text: texto } }),
				);
				expect(decisao).toMatchObject({
					action: "block",
					reason: "ar006_revelacao_automacao",
				});
			}),
			{ seed: 20260928, numRuns: 500 },
		);
	});

	it("NÃO barra palavra que só contém o termo como substring", () => {
		// "dia" contém "ia", "seria" contém "ia", "script" dentro de "javascript" não
		// é o bot se apresentando. Regex sem fronteira de palavra erraria aqui.
		fc.assert(
			fc.property(fc.constantFrom(...FRASES_LIVRES), (frase) => {
				const decisao = evaluatePolicy(
					validInbound({ outbound: { text: frase } }),
				);
				expect(decisao.action).toBe("send");
			}),
			{ seed: 20260928, numRuns: 500 },
		);
	});

	it("bloqueia menção a IA como tecnologia, porque o gate é fail-closed", () => {
		// "Trabalhamos com IA generativa" é conversa de negócio normal e, com um
		// detector de contexto, PASSARIA. Não existe detector de contexto: o gate não
		// distingue "sou uma IA" de "usamos IA na stack", e errar para o lado de
		// enviar é exatamente o que D-11 proíbe. Quem separa os dois casos é o prompt
		// (ADR-012) e, no pior caso, o handoff humano.
		//
		// Este teste existe para fixar a decisão: se alguém "melhorar" o guard com
		// heurística de contexto achando que reduz falso positivo, está
		// reintroduzindo a chance de revelação de automação.
		const decisao = evaluatePolicy(
			validInbound({
				outbound: { text: "Trabalhamos com IA generativa na nossa stack." },
			}),
		);
		expect(decisao).toMatchObject({
			action: "block",
			reason: "ar006_revelacao_automacao",
		});
	});
});
