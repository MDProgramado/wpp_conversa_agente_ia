import { defineConfig } from "vitest/config";

// As seeds do fast-check vao em cada fc.assert, nao aqui (a mesma seed em todos
// os testes, para que a falha seja reproduzivel).
export default defineConfig({
	test: {
		environment: "node",
		include: ["tests/**/*.test.ts"],
		globals: false,
	},
});
