/**
 * Validação E.164 do número de destino.
 *
 * Existe como função separada porque a mesma regra é consultada em três lugares:
 * o guard `lead_numero_invalido`, o `env.ts` no boot e o `lead-importer` do
 * 01-03. Uma cópia em cada lugar divergiria.
 *
 * O formato aceito é `+` seguido de 8 a 15 dígitos, com o primeiro dígito
 * diferente de zero. O intervalo é o de E.164 (ITU-T E.164): 8 é o menor
 * comprimento válido e 15 o máximo, o que deixa de fora o número de emergência
 * curto sem precisar de regra especial.
 */
export const E164 = /^\+[1-9]\d{7,14}$/;

export const ehE164 = (candidato: string): boolean => E164.test(candidato);

/**
 * `true` apenas para o estado **terminal** `invalido`.
 *
 * `desconhecido` NÃO bloqueia por aqui de propósito: logo após a primeira
 * mensagem, a validação do número pelo WhatsApp ainda não rodou, e tratar
 * "não verificado" como "inválido" calaria o bot em toda conversa nova. A
 * distinção é do 01-03 (`wa_validated_at`/`wa_validation_state`).
 */
export const leadNumeroInvalido = (
	estado: "valid" | "invalido" | "desconhecido" | null,
): boolean => estado === "invalido";
