/**
 * Boot da aplicação — ordem inegociável: config → banco (com migrate) → logs →
 * canal → motor.
 *
 * Config antes de tudo porque o logger abre arquivo sob `DATA_ROOT`, e `DATA_ROOT`
 * vem da config. Banco antes do canal porque o canal é quem decide o que existe
 * para conversar; um socket conectado a um schema incompleto é pior que nenhum socket.
 *
 * Hoje o boot termina em (g): o canal e o dispatcher entram na Task 5.
 */
import { sql } from "drizzle-orm";
import { ensureDataDirs, env } from "./config/env.js";
import { closeDb, openDb } from "./infra/db/client.js";
import { childLogger, flushLogSync } from "./infra/logger.js";

/**
 * `BOOT_CHECK_ONLY=1` vem do `launch.cmd check`. Roda o MESMO boot, passo por passo
 * — o que valida o stack inteiro — e encerra em vez de ficar vivo. Sem isso, um
 * launcher que mantém processo nunca devolveria exit 0 e o gate ficaria pendurado.
 */
const BOOT_CHECK_ONLY = process.env.BOOT_CHECK_ONLY === "1";

/**
 * Handle que segura o processo vivo no boot de produção. Vive no escopo do módulo
 * para que `encerra` possa soltá-lo — um timer ref'd que ninguém limpa é justamente
 * o que impediria o processo de sair no Ctrl+C.
 */
let keepAlive: NodeJS.Timeout | undefined;

/**
 * Contagem com `::int`: o driver devolve `count(*)` como `bigint`, que serializa
 * como string (`"0"`) e o campo sairia `"leads_total": "0"` no log — quebrar o gate
 * que exige inteiro e, pior, esconder a diferença entre 0 e "sem lead nenhum".
 */
const countOf = async (
	db: Awaited<ReturnType<typeof openDb>>["db"],
	sqlText: string,
) => {
	const result = await db.execute(sql.raw(sqlText));
	return Number(result.rows[0]?.n ?? 0);
};

const main = async (): Promise<void> => {
	// (a) DATA_ROOT existe, tem auth/backups/logs e NÃO está no OneDrive.
	//     Sai com DATA_ROOT_ON_ONEDRIVE se estiver: a pasta auth É a sessão do WhatsApp.
	ensureDataDirs();

	// (b) Logger com child por módulo.
	const log = childLogger("boot");

	// (c) Banco + `migrate()` (R-031). Falha de migration aborta o boot aqui.
	const conn = await openDb(env.DATABASE_URL);
	log.info(
		{ step: "db_open", pool_max: 5 },
		"banco aberto e migrations aplicadas",
	);

	// (d) Escrita real seguida de leitura real (WHS-05).
	//     O `ON CONFLICT DO NOTHING` é o que torna o boot idempotente: rodar duas
	//     vezes deixa exatamente uma linha, e é a segunda execução que prova isso.
	await conn.db.execute(
		sql`insert into channel_accounts (phone_e164) values (${env.CHANNEL_PHONE_E164}) on conflict do nothing`,
	);

	const conta = await conn.db.execute(
		sql`select phone_e164 from channel_accounts`,
	);
	const linhas = conta.rows as { phone_e164: string }[];
	const contaLida = linhas.at(0);

	if (linhas.length !== 1 || !contaLida) {
		throw new Error(
			`esperado exatamente 1 linha em channel_accounts, encontrei ${linhas.length} — a conta do canal precisa ser unica`,
		);
	}
	if (contaLida.phone_e164 !== env.CHANNEL_PHONE_E164) {
		// Sem logar o valor: o E.164 do número dedicado é PII e o log não é o lugar
		// para ele (COMP-05, R-064). O motivo do erro é a divergência de config.
		throw new Error(
			"channel_accounts.phone_e164 divergente de CHANNEL_PHONE_E164 do .env — " +
				"o número dedicado mudou ou o .env aponta para outra conta",
		);
	}
	// Só o booleano vai para o log: confirma a conta sem publicar o número.
	log.info(
		{ step: "channel_account", channel_account_ok: true, rows: linhas.length },
		"conta do canal gravada e relida",
	);

	// (e) Sanidade do schema: `leads` tem de responder.
	const leadsTotal = await countOf(
		conn.db,
		"select count(*)::int as n from leads",
	);
	log.info({ step: "healthcheck", leads_total: leadsTotal }, "total de leads");

	// (f) Quantas migrations o banco realmente tem — a resposta a "o boot aplicou
	//     tudo?". Comparar com os arquivos em disco é o cruzamento que fecha o R-031.
	const migrationsApplied = await countOf(
		conn.db,
		"select count(*)::int as n from drizzle.__drizzle_migrations",
	);
	log.info(
		{ step: "healthcheck", migrations_applied: migrationsApplied },
		"migrations aplicadas",
	);

	if (BOOT_CHECK_ONLY) {
		// Modo gate: encerra. O log precisa estar em disco ANTES do exit, senão o
		// `grep leads_total app.log` do gate lê um arquivo sem a linha e falha.
		await encerra(conn, log, "boot_check");
		flushLogSync();
		process.exit(0);
	}

	// (g) Boot de produção: o processo precisa ficar VIVO (Agendador de Tarefas).
	//     Timer REF'D de propósito: o `pg` devolve o cliente ocioso ao pool depois de
	//     ~10s e, com o event loop vazio, o Node sai sozinho — o launcher "verde" no
	//     primeiro segundo e morto no minuto seguinte, que é o modo de falha mais
	//     difícil de ver. `unref()` aqui seria o oposto do que se quer.
	log.info(
		{ step: "boot_ok", check_only: false, tz: env.TZ },
		"boot concluido; processo vivo",
	);
	keepAlive = setInterval(() => {}, 60_000);

	// (g) Encerramento gracioso. Kill abrupto corrompe o `useMultiFileAuthState`, e um
	//     auth corrompido é lido pelo WhatsApp como dispositivo novo — sinal de
	//     banimento. Fechar o pool e drenar o log é o que torna o Ctrl+C seguro.
	const sinal = (nome: NodeJS.Signals) => {
		void encerra(conn, log, nome).then(() => {
			flushLogSync();
			process.exit(0);
		});
	};
	process.on("SIGINT", sinal);
	process.on("SIGTERM", sinal);
};

const encerra = async (
	conn: Awaited<ReturnType<typeof openDb>>,
	log: ReturnType<typeof childLogger>,
	motivo: string,
): Promise<void> => {
	log.info({ step: "shutdown", motivo }, "encerrando");
	// Solta o timer ANTES de fechar o pool: enquanto ele existir ref'd, o processo
	// não sai, e `pool.end()`+%`exit` seriam a única saída.
	if (keepAlive) {
		clearInterval(keepAlive);
		keepAlive = undefined;
	}
	await closeDb(conn);
};

main().catch((erro: unknown) => {
	// Última linha de defesa: um boot que falha tem que PARAR, nunca seguir meio
	// inicializado (fail-closed — R-031 e a segurança de R-042 dependem disso).
	const mensagem = erro instanceof Error ? erro.message : String(erro);
	console.error(`[boot] FALHA: ${mensagem}`);
	try {
		flushLogSync();
	} catch {
		// Sem log não há muito a fazer além de sair com código de erro.
	}
	process.exit(1);
});
