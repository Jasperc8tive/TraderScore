import { describe, expect, it } from "vitest";
import { TradeStatus } from "@tradescore/shared";
import { canTransition, isEditable, isCancellable, isConfirmable } from "./trade-status";

describe("trade status workflow", () => {
  it("allows the Stage 3 transitions", () => {
    expect(canTransition(TradeStatus.DRAFT, TradeStatus.PENDING_CONFIRMATION)).toBe(true);
    expect(canTransition(TradeStatus.DRAFT, TradeStatus.CANCELLED)).toBe(true);
    expect(canTransition(TradeStatus.PENDING_CONFIRMATION, TradeStatus.CANCELLED)).toBe(true);
  });

  it("rejects illegal transitions", () => {
    expect(canTransition(TradeStatus.DRAFT, TradeStatus.CONFIRMED)).toBe(false);
    expect(canTransition(TradeStatus.CANCELLED, TradeStatus.DRAFT)).toBe(false);
    expect(canTransition(TradeStatus.CONFIRMED, TradeStatus.CANCELLED)).toBe(false);
    expect(canTransition(TradeStatus.PENDING_CONFIRMATION, TradeStatus.DRAFT)).toBe(false);
    expect(canTransition(TradeStatus.REJECTED, TradeStatus.CONFIRMED)).toBe(false);
    expect(canTransition(TradeStatus.CANCELLED, TradeStatus.CONFIRMED)).toBe(false);
  });

  it("allows the Stage 7 dispute transitions", () => {
    // a confirmed trade can be contested; a disputed trade is adjudicated to final
    expect(canTransition(TradeStatus.CONFIRMED, TradeStatus.DISPUTED)).toBe(true);
    expect(canTransition(TradeStatus.DISPUTED, TradeStatus.CONFIRMED)).toBe(true);
    expect(canTransition(TradeStatus.DISPUTED, TradeStatus.REJECTED)).toBe(true);
  });

  it("allows the Stage 4 counterparty decisions from PENDING_CONFIRMATION", () => {
    expect(canTransition(TradeStatus.PENDING_CONFIRMATION, TradeStatus.CONFIRMED)).toBe(true);
    expect(canTransition(TradeStatus.PENDING_CONFIRMATION, TradeStatus.REJECTED)).toBe(true);
    expect(canTransition(TradeStatus.PENDING_CONFIRMATION, TradeStatus.DISPUTED)).toBe(true);
    // ...but a DRAFT cannot be decided.
    expect(isConfirmable(TradeStatus.DRAFT)).toBe(false);
    expect(isConfirmable(TradeStatus.PENDING_CONFIRMATION)).toBe(true);
  });

  it("marks only pre-confirmation states editable/cancellable", () => {
    expect(isEditable(TradeStatus.DRAFT)).toBe(true);
    expect(isEditable(TradeStatus.PENDING_CONFIRMATION)).toBe(true);
    expect(isEditable(TradeStatus.CONFIRMED)).toBe(false);
    expect(isEditable(TradeStatus.CANCELLED)).toBe(false);

    expect(isCancellable(TradeStatus.DRAFT)).toBe(true);
    expect(isCancellable(TradeStatus.PENDING_CONFIRMATION)).toBe(true);
    expect(isCancellable(TradeStatus.CONFIRMED)).toBe(false);
  });
});
