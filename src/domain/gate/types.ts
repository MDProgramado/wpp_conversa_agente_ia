/**
 * A taxonomia é a de docs/10-anti-requisitos.md:13-24, verbatim. AR-001 é preço,
 * AR-002 é proposta, AR-003 é agendamento, AR-004 é mídia de saída, AR-005 é opt-out,
 * AR-006 é revelação de automação, AR-007 é janela, AR-008 é cota, AR-009 é mídia
 * recebida, AR-010 é pós-handoff, AR-011 é base legal, AR-012 é preço como objeção.
 * Não invente renumeração: `blocked_attempts.rule_reference` (R-022, R-045, COMP-03)
 * e o painel da Fase 04 citam estes identificadores.
 */
import type { OutboundPart } from "../ports/ChannelPort.js";

export type GateReason =
	// --- controles não-AR, fora da numeração AR-001..AR-012 ---
	| "kill_switch_ativo"
	| "r001_primeiro_contato_nao_humano"
	| "lead_numero_invalido"
	| "envio_sem_gate"
	| "timeout"
	| "erro_nao_mapeado"
	// --- os 12 anti-requisitos, na ordem de avaliação do documento ---
	| "ar011_base_legal"
	| "ar005_opt_out"
	| "ar010_handoff_ativo"
	| "ar009_midia_recebida"
	| "ar001_preco"
	| "ar002_proposta"
	| "ar012_preco_como_objecao"
	| "ar003_agendamento"
	| "ar004_midia_saida"
	| "ar006_revelacao_automacao"
	| "ar007_fora_da_janela"
	| "ar008_limite_diario";

export type Decision =
	| { action: "send"; messageId: string; checkedAt: string }
	| { action: "block"; reason: GateReason; detail: string; checkedAt: string }
	| {
			action: "unknown";
			reason: GateReason;
			detail: string;
			checkedAt: string;
	  };

export interface GateInput {
	lead: {
		id: string;
		phoneNumber: string;
		optOut: boolean;
		originSource: string | null;
		legalBasis: string | null;
		purpose: string | null;
		legalRegisteredAt: string | null;
		firstContactByHuman: boolean;
		waValidationState: "valid" | "invalido" | "desconhecido" | null;
	};
	conversation: {
		id: string;
		state: string;
		engagementMode:
			| "bot_active"
			| "awaiting_human"
			| "human"
			| "copilot"
			| "pausado";
		handoffActive: boolean;
		/**
		 * Sinaliza mídia recebida ainda não tratada (AR-009). O 01-01 cria a coluna
		 * `conversations.pending_media_block`; o 01-03 a liga a `true` e registra o
		 * bloqueio; o 01-04 a consome no guard `ar-009.ts`.
		 */
		pendingMediaBlock: boolean;
	};
	outbound: { text: string; parts: readonly OutboundPart[] };
	context: {
		killSwitch: boolean;
		now: Date;
		tz: string;
		windowStartHour: number;
		windowEndHour: number;
		dailyMessageLimit: number;
		dailyMessageCap: number;
		sentToday: number;
		newContactsToday: number;
	};
}
