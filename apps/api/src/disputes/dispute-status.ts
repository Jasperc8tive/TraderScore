import { DisputeStatus } from "@tradescore/shared";

/**
 * Pure helpers for the dispute lifecycle. Kept I/O-free and unit-tested so the
 * rules of "what can happen to a dispute when" live in one authoritative place.
 */

/** A dispute is active (mutable) while OPEN or UNDER_REVIEW. */
export function isActive(status: DisputeStatus): boolean {
  return status === DisputeStatus.OPEN || status === DisputeStatus.UNDER_REVIEW;
}

/** Only an active dispute can be adjudicated. */
export function canResolve(status: DisputeStatus): boolean {
  return isActive(status);
}

/** Only an active dispute can be withdrawn by its raiser. */
export function canWithdraw(status: DisputeStatus): boolean {
  return isActive(status);
}

/** Evidence may be added only while the dispute is active. */
export function canAddEvidence(status: DisputeStatus): boolean {
  return isActive(status);
}

/** Review (claiming a case) is only valid from OPEN. */
export function canReview(status: DisputeStatus): boolean {
  return status === DisputeStatus.OPEN;
}
