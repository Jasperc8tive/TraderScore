import { Inject, Injectable } from "@nestjs/common";
import {
  Role,
  BusinessMemberRole,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,
  type UUID,
} from "@tradescore/shared";
import { normalizePhone } from "@tradescore/core";
import type { AuditLogger } from "@tradescore/logging";
import { UsersRepository } from "../identity/users.repository";
import { BusinessesRepository } from "../identity/businesses.repository";
import { BusinessMembersRepository } from "../identity/business-members.repository";
import type { AuthenticatedUser } from "../common/auth/authenticated-user";
import { AUDIT_LOGGER } from "../tokens";

export interface MemberView {
  userId: UUID;
  phone: string;
  fullName: string | null;
  memberRole: BusinessMemberRole;
  createdAt: Date;
}

@Injectable()
export class MembersService {
  constructor(
    private readonly users: UsersRepository,
    private readonly businesses: BusinessesRepository,
    private readonly members: BusinessMembersRepository,
    @Inject(AUDIT_LOGGER) private readonly audit: AuditLogger,
  ) {}

  /** Add a STAFF member by phone (creating the user if necessary). Owner-only. */
  async addStaff(
    actor: AuthenticatedUser,
    businessId: UUID,
    input: { phone: string; fullName?: string | undefined },
  ): Promise<MemberView> {
    await this.assertBusinessExists(businessId);
    await this.assertOwner(actor, businessId);

    const phone = this.normalize(input.phone);
    const user = await this.users.findOrCreateByPhone(phone, Role.BUSINESS_STAFF);
    if (input.fullName) await this.users.setFullNameIfEmpty(user.id, input.fullName);

    const existing = await this.members.find(businessId, user.id);
    if (existing) throw new ConflictError("User is already a member of this business");

    const member = await this.members.add(
      businessId,
      user.id,
      BusinessMemberRole.STAFF,
      actor.id,
    );
    this.audit.record({
      action: "business.member.added",
      resourceType: "business",
      resourceId: businessId,
      outcome: "success",
      metadata: { userId: user.id, memberRole: BusinessMemberRole.STAFF },
    });
    const refreshed = await this.users.findById(user.id);
    return {
      userId: user.id,
      phone: user.phone,
      fullName: refreshed?.fullName ?? null,
      memberRole: member.memberRole,
      createdAt: member.createdAt,
    };
  }

  /** List members. Visible to any member of the business, or an admin. */
  async list(actor: AuthenticatedUser, businessId: UUID): Promise<MemberView[]> {
    await this.assertBusinessExists(businessId);
    await this.assertMemberOrAdmin(actor, businessId);
    const rows = await this.members.listForBusiness(businessId);
    return rows.map((m) => ({
      userId: m.userId,
      phone: m.userPhone,
      fullName: m.userFullName,
      memberRole: m.memberRole,
      createdAt: m.createdAt,
    }));
  }

  /** Remove a member. Owner-only; cannot remove the last owner. */
  async remove(actor: AuthenticatedUser, businessId: UUID, userId: UUID): Promise<void> {
    await this.assertBusinessExists(businessId);
    await this.assertOwner(actor, businessId);

    const membership = await this.members.find(businessId, userId);
    if (!membership) throw new NotFoundError("Member");
    if (membership.memberRole === BusinessMemberRole.OWNER) {
      const owners = await this.members.countOwners(businessId);
      if (owners <= 1) {
        throw new ValidationError("Cannot remove the last owner of a business");
      }
    }
    await this.members.remove(businessId, userId);
    this.audit.record({
      action: "business.member.removed",
      resourceType: "business",
      resourceId: businessId,
      outcome: "success",
      metadata: { userId },
    });
  }

  private async assertBusinessExists(businessId: UUID): Promise<void> {
    const business = await this.businesses.findById(businessId);
    if (!business) throw new NotFoundError("Business");
  }

  private async assertOwner(actor: AuthenticatedUser, businessId: UUID): Promise<void> {
    if (actor.role === Role.ADMIN) return;
    const membership = await this.members.find(businessId, actor.id);
    if (!membership || membership.memberRole !== BusinessMemberRole.OWNER) {
      throw new ForbiddenError("Only the business owner can manage members");
    }
  }

  private async assertMemberOrAdmin(actor: AuthenticatedUser, businessId: UUID): Promise<void> {
    if (actor.role === Role.ADMIN) return;
    const membership = await this.members.find(businessId, actor.id);
    if (!membership) throw new ForbiddenError("You are not a member of this business");
  }

  private normalize(rawPhone: string): string {
    const result = normalizePhone(rawPhone);
    if (!result.ok) throw new ValidationError("Invalid phone number");
    return result.value;
  }
}
