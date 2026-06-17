import { describe, expect, it, vi } from "vitest";
import {
  Role,
  TradeStatus,
  DisputeStatus,
  DisputeResolution,
  ForbiddenError,
  ConflictError,
} from "@tradescore/shared";
import { DisputesService } from "./disputes.service";
import type { AuthenticatedUser } from "../common/auth/authenticated-user";

const party: AuthenticatedUser = { id: "u-init", role: Role.BUSINESS_OWNER, sessionId: "s" };
const moderator: AuthenticatedUser = { id: "u-mod", role: Role.MODERATOR, sessionId: "s" };

const CONFIRMED_TRADE = {
  id: "t1",
  initiatorBusinessId: "init",
  counterpartyBusinessId: "cp",
  status: TradeStatus.CONFIRMED,
  amountMinor: 1000,
  currency: "NGN",
};

function makeService(opts: {
  trade?: Record<string, unknown>;
  dispute?: Record<string, unknown>;
  active?: Record<string, unknown> | null;
  find?: (bid: string, uid: string) => unknown;
}) {
  const trade = opts.trade ?? CONFIRMED_TRADE;
  const trades = { findById: vi.fn(async () => trade) };
  const members = { find: vi.fn(async (bid: string, uid: string) => (opts.find ? opts.find(bid, uid) : null)) };
  const disputes = {
    findById: vi.fn(async () => opts.dispute ?? null),
    findActiveByTrade: vi.fn(async () => opts.active ?? null),
    open: vi.fn(async () => ({ id: "d1", tradeId: "t1", status: DisputeStatus.OPEN })),
    markUnderReview: vi.fn(async () => ({ id: "d1", status: DisputeStatus.UNDER_REVIEW })),
    resolve: vi.fn(async (i: { newTradeStatus: string }) => ({
      dispute: { id: "d1", status: DisputeStatus.RESOLVED },
      trade: { ...trade, status: i.newTradeStatus },
    })),
  };
  const events = { publish: vi.fn(async () => {}) };
  const audit = { record: vi.fn() };
  const service = new DisputesService(
    trades as never,
    members as never,
    disputes as never,
    events as never,
    audit as never,
  );
  return { service, disputes, events };
}

describe("DisputesService.raise", () => {
  it("lets a party raise a dispute on a confirmed trade and emits trade.disputed", async () => {
    const { service, events } = makeService({ find: (bid) => (bid === "init" ? { memberRole: "OWNER" } : null) });
    await service.raise(party, "t1", "goods not delivered");
    expect(events.publish).toHaveBeenCalledWith("dispute.opened", expect.anything(), expect.anything());
    expect(events.publish).toHaveBeenCalledWith("trade.disputed", expect.anything(), expect.anything());
  });

  it("forbids a non-party from raising", async () => {
    const { service } = makeService({ find: () => null });
    await expect(service.raise(party, "t1", "reason here")).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("rejects raising on a non-disputable trade", async () => {
    const { service } = makeService({
      trade: { ...CONFIRMED_TRADE, status: TradeStatus.PENDING_CONFIRMATION },
      find: (bid) => (bid === "init" ? { memberRole: "OWNER" } : null),
    });
    await expect(service.raise(party, "t1", "reason here")).rejects.toBeInstanceOf(ConflictError);
  });

  it("rejects a second active dispute", async () => {
    const { service } = makeService({
      find: (bid) => (bid === "init" ? { memberRole: "OWNER" } : null),
      active: { id: "d-existing" },
    });
    await expect(service.raise(party, "t1", "reason here")).rejects.toBeInstanceOf(ConflictError);
  });
});

describe("DisputesService.resolve", () => {
  const openDispute = { id: "d1", tradeId: "t1", status: DisputeStatus.UNDER_REVIEW, tradeStatusBefore: TradeStatus.CONFIRMED };

  it("forbids a non-adjudicator from resolving", async () => {
    const { service } = makeService({ dispute: openDispute });
    await expect(service.resolve(party, "d1", DisputeResolution.UPHELD, "x")).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("UPHELD rejects the trade and emits trade.rejected", async () => {
    const { service, events } = makeService({ dispute: openDispute });
    await service.resolve(moderator, "d1", DisputeResolution.UPHELD, "valid");
    expect(events.publish).toHaveBeenCalledWith("dispute.resolved", expect.anything(), expect.anything());
    expect(events.publish).toHaveBeenCalledWith("trade.rejected", expect.anything(), expect.anything());
  });

  it("DISMISSED confirms the trade and emits trade.confirmed", async () => {
    const { service, events } = makeService({ dispute: openDispute });
    await service.resolve(moderator, "d1", DisputeResolution.DISMISSED, "invalid");
    expect(events.publish).toHaveBeenCalledWith("trade.confirmed", expect.anything(), expect.anything());
  });
});
