/**
 * Schema Drizzle — as 15 tabelas da Fase 1.
 *
 * Bloco 1 (6 tabelas): `channel_accounts`, `leads`, `conversations`, `messages`,
 * `outbox`, `daily_counters` — criadas pelo plano 01-01 e **preservadas sem alterar
 * forma** (nenhuma coluna removida, nenhum tipo trocado, nenhuma PK mexida). Tudo
 * que o 01-02 acrescenta aqui é coluna **nullable** ou tabela **nova**, para que o
 * plano 01-03 rode em paralelo sobre o mesmo banco.
 *
 * Bloco 2 (9 tabelas): `app_users`, `optout_ledger`, `handoff_events`, `mode_changes`,
 * `blocked_attempts`, `status_history`, `event_log`, `scheduled_tasks`, `settings` —
 * plano 01-02. O rótulo "7 tabelas restantes" que aparece no plano é **errado**: a
 * lista do próprio plano tem 9 nomes, e são estes 9 que existem. (Registrado no
 * 01-02-SUMMARY.md como desvio de contagem, não de escopo.)
 *
 * Onde os CHECK vivem: o Drizzle emite DDL, mas o `CHECK` é o que sustenta as
 * invariantes no banco — `kind IN ('text','link')` barra mídia por TIPO (AR-004),
 * `count <= 30` é o teto físico de cota (R-023). Nenhum deles depende de runtime.
 *
 * O que NÃO mora aqui e mora em SQL versionado: os triggers de append-only
 * (`messages`, `event_log`, `optout_ledger`), o de irreversibilidade de `opt_out` e
 * o de `DELETE` em `leads`. O Drizzle não expressa trigger, e um CHECK **não**
 * impede `UPDATE` (01-PATTERNS §4.9) — a invariante de R-024/R-043 só existe porque
 * o `0003_guards_and_audit.sql` cria as funções de trigger. Ver esse arquivo.
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
 * INSERT — sem migração, e sem cascata de exclusão em lugar nenhum do schema.
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
 * LEAD-04: nada é apagado. Por isso `duplicate_of` é FK **sem qualquer regra de
 * cascata** e sem `ON DELETE SET NULL`: a eliminação de um lead é um evento no
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
		 * que ninguém pode validar. Deliberadamente SEM cascata de exclusão e SEM
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
		/**
		 * R-028/EQUP-02: responsável pela conversa, **nullable já na Fase 1**. Sob
		 * R-027 (usuário único) ela fica `null`; a diferença entre "marcar depois" e
		 * "marcar agora" é uma migration em base viva depois.
		 */
		responsibleUserId: uuid("responsible_user_id"),
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
		/**
		 * R-028/EQUP-02: quem escreveu a mensagem, quando `origin` é `admin` ou
		 * `ai_suggestion`. Nullable desde já — a coluna que falta depois é a que
		 * obriga um backfill em base com histórico imutável (R-043), e `messages`
		 * é justamente a tabela que não aceita `UPDATE`.
		 */
		authorUserId: uuid("author_user_id"),
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

// ---------------------------------------------------------------------------
// Bloco 2 — plano 01-02. Nenhuma das 6 tabelas acima muda de forma aqui.
// ---------------------------------------------------------------------------

/**
 * O usuário administrador. **Uma** linha na Fase 1 (EQUP-01, R-027 usuário único).
 *
 * A tabela existe mesmo com um usuário só, e por dois motivos que não são
 * "preparação para o futuro": (a) é o destino de `settings.updated_by` e das colunas
 * de R-028, que precisam poder referenciar alguém real; (b) uma credencial de
 * auditoria que mora em `.env` não tem histórico, não tem `id`, e não pode
 * aparecer num relatório de R-022. A linha nasce no boot do 01-03 com
 * `insert ... on conflict (email) do nothing`.
 *
 * Deliberadamente **sem** `password_hash`, `role` ou `permissions`: R-027 adia
 * perfis, e um campo de senha vazio nesta fase seria um campo de senha vazio que
 * alguém preenche sem saber o que ele significa.
 */
