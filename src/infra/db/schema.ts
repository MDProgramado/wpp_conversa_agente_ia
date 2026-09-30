/**
 * Schema Drizzle — as 6 tabelas da Fase 1.
 *
 * Este é o subconjunto do esqueleto; o plano 01-02 cria o resto (handoff_events,
 * optout_ledger, system_events) e NÃO altera nenhuma destas 6. Toda coluna nova
 * entra por `drizzle-kit generate`, nunca por `drizzle-kit push` (R-031 exige
 * migração `.sql` versionada e auditável).
 *
 * Onde os CHECK vivem: o Drizzle emite DDL, mas o `CHECK` é o que sustenta as
 * invariantes no banco — `kind IN ('text','link')` barra mídia por TIPO (AR-004),
 * `count <= 30` é o teto físico de cota (R-023). Nenhum deles depende de runtime.
 *
 * NOTA sobre o `count <= 30` (D-04 x R-023): o CHECK é o TETO FÍSICO e não muda.
 * O limite OPERACIONAL (25, configurável em `.env`) vive no `WHERE count < $limite`
 * do `INSERT ... ON CONFLICT`, porque um CHECK em DDL é estático e não lê `.env`.
 * Se alguém "consertar" este 30 para 25, `DAILY_MESSAGE_LIMIT` deixa de funcionar e
 * uma configuração válida quebra o banco. Não mexer.
 */
import { sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import {
	boolean,
	check,
	date,
	index,
	integer,
	jsonb,
	pgTable,
	primaryKey,
	smallint,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";

/**
 * E.164: `+` seguido de 7 a 15 dígitos, sem zero inicial. Mesmo formato do CHECK do R-031/WHS-05.
 *
 * `sql.raw`, e não `sql`: com `sql` o Drizzle emite um BIND PARAMETER (`phone_e164 ~ $1`)
 * e o `migrate()` executa o `.sql` sem parâmetros — o CHECK passaria a ser
 * `coluna ~ NULL`, que é `unknown`, e `unknown` NUNCA viola um CHECK. A restrição
 * ficaria verde para sempre sem barrar nada. O valor é uma constante nossa, sem
 * interpolação de entrada do usuário, então embutir o literal é seguro.
 */
const E164 = String.raw`^\+[1-9][0-9]{7,14}$`;
const E164_CHECK = sql.raw(`'${E164}'`);

/**
 * A conta do canal. Uma única linha na Fase 1 (WHS-05: um número dedicado só).
 * A tabela já nasce com `id` próprio para que a segunda linha do v2 seja só um
 * INSERT — sem migração, sem ON DELETE CASCADE em lugar nenhum.
 */
export const channelAccounts = pgTable(
	"channel_accounts",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		/**
		 * E.164 do número dedicado. `unique` NÃO é cosmético: o boot faz
		 * `insert ... on conflict do nothing` e só a unicidade faz esse conflito
		 * acontecer. Sem ela o `do nothing` não tem onde agir e cada boot acrescentaria
		 * uma linha — e o número dedicado do projeto é exatamente um. Ver
		 * `.planning/phases/01-funda-o-canal-e-gate-de-envio/01-01-PLAN.md` Task 4, passo (d).
		 */
		phoneE164: text("phone_e164").notNull().unique(),
		displayName: text("display_name"),
		isActive: boolean("is_active").notNull().default(true),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(_t) => [
		check("channel_accounts_phone_e164_check", sql`phone_e164 ~ ${E164_CHECK}`),
	],
);

/**
 * Leads. `phone_number` é a chave de negócio (E.164); `wa_jid` e `lid` são colunas
 * SEPARADAS e nullable porque o Baileys 7 prefere LID (01-PATTERNS §Padrão 4) — nunca
 * usar `remoteJid` como PK ou alvo de FK.
 *
 * LEAD-04: nada é apagado. Por isso `duplicate_of` é FK sem `ON DELETE CASCADE` e a
 * eliminação de um lead é um evento no `optout_ledger` (01-02), não remoção de linha.
 *
 * `first_contact_by_human` inicia `false`: o guard 0 do gate (R-001) só ADMITE a
 * conversa depois que o Admin manda a primeira mensagem à mão (D-02).
 */
export const leads = pgTable(
	"leads",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		phoneNumber: text("phone_number").notNull().unique(),
		waJid: text("wa_jid"),
		lid: text("lid"),
		name: text("name"),
		addressLine: text("address_line"),
		/** Origem do lead — LGPD/R-064: registro obrigatório de procedência. */
		originSource: text("origin_source").notNull(),
		legalBasis: text("legal_basis").notNull().default("legitimate_interest"),
		purpose: text("purpose").notNull(),
		legalRegisteredAt: timestamp("legal_registered_at").notNull(),
		optOut: boolean("opt_out").notNull().default(false),
		firstContactByHuman: boolean("first_contact_by_human")
			.notNull()
			.default(false),
		waValidatedAt: timestamp("wa_validated_at"),
		waValidationState: text("wa_validation_state"),
		/**
		 * LEAD-04/T-01-10: auto-referência para o lead original. A FK é o que faz a
		 * deduplicação ser auditável — sem ela, `duplicate_of` seria um UUID solto
		 * que ninguém pode validar. Deliberadamente SEM `ON DELETE CASCADE` e SEM
		 * `ON DELETE SET NULL`: nada é apagado (LEAD-04). `id` é a PK, então
		 * `leads.id` é a coluna alvo, nunca `remoteJid`.
		 */
		duplicateOf: uuid("duplicate_of").references((): AnyPgColumn => leads.id),
		/** R-028/WHS-05: nullable já na Fase 1 (hoje um usuário só) — adicionar depois é migração em base viva. */
		responsibleUserId: uuid("responsible_user_id"),
		createdBy: uuid("created_by"),
		createdAt: timestamp("created_at").notNull().defaultNow(),
	},
	(_t) => [
		check("leads_phone_number_check", sql`phone_number ~ ${E164_CHECK}`),
		check(
			"leads_wa_validation_state_check",
			sql`wa_validation_state IS NULL OR wa_validation_state IN ('VALIDO', 'NUMERO_INVALIDO', 'DESCONHECIDO')`,
		),
	],
);

/**
 * Uma conversa por lead. `channel_account_id` entra já NOT NULL: toda conversa pertence
 * a uma conta de canal, e o plano 01-03 que faz handoff por conta precisa poder filtrar.
 *
 * `last_processed_at` é o WATERMARK do cursor idempotente: reprocessar o histórico
 * inteiro a cada boot gastaria tokens de LLM e reenviaria mensagens já enviadas.
 *
 * `pending_media_block` é o sinal de AR-009: o 01-03 liga `true` ao registrar mídia
 * recebida, o 01-04 consome no guard `ar-009.ts`, e o Admin desliga ao assumir o
 * handoff. Nasce `false` para não travar uma conversa que nunca recebeu mídia.
 */
export const conversations = pgTable(
	"conversations",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		leadId: uuid("lead_id")
			.notNull()
			.references(() => leads.id),
		channelAccountId: uuid("channel_account_id")
			.notNull()
			.references(() => channelAccounts.id),
		state: text("state").notNull().default("novo"),
		engagementMode: text("engagement_mode").notNull().default("bot_active"),
		stage: text("stage").notNull().default("aquecimento"),
		qualification: jsonb("qualification").notNull().default(sql`'{}'::jsonb`),
		followUpIndex: smallint("follow_up_index").notNull().default(0),
		lastInboundAt: timestamp("last_inbound_at"),
		lastOutboundAt: timestamp("last_outbound_at"),
		lastProcessedAt: timestamp("last_processed_at").notNull().defaultNow(),
		/** R-066: com handoff ativo, o dispatcher não envia nada. */
		handoffActive: boolean("handoff_active").notNull().default(false),
		/** WHS-04: reach-out timelock lido do servidor (463). */
		reachoutTimelockUntil: timestamp("reachout_timelock_until"),
		timezone: text("timezone").notNull().default("America/Sao_Paulo"),
		closedReason: text("closed_reason"),
		pendingMediaBlock: boolean("pending_media_block").notNull().default(false),
		createdAt: timestamp("created_at").notNull().defaultNow(),
	},
	(_t) => [
		check(
			"conversations_state_check",
			sql`state IN ('novo', 'aquecimento', 'qualificando', 'aquecido', 'awaiting_human', 'human', 'copilot', 'pausado', 'encerrado')`,
		),
		check(
			"conversations_engagement_mode_check",
			sql`engagement_mode IN ('bot_active', 'awaiting_human', 'human', 'copilot', 'pausado')`,
		),
	],
);

