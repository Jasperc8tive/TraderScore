import type { AssuranceLevel, ScoreBand, ScoreFactorDirection, UUID } from "@tradescore/shared";

/**
 * The exact, minimal set of inputs a scoring algorithm consumes. Produced by the
 * repository from CONFIRMED trades + identity. Keeping this explicit is what makes
 * scoring a pure, reproducible function (Trust Architecture Review §4).
 */
export interface ScoringInput {
  businessId: UUID;
  assuranceLevel: AssuranceLevel;
  assuranceRank: number;
  /** CONFIRMED trades where the business is initiator or counterparty. */
  confirmedTradeCount: number;
  /** Distinct other-party businesses across those confirmed trades. */
  distinctCounterparties: number;
  /** Sorted ids of the confirmed trades (part of the inputs hash). */
  confirmedTradeIds: string[];
  /** Decisions on trades this business INITIATED (reliability signal). */
  initiatorConfirmed: number;
  initiatorRejected: number;
  initiatorDisputed: number;
}

export interface ComputedFactor {
  key: string;
  direction: ScoreFactorDirection;
  /** Magnitude of the contribution (always >= 0). */
  weight: number;
  detail: Record<string, unknown>;
}

export interface ScoreResult {
  score: number;
  band: ScoreBand;
  factors: ComputedFactor[];
}
