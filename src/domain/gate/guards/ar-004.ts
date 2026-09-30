import {
	MEDIA_LINK_EXT,
	MEDIA_TERM,
	primeiroTermoQueCasa,
} from "../patterns/automation-disclosure.js";
import type { GateInput } from "../types.js";

/**
 * AR-004 — mídia de saída (R-037).
 *
 * Duas checagens, porque "mídia" tem duas portas:
 *
 * (a) **estrutural** — qualquer `part` que não seja `text` nem `link`. O
 *     `OutboundPart` é uma união fechada de `text | link`, então na prática isto
 *     nunca dispara: é a rede de segurança para quando a união ganhar um
 *     `image`/`audio`/`document` no futuro. `link` NÃO é bloqueado aqui —
 *     texto e links são explicitamente permitidos (R-042) e o gate precisa
 *     barrar mídia, não a hyperlink.
 * (b) **de conteúdo** — o texto nomeia mídia, **ou** a URL do link termina em
 *     extensão de mídia. A segunda metade é o que barra um PDF "disfarçado" de
 *     link normal, que passaria pela checagem (a) e pelo `text` neutro.
 */
export const evaluate = (input: GateInput) => {
	const partes = input.outbound.parts;

	const parteNaoTextual = partes.find(
		(p) => p.kind !== "text" && p.kind !== "link",
	);
	if (parteNaoTextual) return "ar004_midia_saida" as const;

	// (b1) o texto nomeia um arquivo de mídia
	if (primeiroTermoQueCasa(input.outbound.text, [MEDIA_TERM]) !== null) {
		return "ar004_midia_saida" as const;
	}

	// (b2) a URL do link tem extensão de mídia
	const linkDeMidia = partes.find(
		(p): p is { readonly kind: "link"; readonly href: string } =>
			p.kind === "link" && MEDIA_LINK_EXT.test(p.href),
	);
	return linkDeMidia ? ("ar004_midia_saida" as const) : null;
};
