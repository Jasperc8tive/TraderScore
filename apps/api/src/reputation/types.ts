import type { ScoreBand, ScoreFactorDirection, UUID } from "@tradescore/shared";

export interface ScoreSnapshotRecord {
  id: UUID;
  businessId: UUID;
  algorithmVersion: string;
  score: number;
  band: ScoreBand;
  inputsHash: string;
  metadata: Record<string, unknown>;
  computedAt: Date;
}

export interface ScoreFactorRecord {
  id: UUID;
  snapshotId: UUID;
  factorKey: string;
  weight: number;
  direction: ScoreFactorDirection;
  detail: Record<string, unknown>;
}
