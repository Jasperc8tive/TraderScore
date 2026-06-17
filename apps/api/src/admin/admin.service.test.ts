import { describe, expect, it, vi } from "vitest";
import { Role, BusinessStatus, UserStatus, NotFoundError } from "@tradescore/shared";
import { AdminService } from "./admin.service";
import type { AuthenticatedUser } from "../common/auth/authenticated-user";

const admin: AuthenticatedUser = { id: "a", role: Role.ADMIN, sessionId: "s" };

function makeService(opts: { user?: unknown; business?: unknown } = {}) {
  const users = {
    findById: vi.fn(async () => opts.user ?? null),
    setStatus: vi.fn(async () => {}),
  };
  const businesses = { setStatus: vi.fn(async () => opts.business ?? null) };
  const sessions = { revokeAllForUser: vi.fn(async () => {}) };
  const audit = { record: vi.fn() };
  const service = new AdminService(
    users as never,
    businesses as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    sessions as never,
    audit as never,
  );
  return { service, users, businesses, sessions, audit };
}

describe("AdminService moderation", () => {
  it("suspends a user: sets SUSPENDED and revokes all sessions", async () => {
    const { service, users, sessions } = makeService({ user: { id: "u1" } });
    await service.suspendUser(admin, "u1", "fraud");
    expect(users.setStatus).toHaveBeenCalledWith("u1", UserStatus.SUSPENDED);
    expect(sessions.revokeAllForUser).toHaveBeenCalledWith("u1");
  });

  it("404s when suspending a missing user", async () => {
    const { service } = makeService({ user: null });
    await expect(service.suspendUser(admin, "nope")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("suspends a business by setting SUSPENDED", async () => {
    const { service, businesses } = makeService({ business: { id: "b1" } });
    await service.suspendBusiness(admin, "b1");
    expect(businesses.setStatus).toHaveBeenCalledWith("b1", BusinessStatus.SUSPENDED);
  });

  it("404s when suspending a missing business", async () => {
    const { service } = makeService({ business: null });
    await expect(service.suspendBusiness(admin, "nope")).rejects.toBeInstanceOf(NotFoundError);
  });
});
