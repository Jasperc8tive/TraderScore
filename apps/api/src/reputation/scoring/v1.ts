import { ScoreBand, ScoreFactorDirection } from "@tradescore/shared";
import type { ComputedFactor, ScoreResult, ScoringInput } from "./types";

/**
 * Scoring algorithm v1.0.0 — pure and deterministic.
 *
 * Same input → same output, always. Every contribution is recorded as a factor so
 * the score is fully explainable (Product Principle 3). See the Stage 5 design note
 * for the model and rationale. To change the maths, add a v2 module and bump the
 * version — never mutate this one (Trust Architecture Review §4).
 */
export const V1_VERSION = "1.0.0";

const MAX_SCORE = 1000;
const VOLUME_CAP = 300;
const DIVERSITY_PER = 40;
const DIVERSITY_CAP = 200;
const RELIABILITY_MAX = 250;
const ASSURANCE_PER_RANK = 50;
const PENALTY_PER_DISPUTE = 40;
const PENALTY_PER_REJECTION = 25;

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function bandFor(score: number, confirmedTradeCount: number): ScoreBand {
  if (confirmedTradeCount === 0) return ScoreBand.NEW; // no track record yet
  if (score < 250) return ScoreBand.BUILDING;
  if (score < 500) return ScoreBand.ESTABLISHED;
  if (score < 750) return ScoreBand.TRUSTED;
  return ScoreBand.HIGHLY_TRUSTED;
}

export function computeScoreV1(input: ScoringInput): ScoreResult {
  const factors: ComputedFactor[] = [];
  let total = 0;

  // 1) Verified activity volume (diminishing returns).
  const volumePts =
    input.confirmedTradeCount === 0
      ? 0
      : Math.min(VOLUME_CAP, Math.round(80 * Math.log(input.confirmedTradeCount + 1)));
  factors.push({
    key: "CONFIRMED_TRADE_VOLUME",
    direction: ScoreFactorDirection.POSITIVE,
    weight: volumePts,
    detail: { confirmedTrades: input.confirmedTradeCount },
  });
  total += volumePts;

  // 2) Counterparty diversity (anti-wash, F5).
  const diversityPts = Math.min(DIVERSITY_CAP, input.distinctCounterparties * DIVERSITY_PER);
  factors.push({
    key: "COUNTERPARTY_DIVERSITY",
    direction: ScoreFactorDirection.POSITIVE,
    weight: diversityPts,
    detail: { distinctCounterparties: input.distinctCounterparties },
  });
  total += diversityPts;

  // 3) Confirmation reliability of this business's own claims (as initiator).
  const decided = input.initiatorConfirmed + input.initiatorRejected + input.initiatorDisputed;
  const rate = decided > 0 ? input.initiatorConfirmed / decided : null;
  const reliabilityPts = rate === null ? 0 : Math.round(rate * RELIABILITY_MAX);
  factors.push({
    key: "CONFIRMATION_RELIABILITY",
    direction: ScoreFactorDirection.POSITIVE,
    weight: reliabilityPts,
    detail: {
      decidedAsInitiator: decided,
      confirmationRate: rate === null ? null : Math.round(rate * 100) / 100,
    },
  });
  total += reliabilityPts;

  // 4) Identity assurance (F1/F2).
  const assurancePts = input.assuranceRank * ASSURANCE_PER_RANK;
  factors.push({
    key: "IDENTITY_ASSURANCE",
    direction: ScoreFactorDirection.POSITIVE,
    weight: assurancePts,
    detail: { assuranceLevel: input.assuranceLevel },
  });
  total += assurancePts;

  // 5) Dispute / rejection penalty (bad-faith or false claims).
  const penalty =
    input.initiatorDisputed * PENALTY_PER_DISPUTE + input.initiatorRejected * PENALTY_PER_REJECTION;
  if (penalty > 0) {
    factors.push({
      key: "DISPUTE_PENALTY",
      direction: ScoreFactorDirection.NEGATIVE,
      weight: penalty,
      detail: { disputed: input.initiatorDisputed, rejected: input.initiatorRejected },
    });
    total -= penalty;
  }

  const score = clamp(total, 0, MAX_SCORE);
  return { score, band: bandFor(score, input.confirmedTradeCount), factors };
}
