/**
 * Kill switch como INVARIANTE, não como caso de teste.
 *
 * Duas metades, e a divisão é deliberada:
 *
 * 1. **Propriedade** (puro, sem banco): para QUALQUER snapshot com
 *    `killSwitch = true`, `evaluatePolicy` devolve `block` com
 *    `reason: "kill_switch_ativo"` — independentemente de todas as outras
 *    dimensões. É a afirmação que o botão de emergência do painel da Fase 04
 *    depende: conta inativa precisa calar o bot, e nenhum outro campo pode
 *    "vencer" esse bloqueio.
 *
 * 2. **Provas por tentativa no PostgreSQL real** (banco de verdade, migration
 *    aplicada): `messages`, `event_log` e `optout_ledger` são append-only, e
 *    `leads.opt_out` só anda de `false` para `true`. Sem trigger no banco, cada
 *    uma dessas afirmações é uma convenção que o próximo `psql` burla.
 *
 * Por que a metade (2) não usa `openDb`: `openDb` roda `migrate()` antes de
 * devolver o handle, e aí o teste PASSARIA por efeito colateral do runner — ele
 * aplicaria a migration dos triggers e depois "confirmaria" que os triggers
 * existem. O teste passaria mesmo com a migration removida do repositório na
 * linha seguinte. Aqui a conexão é um `Pool` cru: o teste afirma o estado do banco
 * como está, e se alguém esquecer de aplicar a migration, ele FALHA.
 */
import { readFileSync } from "node:fs";
import fc from "fast-check";
import type { PoolClient } from "pg";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { evaluatePolicy } from "../../src/domain/gate/evaluate-policy.js";
import type { GateInput } from "../../src/domain/gate/types.js";
import { DIA_UTIL_DENTRO_DA_JANELA, TZ, validInbound } from "./fixtures.js";

/** Semente fixa: uma falha de propriedade é reproduzível com o mesmo número. */
const SEMENTE = 20260928;

/**
 * `GateInput` arbitrário em TODAS as dimensões que o gate enxerga, e depois
 * sobrescrito só no kill switch. É o que "independente de todas as outras
 * dimensões" significa em código: se qualquer campo conseguisse desviar a
 * decisão, este arbitrário o encontraria.
 */
const snapshotArbitrario: fc.Arbitrary<GateInput> = fc.record({
	lead: fc.record({
		id: fc.uuid(),
		// E.164 válido de fixture: um telefone inválido faria o lead cair no guard
		// `lead_numero_invalido` e a propriedade pareceria passar por acidente.
		phoneNumber: fc.constantFrom(
			"+5511999999999",
			"+5511988887777",
			"+5521987654321",
		),
		optOut: fc.boolean(),
		originSource: fc.constantFrom("cacaleads", "indicacao", "site"),
		legalBasis: fc.constantFrom("legitimo_interesse", null),
		purpose: fc.constantFrom("prospecao_b2b_servicos_digitais", null),
		legalRegisteredAt: fc.constantFrom(
			"2025-01-01T12:00:00.000Z",
			null,
			// Registro no FUTURO barra AR-011 — e essa é outra dimensão que não pode
			// desviar o kill switch.
			"2027-01-01T12:00:00.000Z",
		),
		firstContactByHuman: fc.boolean(),
		waValidationState: fc.constantFrom(
			"valid",
			"invalido",
			"desconhecido",
			null,
		),
	}),
	conversation: fc.record({
		id: fc.uuid(),
		state: fc.constantFrom("novo", "aquecimento", "humano", "pausado"),
		engagementMode: fc.constantFrom(
			"bot_active",
			"awaiting_human",
			"human",
			"copilot",
			"pausado",
		),
		handoffActive: fc.boolean(),
		pendingMediaBlock: fc.boolean(),
	}),
	outbound: fc.record({
		// Texto com preço, agendamento e mídia: se o kill switch dependesse de
		// passar pelos outros guards, este texto denunciaria a inversão de ordem.
		text: fc.constantFrom(
			"Boa tarde! Posso ajudar?",
			"R$ 3.500 pelo projeto, fechado?",
			"Consigo agendar sua reunião amanhã às 10h.",
			"Envio o PDF do orçamento agora.",
			"Sou um robô, respondo automaticamente.",
		),
		parts: fc.constantFrom([{ kind: "text" }] as const),
	}),
	context: fc.record({
		killSwitch: fc.boolean(),
		now: fc.constantFrom(new Date(DIA_UTIL_DENTRO_DA_JANELA)),
		tz: fc.constantFrom(TZ, "UTC", "America/Manaus"),
		windowStartHour: fc.constantFrom(0, 7, 9),
		windowEndHour: fc.constantFrom(12, 17, 23),
		dailyMessageLimit: fc.constantFrom(0, 25, 30),
		dailyMessageCap: fc.constantFrom(1, 30, 99),
		sentToday: fc.integer({ min: 0, max: 200 }),
		newContactsToday: fc.integer({ min: 0, max: 200 }),
	}),
});

