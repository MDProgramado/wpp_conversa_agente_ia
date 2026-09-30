import { defineConfig } from "drizzle-kit";

// Path canonico das migrations. Esta MESMA string literal vai em
// src/infra/db/client.ts (migrationsFolder). Divergir os dois e a causa raiz
// do erro de resolucao do drizzle-kit (01-PATTERNS.md §4.8).
export default defineConfig({
	out: "./src/infra/db/migrations",
	schema: "./src/infra/db/schema.ts",
	dialect: "postgresql",
	dbCredentials: {
		url: process.env.DATABASE_URL ?? "",
	},
});
