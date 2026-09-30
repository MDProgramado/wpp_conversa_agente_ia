/**
 * Implementação de `NotifyPort` sobre `scripts/notify.ps1` (R-013, D-07).
 *
 * Spawn, não shell: passar o título e a mensagem como **argumentos** evita que
 * uma mensagem contendo aspas, `&`, `|` ou `$` seja interpretada pelo shell — o
 * texto do toast vem de conteúdo de lead e não é confiável como entrada de
 * shell. Com `spawn` e `shell: false` (o padrão), nada é interpretado.
 *
 * `powershell` e não `pwsh`: o Windows 10/11 sempre traz o Windows PowerShell 5.1
 * com o tipo `Windows.UI.Notifications`, e `-NoProfile` garante que um perfil de
 * usuário não troque o encoding ou defina alias que quebre o script.
 */
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import type { NotifyInput, NotifyPort } from "../domain/ports/NotifyPort.js";
import { logger } from "./logger.js";

/** R-013 é load-bearing; 10s é o suficiente e impede travar o boot. */
const TIMEOUT_MS = 10_000;

const SCRIPT = resolve(process.cwd(), "scripts", "notify.ps1");

export const criarNotifier = (scriptPath: string = SCRIPT): NotifyPort => ({
	notify(input: NotifyInput): Promise<void> {
		return new Promise<void>((resolva) => {
			const args = [
				"-NoProfile",
				// O script é uma dependência de RUNTIME, e `Bypass` é o que permite
				// executá-lo sem alterar a ExecutionPolicy da máquina.
				"-ExecutionPolicy",
				"Bypass",
				"-File",
				scriptPath,
				"-Title",
				input.title,
				"-Message",
				input.message,
			];
			if (input.urgent) args.push("-Urgent");
			if (input.sound !== false) args.push("-Sound");
			if (input.filePath) args.push("-FilePath", input.filePath);

			let encerrado = false;
			/** Log e resolve: nunca rejeita, nunca lança. */
			const finalizar = (evento: string, detalhe: string) => {
				if (encerrado) return;
				encerrado = true;
				logger.warn({ event: evento }, detalhe);
				resolva();
			};

			const filho = spawn("powershell", args, { stdio: "ignore" });

			const timer = setTimeout(() => {
				// Sem `kill`: no Windows o `SIGTERM` de Node é um TerminateProcess
				// e o script pode ter já emitido o toast — matar aqui perderia a
				// notificação que provavelmente já saiu.
				finalizar("notify_timeout", `notificacao excedeu ${TIMEOUT_MS}ms`);
			}, TIMEOUT_MS);
			// `unref` para o timer não segurar o processo aberto por mais 10s no shutdown.
			timer.unref?.();

			filho.on("error", (erro) =>
				finalizar(
					"notify_spawn_failed",
					`nao foi possivel invocar PowerShell: ${erro.message}`,
				),
			);
			filho.on("close", (codigo) => {
				clearTimeout(timer);
				if (codigo === 0) {
					// Sem o título no log: ele pode carregar trecho de conversa com o
					// lead, e o log é o lugar que sobrevive à rotação de retenção
					// (R-064 / T-01-11). `char_count` responde "quanto" sem "o quê".
					logger.info(
						{ event: "notify_sent", urgent: input.urgent },
						`notificacao local emitida (${input.title.length} chars)`,
					);
					resolva();
					return;
				}
				// O script registra o motivo em notifications.log; aqui basta o código.
				finalizar("notify_failed", `notify.ps1 saiu com codigo ${codigo}`);
			});
		});
	},
});
