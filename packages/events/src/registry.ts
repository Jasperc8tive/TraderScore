import type { DomainEvent } from "./event";
import type { UUID } from "@tradescore/shared";

/**
 * Catalogue of Stage 1 domain events.
 *
 * Adding a new event = adding an entry to this map. Publishers and subscribers
 * are typed against it, so a typo in an event name or a mismatched payload is a
 * compile error, not a silent runtime miss. Later stages extend this map
 * (TradeLogged, TradeConfirmed, ...) — the bus itself never changes.
 */
export interface EventPayloads {
  "user.created": { userId: UUID; phone: string; role: string };
  "business.created": { businessId: UUID; ownerUserId: UUID; name: string };
  "business.verified": {
    businessId: UUID;
    assuranceLevel: string;
    verifiedByUserId: UUID;
  };
  "trade.logged": {
    tradeId: UUID;
    initiatorBusinessId: UUID;
    counterpartyBusinessId: UUID | null;
    amountMinor: number;
    currency: string;
  };
  "trade.submitted": {
    tradeId: UUID;
    initiatorBusinessId: UUID;
    counterpartyBusinessId: UUID;
  };
  "trade.cancelled": {
    tradeId: UUID;
    initiatorBusinessId: UUID;
  };
  "trade.confirmed": {
    tradeId: UUID;
    initiatorBusinessId: UUID;
    counterpartyBusinessId: UUID;
    amountMinor: number;
    currency: string;
    decidedByUserId: UUID;
  };
  "trade.rejected": {
    tradeId: UUID;
    initiatorBusinessId: UUID;
    counterpartyBusinessId: UUID;
    decidedByUserId: UUID;
  };
  "trade.disputed": {
    tradeId: UUID;
    initiatorBusinessId: UUID;
    counterpartyBusinessId: UUID;
    decidedByUserId: UUID;
  };
  "dispute.opened": {
    disputeId: UUID;
    tradeId: UUID;
    raisedByBusinessId: UUID;
  };
  "dispute.resolved": {
    disputeId: UUID;
    tradeId: UUID;
    resolution: string;
    reviewedByUserId: UUID;
  };
}

export type EventName = keyof EventPayloads;

export type TradeScoreEvent<TName extends EventName = EventName> = DomainEvent<
  TName,
  EventPayloads[TName]
>;
