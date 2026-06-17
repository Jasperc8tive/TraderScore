import { describe, expect, it, vi } from "vitest";
import {
  Role,
  TradeDirection,
  TradeStatus,
  ForbiddenError,
  ValidationError,
  ConflictError,
} from "@tradescore/shared";
import { TradesService } from "./trades.service";
import type { AuthenticatedUser } from "../common/auth/authenticated-user";

const member: AuthenticatedUser = { id: "u1", role: Role.BUSINESS_OWNER, sessionId: "s1" };

function makeService(opts: {
  membership?: unknown;
  trade?: Record<string, unknown>;
} = {}) {
  const trades = {
    findById: vi.fn(async () => opts.trade ?? null),
    createWithEvent: vi.fn(async (i: Record<string, unknown>) => ({
      id: "t1",
      referenceCode: "TS-ABCD1234",
      status: TradeStatus.DRAFT,
      counterpartyBusinessId: i.counterpartyBusinessId ?? null,
      ...i,
    })),
    transitionWithEvent: vi.fn(async (_id: string, status: string, _e: unknown) => ({
      ...(opts.trade ?? {}),
      status,
    })),
    updateWithEvent: vi.fn(async () => ({ ...(opts.trade ?? {}), status: opts.trade?.status })),
  };
  const businesses = { findById: vi.fn(async () => ({ id: "b1" })) };
  const members = { find: vi.fn(async () => opts.membership ?? null) };
  const events = { publish: vi.fn(async () => {}) };
  const audit = { record: vi.fn() };
  const service = new TradesService(
    trades as never,
    businesses as never,
    members as never,
    events as never,
    audit as never,
  );
  return { service, trades, events };
}

const baseCreate = {
  initiatorBusinessId: "b1",
  direction: TradeDirection.SALE,
  amountMinor: 150000,
  occurredOn: "2026-01-01",
};

describe("TradesService", () => {
  it("forbids a non-member from logging a trade", async () => {
    const { service } = makeService({ membership: null });
    await expect(service.create(member, baseCreate)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("logs a trade and emits trade.logged for a member", async () => {
    const { service, events } = makeService({ membership: { memberRole: "STAFF" } });
    const trade = await service.create(member, baseCreate);
    expect(trade.status).toBe(TradeStatus.DRAFT);
    expect(events.publish).toHaveBeenCalledWith(
      "trade.logged",
      expect.objectContaining({ initiatorBusinessId: "b1" }),
      expect.anything(),
    );
  });

  it("rejects a non-positive amount", async () => {
    const { service } = makeService({ membership: { memberRole: "OWNER" } });
    await expect(service.create(member, { ...baseCreate, amountMinor: 0 })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it("rejects a self-trade", async () => {
    const { service } = makeService({ membership: { memberRole: "OWNER" } });
    await expect(
      service.create(member, { ...baseCreate, counterpartyBusinessId: "b1" }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects a future trade date", async () => {
    const { service } = makeService({ membership: { memberRole: "OWNER" } });
    await expect(
      service.create(member, { ...baseCreate, occurredOn: "2999-01-01" }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("refuses to submit without a registered counterparty", async () => {
    const { service } = makeService({
      membership: { memberRole: "OWNER" },
      trade: { id: "t1", initiatorBusinessId: "b1", status: TradeStatus.DRAFT, counterpartyBusinessId: null },
    });
    await expect(service.submit(member, "t1")).rejects.toBeInstanceOf(ValidationError);
  });

  it("refuses to cancel a confirmed trade", async () => {
    const { service } = makeService({
      membership: { memberRole: "OWNER" },
      trade: { id: "t1", initiatorBusinessId: "b1", status: TradeStatus.CONFIRMED },
    });
    await expect(service.cancel(member, "t1")).rejects.toBeInstanceOf(ConflictError);
  });

  it("refuses to edit a cancelled trade", async () => {
    const { service } = makeService({
      membership: { memberRole: "OWNER" },
      trade: { id: "t1", initiatorBusinessId: "b1", status: TradeStatus.CANCELLED, currency: "NGN" },
    });
    await expect(service.edit(member, "t1", { description: "x" })).rejects.toBeInstanceOf(
      ConflictError,
    );
  });
});
