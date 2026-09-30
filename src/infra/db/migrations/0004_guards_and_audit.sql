-- ===========================================================================
-- 0004_guards_and_audit — os invariantes que o TypeScript não consegue segurar
-- ===========================================================================
--
-- Até aqui, "messages é imutável", "opt_out é irreversível" e "lead não é
-- apagado" eram REGRAS DE CONVENÇÃO: uma linha de código errada, um `psql` aberto
-- no terminal, um `.sql` restaurado de um backup, e a regra valeria. Esta
-- migration move as três para dentro do banco, onde nenhuma aplicação consegue
-- contornar por descuido.
--
-- Duas barreiras, deliberadamente redundantes:
--
--   1. `REVOKE UPDATE, DELETE ... FROM PUBLIC` — negação de privilégio. Alguém
--      sem privilégio nem chega a tentar.
--   2. `CREATE TRIGGER` — a segunda barreira, para quem tem o privilégio por
--      outro caminho (o dono da tabela é superuser do cluster local; superuser
--      ignora REVOKE, não ignora trigger... exceto em `session_replication_role`,
--      que é exatamente o tipo de contorno que um trigger não pode impedir).
--
-- Ordem do arquivo: funções, depois triggers, depois privilégios, depois
-- comentários. Trigger antes de `REVOKE` para que a aplicação nunca veja uma
-- janela em que a regra "existe" mas ainda não está no gatilho.
--
-- Nota de idempotência: o `migrate()` do Drizzle executa cada arquivo uma vez,
-- governado por `drizzle.__drizzle_migrations`, então reexecutar este arquivo
-- direto não é um caminho suportado. Ainda assim `CREATE OR REPLACE FUNCTION`
-- e `DROP TRIGGER IF EXISTS` tornam a aplicação segura mesmo em um banco
-- restaurado de um dump intermediário.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Append-only (R-043, COMP-02)
-- ---------------------------------------------------------------------------
-- Uma função para as três tabelas: o comportamento é idêntico e a mensagem
-- cita `TG_TABLE_NAME`, de modo que o erro já diz de onde veio.
--
-- `RETURN NULL` depois do `RAISE` é inatingível — o `RAISE EXCEPTION` aborta a
-- instrução. Está ali porque o compilador do plpgsql exige um `RETURN`, e um
-- `RETURN NULL` silencioso num trigger de `BEFORE` significa "não modifica a
-- linha", que é o comportamento neutro e não um bug latente.
CREATE OR REPLACE FUNCTION fn_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
begin
	raise exception 'tabela % e append-only (R-043): % proibido', TG_TABLE_NAME, TG_OP;
	return null;
end;
$$;

COMMENT ON FUNCTION fn_append_only() is
	'BEFORE UPDATE OR DELETE. Sustenta R-043 (historico imutavel) e COMP-02. Anexa-se a messages, event_log e optout_ledger.';

-- ---------------------------------------------------------------------------
-- 2. Irreversibilidade do opt-out (R-024, AR-005, COMP-03)
-- ---------------------------------------------------------------------------
-- Só a transição verdadeiro→falso é bloqueada. `false→true` (registrar o
-- pedido) e `true→true` (atualizar qualquer outra coluna de um lead já
--.opt_out) passam, porque o trigger está em `leads`, uma tabela que recebe
-- UPDATE normal durante a vida da conversa.
--
-- O `WHEN` do trigger (abaixo) já restringe a `BEFORE UPDATE`; o `IF` dentro da
-- função é a mesma condição, deliberadamente duplicada: se alguém recriar o
-- trigger sem o `WHEN`, a barreira continua de pé. Uma regra de conformidade
-- que depende de um detalhe sintático do DDL não é uma regra de conformidade.
CREATE OR REPLACE FUNCTION fn_opt_out_irreversible()
RETURNS trigger
LANGUAGE plpgsql
AS $$
begin
	if old.opt_out = true and new.opt_out = false then
		raise exception 'opt_out nao pode ser revertido (R-024, AR-005)';
	end if;
	return new;
end;
$$;

COMMENT ON FUNCTION fn_opt_out_irreversible() is
	'BEFORE UPDATE ON leads. Sustenta R-024: o opt-out e irreversivel, sem excecao e sem correcao administrativa. A eliminacao e evento em optout_ledger, nunca um UPDATE.';

