/**
 * `GUARD_ORDER` — a ordem canônica de avaliação do gate.
 *
 * docs/10-anti-requisitos.md §"Ordem de Avaliação no Gate" define 12 passos e a
 * ordem importa: o `reason` gravado em `blocked_attempts.rule_reference`
 * (R-022, R-045) é o **primeiro** que disparou, e o painel da Fase 04 mostra esse
 * identificador ao Admin. Reordenar muda o que o Admin vê e faz o relatório de
 * conformidade citar a regra errada.
 *
 * Só o kill switch, o Guard 0 (R-001) e o terminal de número vivem aqui como
 * controles **não-AR**; os 12 AR numerados vêm na ordem do documento, e os que
 * esta task não constrói ficam com `guard: null` e o slot **fixado** — o 01-04
 * preenche o guard no lugar, sem `unshift` e sem adivinhação de posição.
 *
 * A ordem completa, com a grafia exata que vai para
 * `blocked_attempts.rule_reference` (R-022, R-045):
 *
 * ```
 * kill_switch_ativo
 *   → r001_primeiro_contato_nao_humano      Guard 0, fora da numeração AR
 *   → lead_numero_invalido                  LEAD-03, estado terminal
 *   → ar011_base_legal                       passo 2
 *   → ar005_opt_out                          passo 3  [01-04]
 *   → ar010_handoff_ativo                    passo 4  [01-04]
 *   → ar009_midia_recebida                   passo 5  [01-04]
 *   → ar001_preco                            passo 6a
 *   → ar002_proposta                         passo 6b [01-04]
 *   → ar012_preco_como_objecao               passo 6c [01-04]
 *   → ar003_agendamento                      passo 7
 *   → ar004_midia_saida                      passo 8
 *   → ar006_revelacao_automacao              passo 9
 *   → ar007_fora_da_janela                   passo 10
 *   → ar008_limite_diario                    passo 11
 *   → send
 * ```
 *
 * Copiada de propósito, e não gerada: este é o único lugar onde a sequência
 * completa fica legível, e é o que se compara com
 * `docs/10-anti-requisitos.md` quando a ordem muda.
 */
import { GUARD_ORDER } from "./guard-order.js";
import type { GateInput, GateReason } from "./types.js";

/** Motivo pelo qual o gate decidiu, com o detalhe que o painel mostra ao Admin. */
export interface Bloqueio {
	readonly reason: GateReason;
	readonly detail: string;
}

const detalhePadrao = (reason: GateReason): string =>
	`bloqueado por ${reason} (docs/10-anti-requisitos.md)`;

/**
 * Percorre a ordem canônica e devolve o **primeiro** bloqueio, ou `null`.
 *
 * Retorna `null` — não `send` — porque decidir o que fazer com a autorização é
 * do chamador: o dispatcher precisa gravar a mensagem, a fila precisa reenfileirar
 * e o painel só quer o motivo. Confundir "nenhuma regra disparou" com "pode
 * enviar" é como uma autorização vira efeito colateral.
 */
export const primeiroBloqueio = (input: GateInput): Bloqueio | null => {
	for (const slot of GUARD_ORDER) {
		// Slot reservado do 01-04: sem guard, nada decide aqui ainda.
		if (!slot.guard) continue;
		const reason = slot.guard(input);
		if (reason !== null) {
			return { reason, detail: detalhePadrao(reason) };
		}
	}
	return null;
};

/**
 * Avalia o gate. **Função pura**: não envia, não consulta banco, não tem efeito
 * colateral, não lança. Quem detecta e quem bloqueia é o chamador.
 *
 * `messageId` é devolvido como string vazia porque o gate não tem acesso ao
 * registro persistido — o dispatcher o preenche com o id que acabou de gravar.
 */
export function evaluatePolicy(input: GateInput) {
	const bloqueio = primeiroBloqueio(input);
	const checkedAt = input.context.now.toISOString();
	if (bloqueio) {
		return { action: "block" as const, ...bloqueio, checkedAt };
	}
	return { action: "send" as const, messageId: "", checkedAt };
}

export type { Guard } from "./guard.js";
export { GUARD_ORDER, REASONS_PENDENTES_01_04 } from "./guard-order.js";
export type { GateInput, GateReason } from "./types.js";
