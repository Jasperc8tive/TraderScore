import { randomBytes } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import {
  Role,
  type AssuranceLevel,
  type UUID,
  type Paginated,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@tradescore/shared";
import { slugify } from "@tradescore/core";
import type { AuditLogger } from "@tradescore/logging";
import type { EventBus } from "@tradescore/events";
import { BusinessesRepository } from "../identity/businesses.repository";
import { BusinessMembersRepository } from "../identity/business-members.repository";
import { MarketClustersRepository } from "../identity/market-clusters.repository";
import type { BusinessRecord } from "../identity/types";
import type { AuthenticatedUser } from "../common/auth/authenticated-user";
import { AUDIT_LOGGER, EVENT_BUS } from "../tokens";

export interface PublicBusiness {
  id: UUID;
  name: string;
  slug: string;
  description: string | null;
  phone: string | null;
  email: string | null;
  marketClusterId: UUID | null;
  assuranceLevel: AssuranceLevel;
  status: string;
  referralCode: string;
  verifiedAt: Date | null;
  createdAt: Date;
}

@Injectable()
export class BusinessesService {
  constructor(
    private readonly businesses: BusinessesRepository,
    private readonly members: BusinessMembersRepository,
    private readonly clusters: MarketClustersRepository,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    @Inject(AUDIT_LOGGER) private readonly audit: AuditLogger,
  ) {}

  async create(
    actor: AuthenticatedUser,
    input: {
      name: string;
      description?: string | undefined;
      phone?: string | undefined;
      email?: string | undefined;
      marketClusterId?: string | undefined;
      referralCode?: string | undefined;
    },
  ): Promise<PublicBusiness> {
    if (input.marketClusterId) {
      const cluster = await this.clusters.findById(input.marketClusterId);
      if (!cluster) throw new ValidationError("Unknown market cluster");
    }
    // Resolve the referrer from a supplied referral code (growth loop).
    let referrerBusinessId: string | undefined;
    if (input.referralCode) {
      const referrer = await this.businesses.findByReferralCode(input.referralCode.toUpperCase());
      if (!referrer) throw new ValidationError("Invalid referral code");
      referrerBusinessId = referrer.id;
    }
    const slug = await this.uniqueSlug(input.name);
    const business = await this.businesses.createWithOwner({
      name: input.name,
      slug,
      description: input.description,
      phone: input.phone,
      email: input.email,
      marketClusterId: input.marketClusterId,
      createdBy: actor.id,
      referralCode: await this.uniqueReferralCode(),
      referrerBusinessId,
    });

    await this.events.publish(
      "business.created",
      { businessId: business.id, ownerUserId: actor.id, name: business.name },
      { actorId: actor.id },
    );
    this.audit.record({
      action: "business.created",
      resourceType: "business",
      resourceId: business.id,
      outcome: "success",
    });
    return this.toPublic(business);
  }

  async getBySlug(slug: string): Promise<PublicBusiness> {
    const business = await this.businesses.findBySlug(slug);
    if (!business) throw new NotFoundError("Business");
    return this.toPublic(business);
  }

  async update(
    actor: AuthenticatedUser,
    businessId: UUID,
    input: {
      name?: string | undefined;
      description?: string | undefined;
      phone?: string | undefined;
      email?: string | undefined;
      marketClusterId?: string | undefined;
    },
  ): Promise<PublicBusiness> {
    const business = await this.businesses.findById(businessId);
    if (!business) throw new NotFoundError("Business");
    await this.assertCanManage(actor, businessId);

    if (input.marketClusterId) {
      const cluster = await this.clusters.findById(input.marketClusterId);
      if (!cluster) throw new ValidationError("Unknown market cluster");
    }

    const updated = await this.businesses.update(businessId, {
      name: input.name,
      description: input.description,
      phone: input.phone,
      email: input.email,
      marketClusterId: input.marketClusterId,
    });
    this.audit.record({
      action: "business.updated",
      resourceType: "business",
      resourceId: businessId,
      outcome: "success",
    });
    return this.toPublic(updated);
  }

  /**
   * Raise a business's assurance level. RBAC (BUSINESS_VERIFY) is enforced by the
   * guard; only MODERATOR/ADMIN reach here. This is the controlled entry point
   * for trust provenance (Trust Architecture Review §3, F1).
   */
  async verify(
    actor: AuthenticatedUser,
    businessId: UUID,
    assuranceLevel: AssuranceLevel,
  ): Promise<PublicBusiness> {
    const business = await this.businesses.findById(businessId);
    if (!business) throw new NotFoundError("Business");

    const updated = await this.businesses.verify(businessId, assuranceLevel);
    await this.events.publish(
      "business.verified",
      { businessId, assuranceLevel, verifiedByUserId: actor.id },
      { actorId: actor.id },
    );
    this.audit.record({
      action: "business.verified",
      resourceType: "business",
      resourceId: businessId,
      outcome: "success",
      metadata: { assuranceLevel },
    });
    return this.toPublic(updated);
  }

  async search(input: {
    query?: string | undefined;
    marketClusterId?: string | undefined;
    page?: number | undefined;
    pageSize?: number | undefined;
  }): Promise<Paginated<PublicBusiness>> {
    const page = input.page ?? 1;
    const pageSize = input.pageSize ?? 20;
    const { items, total } = await this.businesses.search({
      query: input.query,
      marketClusterId: input.marketClusterId,
      page,
      pageSize,
    });
    return { items: items.map((b) => this.toPublic(b)), total, page, pageSize };
  }

  /** Ownership check: ADMIN may manage any business; otherwise must be its OWNER. */
  private async assertCanManage(actor: AuthenticatedUser, businessId: UUID): Promise<void> {
    if (actor.role === Role.ADMIN) return;
    const membership = await this.members.find(businessId, actor.id);
    if (!membership || membership.memberRole !== "OWNER") {
      throw new ForbiddenError("Only the business owner can perform this action");
    }
  }

  /** Referral stats for a business (owner/admin only). */
  async getReferrals(actor: AuthenticatedUser, businessId: UUID): Promise<{
    referralCode: string;
    totalReferred: number;
    referred: Array<{ businessId: UUID; name: string; createdAt: Date }>;
  }> {
    const business = await this.businesses.findById(businessId);
    if (!business) throw new NotFoundError("Business");
    await this.assertCanManage(actor, businessId);
    return this.businesses.getReferralStats(businessId);
  }

  private async uniqueReferralCode(): Promise<string> {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const code = randomBytes(4).toString("hex").toUpperCase(); // 8 hex chars
      if (!(await this.businesses.referralCodeExists(code))) return code;
    }
    return randomBytes(6).toString("hex").toUpperCase();
  }

  private async uniqueSlug(name: string): Promise<string> {
    const base = slugify(name) || "business";
    if (!(await this.businesses.slugExists(base))) return base;
    // Append short entropy on collision. Loop guards against the rare double clash.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = `${base}-${randomBytes(2).toString("hex")}`;
      if (!(await this.businesses.slugExists(candidate))) return candidate;
    }
    return `${base}-${randomBytes(4).toString("hex")}`;
  }

  private toPublic(b: BusinessRecord): PublicBusiness {
    return {
      id: b.id,
      name: b.name,
      slug: b.slug,
      description: b.description,
      phone: b.phone,
      email: b.email,
      marketClusterId: b.marketClusterId,
      assuranceLevel: b.assuranceLevel,
      status: b.status,
      referralCode: b.referralCode,
      verifiedAt: b.verifiedAt,
      createdAt: b.createdAt,
    };
  }
}