-- ---------------------------------------------------------------------------
-- 3. Lead não é apagado (LEAD-04, NFRQ-06)
-- ---------------------------------------------------------------------------
-- Nenhuma FK deste schema declara cascata, então este trigger nunca deve
-- disparar por cascade — e é exatamente por isso que ele existe: se alguém
-- adicionar `on delete cascade` a alguma FK no futuro, o efeito NÃO é a linha
-- sumir em silêncio, é um erro de trigger que aponta o dono do schema.
--
-- A eliminação de dados de lead é o evento `erasure_request` em
-- `optout_ledger` (LEAD-04), não a remoção da linha.
CREATE OR REPLACE FUNCTION fn_no_cascade_leads()
RETURNS trigger
LANGUAGE plpgsql
AS $$
begin
	raise exception 'leads nao pode ser deletado em cascata (LEAD-04)';
end;
$$;

COMMENT ON FUNCTION fn_no_cascade_leads() is
	'BEFORE DELETE ON leads. Sustenta LEAD-04/NFRQ-06: a eliminacao e o evento erasure_request em optout_ledger, nunca a remocao da linha. Existe para tornar qualquer cascata futura um erro visivel.';

-- ---------------------------------------------------------------------------
-- 4. Triggers
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_messages_append_only on messages;
CREATE TRIGGER trg_messages_append_only
	before update or delete on messages
	for each row execute function fn_append_only();

DROP TRIGGER IF EXISTS trg_event_log_append_only on event_log;
CREATE TRIGGER trg_event_log_append_only
	before update or delete on event_log
	for each row execute function fn_append_only();

DROP TRIGGER IF EXISTS trg_optout_ledger_append_only on optout_ledger;
CREATE TRIGGER trg_optout_ledger_append_only
	before update or delete on optout_ledger
	for each row execute function fn_append_only();

DROP TRIGGER IF EXISTS trg_leads_opt_out_irreversivel on leads;
CREATE TRIGGER trg_leads_opt_out_irreversivel
	before update on leads
	for each row
	when (old.opt_out = true and new.opt_out = false)
	execute function fn_opt_out_irreversible();

DROP TRIGGER IF EXISTS trg_leads_no_cascade on leads;
CREATE TRIGGER trg_leads_no_cascade
	before delete on leads
	for each row execute function fn_no_cascade_leads();

-- ---------------------------------------------------------------------------
-- 5. Preenchimento de blocked_attempts para o INSERT mínimo do dispatcher
-- ---------------------------------------------------------------------------
-- `src/application/dispatcher.ts` (01-01) grava exatamente
-- `(conversation_id, rule_reference, detail, created_at)` dentro de um
-- `try/catch` que registra `blocked_attempts_indisponivel` e segue. Sem este
-- trigger, `guard` e `reason_code` — NOT NULL — estouram e TODO negativo do
-- gate é perdido em silêncio: exatamente a trilha de auditoria que R-022 exige.
--
-- O chamador rico (`recordBlockedAttempt` em queries/blocked-attempts.ts)
-- preenche as colunas explicitamente e não é afetado: o trigger só age onde o
-- valor é nulo.
--
-- `guard` recebe o identificador do requisito, não o `GateReason`:
-- `rule_reference` JA E o GateReason (`ar001_preco`), e `guard` e o R/AR
-- correspondente (`AR-001`) — a grafia que o relatorio de conformidade e o
-- painel da Fase 04 citam. A traducao e mecanica: `ar<NNN>_*` vira `AR-<NNN>`.
CREATE OR REPLACE FUNCTION fn_preencher_blocked_attempt()
RETURNS trigger
LANGUAGE plpgsql
AS $$
begin
	if new.reason_code is null then
		new.reason_code := new.rule_reference;
	end if;

	if new.guard is null then
		new.guard := case
			-- AR numerados: o proprio nome carrega o numero (ar001_preco -> AR-001).
			when new.rule_reference ~ '^ar[0-9]{3}_'
				then 'AR-' || upper(substring(new.rule_reference from 3 for 3))
			when new.rule_reference = 'kill_switch_ativo' then 'R-042'
			when new.rule_reference = 'r001_primeiro_contato_nao_humano' then 'R-001'
			when new.rule_reference = 'lead_numero_invalido' then 'LEAD-03'
			-- Estas tres nao sao requisitos: sao falhas do proprio operador do
			-- gate. Marcar como GATE-INTERNO e melhor do que inventar um R-ID que
			-- nao existe e aparecer num relatorio de conformidade.
			else 'GATE-INTERNO'
		end;
	end if;

	if new.excerpt is null then
		-- O dispatcher manda `detail`, que e o motivo legivel. 280 caracteres e o
		-- mesmo corte que o painel usa; o texto integral, se existir, esta em
		-- `messages`, que e a fonte auditavel.
		new.excerpt := left(coalesce(new.detail, new.rule_reference), 280);
	end if;

	return new;
