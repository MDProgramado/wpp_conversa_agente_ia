/**
 * Config do processo, validada uma vez no boot (fail-closed).
 *
 * Duas raízes distintas, e a diferença é deliberada:
 *   - `DATA_ROOT` (C:\whatsapp_prospecao) é onde ficam sessão do Baileys, backups e
 *     logs. NUNCA dentro do OneDrive nem do repo: a pasta `auth` É a sessão, perdê-la
 *     ou sincronizá-la faz o WhatsApp ver um "dispositivo novo" — que é sinal de
 *     banimento (COMP-05/D-01). `ensureDataDirs()` transforma essa regra em invariante
 *     verificada, não em comentário.
 *   - `<repo>\.env` guarda os segredos de DESENVOLVIMENTO (senha do banco, chave de
 *     LLM). Ele é lido pelo launcher e nunca versionado (`.gitignore`).
 */
import { existsSync, lstatSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

/** Raiz de dados padrão (D-01). String.raw evita que o `\w` vire escape. */
export const DATA_ROOT_DEFAULT = String.raw`C:\whatsapp_prospecao`;

/** Token de erro: a busca por ele no log/bilhete aponta direto para a causa. */
export const DATA_ROOT_ON_ONEDRIVE = "DATA_ROOT_ON_ONEDRIVE";

/**
 * Boolean de ambiente SEM o bug clássico do `z.coerce.boolean()`.
 *
 * `Boolean("false") === true`: coersão ingênua faria `KILL_SWITCH=false` virar
 * `true`, e o R-042 (kill switch) desligaria o envio de verdade. Aqui só os
 * literais explícitos viram booleano, e qualquer outra coisa é deixada passar para
 * o zod rejeitar — fail-closed, nunca "verdadeiro por acidente".
 */
const envBoolean = (fallback: boolean) =>
	z.preprocess(
		(value) => {
			if (value === undefined || value === null || value === "")
				return fallback;
			if (typeof value === "boolean") return value;
			const normal = String(value).trim().toLowerCase();
			if (["true", "1", "yes", "y", "on", "sim"].includes(normal)) return true;
			if (["false", "0", "no", "n", "off", "nao", "não"].includes(normal))
				return false;
			return value;
		},
		z.boolean({ message: "esperado boolean (true/false/1/0/sim/nao)" }),
	);

/** E.164 do número dedicado (WHS-05). Mesmo formato do CHECK no banco. */
const phoneE164 = z
	.string()
	.regex(/^\+[1-9][0-9]{7,14}$/, "CHANNEL_PHONE_E164 fora do formato E.164");

/**
 * `postgres://` e `postgresql://` são o mesmo protocolo no `libpq`; o `pg` aceita
 * os dois. Aceitar só o primeiro quebraria uma URL perfeitamente válida.
 */
const databaseUrl = z
	.string()
	.regex(
		/^postgres(ql)?:\/\/\S+$/,
		"DATABASE_URL deve ser postgres:// ou postgresql://",
	);

export const envSchema = z.object({
	DATA_ROOT: z.string().min(1).default(DATA_ROOT_DEFAULT),

	/**
	 * Limite OPERACIONAL de mensagens/dia (R-023/D-04). Configurável, e por isso
	 * limitado a <= 30: 30 é o TETO FÍSICO gravado no CHECK do banco
	 * (`daily_counters_max`). Configurar 31 aqui passaria na config e rebentaria
	 * no INSERT — a validação existe para transformar esse erro em erro de boot.
	 */
	DAILY_MESSAGE_LIMIT: z.coerce
		.number()
		.int()
		.default(25)
		.refine(
			(v) => v > 0 && v <= 30,
			"DAILY_MESSAGE_LIMIT tem de estar em 1..30 (teto fisico do banco)",
		),

	DAILY_LEAD_LIMIT: z.coerce.number().int().positive().default(20),
	WINDOW_START_HOUR: z.coerce.number().int().min(0).max(23).default(7),
	WINDOW_END_HOUR: z.coerce.number().int().min(1).max(24).default(17),

	/** R-042: true aborta TUDO antes de qualquer verificação. */
	KILL_SWITCH: envBoolean(false),

	CHANNEL_PHONE_E164: phoneE164,
	DATABASE_URL: databaseUrl,

	/** D-05: o gate avalia a janela no fuso de São Paulo, não no do processo. */
	TZ: z.string().min(1).default("America/Sao_Paulo"),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Caminho do `.env` de DESENVOLVIMENTO, resolvido a partir deste arquivo e não do
 * cwd — assim funciona de qualquer diretório (Agendador de Tarefas, `npm test`,
 * um `cd` acidental) em vez de só da raiz do repo.
 */
export const DEV_ENV_FILE = fileURLToPath(
	new URL("../../.env", import.meta.url),
);

/**
 * Carrega o `.env` de desenvolvimento sem dependência externa.
 *
 * `process.loadEnvFile` (Node 20.12+/24) NÃO sobrescreve variável já existente no
 * ambiente. Isso é a propriedade que importa: o `launch.cmd` define `DATA_ROOT` e
 * `TZ` de propósito antes de chamar o processo, e o `.env` não pode atropelar essa
 * decisão. Em desenvolvimento puro (`npx tsx src/index.ts` no shell) não há nada
 * pré-definido, e o `.env` preenche tudo.
 *
 * O `launch.cmd` continua sendo a fonte de `DATA_ROOT`/`TZ` no boot de produção; aqui
 * só entram as chaves que ele não define, principalmente `DATABASE_URL`, `CHANNEL_PHONE_E164`
 * e os limites.
 */
const carregarEnvDeDesenvolvimento = (): void => {
	if (!existsSync(DEV_ENV_FILE)) return;
	try {
		process.loadEnvFile(DEV_ENV_FILE);
	} catch (erro) {
		const motivo = erro instanceof Error ? erro.message : String(erro);
		throw new Error(
			`nao consegui ler o .env de desenvolvimento (${DEV_ENV_FILE}): ${motivo}`,
		);
	}
};

carregarEnvDeDesenvolvimento();

/** `.strip()` (padrão do zod) descarta chaves estranhas: `.env` pode ter lixo sem quebrar o boot. */
export const env: Env = envSchema.parse(process.env);
export const dataRoot = (): string => env.DATA_ROOT;
export const authDir = (): string => join(env.DATA_ROOT, "auth");
export const backupsDir = (): string => join(env.DATA_ROOT, "backups");
export const logsDir = (): string => join(env.DATA_ROOT, "logs");

/**
 * OneDrive, junctions e symlinks: todos os três aparecem para o Node como
 * `isSymbolicLink() === true` (junction é reparse point, e o libuv reporta junction
 * como link). A checagem do nome de pasta é a rede de segurança para o caso em que
 * o OneDrive reparse o diretório PAI e o `DATA_ROOT` em si não for um link.
 */
const isInsideOneDrive = (target: string): boolean =>
	target
		.split(/[\\/]/)
		.some((segment) => segment.toLowerCase().startsWith("onedrive"));

/**
 * Cria `auth\`, `backups\` e `logs\` e ABORTA se a raiz estiver dentro do OneDrive.
 *
 * É a única forma de "auth nunca no OneDrive" ser uma invariante: um comentário não
 * impede ninguém de apontar `DATA_ROOT` para a pasta sincronizada.
 */
export const ensureDataDirs = (): void => {
	for (const dir of [env.DATA_ROOT, authDir(), backupsDir(), logsDir()]) {
		mkdirSync(dir, { recursive: true });
	}

	const root = env.DATA_ROOT;
	let isLink = false;
	try {
		isLink = lstatSync(root).isSymbolicLink();
	} catch {
		// Se não dá para inspecionar, não dá para garantir: fail-closed.
		isLink = true;
	}

	if (isLink || isInsideOneDrive(root)) {
		console.error(
			`[${DATA_ROOT_ON_ONEDRIVE}] DATA_ROOT="${root}" esta dentro do OneDrive ou e um link/junction. ` +
				"A pasta auth e a sessao do WhatsApp: sincronizar ou perder isso faz o numero ser lido como " +
				"dispositivo novo. Configure DATA_ROOT fora do OneDrive (padrao C:\\whatsapp_prospecao).",
		);
		process.exit(1);
	}
};
