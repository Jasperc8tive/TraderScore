import { FraudFlagType, FraudSubjectType, FraudSeverity } from "@tradescore/shared";
import type { BusinessStat, DetectedFlag } from "./types";

/**
 * Suspicious-transaction detection per business (TAR F5):
 *  - WASH_TRADING: confirmed volume concentrated on a single counterparty.
 *  - VELOCITY_ANOMALY: an abnormal burst of confirmations in 24h.
 *  - HIGH_DISPUTE_RATE: a high share of initiated trades end rejected/disputed.
 * Pure and deterministic.
 */
export const WASH_MIN_CONFIRMED = 5;
export const WASH_CONCENTRATION = 0.8;
export const VELOCITY_24H_THRESHOLD = 10;
export const DISPUTE_MIN_DECIDED = 4;
export const DISPUTE_RATE_THRESHOLD = 0.5;

export function detectSuspicious(stats: BusinessStat[]): DetectedFlag[] {
  const flags: DetectedFlag[] = [];

  for (const s of stats) {
    // Wash trading: highly concentrated confirmed volume.
    if (s.confirmedCount >= WASH_MIN_CONFIRMED) {
      const concentration = s.maxWithOneCounterparty / s.confirmedCount;
      if (concentration >= WASH_CONCENTRATION) {
        flags.push({
          flagType: FraudFlagType.WASH_TRADING,
          subjectType: FraudSubjectType.BUSINESS,
          subjectId: s.businessId,
          severity: concentration >= 1 ? FraudSeverity.HIGH : FraudSeverity.MEDIUM,
          detail: {
            confirmedCount: s.confirmedCount,
            maxWithOneCounterparty: s.maxWithOneCounterparty,
            concentration: Math.round(concentration * 100) / 100,
          },
        });
      }
    }

    // Velocity: confirmation burst.
    if (s.recentConfirmedCount >= VELOCITY_24H_THRESHOLD) {
      flags.push({
        flagType: FraudFlagType.VELOCITY_ANOMALY,
        subjectType: FraudSubjectType.BUSINESS,
        subjectId: s.businessId,
        severity: FraudSeverity.HIGH,
        detail: { recentConfirmedCount: s.recentConfirmedCount, windowHours: 24 },
      });
    }

    // High dispute/rejection rate on initiated trades.
    const decided = s.initiatorConfirmed + s.initiatorRejected + s.initiatorDisputed;
    if (decided >= DISPUTE_MIN_DECIDED) {
      const badRate = (s.initiatorRejected + s.initiatorDisputed) / decided;
      if (badRate >= DISPUTE_RATE_THRESHOLD) {
        flags.push({
          flagType: FraudFlagType.HIGH_DISPUTE_RATE,
          subjectType: FraudSubjectType.BUSINESS,
          subjectId: s.businessId,
          severity: badRate >= 0.75 ? FraudSeverity.HIGH : FraudSeverity.MEDIUM,
          detail: {
            decided,
            rejected: s.initiatorRejected,
            disputed: s.initiatorDisputed,
            badRate: Math.round(badRate * 100) / 100,
          },
        });
      }
    }
  }

  return flags;
}
