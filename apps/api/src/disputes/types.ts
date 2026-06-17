import type { DisputeStatus, DisputeResolution, TradeStatus, UUID } from "@tradescore/shared";

export interface DisputeRecord {
  id: UUID;
  tradeId: UUID;
  raisedByBusinessId: UUID;
  raisedByUserId: UUID;
  reason: string;
  status: DisputeStatus;
  tradeStatusBefore: TradeStatus;
  resolution: DisputeResolution | null;
  resolutionNote: string | null;
  reviewedByUserId: UUID | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DisputeEvidenceRecord {
  id: UUID;
  disputeId: UUID;
  submittedByUserId: UUID;
  submittedByBusinessId: UUID;
  body: string;
  attachmentUrl: string | null;
  createdAt: Date;
}
