/**
 * Conexão com o PostgreSQL local + aplicação das migrations no boot (R-031).
 *
 * `openDb` roda `migrate()` ANTES de devolver o handle: a ordem importa, porque o
 * primeiro consumidor é o `launch.cmd`, que precisa de um banco já no shape do
 * schema para escrever o healthcheck em `logs/app.log`. Se a migration falhar, o
 * boot aborta — nunca segue com um schema meio aplicado.
 *
 * `migrationsFolder` é a MESMA string literal de `drizzle.config.ts` (`out`).
 * Divergir as duas é a causa raiz do "migration not found": o drizzle-kit escreve
 * num lugar e o runtime procura outro (01-PATTERNS §4.8).
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import * as schema from "./schema.js";

/** Caminho canônico das migrations — idêntico ao `out` do drizzle.config.ts. */
export const MIGRATIONS_FOLDER = "./src/infra/db/migrations";

/** `application_name` é o que torna `pg_stat_activity` legível (R-045, Fase 04). */
export const APPLICATION_NAME = "whatsapp_prospect";

export type Db = ReturnType<typeof drizzle<typeof schema>>;

export type OpenDb = {
	db: Db;
	pool: Pool;
};

export const openDb = async (connectionString: string): Promise<OpenDb> => {
	const pool = new Pool({
		connectionString,
		// App local de usuário único: pool grande é overhead puro, não capacidade.
		max: 5,
		application_name: APPLICATION_NAME,
	});
	const db = drizzle(pool, { schema });
	// R-031: antes de qualquer outra coisa. Idempotente por natureza — a segunda
	// execução é no-op, governada pela contagem em `drizzle.__drizzle_migrations`.
	await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
	return { db, pool };
};

export const closeDb = async ({ pool }: OpenDb): Promise<void> => {
	await pool.end();
};