describe("kill switch — propriedade (puro, sem banco)", () => {
	it("bloqueia com kill_switch_ativo em 500 snapshots arbitrários com killSwitch = true", () => {
		fc.assert(
			fc.property(snapshotArbitrario, (snapshot) => {
				const input: GateInput = {
					...snapshot,
					context: { ...snapshot.context, killSwitch: true },
				};
				const decisao = evaluatePolicy(input);
				expect(decisao.action).toBe("block");
				expect(decisao.action === "block" && decisao.reason).toBe(
					"kill_switch_ativo",
				);
			}),
			{ numRuns: 500, seed: SEMENTE },
		);
	});

	it("NUNCA acusa kill_switch_ativo com killSwitch = false (mesmo snapshot arbitrário)", () => {
		fc.assert(
			fc.property(snapshotArbitrario, (snapshot) => {
				const input: GateInput = {
					...snapshot,
					context: { ...snapshot.context, killSwitch: false },
				};
				const decisao = evaluatePolicy(input);
				// O kill switch não pode ser a razão de nenhum outro desfecho. Sem
				// este complemento, um guard que devolvesse `kill_switch_ativo`
				// "por acaso" manteria o teste anterior verde.
				//
				// `evaluatePolicy` só produz `block` ou `send` hoje — o terceiro
				// desfecho da união (`unknown`) é para as fases seguintes, quando
				// houver leitura inconclusiva de estado.
				if (decisao.action === "block") {
					expect(decisao.reason).not.toBe("kill_switch_ativo");
				}
			}),
			{ numRuns: 500, seed: SEMENTE },
		);
	});

	it("o kill switch é o PRIMEIRO guard: um snapshot que violaria AR-001, AR-003 e R-024 reporta kill_switch_ativo", () => {
		// Teste de sanidade, não de propriedade: fixa a ORDEM. Se alguém mover o
		// kill switch para o fim da lista, a propriedade acima continuaria verde
		// (o resultado ainda seria `block`) e entregaria o motivo errado — o painel
		// da Fase 04 mostraria `ar001_preco` para um operador tentando desligar a
		// conta de emergência.
		const base = validInbound({
			lead: { optOut: true, firstContactByHuman: false },
			outbound: { text: "R$ 3.500 e agendo sua reunião agora" },
			context: { killSwitch: true, now: new Date("2026-09-27T12:00:00.000Z") },
		});
		const decisao = evaluatePolicy(base);
		expect(decisao.action).toBe("block");
		expect(decisao.action === "block" && decisao.reason).toBe(
			"kill_switch_ativo",
		);
	});
});

// ---------------------------------------------------------------------------
// Metade 2: provas por tentativa no PostgreSQL real
// ---------------------------------------------------------------------------

/** Lê só a URL de conexão do `.env` — o arquivo NÃO é impresso nem logado. */
const databaseUrl = (): string => {
	const linha = readFileSync(".env", "utf8")
		.split(/\r?\n/)
		.find((l) => l.startsWith("DATABASE_URL="));
	if (!linha) throw new Error("DATABASE_URL ausente do .env");
	return linha.slice("DATABASE_URL=".length).trim();
};

let pool: Pool;
/** Só para gerar telefones de fixture distintos dentro da mesma execução. */
let sequencia = 0;

/**
 * Telefone E.164 de fixture, novo a cada chamada: 13 dígitos, dentro do CHECK
 * `^\+[1-9][0-9]{7,14}$` de `leads` e `channel_accounts`.
 *
 * Único por chamada porque os dois têm `UNIQUE` e porque um resíduo de uma
 * execução anterior quebraria o teste por um motivo que não tem nada a ver com a
 * invariante sob teste.
 */
const telefoneFixture = (): string => {
	sequencia += 1;
	const bloco = String(Date.now() % 100000).padStart(5, "0");
	return `+55119${bloco}${String(sequencia).padStart(3, "0")}`;
};

