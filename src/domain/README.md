/**
 * Domínio — gate, tipos e portas. Regra do projeto (AGENTS.md, 01-PATTERNS §2):
 * `src/domain/` **não** importa nada de `src/infra/`, nem de `pg`/`drizzle`, nem
 * o pacote do canal. O gate decide sobre um `GateInput` que já chegou pronto;
 * quem busca o estado é o dispatcher, e ele vive fora daqui.
 *
 * A barreira é mecânica: `npx biome lint src/domain` precisa sair com 0, e o
 * `noRestrictedImports` do `biome.json` fecha o pacote do canal em todo o projeto.
 */
