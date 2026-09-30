import type { GateInput, GateReason } from "./types.js";

/**
 * Contrato de todo guard: recebe o snapshot, devolve `null` (não bloqueia) ou o
 * `GateReason` pelo qual bloqueia. **Nunca lança e nunca tem efeito colateral** —
 * o gate é função pura, quem aplica o bloqueio é o chamador.
 */
export type Guard = (input: GateInput) => GateReason | null;
