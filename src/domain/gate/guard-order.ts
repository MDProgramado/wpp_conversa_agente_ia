/**
 * A ordem canônica de avaliação — docs/10-anti-requisitos.md §"Ordem de Avaliação
 * no Gate", 12 passos, imutável.
 *
 * A ordem importa por um motivo concreto: o `reason` gravado em
 * `blocked_attempts.rule_reference` é o primeiro que disparou, e o painel da
 * Fase 04 mostra esse identificador ao Admin. Reordenar a lista muda o que o
 * Admin vê, e o relatório de conformidade passa a citar a regra errada.
 *
 * **Nesta task (01-01) só os guards marcados `[01-01]` existem.** Os demais
 * posições estão declaradas com `guard: null` para fixar o slot — sem isso, o
 * 01-04 teria de adivinhar onde cada um entra, e um `unshift` errado passaria
 * despercebido. A entrada `send` é o único caminho de saída.
 */
export interface GuardSlot {
	readonly reason: GateReason;
	readonly guard: ((input: GateInput) => GateReason | null) | null;
	/** Task dona do guard. `null` = slot reservado, ainda não implementado. */
	readonly owner: string | null;
}

import {
	evaluateNumeroInvalido,
	evaluate as primeiroContato,
} from "./guard-0-r001.js";
import { evaluate as preco } from "./guards/ar-001.js";
import { evaluate as agendamento } from "./guards/ar-003.js";
import { evaluate as midiaSaida } from "./guards/ar-004.js";
import { evaluate as revelacao } from "./guards/ar-006.js";
import { evaluate as janela } from "./guards/ar-007.js";
import { evaluate as limiteDiario } from "./guards/ar-008.js";
import { evaluate as baseLegal } from "./guards/ar-011.js";
import { evaluate as killSwitch } from "./kill-switch.js";
import type { GateInput, GateReason } from "./types.js";

export const GUARD_ORDER: readonly GuardSlot[] = [
	// 1 — operação
	{ reason: "kill_switch_ativo", guard: killSwitch, owner: "[01-01]" },
	// Guard 0 — R-001, fora da numeração AR
	{
		reason: "r001_primeiro_contato_nao_humano",
		guard: primeiroContato,
		owner: "[01-01]",
	},
	// LEAD-03: estado terminal, por isso antes dos AR de conteúdo
	{
		reason: "lead_numero_invalido",
		guard: evaluateNumeroInvalido,
		owner: "[01-01]",
	},
	// 2
	{ reason: "ar011_base_legal", guard: baseLegal, owner: "[01-01]" },
	// 3 — 01-04
	{ reason: "ar005_opt_out", guard: null, owner: "[01-04]" },
	// 4 — 01-04
	{ reason: "ar010_handoff_ativo", guard: null, owner: "[01-04]" },
	// 5 — 01-04
	{ reason: "ar009_midia_recebida", guard: null, owner: "[01-04]" },
	// 6a
	{ reason: "ar001_preco", guard: preco, owner: "[01-01]" },
	// 6b — 01-04
	{ reason: "ar002_proposta", guard: null, owner: "[01-04]" },
	// 6c — 01-04
	{ reason: "ar012_preco_como_objecao", guard: null, owner: "[01-04]" },
	// 7
	{ reason: "ar003_agendamento", guard: agendamento, owner: "[01-01]" },
	// 8
	{ reason: "ar004_midia_saida", guard: midiaSaida, owner: "[01-01]" },
	// 9
	{ reason: "ar006_revelacao_automacao", guard: revelacao, owner: "[01-01]" },
	// 10
	{ reason: "ar007_fora_da_janela", guard: janela, owner: "[01-01]" },
	// 11
	{ reason: "ar008_limite_diario", guard: limiteDiario, owner: "[01-01]" },
] as const;

/**
 * Motivos que esta task reserva para o 01-04, para o relatório de cobertura não os
 * contar como implementados por engano.
 */
export const REASONS_PENDENTES_01_04 = GUARD_ORDER.filter(
	(s) => s.guard === null,
).map((s) => s.reason);

export type { GateInput, GateReason };