beforeAll(() => {
	pool = new Pool({
		connectionString: databaseUrl(),
		// Um teste por vez: as fixtures usam telefones únicos, mas serializar
		// mantém a ordem dos logs legível e elimina qualquer corrida de
		// unique-violation entre testes concorrentes.
		max: 1,
		application_name: "testes_kill_switch",
	});
});

afterAll(async () => {
	await pool?.end();
});

/**
 * Executa `sql` esperando que o PostgreSQL REJEITE, e devolve o erro literal.
 * Devolve `null` quando o statement passa — e aí o teste falha, que é o ponto.
 *
 * `RAISE EXCEPTION` dentro de trigger aborta a transação inteira; o
 * `ROLLBACK TO SAVEPOINT` devolve a transação à vida para as próximas
 * asserções sem desfazer as fixtures já inseridas.
 */
const esperaRejeicao = async (
	client: PoolClient,
	sql: string,
	parametros: unknown[] = [],
): Promise<{ codigo: string; mensagem: string } | null> => {
	await client.query("savepoint prova");
	try {
		await client.query(sql, parametros);
		await client.query("rollback to savepoint prova");
		return null;
	} catch (e) {
		await client.query("rollback to savepoint prova");
		const err = e as { code?: string; message?: string };
		return { codigo: err.code ?? "?", mensagem: err.message ?? "?" };
	}
};

/** Cria as fixtures mínimas (conta, lead, conversa, mensagem) e devolve os ids. */
const criaFixtures = async (
	client: PoolClient,
): Promise<{ leadId: string; messageId: string; conversationId: string }> => {
	const conta = await client.query(
		"insert into channel_accounts (phone_e164) values ($1) returning id",
		[telefoneFixture()],
	);
	const lead = await client.query(
		`insert into leads (phone_number, origin_source, purpose, legal_registered_at)
		 values ($1, 'cacaleads', 'prospecao_b2b_servicos_digitais', now() - interval '1 day')
		 returning id`,
		[telefoneFixture()],
	);
	const conversa = await client.query(
		"insert into conversations (lead_id, channel_account_id) values ($1, $2) returning id",
		[lead.rows[0].id, conta.rows[0].id],
	);
	const mensagem = await client.query(
		`insert into messages (conversation_id, direction, origin, body, idempotency_key)
		 values ($1, 'out', 'bot', 'Boa tarde!', $2) returning id`,
		[conversa.rows[0].id, `prova-${Date.now()}-${Math.random()}`],
	);
	return {
		leadId: lead.rows[0].id as string,
		messageId: mensagem.rows[0].id as string,
		conversationId: conversa.rows[0].id as string,
	};
};

/**
 * Roda `corpo` numa transação que é SEMPRE revertida, devolvendo o resultado.
 *
 * Por que reverter e não limpar: `messages`, `event_log` e `optout_ledger`
 * serão append-only (R-043), então um `DELETE` de limpeza passaria a ser
 * proibido — o próprio teste quebraria a invariante que existe para provar. O
 * `ROLLBACK` final é a única limpeza que continua válida depois dos triggers
 * ativos.
 *
 * Por que o `release` importa: o pool é `max: 1`, e sem `release` a conexão
 * seguinte esperaria para sempre — o teste expiraria em 5s em vez de reprovar
 * com a mensagem do que deu errado. O `rollback` redundante no `finally` cobre
 * o caso em que `corpo` estoura antes do rollback final.
 */
const emTransacaoDescartavel = async <T>(
	corpo: (client: PoolClient) => Promise<T>,
): Promise<T> => {
	const client = await pool.connect();
	try {
		await client.query("begin");
		try {
			const resultado = await corpo(client);
			await client.query("rollback");
			return resultado;
		} catch (e) {
			await client.query("rollback").catch(() => undefined);
			throw e;
		}
	} finally {
		client.release();
	}
};

/** `P0001` é o SQLSTATE de `RAISE EXCEPTION` — o que o trigger emite. */
const P0001 = "P0001";

