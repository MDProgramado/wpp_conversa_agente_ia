/**
 * Trilha de **negativos** do gate (R-022, R-045, COMP-03).
 *
 * Gate que bloqueia sem deixar registro não é auditável, e o relatório de
 * conformidade do mês depende destas linhas para contar "quantas vezes o AR-001
 * disparou". Este módulo tem os dois lados: `recordBlockedAttempt` escreve,
 * `loadBlockedAttempts` lê de volta.
 *
 * ## Por que existem dois caminhos de escrita
 *
 * O `dispatcher.ts` do 01-01 grava um INSERT **embutido**, com o conjunto
 * mínimo de colunas:
 *
 * ```sql
 * insert into blocked_attempts (conversation_id, rule_reference, detail, created_at)
 * ```
 *
 * dentro de um `try/catch` que registra `blocked_attempts_indisponivel` e
 * **segue**. `guard`, `reason_code` e `excerpt` são `NOT NULL`, então esse
 * INSERT falharia e TODO negativo do gate seria perdido em silêncio — o
 * `dispatcher` é propriedade do 01-01 e não pode ser corrigido aqui. A resposta
 * é o trigger `fn_preencher_blocked_attempt` (migration
 * `0004_guards_and_audit.sql`), que deriva as três colunas de
 * `rule_reference`/`detail` quando o chamador não as fornece.
 *
 * `recordBlockedAttempt` é o caminho **rico**, para quem tem todos os dados:
 * escreve `guard`, `reason_code` e `excerpt` explicitamente e por isso não é
 * afetado pelo trigger — que só age onde o valor é nulo.
 *
 * ## `guard` versus `reason_code`, que seem o mesmo campo
 *
 * Não são. `rule_reference` e `reason_code` carregam o `GateReason`
 * (`ar001_preco`); `guard` carrega o identificador do requisito
 * (`AR-001`), que é a grafia que o painel da Fase 04 e o relatório de
 * conformidade citam. A tradução é mecânica e vive em uma função só — a do
 * trigger — para que as duas colunas nunca discordem.
 */
import { sql } from "drizzle-orm";
import type { GateReason } from "../../../domain/gate/types.js";
import type { Db } from "../client.js";
import { blockedAttempts } from "../schema.js";

/**
 * O que o chamador sabe quando um guard disparou.
 *
 * `guard` e `excerpt` são opcionais porque o caminho mínimo do dispatcher não os
 * tem; quando ausentes, o trigger preenche. `ruleReference` é obrigatório e é o
 * `GateReason` — o identificador canônico (R-022).
 */
export interface NegativoDoGate {
	readonly conversationId: string;
	readonly ruleReference: GateReason;
	/** Texto legível do porquê — é o que o painel mostra ao Admin. */
	readonly detail: string;
	/** R/AR correspondente (`AR-001`, `R-042`, `LEAD-03`). Derivado se ausente. */
	readonly guard?: string;
	/** Trecho do texto que o guard examinou, para o relatório de conformidade. */
	readonly excerpt?: string;
	/** `in` para bloqueio na recepção (AR-009, mídia recebida), `out` por padrão. */
	readonly direction?: "in" | "out";
	/** Recorte da janela operacional no instante do bloqueio (AR-007, R-006). */
	readonly windowAtEvent?: Date;
	/**
	 * Instante do fato, quando difere do instante da gravação. `dispatcher.ts`
	 * manda `now()`; os jobs de follow-up mandam o horário agendado, que é o que
	 * o relatório precisa para detectar um disparo atrasado (R-007).
	 */
	readonly createdAt?: Date;
}

/** Uma linha de `blocked_attempts` como o painel a consome. */
export interface NegativoLido {
	readonly id: string;
	readonly conversationId: string | null;
	readonly leadId: string | null;
	readonly direction: "in" | "out";
	readonly guard: string;
	readonly reasonCode: string;
	readonly ruleReference: string;
	readonly excerpt: string;
	readonly detail: string | null;
	readonly blockedAt: Date;
	readonly createdAt: Date;
}

/** Teto padrão de leitura. O painel pede 50; mais que isso e tela cheia, não dado. */
export const LIMITE_PADRAO = 50;

/**
 * Grava um negativo do gate.
 *
 * Devolve o `id` gravado para que o chamador possa correlacionar o log da
 * aplicação com a linha de auditoria — sem ele, um `blocked_attempts` no log e
 * uma linha no banco não se ligam.
 *
 * `on conflict do nothing` não é uma desculpa para ignorar duplicata: não há
 * chave única além da PK gerada, então um reenvio do mesmo bloqueio cria uma
 * linha nova. É o comportamento correto — o gate reavaliado é um fato novo, e o
 * relatório de conformidade quer contar quantas vezes a regra disparou, não
 * quantas vezes alguém abriu a tela.
 */
