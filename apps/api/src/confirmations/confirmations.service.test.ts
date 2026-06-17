import { describe, expect, it, vi } from "vitest";
import {
  Role,
  TradeStatus,
  ForbiddenError,
  ConflictError,
  ValidationError,
} from "@tradescore/shared";
import { ConfirmationsService } from "./confirmations.service";
import type { AuthenticatedUser } from "../common/auth/authenticated-user";

const cpUser: AuthenticatedUser = { id: "u-cp", role: Role.BUSINESS_OWNER, sessionId: "s1" };

function makeService(opts: {
  trade?: Record<string, unknown>;
  find?: (businessId: string, userId: string) => unknown;
}) {
  const trade = opts.trade ?? {
    id: "t1",
    initiatorBusinessId: "init",
    counterpartyBusinessId: "cp",
    status: TradeStatus.PENDING_CONFIRMATION,
    amountMinor: 1000,
    currency: "NGN",
  };
  const trades = { findById: vi.fn(async () => trade) };
  const members = { find: vi.fn(async (bid: string, uid: string) => (opts.find ? opts.find(bid, uid) : null)) };
  const confirmations = {
    decide: vi.fn(async (i: { decision: string }) => ({ ...trade, status: i.decision })),
  };
  const events = { publish: vi.fn(async () => {}) };
  const audit = { record: vi.fn() };
  const service = new ConfirmationsService(
    trades as never,
    members as never,
    confirmations as never,
    events as never,
    audit as never,
  );
  return { service, confirmations, events };
}

describe("ConfirmationsService", () => {
  it("lets a counterparty member confirm a pending trade", async () => {
    const { service, events } = makeService({
      find: (bid) => (bid === "cp" ? { memberRole: "OWNER" } : null),
    });
    const result = await service.confirm(cpUser, "t1");
    expect(result.status).toBe(TradeStatus.CONFIRMED);
    expect(events.publish).toHaveBeenCalledWith(
      "trade.confirmed",
      expect.objectContaining({ counterpartyBusinessId: "cp" }),
      expect.anything(),
    );
  });

  it("FORBIDS the initiating side from confirming its own trade (member of both)", async () => {
    // actor is a member of BOTH businesses — the dangerous self-confirm case
    const { service } = makeService({ find: () => ({ memberRole: "OWNER" }) });
    await expect(service.confirm(cpUser, "t1")).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("forbids a non-counterparty member from deciding", async () => {
    const { service } = makeService({ find: () => null });
    await expect(service.confirm(cpUser, "t1")).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("does not allow ADMIN to self-confirm (no admin bypass)", async () => {
    const admin: AuthenticatedUser = { id: "a", role: Role.ADMIN, sessionId: "s" };
    const { service } = makeService({ find: () => null });
    await expect(service.confirm(admin, "t1")).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("rejects deciding a trade that is not pending confirmation", async () => {
    const { service } = makeService({
      trade: { id: "t1", initiatorBusinessId: "init", counterpartyBusinessId: "cp", status: TradeStatus.CONFIRMED },
      find: (bid) => (bid === "cp" ? { memberRole: "OWNER" } : null),
    });
    await expect(service.confirm(cpUser, "t1")).rejects.toBeInstanceOf(ConflictError);
  });

  it("requires a reason to dispute", async () => {
    const { service } = makeService({
      find: (bid) => (bid === "cp" ? { memberRole: "OWNER" } : null),
    });
    await expect(service.dispute(cpUser, "t1", "  ")).rejects.toBeInstanceOf(ValidationError);
  });
});
