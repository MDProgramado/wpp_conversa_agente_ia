/**
 * Porta de notificação local (R-013, D-07).
 *
 * Existe como interface porque a regra de negócio (quando notificar) é do
 * domínio e o mecanismo (WinRT via PowerShell) é do SO. Um `import` de
 * `child_process` dentro de um guard seria o Coupled Change; aqui a fronteira
 * é um método.
 */
export interface NotifyInput {
	readonly title: string;
	readonly message: string;
	/** Alerta de maior prioridade: som de alarme e cenário de recordação. */
	readonly urgent: boolean;
	readonly sound?: boolean;
	readonly filePath?: string;
}

export interface NotifyPort {
	/**
	 * Notifica localmente. **Não lança**: uma falha de notificação é registrada,
	 * não propagada — quem chama é um caminho que já está tratando um problema
	 * mais grave, e uma exceção aqui arrancaria o handoff.
	 */
	notify(input: NotifyInput): Promise<void>;
}
