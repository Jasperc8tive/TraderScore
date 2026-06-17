import { PlanId } from "@tradescore/shared";

/**
 * Plans are defined in code so prices and entitlements are server-authoritative —
 * never trusted from a request body. Money is integer minor units (kobo).
 */
export interface PlanEntitlements {
  verifiedBadge: boolean;
  prioritySupport: boolean;
  maxStaff: number;
}

export interface PlanDefinition {
  id: PlanId;
  name: string;
  priceMinor: number;
  currency: string;
  entitlements: PlanEntitlements;
}

export const PLANS: Record<PlanId, PlanDefinition> = {
  [PlanId.FREE]: {
    id: PlanId.FREE,
    name: "Free",
    priceMinor: 0,
    currency: "NGN",
    entitlements: { verifiedBadge: false, prioritySupport: false, maxStaff: 3 },
  },
  [PlanId.PRO]: {
    id: PlanId.PRO,
    name: "Pro",
    priceMinor: 500_000, // NGN 5,000
    currency: "NGN",
    entitlements: { verifiedBadge: true, prioritySupport: false, maxStaff: 15 },
  },
  [PlanId.ELITE]: {
    id: PlanId.ELITE,
    name: "Elite",
    priceMinor: 1_500_000, // NGN 15,000
    currency: "NGN",
    entitlements: { verifiedBadge: true, prioritySupport: true, maxStaff: 100 },
  },
};

export function getPlan(id: PlanId): PlanDefinition {
  const plan = PLANS[id];
  if (!plan) throw new Error(`Unknown plan: ${id}`);
  return plan;
}

/** Entitlements for a plan; a missing/null plan resolves to FREE. */
export function entitlementsFor(id: PlanId | null | undefined): PlanEntitlements {
  return (id && PLANS[id]) ? PLANS[id].entitlements : PLANS[PlanId.FREE].entitlements;
}

export function isPaidPlan(id: PlanId): boolean {
  return PLANS[id]?.priceMinor > 0;
}
