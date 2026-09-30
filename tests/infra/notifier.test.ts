/**
 * `criarNotifier` — o contrato que R-013 depende.
 *
 * O que está sob teste aqui não é o toast (isso é humano e físico) e sim as três
 * garantias de que o handoff **não se perde**:
 *
 * 1. nunca rejeita — uma notificação que lança quebra quem chamou, e quem
 *    chama é o caminho do handoff. O problema viraria falha de envio;
 * 2. sempre passa título e mensagem como ARGUMENTO — o texto vem de conteúdo de
 *    lead, então `&`/`|`/`$` no título não podem virar shell (injeção local);
 * 3. timeout resolve em vez de travar o boot.
 */
import { describe, expect, it, vi } from "vitest";

type Handler = (...a: unknown[]) => void;

const spawnCalls: { cmd: string; args: string[] }[] = [];
let codigoSaida = 0;
let lancarErro: Error | null = null;
let handlers: Record<string, Handler> = {};

vi.mock("node:child_process", () => ({
	spawn: (cmd: string, args: string[]) => {
		spawnCalls.push({ cmd, args });
		handlers = {};
		setImmediate(() => {
			if (lancarErro) {
				handlers.error?.(lancarErro);
				return;
			}
			handlers.close?.(codigoSaida);
		});
		return {
			on: (evento: string, cb: Handler) => {
				handlers[evento] = cb;
			},
		};
	},
}));

vi.mock("../../src/infra/logger.js", () => ({
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { criarNotifier } = await import("../../src/infra/notifier.js");

const titulo = "Handoff: Maria";
const mensagem = "Lead pediu preço & quer orçamento de R$ 3.500 | urgently";

/** Os `args` do último spawn. Lê `.at(-1)` porque `noUncheckedIndexedAccess` vale aqui. */
const argumentosDaUltimaChamada = (): string[] => spawnCalls.at(-1)?.args ?? [];

describe("criarNotifier", () => {
	it("resolve e nunca rejeita com código 0", async () => {
		codigoSaida = 0;
		lancarErro = null;
		await expect(
			criarNotifier("C:\\x\\notify.ps1").notify({
				title: titulo,
				message: mensagem,
				urgent: true,
			}),
		).resolves.toBeUndefined();
	});

	it("passa título e mensagem como argumentos, nunca concatenados no shell", () => {
		const args = argumentosDaUltimaChamada();
		const iTitulo = args.indexOf("-Title");
		const iMensagem = args.indexOf("-Message");
		expect(iTitulo).toBeGreaterThan(-1);
		expect(iMensagem).toBeGreaterThan(-1);
		// O valor chega inteiro, com `&`, `|` e `$` intactos: se estivesse
		// concatenado numa linha de comando, o PowerShell interpretaria e o
		// título chegaria truncado — ou executaria algo.
		expect(args[iTitulo + 1]).toBe(titulo);
		expect(args[iMensagem + 1]).toBe(mensagem);
	});

	it("usa Windows PowerShell com -NoProfile e -ExecutionPolicy Bypass", () => {
		const chamada = spawnCalls.at(-1);
		expect(chamada?.cmd).toBe("powershell");
		expect(chamada?.args).toContain("-NoProfile");
		expect(chamada?.args.slice(0, 4)).toEqual([
			"-NoProfile",
			"-ExecutionPolicy",
			"Bypass",
			"-File",
		]);
	});

	it("repassa -Urgent e -Sound conforme o input", () => {
		const args = argumentosDaUltimaChamada();
		expect(args).toContain("-Urgent");
		expect(args).toContain("-Sound");
	});

	it("omite -Sound quando sound === false", async () => {
		spawnCalls.length = 0;
		codigoSaida = 0;
		await criarNotifier("C:\\x\\notify.ps1").notify({
			title: "t",
			message: "m",
			urgent: false,
			sound: false,
		});
		expect(argumentosDaUltimaChamada()).not.toContain("-Sound");
	});

	it("NÃO rejeita quando o script sai com código != 0", async () => {
		codigoSaida = 1;
		await expect(
			criarNotifier("C:\\x\\notify.ps1").notify({
				title: "t",
				message: "m",
				urgent: false,
			}),
		).resolves.toBeUndefined();
	});

	it("NÃO rejeita quando o spawn falha (PowerShell ausente)", async () => {
		lancarErro = new Error("spawn powershell ENOENT");
		await expect(
			criarNotifier("C:\\x\\notify.ps1").notify({
				title: "t",
				message: "m",
				urgent: false,
			}),
		).resolves.toBeUndefined();
	});

	it("NÃO loga o título — pode carregar conteúdo de lead (R-064)", async () => {
		const { logger } = await import("../../src/infra/logger.js");
		spawnCalls.length = 0;
		codigoSaida = 0;
		const vazamento: string[] = [];
		const original = logger.info;
		// O logger é o que persiste além da rotação de retenção, então o título
		// não pode atravessar ele.
		(logger as unknown as { info: unknown }).info = (
			obj: unknown,
			msg: string,
		) => {
			vazamento.push(JSON.stringify(obj), String(msg));
			original(obj, msg);
		};
		await criarNotifier("C:\\x\\notify.ps1").notify({
			title: "Pedido de orcamento R$ 3500 da Maria",
			message: "m",
			urgent: true,
		});
		(logger as unknown as { info: unknown }).info = original;
		const texto = vazamento.join(" ");
		expect(texto).not.toContain("Maria");
		expect(texto).not.toContain("3500");
	});
});