describe("invariantes de auditoria no PostgreSQL real", () => {
	it("R-043: UPDATE em messages é REJEITADO pelo banco, não por convenção", async () => {
		const erro = await emTransacaoDescartavel(async (client) => {
			const { messageId } = await criaFixtures(client);
			return esperaRejeicao(
				client,
				"update messages set body = $1 where id = $2",
				["preco novo", messageId],
			);
		});
		expect(
			erro,
			"UPDATE em messages NÃO foi rejeitado — trigger append-only ausente",
		).not.toBeNull();
		expect(erro?.codigo).toBe(P0001);
		expect(erro?.mensagem).toContain("append-only");
	});

	it("R-043: DELETE em optout_ledger é REJEITADO pelo banco", async () => {
		const erro = await emTransacaoDescartavel(async (client) => {
			const { leadId } = await criaFixtures(client);
			await client.query(
				`insert into optout_ledger (lead_id, event_type, source, raw_content, legal_basis, purpose, occurred_at)
				 values ($1, 'opt_out', 'auto_detected', 'pare de me mandar msg', 'legitimate_interest', 'prospecao_b2b_servicos_digitais', now())`,
				[leadId],
			);
			return esperaRejeicao(
				client,
				"delete from optout_ledger where lead_id = $1",
				[leadId],
			);
		});
		expect(
			erro,
			"DELETE em optout_ledger NÃO foi rejeitado — trigger ausente",
		).not.toBeNull();
		expect(erro?.codigo).toBe(P0001);
	});

	it("R-022: UPDATE e DELETE em event_log são REJEITADOS pelo banco", async () => {
		const { erroUpdate, erroDelete } = await emTransacaoDescartavel(
			async (client) => {
				await client.query(
					`insert into event_log (event_type, entity_type, severity)
				 values ('prova', 'teste', 'debug')`,
				);
				const erroUpdate = await esperaRejeicao(
					client,
					"update event_log set severity = 'error'",
				);
				const erroDelete = await esperaRejeicao(
					client,
					"delete from event_log",
				);
				return { erroUpdate, erroDelete };
			},
		);
		expect(erroUpdate, "UPDATE em event_log NÃO foi rejeitado").not.toBeNull();
		expect(erroDelete, "DELETE em event_log NÃO foi rejeitado").not.toBeNull();
		expect(erroUpdate?.codigo).toBe(P0001);
		expect(erroDelete?.codigo).toBe(P0001);
	});

	it("R-024: UPDATE leads SET opt_out = false é REJEITADO — e só essa direção", async () => {
		const { erro, gravado } = await emTransacaoDescartavel(async (client) => {
			const { leadId } = await criaFixtures(client);

			// Sentido permitido: registrar o opt-out. Tem de passar.
			await client.query("update leads set opt_out = true where id = $1", [
				leadId,
			]);
			const conferido = await client.query(
				"select opt_out from leads where id = $1",
				[leadId],
			);

			// Sentido proibido: reativar. Tem de ser rejeitado.
			const erro = await esperaRejeicao(
				client,
				"update leads set opt_out = false where id = $1",
				[leadId],
			);
			return { erro, gravado: conferido.rows[0].opt_out === true };
		});
		expect(
			gravado,
			"false -> true (registrar opt-out) foi barrado: só a inversão é proibida",
		).toBe(true);
		expect(
			erro,
			"UPDATE leads SET opt_out = false NÃO foi rejeitado — R-024 violado no banco",
		).not.toBeNull();
		expect(erro?.codigo).toBe(P0001);
		expect(erro?.mensagem).toContain("opt_out");
	});

	it("R-022: o INSERT do dispatcher (conversation_id, rule_reference, detail, created_at) preenche guard, reason_code e excerpt", async () => {
		const linha = await emTransacaoDescartavel(async (client) => {
			const { conversationId } = await criaFixtures(client);
			// Exatamente o conjunto de colunas que `src/application/dispatcher.ts`
			// envia. Sem o trigger, isto estouraria NOT NULL de `guard` — e todo
			// TODO negativo do gate morreria dentro de um try/catch que só loga.
			await client.query(
				`insert into blocked_attempts (conversation_id, rule_reference, detail, created_at)
				 values ($1, 'ar001_preco', 'citou R$ 3.500', now())`,
				[conversationId],
			);
			const res = await client.query(
				"select guard, reason_code, excerpt from blocked_attempts where conversation_id = $1",
				[conversationId],
			);
			return res.rows[0] as Record<string, unknown> | undefined;
		});
		expect(
			linha,
			"o INSERT do dispatcher não criou linha em blocked_attempts",
		).toBeDefined();
		expect(linha?.reason_code).toBe("ar001_preco");
		expect(linha?.excerpt).toBe("citou R$ 3.500");
		// `rule_reference` é o identificador canônico do guard (R-022/R-045); o
		// trigger o espelha em `reason_code` e traduz o slot em `guard`.
		expect(linha?.guard).toBe("guard-6a");
	});
});
