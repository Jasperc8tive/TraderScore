import type { TradeStatus, TradeDirection, TradeEventType, UUID } from "@tradescore/shared";

export interface TradeRecord {
  id: UUID;
  referenceCode: string;
  initiatorBusinessId: UUID;
  counterpartyBusinessId: UUID | null;
  counterpartyName: string | null;
  counterpartyPhone: string | null;
  direction: TradeDirection;
  amountMinor: number;
  currency: string;
  description: string | null;
  occurredOn: string; // DATE as ISO yyyy-mm-dd
  status: TradeStatus;
  createdBy: UUID;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TradeEventRecord {
  id: UUID;
  tradeId: UUID;
  eventType: TradeEventType;
  fromStatus: TradeStatus | null;
  toStatus: TradeStatus | null;
  actorUserId: UUID | null;
  reason: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}