export const appUsers = pgTable("app_users", {
	id: uuid("id").primaryKey().defaultRandom(),
	name: text("name").notNull(),
	email: text("email").notNull().unique(),
	isActive: boolean("is_active").notNull().default(true),
	createdAt: timestamp("created_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
});

/**
 * Ledger de opt-out e de eliminação. **Append-only** (R-043) e **sem coluna de
 * estado** — ver o comentário longo abaixo; a ausência de estado é o invariante.
 *
 * `reinstate` existe como `event_type` porque há fluxo de reativação: um opt-out é
 * irreversível (AR-005), mas uma **pessoa** pode voltar a querer falar depois, e
 * essa decisão é do Admin, registrada como evento, não como update silencioso.
 */
export const optoutLedger = pgTable(
	"optout_ledger",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		leadId: uuid("lead_id")
			.notNull()
			.references(() => leads.id),
		/**
		 * `opt_out`       — o titular pediu para não receber mais mensagens.
		 * `erasure_request` — o titular pediu eliminação dos dados (AR-005, R-024).
		 * `reinstate`     — o Admin registra que o titular voltou a consentir.
		 *
		 * Sem `active`, sem `revoked_at`, sem `deleted_at`: **a eliminação é evento,
		 * não remoção** (LEAD-04/NFRQ-06). Uma coluna de estado aqui permitiria o
		 * `UPDATE leads SET opt_out = false` que o trigger de `leads` barra — e
		 * barrar num lugar só é o que faz o bug reaparecer por outro caminho.
		 */
		eventType: text("event_type").notNull(),
		source: text("source").notNull(),
		detectedBy: text("detected_by"),
		/** O texto do pedido, truncado. É a prova de que o pedido aconteceu (R-024). */
		rawContent: text("raw_content").notNull(),
		legalBasis: text("legal_basis").notNull(),
		purpose: text("purpose").notNull(),
		occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
		recordedAt: timestamp("recorded_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(t) => [
		check(
			"optout_ledger_event_type_check",
			sql`event_type IN ('opt_out', 'erasure_request', 'reinstate')`,
		),
		check(
			"optout_ledger_source_check",
			sql`source IN ('auto_detected', 'manual')`,
		),
		check(
			"optout_ledger_detected_by_check",
			sql`detected_by IS NULL OR detected_by IN ('deterministic', 'llm_signal')`,
		),
		// A pergunta que a ANPD faz primeiro é "este lead já pediu? e quando?" —
		// e ela responde com as duas colunas, sem varrer a tabela.
		index("optout_ledger_lead_occurred_idx").on(
			t.leadId,
			sql`${t.occurredAt} DESC`,
		),
	],
);

/**
 * Handoff é **tabela**, não coluna (R-012, R-065, R-022). Uma coluna
 * `conversations.handoff_reason` seria um campo mutável que alguém pode sobrescrever,
 * e a pergunta "por que a automação parou aqui?" deixaria de ter resposta.
 *
 * `simultaneous_send_blocked NOT NULL` é a prova de que a interrupção foi **efeito**,
 * não intenção: o bot para na mesma transação que grava o handoff. Por isso a coluna
 * é obrigatória e sem default — um `handoff_events` gravado com `false` significa
 * "o sistema registrou que ia parar e não parou", e essa é exatamente a linha que o
 * relatório de conformidade de R-022 precisa conseguir apontar.
 */
export const handoffEvents = pgTable(
	"handoff_events",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		conversationId: uuid("conversation_id")
			.notNull()
			.references(() => conversations.id),
		leadId: uuid("lead_id")
			.notNull()
			.references(() => leads.id),
		channelAccountId: uuid("channel_account_id")
			.notNull()
			.references(() => channelAccounts.id),
		triggeredBy: text("triggered_by").notNull(),
		triggerDetail: text("trigger_detail"),
		triggerValue: text("trigger_value"),
		excerpt: text("excerpt").notNull(),
		simultaneousSendBlocked: boolean("simultaneous_send_blocked").notNull(),
		botStoppedAt: timestamp("bot_stopped_at", { withTimezone: true }).notNull(),
		humanAcknowledgedAt: timestamp("human_acknowledged_at", {
			withTimezone: true,
		}),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(t) => [
		check(
			"handoff_events_triggered_by_check",
			sql`triggered_by IN ('keyword', 'intent', 'message_type', 'opt_out', 'validation_error', 'low_confidence', 'user_defined')`,
		),
		// A fila de handoffs pendentes é a leitura mais frequente do painel: "o que
		// parou e o Admin ainda não viu". Índice PARCIAL por `human_acknowledged_at
		// IS NULL` — depois que o Admin assume, a linha sai do índice sem sumir do
		// histórico. (Predicado, não coluna: uma expressão `IS NULL` dentro de
		// `.on()` é rejeitada pelo PostgreSQL com erro de sintaxe — o Drizzle a emite
		// crua, sem os parênteses que o SQL exige.)
		index("handoff_events_open_idx")
			.on(t.createdAt)
			.where(sql`${t.humanAcknowledgedAt} IS NULL`),
	],
);

/**
 * Histórico de modo de engajamento (R-066, COMP-05). A pergunta é sempre a mesma —
 * "quem desligou o bot, quando, e por quê" — e ela é respondida por linha, nunca por
 * coluna. `to_mode` reaproveita o mesmo domínio de `conversations.engagement_mode`
 * para que a lista de valores não possa divergir entre as duas tabelas.
 */
export const modeChanges = pgTable(
	"mode_changes",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		conversationId: uuid("conversation_id")
			.notNull()
			.references(() => conversations.id),
		fromMode: text("from_mode").notNull(),
		toMode: text("to_mode").notNull(),
		actor: text("actor").notNull(),
		reason: text("reason"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(t) => [
		check(
			"mode_changes_to_mode_check",
			sql`to_mode IN ('bot_active', 'awaiting_human', 'human', 'copilot', 'pausado')`,
		),
		check(
			"mode_changes_from_mode_check",
			sql`from_mode IN ('bot_active', 'awaiting_human', 'human', 'copilot', 'pausado')`,
		),
		check("mode_changes_actor_check", sql`actor IN ('bot', 'admin', 'system')`),
		index("mode_changes_conversation_created_idx").on(
			t.conversationId,
			t.createdAt,
		),
	],
);

/**
 * Trilha de **negativos** do gate (R-022, R-045). Gate que bloqueia sem registro é
 * gate não auditável, e é a partir daqui que o relatório de conformidade conta
 * "quantas vezes o AR-001 disparou este mês".
 *
 * Três colunas merecem nota, porque são o resultado de reconciliar o plano com o
 * código que o 01-01 já havia escrito:
 *
 * 1. `rule_reference` é o `GateReason` canônico (`ar001_preco`, `kill_switch_ativo`,
 *    `r001_primeiro_contato_nao_humano`) — é a grafia que `evaluate-policy.ts` já
 *    declara ser a que vai para esta coluna. `guard` é o identificador do AR/R
 *    (`AR-001`, `R-023`) quando o chamador sabe dizer.
 * 2. `detail` e `created_at` existem porque `src/application/dispatcher.ts` (01-01)
 *    grava exatamente `(conversation_id, rule_reference, detail, created_at)` e esse
 *    arquivo é propriedade do 01-01 — não pode ser corrigido aqui. Sem estas duas
 *    colunas o INSERT do dispatcher falha e **todo** negativo do gate é perdido,
 *    dentro de um `try/catch` que registra `blocked_attempts_indisponivel` e segue.
 * 3. Por isso `guard`, `reason_code` e `excerpt` são `NOT NULL` mas o
 *    `0003_guards_and_audit.sql` cria um trigger `BEFORE INSERT` que os preenche a
 *    partir de `rule_reference`/`detail` quando o chamador mínimo não os fornece.
 *    `recordBlockedAttempt` (queries/blocked-attempts.ts) escreve todos explicitamente
 *    e por isso não é afetado.
 */
export const blockedAttempts = pgTable(
	"blocked_attempts",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		conversationId: uuid("conversation_id").references(() => conversations.id),
		leadId: uuid("lead_id").references(() => leads.id),
		direction: text("direction").notNull().default("out"),
		/** `GateReason` que decidiu. É a coluna que o painel da Fase 04 exibe. */
		guard: text("guard").notNull(),
		reasonCode: text("reason_code").notNull(),
		ruleReference: text("rule_reference").notNull(),
		excerpt: text("excerpt").notNull(),
		/** Texto legível do porquê — o que o 01-01 chama de `detail`. */
		detail: text("detail"),
		payloadExcerpt: text("payload_excerpt"),
		windowAtEvent: timestamp("window_at_event", { withTimezone: true }),
		blockedAt: timestamp("blocked_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		/** Nome que o 01-01 grava; canônico é `blocked_at`. Ver nota 2 acima. */
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(t) => [
		check("blocked_attempts_direction_check", sql`direction IN ('in', 'out')`),
		index("blocked_attempts_conversation_idx").on(
			t.conversationId,
			sql`${t.blockedAt} DESC`,
		),
		// Responde "qual regra está disparando mais" sem varrer a tabela — é a
		// leitura do relatório mensal de conformidade.
		index("blocked_attempts_guard_idx").on(t.guard, sql`${t.blockedAt} DESC`),
	],
);

/**
 * Histórico de mudança de status do pipeline (R-022: "transições com critérios claros
 * e auditáveis"). `changed_by` é texto, não FK: hoje só existe `bot` e `admin`
 * (R-027), e o valor precisa dizer **qual** dos dois mesmo antes de `app_users`
 * ter mais de uma linha.
 */
export const statusHistory = pgTable(
	"status_history",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		conversationId: uuid("conversation_id")
			.notNull()
			.references(() => conversations.id),
		fromState: text("from_state").notNull(),
		toState: text("to_state").notNull(),
		changedBy: text("changed_by").notNull(),
		reason: text("reason"),
		changedAt: timestamp("changed_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(t) => [
		index("status_history_conversation_changed_idx").on(
			t.conversationId,
			t.changedAt,
		),
	],
);

/**
 * Log de auditoria estruturado, **append-only** (R-043, R-045). É a tabela que
 * sustenta o painel de erros do R-045 e o relatório de conformidade.
 *
 * `payload` guarda estrutura, **não** o corpo da mensagem: o corpo vive em
 * `messages`, que é a tabela append-only auditável, e duplicá-lo aqui colocaria PII
 * fora do registro com prazo de retenção (ver `docs/lgpd/retencao-e-eliminacao.md`).
 * O que entra aqui é o que o STACK manda: `model`, tokens, `latency_ms`,
 * `zod_parse_ok`, campos de decisão.
 */
export const eventLog = pgTable(
	"event_log",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		eventType: text("event_type").notNull(),
		entityType: text("entity_type").notNull(),
		entityId: uuid("entity_id"),
		leadId: uuid("lead_id").references(() => leads.id),
		conversationId: uuid("conversation_id").references(() => conversations.id),
		payload: jsonb("payload").notNull().default(sql`'{}'::jsonb`),
		severity: text("severity").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(t) => [
		check(
			"event_log_severity_check",
			sql`severity IN ('debug', 'info', 'warn', 'error', 'critical')`,
		),
		index("event_log_created_idx").on(sql`${t.createdAt} DESC`),
		index("event_log_type_created_idx").on(
			t.eventType,
			sql`${t.createdAt} DESC`,
		),
	],
);

/**
 * Fila de tarefas agendadas. Nasce **vazia** nesta fase e a cadência é Fase 02
 * (FLUP): a tabela existe agora porque `attempts`/`status`/`cancelled_reason` são a
 * forma como um follow-up cancelado fica auditável em vez de sumir do agendador.
 *
 * `cancelled_at` + `cancelled_reason` existem para que "por que este follow-up de
 * 3 dias não disparou depois do opt-out" tenha resposta. Um agendamento cancelado
 * que é só apagado é indistinguível de um que nunca existiu.
 */
export const scheduledTasks = pgTable(
	"scheduled_tasks",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		conversationId: uuid("conversation_id")
			.notNull()
			.references(() => conversations.id),
		taskType: text("task_type").notNull(),
		scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull(),
		attempts: integer("attempts").notNull().default(0),
		status: text("status").notNull().default("pending"),
		cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
		cancelledReason: text("cancelled_reason"),
		lastError: text("last_error"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(t) => [
		check(
			"scheduled_tasks_status_check",
			sql`status IN ('pending', 'done', 'failed', 'abandoned')`,
		),
		// Índice parcial só do que ainda tem ação pendente: `done`/`abandoned` são
		// maioria em três meses e o tick não deveria varrê-los.
		index("scheduled_tasks_pending_idx")
			.on(t.scheduledFor, t.id)
			.where(sql`${t.status} = 'pending'`),
	],
);

/**
 * Config de negócio mutável em runtime, sem redeploy. R-033/T-01-10: **aqui não
 * entra segredo**. Limites, janelas e textos de persona, sim; senha de banco, chave
 * de LLM e credencial de canal, nunca — a Fase 04 exibe `settings` num painel e um
 * segredo em tabela é segredo em tela. Segredo fica em `.env`, que é lido uma vez
 * no boot e validado por zod (`src/config/env.ts`).
 */
export const settings = pgTable("settings", {
	key: text("key").primaryKey(),
	value: jsonb("value").notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
	updatedBy: uuid("updated_by").references(() => appUsers.id),
});
