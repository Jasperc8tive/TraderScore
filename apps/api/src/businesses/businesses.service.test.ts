import { describe, expect, it, vi } from "vitest";
import { Role, ForbiddenError } from "@tradescore/shared";
import { BusinessesService } from "./businesses.service";
import type { AuthenticatedUser } from "../common/auth/authenticated-user";

const owner: AuthenticatedUser = { id: "u-owner", role: Role.BUSINESS_OWNER, sessionId: "s1" };
const stranger: AuthenticatedUser = { id: "u-stranger", role: Role.BUSINESS_OWNER, sessionId: "s2" };

function makeService(overrides: {
  members?: Partial<{ find: ReturnType<typeof vi.fn> }>;
  businesses?: Partial<Record<string, ReturnType<typeof vi.fn>>>;
}) {
  const businesses = {
    findById: vi.fn(async () => ({ id: "b1", name: "Acme", slug: "acme" })),
    slugExists: vi.fn(async () => false),
    referralCodeExists: vi.fn(async () => false),
    findByReferralCode: vi.fn(async () => null),
    createWithOwner: vi.fn(async () => ({ id: "b1", name: "Acme", slug: "acme", assuranceLevel: "UNVERIFIED" })),
    update: vi.fn(async () => ({ id: "b1", name: "Acme2", slug: "acme" })),
    search: vi.fn(async () => ({ items: [], total: 0 })),
    ...overrides.businesses,
  };
  const members = { find: vi.fn(async () => null), ...overrides.members };
  const clusters = { findById: vi.fn(async () => ({ id: "c1" })) };
  const events = { publish: vi.fn(async () => {}) };
  const audit = { record: vi.fn() };
  const service = new BusinessesService(
    businesses as never,
    members as never,
    clusters as never,
    events as never,
    audit as never,
  );
  return { service, businesses, members, events, audit };
}

describe("BusinessesService", () => {
  it("creates a business, makes the actor owner, and emits business.created", async () => {
    const { service, businesses, events } = makeService({});
    const result = await service.create(owner, { name: "Acme" });
    expect(businesses.createWithOwner).toHaveBeenCalledOnce();
    expect(events.publish).toHaveBeenCalledWith(
      "business.created",
      expect.objectContaining({ ownerUserId: "u-owner" }),
      expect.anything(),
    );
    expect(result.assuranceLevel).toBe("UNVERIFIED");
  });

  it("forbids a non-owner from updating a business", async () => {
    const { service } = makeService({ members: { find: vi.fn(async () => null) } });
    await expect(service.update(stranger, "b1", { name: "Hacked" })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("allows the owner to update", async () => {
    const { service } = makeService({
      members: { find: vi.fn(async () => ({ memberRole: "OWNER" })) },
    });
    const updated = await service.update(owner, "b1", { name: "Acme2" });
    expect(updated.name).toBe("Acme2");
  });

  it("applies search pagination defaults", async () => {
    const { service, businesses } = makeService({});
    const page = await service.search({});
    expect(page.page).toBe(1);
    expect(page.pageSize).toBe(20);
    expect(businesses.search).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, pageSize: 20 }),
    );
  });
});
