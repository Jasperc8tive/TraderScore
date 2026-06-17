import { describe, expect, it, vi } from "vitest";
import { Role, ForbiddenError, ValidationError, BusinessMemberRole } from "@tradescore/shared";
import { MembersService } from "./members.service";
import type { AuthenticatedUser } from "../common/auth/authenticated-user";

const owner: AuthenticatedUser = { id: "u-owner", role: Role.BUSINESS_OWNER, sessionId: "s1" };
const stranger: AuthenticatedUser = { id: "u-x", role: Role.BUSINESS_OWNER, sessionId: "s2" };

function makeService(memberFind: ReturnType<typeof vi.fn>, extra?: {
  countOwners?: ReturnType<typeof vi.fn>;
}) {
  const users = {
    findOrCreateByPhone: vi.fn(async () => ({ id: "u-staff", phone: "+2348011111111", fullName: null })),
    setFullNameIfEmpty: vi.fn(async () => {}),
    findById: vi.fn(async () => ({ id: "u-staff", phone: "+2348011111111", fullName: null })),
  };
  const businesses = { findById: vi.fn(async () => ({ id: "b1" })) };
  const members = {
    find: memberFind,
    add: vi.fn(async () => ({ memberRole: BusinessMemberRole.STAFF, createdAt: new Date() })),
    listForBusiness: vi.fn(async () => []),
    countOwners: extra?.countOwners ?? vi.fn(async () => 2),
    remove: vi.fn(async () => {}),
  };
  const audit = { record: vi.fn() };
  const service = new MembersService(
    users as never,
    businesses as never,
    members as never,
    audit as never,
  );
  return { service, users, members };
}

describe("MembersService", () => {
  it("lets an owner add staff", async () => {
    // owner lookup returns OWNER; new staff is not yet a member
    const find = vi
      .fn()
      .mockResolvedValueOnce({ memberRole: BusinessMemberRole.OWNER }) // assertOwner
      .mockResolvedValueOnce(null); // existing membership check
    const { service, members } = makeService(find);
    const result = await service.addStaff(owner, "b1", { phone: "08011111111" });
    expect(members.add).toHaveBeenCalledOnce();
    expect(result.memberRole).toBe(BusinessMemberRole.STAFF);
  });

  it("forbids a non-owner from adding staff", async () => {
    const { service } = makeService(vi.fn(async () => null));
    await expect(service.addStaff(stranger, "b1", { phone: "08011111111" })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("refuses to remove the last owner", async () => {
    const find = vi
      .fn()
      .mockResolvedValueOnce({ memberRole: BusinessMemberRole.OWNER }) // assertOwner (actor)
      .mockResolvedValueOnce({ memberRole: BusinessMemberRole.OWNER }); // target membership
    const { service } = makeService(find, { countOwners: vi.fn(async () => 1) });
    await expect(service.remove(owner, "b1", "u-owner")).rejects.toBeInstanceOf(ValidationError);
  });
});
