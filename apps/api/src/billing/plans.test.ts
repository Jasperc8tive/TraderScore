import { describe, expect, it } from "vitest";
import { PlanId } from "@tradescore/shared";
import { PLANS, getPlan, entitlementsFor, isPaidPlan } from "./plans";

describe("plans", () => {
  it("defines FREE/PRO/ELITE with integer prices", () => {
    expect(PLANS.FREE.priceMinor).toBe(0);
    expect(PLANS.PRO.priceMinor).toBeGreaterThan(0);
    expect(Number.isInteger(PLANS.ELITE.priceMinor)).toBe(true);
  });

  it("grants the verified badge only on paid plans", () => {
    expect(entitlementsFor(PlanId.FREE).verifiedBadge).toBe(false);
    expect(entitlementsFor(PlanId.PRO).verifiedBadge).toBe(true);
    expect(entitlementsFor(PlanId.ELITE).verifiedBadge).toBe(true);
  });

  it("treats a missing plan as FREE", () => {
    expect(entitlementsFor(null).verifiedBadge).toBe(false);
    expect(entitlementsFor(undefined).verifiedBadge).toBe(false);
  });

  it("classifies paid plans", () => {
    expect(isPaidPlan(PlanId.FREE)).toBe(false);
    expect(isPaidPlan(PlanId.PRO)).toBe(true);
  });

  it("getPlan throws on unknown", () => {
    expect(() => getPlan("NOPE" as PlanId)).toThrow();
  });
});
