import { describe, expect, it } from "vitest";
import { DisputeStatus } from "@tradescore/shared";
import { isActive, canResolve, canWithdraw, canAddEvidence, canReview } from "./dispute-status";

describe("dispute lifecycle helpers", () => {
  it("treats OPEN and UNDER_REVIEW as active", () => {
    expect(isActive(DisputeStatus.OPEN)).toBe(true);
    expect(isActive(DisputeStatus.UNDER_REVIEW)).toBe(true);
    expect(isActive(DisputeStatus.RESOLVED)).toBe(false);
    expect(isActive(DisputeStatus.WITHDRAWN)).toBe(false);
  });

  it("allows resolve/withdraw/evidence only while active", () => {
    for (const s of [DisputeStatus.OPEN, DisputeStatus.UNDER_REVIEW]) {
      expect(canResolve(s)).toBe(true);
      expect(canWithdraw(s)).toBe(true);
      expect(canAddEvidence(s)).toBe(true);
    }
    for (const s of [DisputeStatus.RESOLVED, DisputeStatus.WITHDRAWN]) {
      expect(canResolve(s)).toBe(false);
      expect(canWithdraw(s)).toBe(false);
      expect(canAddEvidence(s)).toBe(false);
    }
  });

  it("allows review only from OPEN", () => {
    expect(canReview(DisputeStatus.OPEN)).toBe(true);
    expect(canReview(DisputeStatus.UNDER_REVIEW)).toBe(false);
    expect(canReview(DisputeStatus.RESOLVED)).toBe(false);
  });
});
