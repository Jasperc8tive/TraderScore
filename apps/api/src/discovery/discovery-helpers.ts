import { AssuranceLevel } from "@tradescore/shared";

/**
 * Verification badge derived from a business's assurance level. This is a
 * *presentation* of identity provenance — not a trust score. Pure and
 * unit-tested so the badge can never silently drift from the assurance scale.
 */
export interface VerificationBadge {
  verified: boolean;
  label: string;
  level: AssuranceLevel;
}

export function verificationBadge(level: AssuranceLevel): VerificationBadge {
  switch (level) {
    case AssuranceLevel.FULLY_VERIFIED:
      return { verified: true, label: "Fully Verified", level };
    case AssuranceLevel.DOCUMENT_VERIFIED:
      return { verified: true, label: "Document Verified", level };
    case AssuranceLevel.PHONE_VERIFIED:
      return { verified: true, label: "Phone Verified", level };
    default:
      return { verified: false, label: "Unverified", level: AssuranceLevel.UNVERIFIED };
  }
}

export type DiscoverySort = "score" | "name";

/** Whitelist user-supplied sort to a safe, known value (no SQL from input). */
export function parseSort(sort: string | undefined): DiscoverySort {
  return sort === "name" ? "name" : "score";
}

/** Map a whitelisted sort to its SQL ORDER BY clause (no user input interpolated). */
export function sortToOrderBy(sort: DiscoverySort): string {
  return sort === "name" ? "b.name ASC" : "s.score DESC NULLS LAST, b.name ASC";
}
