import { Inject, Injectable } from "@nestjs/common";
import {
  BusinessStatus,
  UserStatus,
  NotFoundError,
  type UUID,
} from "@tradescore/shared";
import type { SessionStore } from "@tradescore/auth";
import type { AuditLogger } from "@tradescore/logging";
import { UsersRepository } from "../identity/users.repository";
import { BusinessesRepository } from "../identity/businesses.repository";
import { BusinessMembersRepository } from "../identity/business-members.repository";
import { MarketClustersRepository } from "../identity/market-clusters.repository";
import { DisputesRepository } from "../disputes/disputes.repository";
import { ReputationService } from "../reputation/reputation.service";
import { AdminRepository } from "./admin.repository";
import type { AuthenticatedUser } from "../common/auth/authenticated-user";
import { AUDIT_LOGGER, SESSION_STORE } from "../tokens";

@Injectable()
export class AdminService {
  constructor(
    private readonly users: UsersRepository,
    private readonly businesses: BusinessesRepository,
    private readonly members: BusinessMembersRepository,
    private readonly clusters: MarketClustersRepository,
    private readonly disputes: DisputesRepository,
    private readonly reputation: ReputationService,
    private readonly admin: AdminRepository,
    @Inject(SESSION_STORE) private readonly sessions: SessionStore,
    @Inject(AUDIT_LOGGER) private readonly audit: AuditLogger,
  ) {}

  // --- Moderation ----------------------------------------------------------

  async suspendBusiness(_actor: AuthenticatedUser, id: UUID, reason?: string): Promise<void> {
    const updated = await this.businesses.setStatus(id, BusinessStatus.SUSPENDED);
    if (!updated) throw new NotFoundError("Business");
    this.audit.record({
      action: "admin.business.suspended",
      resourceType: "business",
      resourceId: id,
      outcome: "success",
      metadata: reason ? { reason } : {},
    });
  }

  async reactivateBusiness(_actor: AuthenticatedUser, id: UUID): Promise<void> {
    const updated = await this.businesses.setStatus(id, BusinessStatus.ACTIVE);
    if (!updated) throw new NotFoundError("Business");
    this.audit.record({
      action: "admin.business.reactivated",
      resourceType: "business",
      resourceId: id,
      outcome: "success",
    });
  }

  async suspendUser(_actor: AuthenticatedUser, id: UUID, reason?: string): Promise<void> {
    const user = await this.users.findById(id);
    if (!user) throw new NotFoundError("User");
    await this.users.setStatus(id, UserStatus.SUSPENDED);
    // Immediate lockout: revoke all sessions (TAR F8).
    await this.sessions.revokeAllForUser(id);
    this.audit.record({
      action: "admin.user.suspended",
      resourceType: "user",
      resourceId: id,
      outcome: "success",
      metadata: reason ? { reason } : {},
    });
  }

  async reactivateUser(_actor: AuthenticatedUser, id: UUID): Promise<void> {
    const user = await this.users.findById(id);
    if (!user) throw new NotFoundError("User");
    await this.users.setStatus(id, UserStatus.ACTIVE);
    this.audit.record({
      action: "admin.user.reactivated",
      resourceType: "user",
      resourceId: id,
      outcome: "success",
    });
  }

  // --- Business review -----------------------------------------------------

  async businessReview(id: UUID): Promise<Record<string, unknown>> {
    const business = await this.businesses.findById(id);
    if (!business) throw new NotFoundError("Business");
    const [members, tradeCounts, disputeCount, score] = await Promise.all([
      this.members.listForBusiness(id),
      this.admin.tradeCountsForBusiness(id),
      this.admin.disputeCountForBusiness(id),
      this.reputation.getScore(id),
    ]);
    return {
      business: {
        id: business.id,
        name: business.name,
        slug: business.slug,
        status: business.status,
        assuranceLevel: business.assuranceLevel,
        createdBy: business.createdBy,
        createdAt: business.createdAt,
      },
      members: members.map((m) => ({
        userId: m.userId,
        phone: m.userPhone,
        fullName: m.userFullName,
        memberRole: m.memberRole,
      })),
      tradeCounts,
      disputeCount,
      score: { score: score.score, band: score.band, computedAt: score.computedAt },
    };
  }

  // --- Fraud dashboard -----------------------------------------------------

  async fraudOverview(): Promise<Record<string, unknown>> {
    const [risk, sybil] = await Promise.all([
      this.admin.riskSignals(),
      this.admin.sybilSignals(),
    ]);
    return { riskSignals: risk, sybilSignals: sybil };
  }

  disputeQueue(status?: string): ReturnType<DisputesRepository["listByStatus"]> {
    return this.disputes.listByStatus(status);
  }

  // --- Market management ---------------------------------------------------

  listMarkets(): ReturnType<MarketClustersRepository["list"]> {
    return this.clusters.list();
  }

  async updateMarket(
    _actor: AuthenticatedUser,
    id: UUID,
    fields: { name?: string; city?: string; state?: string; description?: string },
  ): Promise<unknown> {
    const updated = await this.clusters.update(id, fields);
    if (!updated) throw new NotFoundError("Market cluster");
    this.audit.record({
      action: "admin.market.updated",
      resourceType: "market_cluster",
      resourceId: id,
      outcome: "success",
    });
    return updated;
  }

  // --- Score monitoring ----------------------------------------------------

  async scoreOverview(): Promise<Record<string, unknown>> {
    const [distribution, recent] = await Promise.all([
      this.admin.bandDistribution(),
      this.admin.recentSnapshots(),
    ]);
    return { distribution, recent };
  }
}
