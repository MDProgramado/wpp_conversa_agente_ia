/**
 * O snapshot do gate: **um** `SELECT` com os três joins de que o gate precisa.
 *
 * A consistência do gate vem de ler tudo na mesma instrução. Três consultas
 * separadas abririam uma janela em que o opt-out é gravado entre a leitura do
 * lead e a leitura da conversa — e o gate aprovaria um envio que deveria estar
 * bloqueado. Uma leitura, um instantâneo.
 */
import { sql } from "drizzle-orm";
import type { GateInput } from "../../../domain/gate/types.js";
import type { Db } from "../client.js";
import { channelAccounts, conversations, leads } from "../schema.js";

/** A linha crua do `SELECT`, já com os nomes do schema (snake_case). */
interface SnapshotRow {
	lead_id: string;
	phone_number: string;
	opt_out: boolean;
	origin_source: string | null;
	legal_basis: string | null;
	purpose: string | null;
	legal_registered_at: Date | null;
	first_contact_by_human: boolean;
	wa_validation_state: string | null;
	conversation_id: string;
	conversation_state: string;
	engagement_mode: string;
	handoff_active: boolean;
	// AR-009: sinaliza mídia recebida ainda não tratada. O 01-03 liga a `true` e
	// registra o bloqueio; o 01-04 consome este sinal no guard `ar-009.ts`.
	pending_media_block: boolean;
	/**
	 * O kill switch é lido de `channel_accounts.is_active`: conta INATIVA é kill
	 * switch ligado. Não existe coluna `kill_switch` — o botão de emergência do
	 * painel da Fase 04 desativa a conta, e o gate precisa do mesmo sinal.
	 *
	 * A inversão acontece no SQL (`not coalesce(...)`) e não no TypeScript porque
	 * o nome da coluna e o nome do campo precisam concordar: `kill_switch` aqui
	 * significa "envio proibido", e `is_active = true` significa "envio
	 * permitido". Sem o `not`, uma conta ativa — o caso normal — devolveria
	 * `kill_switch = true` e o gate bloquearia toda mensagem do sistema.
	 * `coalesce(..., false)` antes do `not` porque um `LEFT JOIN` sem conta
	 * precisa devolver kill switch desligado (o snapshot 01-03 já garante a
	 * conta, mas `null` não pode virar bloqueio por acidente).
	 */
	kill_switch: boolean;
}

/** `wa_validation_state` é texto livre no banco mas união fechada no `GateInput`. */
const ESTADOS_VALIDACAO = ["valid", "invalido", "desconhecido"] as const;
type EstadoValidacao = (typeof ESTADOS_VALIDACAO)[number];

const paraEstado = (bruto: string | null): EstadoValidacao | null => {
	const achado = ESTADOS_VALIDACAO.find((e) => e === bruto);
	return achado ?? null;
};

/** `engagement_mode` idem: um valor inesperado no banco vira `null`, nunca lixo. */
const MODOS = [
	"bot_active",
	"awaiting_human",
	"human",
	"copilot",
	"pausado",
] as const;
type Modo = (typeof MODOS)[number];

const paraModo = (bruto: string): Modo =>
	MODOS.find((m) => m === bruto) ?? "pausado";

/**
 * Monta o `GateInput` a partir da linha crua.
 *
 * Exportada para teste: a cobertura de `wa_validation_state` desconhecido ou de
 * `engagement_mode` invalido é a que impede um valor do banco de entrar no gate
 * como se fosse um modo válido.
 */
export const paraGateInput = (
	row: SnapshotRow,
	agora: Date,
	ctx: Pick<
		GateInput["context"],
		| "tz"
		| "windowStartHour"
		| "windowEndHour"
		| "dailyMessageLimit"
		| "dailyMessageCap"
		| "sentToday"
		| "newContactsToday"
	>,
): GateInput => ({
	lead: {
		id: row.lead_id,
		phoneNumber: row.phone_number,
		optOut: row.opt_out,
		originSource: row.origin_source,
		legalBasis: row.legal_basis,
		purpose: row.purpose,
		legalRegisteredAt: row.legal_registered_at?.toISOString() ?? null,
		firstContactByHuman: row.first_contact_by_human,
		waValidationState: paraEstado(row.wa_validation_state),
	},
	conversation: {
		id: row.conversation_id,
		state: row.conversation_state,
		engagementMode: paraModo(row.engagement_mode),
		handoffActive: row.handoff_active,
		pendingMediaBlock: row.pending_media_block,
	},
	// `text` e `parts` são preenchidos pelo dispatcher: o snapshot é do **estado**,
	// a intenção de envio entra depois. O gate é puro, então quem decide o texto
	// é quem chama.
	outbound: { text: "", parts: [{ kind: "text" }] },
	context: { killSwitch: row.kill_switch, now: agora, ...ctx },
});

/**
 * Lê o snapshot da conversa. `null` quando a conversa não existe — e isso é
 * declarado, não exceptional: o dispatcher trata `null` como `erro_nao_mapeado` e
 * **fica em silêncio**, nunca envia um texto de fallback.
 */
export const loadGateSnapshot = async (
	db: Db,
	conversationId: string,
	agora: Date,
	ctx: Omit<
		Parameters<typeof paraGateInput>[2],
		"sentToday" | "newContactsToday"
	> & { sentToday: number; newContactsToday: number },
): Promise<GateInput | null> => {
	const resultado = await db.execute(sql`
		select
			l.id             as lead_id,
			l.phone_number,
			l.opt_out,
			l.origin_source,
			l.legal_basis,
			l.purpose,
			l.legal_registered_at,
			l.first_contact_by_human,
			l.wa_validation_state,
			c.id             as conversation_id,
			c.state          as conversation_state,
			c.engagement_mode,
			c.handoff_active,
			c.pending_media_block,
			not coalesce(a.is_active, false) as kill_switch
		from ${conversations} c
		left join ${leads} l on l.id = c.lead_id
		left join ${channelAccounts} a on a.id = c.channel_account_id
		where c.id = ${conversationId}
	`);

	const row = (resultado as unknown as { rows: SnapshotRow[] }).rows[0];
	if (!row) return null;
	return paraGateInput(row, agora, ctx);
};
