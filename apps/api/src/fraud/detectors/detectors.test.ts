import { describe, expect, it } from "vitest";
import { FraudFlagType, FraudSeverity } from "@tradescore/shared";
import { detectSybil } from "./sybil";
import { detectCircularTrading } from "./circular";
import { detectSuspicious } from "./suspicious";
import { detectRelationshipRisk } from "./relationship-risk";
import type { BusinessStat } from "./types";

describe("detectSybil", () => {
  it("flags creators at/above the threshold, scaling severity", () => {
    const flags = detectSybil([
      { userId: "u1", phone: "+1", businessCount: 2 },
      { userId: "u2", phone: "+2", businessCount: 3 },
      { userId: "u3", phone: "+3", businessCount: 6 },
    ]);
    expect(flags).toHaveLength(2);
    expect(flags.find((f) => f.subjectId === "u2")?.severity).toBe(FraudSeverity.MEDIUM);
    expect(flags.find((f) => f.subjectId === "u3")?.severity).toBe(FraudSeverity.HIGH);
    expect(flags[0]!.flagType).toBe(FraudFlagType.SYBIL_CLUSTER);
  });
});

describe("detectCircularTrading", () => {
  it("detects a 2-cycle (A↔B)", () => {
    const flags = detectCircularTrading([
      { from: "A", to: "B" },
      { from: "B", to: "A" },
    ]);
    expect(flags).toHaveLength(1);
    expect(flags[0]!.subjectId).toBe("A|B");
    expect(flags[0]!.severity).toBe(FraudSeverity.MEDIUM);
  });

  it("detects a 3-cycle (A→B→C→A) once, canonicalized", () => {
    const flags = detectCircularTrading([
      { from: "A", to: "B" },
      { from: "B", to: "C" },
      { from: "C", to: "A" },
    ]);
    const threeCycles = flags.filter((f) => (f.detail.cycleLength as number) === 3);
    expect(threeCycles).toHaveLength(1);
    expect(threeCycles[0]!.subjectId).toBe("A|B|C");
    expect(threeCycles[0]!.severity).toBe(FraudSeverity.HIGH);
  });

  it("does not flag an acyclic graph", () => {
    expect(detectCircularTrading([{ from: "A", to: "B" }, { from: "B", to: "C" }])).toHaveLength(0);
  });
});

function stat(overrides: Partial<BusinessStat>): BusinessStat {
  return {
    businessId: "b1",
    confirmedCount: 0,
    maxWithOneCounterparty: 0,
    recentConfirmedCount: 0,
    initiatorConfirmed: 0,
    initiatorRejected: 0,
    initiatorDisputed: 0,
    ...overrides,
  };
}

describe("detectSuspicious", () => {
  it("flags wash trading on high single-counterparty concentration", () => {
    const flags = detectSuspicious([stat({ confirmedCount: 10, maxWithOneCounterparty: 10 })]);
    const wash = flags.find((f) => f.flagType === FraudFlagType.WASH_TRADING);
    expect(wash?.severity).toBe(FraudSeverity.HIGH);
  });

  it("does not flag wash trading when diversified", () => {
    const flags = detectSuspicious([stat({ confirmedCount: 10, maxWithOneCounterparty: 3 })]);
    expect(flags.find((f) => f.flagType === FraudFlagType.WASH_TRADING)).toBeUndefined();
  });

  it("flags velocity anomaly on a confirmation burst", () => {
    const flags = detectSuspicious([stat({ recentConfirmedCount: 12 })]);
    expect(flags.find((f) => f.flagType === FraudFlagType.VELOCITY_ANOMALY)).toBeTruthy();
  });

  it("flags high dispute/rejection rate", () => {
    const flags = detectSuspicious([
      stat({ initiatorConfirmed: 1, initiatorRejected: 2, initiatorDisputed: 1 }),
    ]);
    expect(flags.find((f) => f.flagType === FraudFlagType.HIGH_DISPUTE_RATE)?.severity).toBe(
      FraudSeverity.HIGH,
    );
  });
});

describe("detectRelationshipRisk", () => {
  it("flags heavy mutual trading", () => {
    const flags = detectRelationshipRisk([{ a: "A", b: "B", aToB: 2, bToA: 2, disputes: 0 }]);
    expect(flags).toHaveLength(1);
    expect(flags[0]!.flagType).toBe(FraudFlagType.RELATIONSHIP_RISK);
  });

  it("ignores diverse one-directional trade", () => {
    expect(detectRelationshipRisk([{ a: "A", b: "B", aToB: 5, bToA: 0, disputes: 0 }])).toHaveLength(
      0,
    );
  });
});
