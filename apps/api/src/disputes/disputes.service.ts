import { Inject, Injectable } from "@nestjs/common";
import {
  Role,
  TradeStatus,
  DisputeResolution,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  type UUID,
} from "@tradescore/shared";
import { can, Permission } from "@tradescore/auth";
import type { AuditLogger } from "@tradescore/logging";
import type { EventBus } from "@tradescore/events";
import { TradesRepository } from "../trades/trades.repository";
import { BusinessMembersRepository } from "../identity/business-members.repository";
import { DisputesRepository } from "./disputes.repository";
import { canResolve, canWithdraw, canReview, canAddEvidence } from "./dispute-status";
import type { TradeRecord } from "../trades/types";
import type { DisputeRecord, DisputeEvidenceRecord } from "./types";
import type { AuthenticatedUser } from "../common/auth/authenticated-user";
import { AUDIT_LOGGER, EVENT_BUS } from "../tokens";

export interface DisputeDetail extends DisputeRecord {
  evidence: DisputeEvidenceRecord[];
}

@Injectable()
export class DisputesService {
  constructor(
    private readonly trades: TradesRepository,
    private readonly members: BusinessMembersRepository,
    private readonly disputes: DisputesRepository,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    @Inject(AUDIT_LOGGER) private readonly audit: AuditLogger,
  ) {}

  /** A party raises a formal dispute, freezing the trade's trust. */
  async raise(actor: AuthenticatedUser, tradeId: UUID, reason: string): Promise<DisputeRecord> {
    const trade = await this.loadTrade(tradeId);
    if (trade.status !== TradeStatus.CONFIRMED && trade.status !== TradeStatus.DISPUTED) {
      throw new ConflictError(`A trade in status ${trade.status} cannot be disputed`);
    }
    const raisedByBusinessId = await this.assertParty(actor, trade);
    const active = await this.disputes.findActiveByTrade(tradeId);
    if (active) throw new ConflictError("This trade already has an active dispute");

    const dispute = await this.disputes.open({
      tradeId,
      raisedByBusinessId,
      raisedByUserId: actor.id,
      reason,
      tradeStatusBefore: trade.status,
      newTradeStatus: TradeStatus.DISPUTED,
    });

    await this.events.publish(
      "dispute.opened",
      { disputeId: dispute.id, tradeId, raisedByBusinessId },
      { actorId: actor.id },
    );
    if (trade.status === TradeStatus.CONFIRMED) {
      // Trust was frozen — tell the reputation engine to recompute.
      await this.emitTradeStatus(trade, TradeStatus.DISPUTED, actor.id);
    }
    this.audit.record({ action: "dispute.opened", resourceType: "dispute", resourceId: dispute.id, outcome: "success" });
    return dispute;
  }

  async addEvidence(
    actor: AuthenticatedUser,
    disputeId: UUID,
    body: string,
    attachmentUrl: string | undefined,
  ): Promise<DisputeEvidenceRecord> {
    const dispute = await this.loadDispute(disputeId);
    if (!canAddEvidence(dispute.status)) {
      throw new ConflictError("Evidence can only be added to an active dispute");
    }
    const trade = await this.loadTrade(dispute.tradeId);
    const businessId = await this.assertParty(actor, trade);
    const evidence = await this.disputes.addEvidence({
      disputeId,
      submittedByUserId: actor.id,
      submittedByBusinessId: businessId,
      body,
      attachmentUrl,
    });
    this.audit.record({ action: "dispute.evidence.added", resourceType: "dispute", resourceId: disputeId, outcome: "success" });
    return evidence;
  }

  /** The raising business withdraws its dispute; the trade's prior status is restored. */
  async withdraw(actor: AuthenticatedUser, disputeId: UUID): Promise<DisputeRecord> {
    const dispute = await this.loadDispute(disputeId);
    if (!canWithdraw(dispute.status)) throw new ConflictError("This dispute cannot be withdrawn");
    const membership =
      actor.role === Role.ADMIN ? true : await this.members.find(dispute.raisedByBusinessId, actor.id);
    if (!membership) throw new ForbiddenError("Only the business that raised the dispute can withdraw it");

    const trade = await this.loadTrade(dispute.tradeId);
    const { dispute: updated, trade: restored } = await this.disputes.withdraw({
      disputeId,
      reviewerUserId: actor.id,
      tradeId: dispute.tradeId,
      fromStatus: trade.status,
      restoreStatus: dispute.tradeStatusBefore,
    });
    if (restored.status !== trade.status) {
      await this.emitTradeStatus(restored, restored.status, actor.id);
    }
    this.audit.record({ action: "dispute.withdrawn", resourceType: "dispute", resourceId: disputeId, outcome: "success" });
    return updated;
  }

