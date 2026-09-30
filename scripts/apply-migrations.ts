/**
 * Aplica as migrations contra o banco real via `openDb` e prova a idempotencia.
 * Uso: npx tsx scripts/apply-migrations.ts [rotulo]
 * Não é versionado como parte do app; é a ferramenta da Task 3 do plano 01-01.
 */
import { readFileSync } from "node:fs";
import { closeDb, openDb } from "../src/infra/db/client.js";

const env = Object.fromEntries(
	readFileSync(".env", "utf8")
		.split(/\r?\n/)
		.filter((l) => l.trim() && !l.trim().startsWith("#"))
		.map((l) => {
			const i = l.indexOf("=");
			return [l.slice(0, i), l.slice(i + 1)];
		}),
);

const rotulo = process.argv[2] ?? "execucao";
const { db, pool } = await openDb(env.DATABASE_URL as string);

/** `db.execute` no node-postgres devolve um QueryResult; o valor vive em `.rows[0]`. */
const n = (res: unknown): number =>
	(res as { rows: { n: number }[] }).rows[0]?.n ?? -1;

const aplicadas = n(
	await db.execute(
		"select count(*)::int as n from drizzle.__drizzle_migrations",
	),
);
const tabelas = n(
	await db.execute(
		"select count(*)::int as n from information_schema.tables where table_schema = 'public'",
	),
);
console.log(
	`[${rotulo}] migrations aplicadas = ${aplicadas} | tabelas public = ${tabelas}`,
);

await closeDb({ db, pool });
