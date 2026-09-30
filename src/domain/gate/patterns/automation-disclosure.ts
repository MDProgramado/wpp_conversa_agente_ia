/**
 * Vocabulário de conteúdo — o **único** lugar onde estes termos são escritos
 * (acceptance da task 5). `AUTOMATION_TERM` (AR-006) mora aqui; os demais
 * (preço, agendamento, mídia) são consumidos pelos guards irmãos.
 *
 * Duas decisões valem uma linha cada:
 *
 * 1. **Fronteira de palavra em todo termo.** Um `/ia/i` sem `\b` casaria "dia",
 *    "seria", "faria" — o bot se calaria em metade das frases, falha silenciosa e
 *    cara. `\bia\b` casa a palavra e não a substring. Mesmo cuidado em "script"
 *    (não deve casar "javascript") e "bot" (não deve casar "robotizar").
 * 2. **Acento vira classe de caracteres, não normalização.** `[áa]` cobre a grafia
 *    acentuada e a não acentuada sem custo de runtime, e `semAcento` não é
 *    necessário para um termo isolado — só seria para comparação por igualdade.
 */

/** Preço, valor, dinheiro. AR-001. */
export const CURRENCY_TERM =
	/\br\$\s*\d|\breais?\b|\bdinheiro\b|\bvalor\b|\bor[çc]amento\b/i;

/** Porcentagem e desconto como número — o LM pode produzir "50% off" sem dizer a palavra. */
export const PERCENT_TERM = /\b\d+\s*%|\bpor\s?cento\b/i;

/** Promoção e desconto comercial. AR-001/AR-012. */
export const DISCOUNT_TERM =
	/\bdesconto\b|\bpromo[çc][ãa]o\b|\bblack\s?friday\b|\bcupom\b/i;

/** Proposta comercial. AR-002. */
export const PROPOSAL_TERM = /\bproposta\b|\bor[çc]amento\b/i;

/** AR-004: o texto nomeia um arquivo de mídia. */
export const MEDIA_TERM =
	/\bfoto\b|\bimagem\b|\b[áa]udio\b|\bv[íi]deo\b|\bpdf\b|\bplanilha\b/i;

/**
 * AR-004: extensão de mídia na URL.
 *
 * É o que barra um link de PDF disfarçado de link normal — a checagem estrutural
 * de `parts` deixa `link` passar, e o texto pode estar limpo. Case-insensitive
 * porque `.JPG` e `.jpg` são o mesmo arquivo.
 */
export const MEDIA_LINK_EXT =
	/\.(png|jpe?g|gif|webp|mp3|ogg|opus|m4a|mp4|mov|pdf|docx?|xlsx?|pptx?|zip)$/i;

/** Agendamento. AR-003. */
export const SCHEDULE_TERM =
	/\bagendar\b|\bmarcar\b|\breuni[ãa]o\b|\bchamada\b|\bcall\b|\bhor[áa]rio\b/i;

/**
 * AR-006. `\bia\b` é o caso perigoso: sem `\b` ele casaria "dia".
 * `\brob[ôo]\b` aceita as duas grafias de "robô"; `\bsistema autom[áa]tico\b`
 * exige a palavra "sistema" para não barrar o adjetivo solto.
 */
export const AUTOMATION_TERM: readonly RegExp[] = [
	/\bautoma[çc][ãa]o\b/i,
	/\bbots?\b/i,
	/\bchatbots?\b/i,
	/\bia\b/i,
	/\bgpt\b/i,
	/\bopen\s?ai\b/i,
	/\bassistente\s+virtual\b/i,
	/\bscripts?\b/i,
	/**
	 * `\brob[ôo]\b` NÃO funciona: `\b` é fronteira entre `\w` e não-`\w`, e
	 * JavaScript trata só [A-Za-z0-9_] como `\w` — "ô" é não-`\w`. Então a
	 * fronteira depois do acento cai dentro da palavra e nunca casa. A terminação
	 * usa lookahead explícito: `(?!\w)`, que é o mesmo teste de fronteira mas
	 * posicionado depois de um caractere acento. `robots?` cobre o plural.
	 */
	/\brob[ôo]?(?!\w)/i,
	/\bsistema\s+autom[áa]tico\b/i,
];

/**
 * "IA" é o termo perigoso: `\bia\b` não casa "dia" nem "seria", mas casa a
 * menção de negócio "trabalhamos com IA generativa" — e isso é **proposital**.
 *
 * O gate não tem contexto para saber se o bot está se apresentando ou falando de
 * IA como tecnologia, e errar para o lado de enviar é o erro que a regra proíbe
 * (D-11, fail-closed). Quem distingue os dois casos é o prompt (ADR-012) e, no
 * pior caso, o handoff humano — não um regex.
 */
export const IA_E_TECNOLOGIA = "ia";

/** Preço na forma de objeção ("fica caro, não tenho orçamento") — AR-012. */
export const OBJECTION_TERM =
	/\b(car[oa]|s[áa]o\s+car[oa]|custa\s+(muito|demais))\b|\bn[ãa]o\s+tenho\s+(dinheiro|or[çc]amento)\b|\best[áa]\s+fora\s+do\s+(or[çc]amento|bolso)\b/i;

/** Primeiro termo que casar no texto, ou `null`. A ordem da lista é a precedência. */
export const primeiroTermoQueCasa = (
	texto: string,
	termos: readonly RegExp[],
): string | null => {
	for (const t of termos) {
		const achado = texto.match(t);
		if (achado) return achado[0];
	}
	return null;
};
