import type { FraudFlagType, FraudSubjectType, FraudSeverity } from "@tradescore/shared";

/** A normalized flag produced by a detector (persisted by the engine). */
export interface DetectedFlag {
  flagType: FraudFlagType;
  subjectType: FraudSubjectType;
  subjectId: string;
  severity: FraudSeverity;
  detail: Record<string, unknown>;
}

/** Inputs the repository supplies to the pure detectors. */
export interface CreatorCount {
  userId: string;
  phone: string;
  businessCount: number;
}

export interface Edge {
  from: string; // initiator business id
  to: string; // counterparty business id
}

export interface BusinessStat {
  businessId: string;
  confirmedCount: number; // confirmed trades involving the business
  maxWithOneCounterparty: number; // max confirmed trades with a single counterparty
  recentConfirmedCount: number; // confirmed in the last 24h
  initiatorConfirmed: number;
  initiatorRejected: number;
  initiatorDisputed: number;
}

export interface PairStat {
  a: string;
  b: string; // a < b (canonical)
  aToB: number; // confirmed trades a→b
  bToA: number; // confirmed trades b→a
  disputes: number; // disputes on trades between a and b
}