/**
 * Histórico IMUTÁVEL (R-043). O trigger `messages_append_only` que barra UPDATE/DELETE
 * nasce no 01-02 (PATTERNS §4.9); aqui a tabela já nasce com `idempotency_key UNIQUE`
 * para que a unicidade do envio não dependa do trigger.
 *
 * AR-004/CONV-11 moram no `CHECK (kind IN ('text','link'))`: um payload de mídia é
 * rejeitado pelo TIPO no banco, não por validação em runtime. `images`/`audio`/
 * `video`/`document`/`sticker` simplesmente não têm valor aceito.
 */
export const messages = pgTable(
	"messages",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		conversationId: uuid("conversation_id")
			.notNull()
			.references(() => conversations.id),
		direction: text("direction").notNull(),
		origin: text("origin").notNull(),
		kind: text("kind").notNull().default("text"),
		body: text("body").notNull(),
		parts: jsonb("parts"),
		status: text("status").notNull().default("queued"),
		providerMsgId: text("provider_msg_id"),
		idempotencyKey: text("idempotency_key").notNull().unique(),
		latencyMs: integer("latency_ms"),
		createdAt: timestamp("created_at").notNull().defaultNow(),
	},
	(_t) => [
		check("messages_direction_check", sql`direction IN ('in', 'out')`),
		check(
			"messages_origin_check",
			sql`origin IN ('lead', 'bot', 'admin', 'ai_suggestion', 'system')`,
		),
		check("messages_kind_check", sql`kind IN ('text', 'link')`),
		check(
			"messages_status_check",
			sql`status IN ('queued', 'suggested', 'sent', 'failed', 'blocked')`,
		),
	],
);

/**
 * Fila de saída. A reserva é transacional (Padrão 2) e usa `FOR UPDATE SKIP LOCKED`
 * sobre o índice PARCIAL abaixo: só linhas `pending` são candidatas, então o índice não
 * guarda nada que não possa ser reservado agora.
 *
 * `scheduled_for` respeita a cadência de follow-up (1h/1d/3d/7d) e o `catchup` do R-007.
 */
export const outbox = pgTable(
	"outbox",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		conversationId: uuid("conversation_id")
			.notNull()
			.references(() => conversations.id),
		origin: text("origin").notNull(),
		messageId: uuid("message_id").references(() => messages.id),
		body: text("body").notNull(),
		parts: jsonb("parts"),
		idempotencyKey: text("idempotency_key").notNull().unique(),
		scheduledFor: timestamp("scheduled_for").notNull().defaultNow(),
		status: text("status").notNull().default("pending"),
		attempts: integer("attempts").notNull().default(0),
		lastError: text("last_error"),
		reservedAt: timestamp("reserved_at"),
		createdAt: timestamp("created_at").notNull().defaultNow(),
	},
	(t) => [
		check(
			"outbox_origin_check",
			sql`origin IN ('bot', 'admin', 'followup', 'catchup')`,
		),
		check(
			"outbox_status_check",
			sql`status IN ('pending', 'reserved', 'sent', 'failed', 'abandoned')`,
		),
		index("outbox_pending_scheduled_idx")
			.on(t.scheduledFor, t.id)
			.where(sql`${t.status} = 'pending'`),
	],
);

/**
 * Contadores de cota. `CHECK (count <= 30)` é o TETO FÍSICO de R-023 e não muda —
 * ver a nota no topo do arquivo. O limite operacional (`DAILY_MESSAGE_LIMIT`, 25) é
 * aplicado no `ON CONFLICT` do código, com bind parameter.
 */
export const dailyCounters = pgTable(
	"daily_counters",
	{
		day: date("day").notNull(),
		kind: text("kind").notNull(),
		count: integer("count").notNull().default(0),
	},
	(t) => [
		primaryKey({ name: "daily_counters_pkey", columns: [t.day, t.kind] }),
		check("daily_counters_kind_check", sql`kind IN ('sent', 'new_contacts')`),
		check("daily_counters_max", sql`count <= 30`),
	],
);
