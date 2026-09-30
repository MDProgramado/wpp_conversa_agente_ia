/**
 * Logger estruturado (pino 10.3.1) em arquivo local, com redação de PII no LOGGER.
 *
 * Por que a redação mora aqui e não no ponto de chamada: um desenvolvedor que
 * esquecer de redigir não vaza PII, porque o logger já redigiu por ele. Se cada call
 * site tivesse que lembrar, bastaria um `logger.info({ body })` esquecido num PR de
 * meia-noite para escrever a conversa inteira num arquivo de log.
 *
 * E por que log é ID, e não conteúdo: o corpo da mensagem e a auditoria de R-043,
 * que vive na tabela `messages` (append-only, sob controle do sistema). Duplicá-lo em
 * `app.log` cria uma segunda cópia de dado pessoal do lead fora do controle de
 * retenção. Aqui entram `message_id`, `lead_id`, `direction`, `char_count` e hash.
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import pino from "pino";
import { dataRoot, env, logsDir } from "../config/env.js";

/**
 * O plano pede estes caminhos; acrescento `phone_e164` porque o E.164 do número
 * dedicado é PII do mesmo tipo e é justamente o campo que o boot toca.
 */
export const REDACT_PATHS = [
	"*.body",
	"body",
	"*.phone",
	"*.phone_number",
	"phone",
	"phone_number",
	"*.phone_e164",
	"phone_e164",
	"req.headers.authorization",
	"*.token",
	"*.secret",
] as const;

export const CENSOR = "[redacted]";

/**
 * `logger.ts` é importado no topo de `index.ts`, ou seja, o destino do pino é
 * aberto antes de `ensureDataDirs()` rodar no passo (a) do boot. Criar só o
 * `logs\` aqui resolve: se o passo (a) abortar por OneDrive, nenhum byte foi
 * escrito — o pino só escreve no primeiro log.
 */
mkdirSync(logsDir(), { recursive: true });

export const LOG_FILE = join(dataRoot(), "logs", "app.log");

/**
 * Destino do log, guardado como referência porque é nele que mora o `flushSync`.
 *
 * `logger.flushSync()` é `undefined` em runtime: o `flush` do logger é assíncrono e
 * `process.exit(0)` mata o processo antes do write. O boot em modo `check` precisa
 * que a linha `leads_total` esteja no arquivo quando o gate lê o `app.log` — então é
 * o stream (SonicBoom) que precisa ser drenado, não o logger.
 */
export const logDestination = pino.destination({
	dest: LOG_FILE,
	// `append: true`: o log sobrevive a restart e um boot de manutenção não apaga
	// histórico. A rotação por data é de outra fase.
	append: true,
});

export const logger = pino(
	{
		level: process.env.LOG_LEVEL ?? "info",
		base: { service: "whatsapp_prospecao" },
		redact: { paths: [...REDACT_PATHS], censor: CENSOR },
	},
	logDestination,
);

/** Drena o log para disco de forma SÍNCRONA. Chamar antes de qualquer `process.exit`. */
export const flushLogSync = (): void => {
	logDestination.flushSync();
};

export const childLogger = (module: string): pino.Logger =>
	logger.child({ module });

/** Fuso efetiva da aplicação (D-05), para o log deixar claro com que regra ele corre. */
export const logTimezone = (): string => env.TZ;
