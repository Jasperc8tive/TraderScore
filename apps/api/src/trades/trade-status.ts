import { TradeStatus } from "@tradescore/shared";

/**
 * The trade status workflow as an explicit transition allow-list.
 *
 * Keeping the state machine here (pure, no I/O) makes it exhaustively unit-testable
 * and the single authority on what transitions are legal. Stage 4 (confirmation)
 * extends `PENDING_CONFIRMATION` with CONFIRMED/DISPUTED/REJECTED — by adding to
 * this map, not by scattering status checks across services.
 */
const ALLOWED_TRANSITIONS: Record<TradeStatus, readonly TradeStatus[]> = {
  [TradeStatus.DRAFT]: [TradeStatus.PENDING_CONFIRMATION, TradeStatus.CANCELLED],
  // From PENDING_CONFIRMATION: the initiator may still cancel, and the
  // counterparty may confirm / reject / dispute (Stage 4).
  [TradeStatus.PENDING_CONFIRMATION]: [
    TradeStatus.CANCELLED,
    TradeStatus.CONFIRMED,
    TradeStatus.REJECTED,
    TradeStatus.DISPUTED,
  ],
  // Stage 7 (disputes): a confirmed trade can be contested, and a disputed trade
  // is driven to a final state by adjudication or withdrawal. These transitions
  // are only reachable through the dispute workflow.
  [TradeStatus.CONFIRMED]: [TradeStatus.DISPUTED],
  [TradeStatus.DISPUTED]: [TradeStatus.CONFIRMED, TradeStatus.REJECTED],
  [TradeStatus.REJECTED]: [],
  [TradeStatus.CANCELLED]: [],
};

/** Counterparty decisions and the status each produces. */
export const CONFIRMATION_DECISIONS = [
  TradeStatus.CONFIRMED,
  TradeStatus.REJECTED,
  TradeStatus.DISPUTED,
] as const;
export type ConfirmationDecision = (typeof CONFIRMATION_DECISIONS)[number];

/** A trade can receive a counterparty decision only while pending confirmation. */
export function isConfirmable(status: TradeStatus): boolean {
  return status === TradeStatus.PENDING_CONFIRMATION;
}

/** Statuses in which a trade's fields may still be edited. */
const EDITABLE_STATUSES: readonly TradeStatus[] = [
  TradeStatus.DRAFT,
  TradeStatus.PENDING_CONFIRMATION,
];

export function canTransition(from: TradeStatus, to: TradeStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function isEditable(status: TradeStatus): boolean {
  return EDITABLE_STATUSES.includes(status);
}

/** A trade can be cancelled from any pre-confirmation, non-terminal state. */
export function isCancellable(status: TradeStatus): boolean {
  return canTransition(status, TradeStatus.CANCELLED);
}
