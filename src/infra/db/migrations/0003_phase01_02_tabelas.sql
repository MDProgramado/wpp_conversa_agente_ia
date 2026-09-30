CREATE TABLE "app_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "blocked_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid,
	"lead_id" uuid,
	"direction" text DEFAULT 'out' NOT NULL,
	"guard" text NOT NULL,
	"reason_code" text NOT NULL,
	"rule_reference" text NOT NULL,
	"excerpt" text NOT NULL,
	"detail" text,
	"payload_excerpt" text,
	"window_at_event" timestamp with time zone,
	"blocked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "blocked_attempts_direction_check" CHECK (direction IN ('in', 'out'))
);
--> statement-breakpoint
CREATE TABLE "event_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"lead_id" uuid,
	"conversation_id" uuid,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"severity" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_log_severity_check" CHECK (severity IN ('debug', 'info', 'warn', 'error', 'critical'))
);
--> statement-breakpoint
CREATE TABLE "handoff_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"channel_account_id" uuid NOT NULL,
	"triggered_by" text NOT NULL,
	"trigger_detail" text,
	"trigger_value" text,
	"excerpt" text NOT NULL,
	"simultaneous_send_blocked" boolean NOT NULL,
	"bot_stopped_at" timestamp with time zone NOT NULL,
	"human_acknowledged_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "handoff_events_triggered_by_check" CHECK (triggered_by IN ('keyword', 'intent', 'message_type', 'opt_out', 'validation_error', 'low_confidence', 'user_defined'))
);
--> statement-breakpoint
CREATE TABLE "mode_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"from_mode" text NOT NULL,
	"to_mode" text NOT NULL,
	"actor" text NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mode_changes_to_mode_check" CHECK (to_mode IN ('bot_active', 'awaiting_human', 'human', 'copilot', 'pausado')),
	CONSTRAINT "mode_changes_from_mode_check" CHECK (from_mode IN ('bot_active', 'awaiting_human', 'human', 'copilot', 'pausado')),
	CONSTRAINT "mode_changes_actor_check" CHECK (actor IN ('bot', 'admin', 'system'))
);
--> statement-breakpoint
CREATE TABLE "optout_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"source" text NOT NULL,
	"detected_by" text,
	"raw_content" text NOT NULL,
	"legal_basis" text NOT NULL,
	"purpose" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "optout_ledger_event_type_check" CHECK (event_type IN ('opt_out', 'erasure_request', 'reinstate')),
	CONSTRAINT "optout_ledger_source_check" CHECK (source IN ('auto_detected', 'manual')),
	CONSTRAINT "optout_ledger_detected_by_check" CHECK (detected_by IS NULL OR detected_by IN ('deterministic', 'llm_signal'))
);
--> statement-breakpoint
CREATE TABLE "scheduled_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"task_type" text NOT NULL,
	"scheduled_for" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"cancelled_at" timestamp with time zone,
	"cancelled_reason" text,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scheduled_tasks_status_check" CHECK (status IN ('pending', 'done', 'failed', 'abandoned'))
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"from_state" text NOT NULL,
	"to_state" text NOT NULL,
	"changed_by" text NOT NULL,
	"reason" text,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "responsible_user_id" uuid;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "author_user_id" uuid;--> statement-breakpoint
ALTER TABLE "blocked_attempts" ADD CONSTRAINT "blocked_attempts_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocked_attempts" ADD CONSTRAINT "blocked_attempts_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_log" ADD CONSTRAINT "event_log_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_log" ADD CONSTRAINT "event_log_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handoff_events" ADD CONSTRAINT "handoff_events_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handoff_events" ADD CONSTRAINT "handoff_events_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handoff_events" ADD CONSTRAINT "handoff_events_channel_account_id_channel_accounts_id_fk" FOREIGN KEY ("channel_account_id") REFERENCES "public"."channel_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mode_changes" ADD CONSTRAINT "mode_changes_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "optout_ledger" ADD CONSTRAINT "optout_ledger_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_tasks" ADD CONSTRAINT "scheduled_tasks_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_updated_by_app_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."app_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_history" ADD CONSTRAINT "status_history_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "blocked_attempts_conversation_idx" ON "blocked_attempts" USING btree ("conversation_id","blocked_at" DESC);--> statement-breakpoint
CREATE INDEX "blocked_attempts_guard_idx" ON "blocked_attempts" USING btree ("guard","blocked_at" DESC);--> statement-breakpoint
CREATE INDEX "event_log_created_idx" ON "event_log" USING btree ("created_at" DESC);--> statement-breakpoint
CREATE INDEX "event_log_type_created_idx" ON "event_log" USING btree ("event_type","created_at" DESC);--> statement-breakpoint
CREATE INDEX "handoff_events_open_idx" ON "handoff_events" USING btree ("created_at") WHERE "handoff_events"."human_acknowledged_at" IS NULL;--> statement-breakpoint
CREATE INDEX "mode_changes_conversation_created_idx" ON "mode_changes" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "optout_ledger_lead_occurred_idx" ON "optout_ledger" USING btree ("lead_id","occurred_at" DESC);--> statement-breakpoint
CREATE INDEX "scheduled_tasks_pending_idx" ON "scheduled_tasks" USING btree ("scheduled_for","id") WHERE "scheduled_tasks"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "status_history_conversation_changed_idx" ON "status_history" USING btree ("conversation_id","changed_at");