export const recordBlockedAttempt = async (
	db: Db,
	input: NegativoDoGate,
): Promise<string> => {
	const resultado = await db.execute(sql`
		insert into ${blockedAttempts} (
			conversation_id,
			direction,
			guard,
			reason_code,
			rule_reference,
			excerpt,
			detail,
			window_at_event,
			created_at
		)
		values (
			${input.conversationId},
			${input.direction ?? "out"},
			${input.guard ?? null},
			${input.ruleReference},
			${input.ruleReference},
			${input.excerpt ?? cortaExcerpt(input.detail)},
			${input.detail},
			${input.windowAtEvent ?? null},
			${coalesceCreatedAt(input.createdAt)}
		)
		returning id
	`);

	const rows = (resultado as unknown as { rows: { id: string }[] }).rows;
	// `RETURNING id` numa tabela com PK uuid e default sempre devolve uma linha.
	// A ausência aqui significaria que o INSERT não aconteceu, e devolver um id
	// inventado seria pior que falhar: o log mentiria sobre a auditoria.
	const primeira = rows[0];
	if (!primeira) {
		throw new Error(
			"recordBlockedAttempt: o INSERT não devolveu id — a trilha de negativos (R-022) não foi gravada",
		);
	}
	return primeira.id;
};

/**
 * `created_at` é NOT NULL com default `now()`. Mandar `null` explicitamente
 * anula o default no PostgreSQL, então o default tem de ser escolhido aqui.
 */
const coalesceCreatedAt = (criadoEm: Date | undefined): Date =>
	criadoEm ?? new Date();

/**
 * Corte do `excerpt`, igual ao que `fn_preencher_blocked_attempt` aplica no
 * trigger — 280 caracteres, o que o painel da Fase 04 mostra. O texto integral,
 * se existir, está em `messages`, que é a fonte auditável.
 *
 * O corte é feito em JS, e não em SQL, para que o caminho rico e o caminho
 * mínimo produzam a MESMA string: um `left()` aqui e um `left()` no trigger com
 * limites diferentes produziriam dois `excerpt` para o mesmo bloqueio, e a
 * reconciliação de auditoria da Fase 04 acusaria divergência.
 */
const CORTE_EXCERPT = 280;
const cortaExcerpt = (detail: string): string => detail.slice(0, CORTE_EXCERPT);

/**
 * Lê os negativos de uma conversa, mais recentes primeiro.
 *
 * A ordenação é `blocked_at DESC` e não `created_at DESC` porque `blocked_at` é
 * o canônico (ver nota 2 do schema): `created_at` é o nome que o `dispatcher.ts`
 * do 01-01 grava, e os dois só divergem quando o job de follow-up registra o
 * horário agendado em vez do instante real. Ordenar pelo agendado mostraria um
 * follow-up atrasado como se tivesse disparado na hora.
 *
 * `limit` é limitado a 200 no TypeScript **e** re-limitado no SQL: a query é
 * parametrizada, mas um `limit` de million deixaria a Fase 04 sem render e
 * nenhum erro visível.
 */
export const loadBlockedAttempts = async (
	db: Db,
	conversationId: string,
	limit: number = LIMITE_PADRAO,
): Promise<NegativoLido[]> => {
	const teto = Math.min(Math.max(Math.trunc(limit), 1), 200);

	const resultado = await db.execute(sql`
		select
			id,
			conversation_id,
			lead_id,
			direction,
			guard,
			reason_code,
			rule_reference,
			excerpt,
			detail,
			blocked_at,
			created_at
		from ${blockedAttempts}
		where conversation_id = ${conversationId}
		order by blocked_at desc
		limit ${teto}
	`);

	return (resultado as unknown as { rows: Record<string, unknown>[] }).rows.map(
		paraNegativoLido,
	);
};

/**
 * Narrowing explícito das três colunas fechadas em vez de `as`.
 *
 * `direction` e `blocked_at`/`created_at` vêm do banco como `text`/`timestamptz`
 * crus; o CHECK do schema garante a união de `direction`, mas o TypeScript não
 * sabe disso. Deixar `string`/`string | null` vazar para a Fase 04 daria
 * `decision.direction` como `string` e o `switch` do painel perderia o
 * exhaustiveness check.
 */
const paraNegativoLido = (row: Record<string, unknown>): NegativoLido => ({
	id: row.id as string,
	conversationId: (row.conversation_id as string | null) ?? null,
	leadId: (row.lead_id as string | null) ?? null,
	direction: row.direction === "in" ? "in" : "out",
	guard: row.guard as string,
	reasonCode: row.reason_code as string,
	ruleReference: row.rule_reference as string,
	excerpt: row.excerpt as string,
	detail: (row.detail as string | null) ?? null,
	blockedAt: row.blocked_at as Date,
	createdAt: row.created_at as Date,
});

/**
 * Agregado do relatório mensal de conformidade: quantas vezes cada regra
 * disparou numa janela de datas.
 *
 * `date_trunc` fecha a granularidade, mas a lista de regras vem da
 * aplicação — o relatório compara com os 12 anti-requisitos e com as regras
 * operacionais (R-042, R-001, LEAD-03), e uma linha só com o que disparou não
 * distingue "nunca aconteceu" de "não existe mais no código".
 */
export const countBlockedAttemptsByGuard = async (
	db: Db,
	desde: Date,
	ate: Date,
): Promise<readonly { guard: string; total: number }[]> => {
	const resultado = await db.execute(sql`
		select guard, count(*)::int as total
		from ${blockedAttempts}
		where blocked_at >= ${desde} and blocked_at < ${ate}
		group by guard
		order by total desc, guard asc
	`);
	return (resultado as unknown as { rows: { guard: string; total: number }[] })
		.rows;
};
