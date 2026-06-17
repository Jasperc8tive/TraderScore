import { computeScoreV1, V1_VERSION } from "./v1";
import type { ScoreResult, ScoringInput } from "./types";

export * from "./types";
export { computeScoreV1, V1_VERSION };

/** The algorithm version currently in production. */
export const CURRENT_ALGORITHM_VERSION = V1_VERSION;

/**
 * Compute a score with the current algorithm. A future change selects a newer
 * version here (or runs several in parallel for shadow scoring) without touching
 * callers or the database schema (Trust Architecture Review §4).
 */
export function computeScore(input: ScoringInput): ScoreResult {
  return computeScoreV1(input);
}
