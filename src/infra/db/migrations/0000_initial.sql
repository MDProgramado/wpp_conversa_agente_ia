CREATE TABLE "channel_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone_e164" text NOT NULL,
	"display_name" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "channel_accounts_phone_e164_check" CHECK (phone_e164 ~ '^\+[1-9][0-9]{7,14}$')
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"channel_account_id" uuid NOT NULL,
	"state" text DEFAULT 'novo' NOT NULL,
	"engagement_mode" text DEFAULT 'bot_active' NOT NULL,
	"stage" text DEFAULT 'aquecimento' NOT NULL,
	"qualification" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"follow_up_index" smallint DEFAULT 0 NOT NULL,
	"last_inbound_at" timestamp,
	"last_outbound_at" timestamp,
	"last_processed_at" timestamp DEFAULT now() NOT NULL,
	"handoff_active" boolean DEFAULT false NOT NULL,
	"reachout_timelock_until" timestamp,
	"timezone" text DEFAULT 'America/Sao_Paulo' NOT NULL,
	"closed_reason" text,
	"pending_media_block" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "conversations_state_check" CHECK (state IN ('novo', 'aquecimento', 'qualificando', 'aquecido', 'awaiting_human', 'human', 'copilot', 'pausado', 'encerrado')),
	CONSTRAINT "conversations_engagement_mode_check" CHECK (engagement_mode IN ('bot_active', 'awaiting_human', 'human', 'copilot', 'pausado'))
);
--> statement-breakpoint
CREATE TABLE "daily_counters" (
	"day" date NOT NULL,
	"kind" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "daily_counters_pkey" PRIMARY KEY("day","kind"),
	CONSTRAINT "daily_counters_kind_check" CHECK (kind IN ('sent', 'new_contacts')),
	CONSTRAINT "daily_counters_max" CHECK (count <= 30)
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone_number" text NOT NULL,
	"wa_jid" text,
	"lid" text,
	"name" text,
	"address_line" text,
	"origin_source" text NOT NULL,
	"legal_basis" text DEFAULT 'legitimate_interest' NOT NULL,
	"purpose" text NOT NULL,
	"legal_registered_at" timestamp NOT NULL,
	"opt_out" boolean DEFAULT false NOT NULL,
	"first_contact_by_human" boolean DEFAULT false NOT NULL,
	"wa_validated_at" timestamp,
	"wa_validation_state" text,
	"duplicate_of" uuid,
	"responsible_user_id" uuid,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "leads_phone_number_unique" UNIQUE("phone_number"),
	CONSTRAINT "leads_phone_number_check" CHECK (phone_number ~ '^\+[1-9][0-9]{7,14}$'),
	CONSTRAINT "leads_wa_validation_state_check" CHECK (wa_validation_state IS NULL OR wa_validation_state IN ('VALIDO', 'NUMERO_INVALIDO', 'DESCONHECIDO'))
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"direction" text NOT NULL,
	"origin" text NOT NULL,
	"kind" text DEFAULT 'text' NOT NULL,
	"body" text NOT NULL,
	"parts" jsonb,
	"status" text DEFAULT 'queued' NOT NULL,
	"provider_msg_id" text,
	"idempotency_key" text NOT NULL,
	"latency_ms" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "messages_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "messages_direction_check" CHECK (direction IN ('in', 'out')),
	CONSTRAINT "messages_origin_check" CHECK (origin IN ('lead', 'bot', 'admin', 'ai_suggestion', 'system')),
	CONSTRAINT "messages_kind_check" CHECK (kind IN ('text', 'link')),
	CONSTRAINT "messages_status_check" CHECK (status IN ('queued', 'suggested', 'sent', 'failed', 'blocked'))
);
--> statement-breakpoint
CREATE TABLE "outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"origin" text NOT NULL,
	"message_id" uuid,
	"body" text NOT NULL,
	"parts" jsonb,
	"idempotency_key" text NOT NULL,
	"scheduled_for" timestamp DEFAULT now() NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"reserved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "outbox_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "outbox_origin_check" CHECK (origin IN ('bot', 'admin', 'followup', 'catchup')),
	CONSTRAINT "outbox_status_check" CHECK (status IN ('pending', 'reserved', 'sent', 'failed', 'abandoned'))
);
--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_channel_account_id_channel_accounts_id_fk" FOREIGN KEY ("channel_account_id") REFERENCES "public"."channel_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbox" ADD CONSTRAINT "outbox_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbox" ADD CONSTRAINT "outbox_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "outbox_pending_scheduled_idx" ON "outbox" USING btree ("scheduled_for","id") WHERE "outbox"."status" = 'pending';