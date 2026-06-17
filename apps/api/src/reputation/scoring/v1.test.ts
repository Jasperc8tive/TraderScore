import { describe, expect, it } from "vitest";
import { AssuranceLevel, ScoreBand, ScoreFactorDirection } from "@tradescore/shared";
import { computeScoreV1 } from "./v1";
import type { ScoringInput } from "./types";

function input(overrides: Partial<ScoringInput> = {}): ScoringInput {
  return {
    businessId: "b1",
    assuranceLevel: AssuranceLevel.UNVERIFIED,
    assuranceRank: 0,
    confirmedTradeCount: 0,
    distinctCounterparties: 0,
    confirmedTradeIds: [],
    initiatorConfirmed: 0,
    initiatorRejected: 0,
    initiatorDisputed: 0,
    ...overrides,
  };
}

function factor(result: { factors: { key: string; weight: number; direction: string }[] }, key: string) {
  return result.factors.find((f) => f.key === key)!;
}

describe("computeScoreV1", () => {
  it("a brand-new business with no trades is NEW with score 0", () => {
    const r = computeScoreV1(input());
    expect(r.score).toBe(0);
    expect(r.band).toBe(ScoreBand.NEW);
  });

  it("identity assurance adds points but band stays NEW without confirmed trades", () => {
    const r = computeScoreV1(input({ assuranceLevel: AssuranceLevel.FULLY_VERIFIED, assuranceRank: 3 }));
    expect(factor(r, "IDENTITY_ASSURANCE").weight).toBe(150);
    expect(r.score).toBe(150);
    expect(r.band).toBe(ScoreBand.NEW); // no track record yet
  });

  it("rewards confirmed volume with diminishing returns and caps it", () => {
    const few = computeScoreV1(input({ confirmedTradeCount: 1, confirmedTradeIds: ["t1"] }));
    const many = computeScoreV1(input({ confirmedTradeCount: 100, confirmedTradeIds: ["x"] }));
    expect(factor(few, "CONFIRMED_TRADE_VOLUME").weight).toBeGreaterThan(0);
    expect(factor(many, "CONFIRMED_TRADE_VOLUME").weight).toBeLessThanOrEqual(300);
    // diminishing: doubling from 1->many should be far less than linear
    expect(factor(many, "CONFIRMED_TRADE_VOLUME").weight).toBeLessThan(
      factor(few, "CONFIRMED_TRADE_VOLUME").weight * 100,
    );
  });

  it("rewards counterparty diversity and caps it (anti-wash)", () => {
    const r = computeScoreV1(input({ confirmedTradeCount: 10, distinctCounterparties: 10 }));
    expect(factor(r, "COUNTERPARTY_DIVERSITY").weight).toBe(200); // capped at 5 distinct * 40
  });

  it("scores confirmation reliability from initiator decisions", () => {
    const perfect = computeScoreV1(input({ initiatorConfirmed: 10 }));
    const mixed = computeScoreV1(input({ initiatorConfirmed: 5, initiatorRejected: 5 }));
    expect(factor(perfect, "CONFIRMATION_RELIABILITY").weight).toBe(250);
    expect(factor(mixed, "CONFIRMATION_RELIABILITY").weight).toBe(125);
  });

  it("penalizes disputes and rejections", () => {
    const r = computeScoreV1(
      input({ confirmedTradeCount: 5, initiatorDisputed: 2, initiatorRejected: 2 }),
    );
    const penalty = factor(r, "DISPUTE_PENALTY");
    expect(penalty.direction).toBe(ScoreFactorDirection.NEGATIVE);
    expect(penalty.weight).toBe(2 * 40 + 2 * 25);
  });

  it("clamps to [0, 1000] and assigns the right band", () => {
    const strong = computeScoreV1(
      input({
        assuranceLevel: AssuranceLevel.FULLY_VERIFIED,
        assuranceRank: 3,
        confirmedTradeCount: 100,
        distinctCounterparties: 20,
        confirmedTradeIds: ["a"],
        initiatorConfirmed: 50,
      }),
    );
    expect(strong.score).toBeLessThanOrEqual(1000);
    expect(strong.score).toBeGreaterThanOrEqual(750);
    expect(strong.band).toBe(ScoreBand.HIGHLY_TRUSTED);
  });

  it("is deterministic", () => {
    const a = computeScoreV1(input({ confirmedTradeCount: 7, distinctCounterparties: 3 }));
    const b = computeScoreV1(input({ confirmedTradeCount: 7, distinctCounterparties: 3 }));
    expect(a).toEqual(b);
  });
});
