import { FraudFlagType, FraudSubjectType, FraudSeverity } from "@tradescore/shared";
import type { CreatorCount, DetectedFlag } from "./types";

/**
 * Sybil detection (TAR F1/F2): a single user that created an unusual number of
 * businesses is a strong Sybil signal (one human masquerading as many independent
 * parties to manufacture trust). Pure and deterministic.
 */
export const SYBIL_MIN_BUSINESSES = 3;
const SYBIL_HIGH_BUSINESSES = 5;

export function detectSybil(
  creators: CreatorCount[],
  minBusinesses = SYBIL_MIN_BUSINESSES,
): DetectedFlag[] {
  const flags: DetectedFlag[] = [];
  for (const c of creators) {
    if (c.businessCount < minBusinesses) continue;
    flags.push({
      flagType: FraudFlagType.SYBIL_CLUSTER,
      subjectType: FraudSubjectType.USER,
      subjectId: c.userId,
      severity: c.businessCount >= SYBIL_HIGH_BUSINESSES ? FraudSeverity.HIGH : FraudSeverity.MEDIUM,
      detail: { businessCount: c.businessCount, phone: c.phone },
    });
  }
  return flags;
}
