import { FraudFlagType, FraudSubjectType, FraudSeverity } from "@tradescore/shared";
import type { PairStat, DetectedFlag } from "./types";

/**
 * Relationship risk scoring (TAR F4/F5/F6): a pair of businesses with heavy
 * MUTUAL trading and/or disputes is riskier than diverse one-directional trade.
 * Risk = mutual volume (weighted, only when reciprocal) + disputes (weighted).
 * Pure and deterministic.
 */
export const RELATIONSHIP_RISK_THRESHOLD = 6;

export function detectRelationshipRisk(pairs: PairStat[]): DetectedFlag[] {
  const flags: DetectedFlag[] = [];
  for (const p of pairs) {
    const reciprocal = p.aToB > 0 && p.bToA > 0;
    const mutualVolume = reciprocal ? p.aToB + p.bToA : 0;
    const risk = mutualVolume * 2 + p.disputes * 3;
    if (risk < RELATIONSHIP_RISK_THRESHOLD) continue;

    const members = [p.a, p.b].sort((x, y) => x.localeCompare(y));
    flags.push({
      flagType: FraudFlagType.RELATIONSHIP_RISK,
      subjectType: FraudSubjectType.RELATIONSHIP,
      subjectId: members.join("|"),
      severity: risk >= 12 ? FraudSeverity.HIGH : FraudSeverity.MEDIUM,
      detail: { members, aToB: p.aToB, bToA: p.bToA, disputes: p.disputes, risk },
    });
  }
  return flags;
}