end;
$$;

COMMENT ON FUNCTION fn_preencher_blocked_attempt() is
	'BEFORE INSERT ON blocked_attempts. Deriva reason_code, guard e excerpt quando o INSERT nao os fornece, para que o writer minimo do dispatcher (01-01) nao perca a trilha de negativos (R-022).';

DROP TRIGGER IF EXISTS trg_blocked_attempts_preencher on blocked_attempts;
CREATE TRIGGER trg_blocked_attempts_preencher
	before insert on blocked_attempts
	for each row execute function fn_preencher_blocked_attempt();

-- ---------------------------------------------------------------------------
-- 6. Privilegios: a negacao antes do gatilho
-- ---------------------------------------------------------------------------
-- `REVOKE` nega para PUBLIC, que inclui todo role que ainda nao recebeu o
-- privilegio explicitamente. O role da aplicacao (o dono do schema) mantem o
-- privilegio, porque precisa de SELECT e INSERT — e e por isso que o trigger
-- acima e a barreira que realmente importa.
REVOKE UPDATE, DELETE ON messages FROM PUBLIC;
REVOKE UPDATE, DELETE ON event_log FROM PUBLIC;
REVOKE UPDATE, DELETE ON optout_ledger FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- 7. Comentarios: um trigger sem documentacao nao sobrevive a maintenance
-- ---------------------------------------------------------------------------
COMMENT ON TABLE messages is
	'Historico de mensagens (R-043). Append-only por trigger e por revogacao de privilegio. Nunca UPDATE nem DELETE: correcao e um novo registro, nao uma sobrescrita.';

COMMENT ON TABLE event_log is
	'Trilha de eventos tecnicos (R-022, R-045). Append-only. Nao e o historico de conversa: o conteudo das mensagens vive em messages.';

COMMENT ON TABLE optout_ledger is
	'Pedidos do titular (R-024, LEAD-04, COMP-03). Append-only e SEM COLUNA DE ESTADO, de proposito: a eliminacao e o evento erasure_request, e o opt-out e irreversivel. Nenhuma linha e removida ou corrigida aqui.';

COMMENT ON TABLE blocked_attempts is
	'Trilha de negativos do gate (R-022, R-045). Gate que bloqueia sem registro nao e auditavel. rule_reference e o GateReason; guard e o R/AR correspondente.';

COMMENT ON TABLE handoff_events is
	'Interrupcoes da automacao (R-012, R-065). Uma linha por handoff, com o instante em que o bot calou. human_acknowledged_at preenchido pelo Admin = R-066 (o bot nao volta a falar sozinho).';

COMMENT ON TABLE mode_changes is
	'Transicoes de engagement_mode (bot_active, awaiting_human, human, copilot, pausado). Append-only por convencao da aplicacao: e historico de quem assumiu, e nao estado atual.';

COMMENT ON TABLE status_history is
	'Transicoes de conversations.state. Complementa mode_changes: um guarda a postura de relacionamento, o outro guarda o estagio do funil.';

COMMENT ON TABLE scheduled_tasks is
	'Fila de follow-up (R-007, R-006, R-023). scheduled_for pode estar no passado quando o app estava fechado — a execucao e reavaliada contra janela e cota antes de enviar, nunca assumida.';

COMMENT ON TABLE app_users is
	'Unico usuario da aplicacao na Fase 1 (R-027, EQUP-01). A tabela ja nasce com id proprio para a segunda linha do v2 ser so um INSERT, sem migracao.';

COMMENT ON TABLE settings is
	'Parametros operacionais chave/valor (fuso, janela, limites). updated_by referencia app_users e e nullable porque a migracao de um plano pode alterar.';