  /** Moderator/admin claims a dispute for review. */
  async review(actor: AuthenticatedUser, disputeId: UUID): Promise<DisputeRecord> {
    this.assertCanAdjudicate(actor);
    const dispute = await this.loadDispute(disputeId);
    if (!canReview(dispute.status)) throw new ConflictError("Only an open dispute can be put under review");
    const updated = await this.disputes.markUnderReview(disputeId, actor.id);
    this.audit.record({ action: "dispute.review", resourceType: "dispute", resourceId: disputeId, outcome: "success" });
    return updated;
  }

  /** Moderator/admin resolves a dispute, driving the trade to its final status. */
  async resolve(
    actor: AuthenticatedUser,
    disputeId: UUID,
    resolution: DisputeResolution,
    note: string | undefined,
  ): Promise<DisputeRecord> {
    this.assertCanAdjudicate(actor);
    const dispute = await this.loadDispute(disputeId);
    if (!canResolve(dispute.status)) throw new ConflictError("This dispute has already been resolved");
    const trade = await this.loadTrade(dispute.tradeId);

    const newTradeStatus =
      resolution === DisputeResolution.UPHELD ? TradeStatus.REJECTED : TradeStatus.CONFIRMED;

    const { dispute: updated, trade: finalTrade } = await this.disputes.resolve({
      disputeId,
      resolution,
      note,
      reviewerUserId: actor.id,
      tradeId: dispute.tradeId,
      fromStatus: trade.status,
      newTradeStatus,
    });

    await this.events.publish(
      "dispute.resolved",
      { disputeId, tradeId: dispute.tradeId, resolution, reviewedByUserId: actor.id },
      { actorId: actor.id },
    );
    await this.emitTradeStatus(finalTrade, newTradeStatus, actor.id);
    this.audit.record({
      action: "dispute.resolved",
      resourceType: "dispute",
      resourceId: disputeId,
      outcome: "success",
      metadata: { resolution },
    });
    return updated;
  }

  async get(actor: AuthenticatedUser, disputeId: UUID): Promise<DisputeDetail> {
    const dispute = await this.loadDispute(disputeId);
    const trade = await this.loadTrade(dispute.tradeId);
    await this.assertCanView(actor, trade);
    const evidence = await this.disputes.getEvidence(disputeId);
    return { ...dispute, evidence };
  }

  async listForBusiness(actor: AuthenticatedUser, businessId: UUID): Promise<DisputeRecord[]> {
    if (actor.role !== Role.ADMIN && !can(actor.role, Permission.DISPUTE_RESOLVE)) {
      const membership = await this.members.find(businessId, actor.id);
      if (!membership) throw new ForbiddenError("You are not a member of this business");
    }
    return this.disputes.listForBusiness(businessId);
  }

  // --- helpers -------------------------------------------------------------

  private assertCanAdjudicate(actor: AuthenticatedUser): void {
    if (!can(actor.role, Permission.DISPUTE_RESOLVE)) {
      throw new ForbiddenError("Only a moderator or administrator can adjudicate disputes");
    }
  }

  /** Actor must be a member of one of the trade's parties; returns that business id. */
  private async assertParty(actor: AuthenticatedUser, trade: TradeRecord): Promise<UUID> {
    const initiator = await this.members.find(trade.initiatorBusinessId, actor.id);
    if (initiator) return trade.initiatorBusinessId;
    if (trade.counterpartyBusinessId) {
      const counterparty = await this.members.find(trade.counterpartyBusinessId, actor.id);
      if (counterparty) return trade.counterpartyBusinessId;
    }
    throw new ForbiddenError("You are not a party to this trade");
  }

  private async assertCanView(actor: AuthenticatedUser, trade: TradeRecord): Promise<void> {
    if (actor.role === Role.ADMIN || can(actor.role, Permission.DISPUTE_RESOLVE)) return;
    await this.assertParty(actor, trade);
  }

  private async emitTradeStatus(trade: TradeRecord, status: TradeStatus, actorId: UUID): Promise<void> {
    const counterpartyBusinessId = trade.counterpartyBusinessId as UUID;
    const base = { tradeId: trade.id, initiatorBusinessId: trade.initiatorBusinessId, counterpartyBusinessId };
    if (status === TradeStatus.CONFIRMED) {
      await this.events.publish(
        "trade.confirmed",
        { ...base, amountMinor: trade.amountMinor, currency: trade.currency, decidedByUserId: actorId },
        { actorId },
      );
    } else if (status === TradeStatus.REJECTED) {
      await this.events.publish("trade.rejected", { ...base, decidedByUserId: actorId }, { actorId });
    } else if (status === TradeStatus.DISPUTED) {
      await this.events.publish("trade.disputed", { ...base, decidedByUserId: actorId }, { actorId });
    }
  }

  private async loadTrade(tradeId: UUID): Promise<TradeRecord> {
    const trade = await this.trades.findById(tradeId);
    if (!trade) throw new NotFoundError("Trade");
    return trade;
  }

  private async loadDispute(disputeId: UUID): Promise<DisputeRecord> {
    const dispute = await this.disputes.findById(disputeId);
    if (!dispute) throw new NotFoundError("Dispute");
    return dispute;
  }
}
