import { Inject, Injectable } from "@nestjs/common";
import {
  Role,
  TradeStatus,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,
  type UUID,
  type Paginated,
} from "@tradescore/shared";
import type { AuditLogger } from "@tradescore/logging";
import type { EventBus } from "@tradescore/events";
import { TradesRepository } from "../trades/trades.repository";
import { BusinessMembersRepository } from "../identity/business-members.repository";
import { ConfirmationsRepository } from "./confirmations.repository";
import { isConfirmable, type ConfirmationDecision } from "../trades/trade-status";
import type { TradeRecord } from "../trades/types";
import type { PublicTrade } from "../trades/trades.service";
import type { AuthenticatedUser } from "../common/auth/authenticated-user";
import { AUDIT_LOGGER, EVENT_BUS } from "../tokens";

@Injectable()
export class ConfirmationsService {
  constructor(
    private readonly trades: TradesRepository,
    private readonly members: BusinessMembersRepository,
    private readonly confirmations: ConfirmationsRepository,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    @Inject(AUDIT_LOGGER) private readonly audit: AuditLogger,
  ) {}

  async confirm(actor: AuthenticatedUser, tradeId: UUID, note?: string): Promise<PublicTrade> {
    return this.decide(actor, tradeId, TradeStatus.CONFIRMED, note);
  }

  async reject(actor: AuthenticatedUser, tradeId: UUID, note?: string): Promise<PublicTrade> {
    return this.decide(actor, tradeId, TradeStatus.REJECTED, note);
  }

  async dispute(actor: AuthenticatedUser, tradeId: UUID, reason: string): Promise<PublicTrade> {
    return this.decide(actor, tradeId, TradeStatus.DISPUTED, reason);
  }

  /** Trades awaiting this business's decision (the counterparty inbox). */
  async listIncoming(
    actor: AuthenticatedUser,
    businessId: UUID,
    page = 1,
    pageSize = 20,
  ): Promise<Paginated<PublicTrade>> {
    if (actor.role !== Role.ADMIN) {
      const membership = await this.members.find(businessId, actor.id);
      if (!membership) throw new ForbiddenError("You are not a member of this business");
    }
    const { items, total } = await this.confirmations.listIncoming(businessId, page, pageSize);
    return { items: items.map((t) => this.toPublic(t)), total, page, pageSize };
  }

  private async decide(
    actor: AuthenticatedUser,
    tradeId: UUID,
    decision: ConfirmationDecision,
    note?: string,
  ): Promise<PublicTrade> {
    const trade = await this.loadTrade(tradeId);
    if (!isConfirmable(trade.status)) {
      throw new ConflictError(
        `A trade in status ${trade.status} can no longer be confirmed, rejected, or disputed`,
      );
    }
    if (decision === TradeStatus.DISPUTED && (!note || note.trim().length === 0)) {
      throw new ValidationError("A reason is required to dispute a trade");
    }
    const counterpartyBusinessId = await this.assertCounterpartyActor(actor, trade);

    const updated = await this.confirmations.decide({
      tradeId,
      counterpartyBusinessId,
      decision,
      decidedBy: actor.id,
      note,
    });

    await this.emit(decision, updated, actor.id);
    this.audit.record({
      action: `trade.${decision.toLowerCase()}`,
      resourceType: "trade",
      resourceId: tradeId,
      outcome: "success",
    });
    return this.toPublic(updated);
  }

  /**
   * The integrity rule (TAR §3, F3): the decision MUST come from the counterparty,
   * and the initiating side can NEVER decide its own trade — including the case
   * where one user is a member of both businesses. No ADMIN bypass.
   */
  private async assertCounterpartyActor(
    actor: AuthenticatedUser,
    trade: TradeRecord,
  ): Promise<UUID> {
    if (!trade.counterpartyBusinessId) {
      throw new ValidationError("This trade has no registered counterparty to confirm it");
    }
    const counterpartyMembership = await this.members.find(trade.counterpartyBusinessId, actor.id);
    if (!counterpartyMembership) {
      throw new ForbiddenError("Only a member of the counterparty business can decide this trade");
    }
    const initiatorMembership = await this.members.find(trade.initiatorBusinessId, actor.id);
    if (initiatorMembership) {
      throw new ForbiddenError("The initiating party cannot confirm its own trade");
    }
    return trade.counterpartyBusinessId;
  }

  private async emit(
    decision: ConfirmationDecision,
    trade: TradeRecord,
    decidedByUserId: UUID,
  ): Promise<void> {
    const counterpartyBusinessId = trade.counterpartyBusinessId as UUID;
    if (decision === TradeStatus.CONFIRMED) {
      await this.events.publish(
        "trade.confirmed",
        {
          tradeId: trade.id,
          initiatorBusinessId: trade.initiatorBusinessId,
          counterpartyBusinessId,
          amountMinor: trade.amountMinor,
          currency: trade.currency,
          decidedByUserId,
        },
        { actorId: decidedByUserId },
      );
    } else if (decision === TradeStatus.REJECTED) {
      await this.events.publish(
        "trade.rejected",
        { tradeId: trade.id, initiatorBusinessId: trade.initiatorBusinessId, counterpartyBusinessId, decidedByUserId },
        { actorId: decidedByUserId },
      );
    } else {
      await this.events.publish(
        "trade.disputed",
        { tradeId: trade.id, initiatorBusinessId: trade.initiatorBusinessId, counterpartyBusinessId, decidedByUserId },
        { actorId: decidedByUserId },
      );
    }
  }

  private async loadTrade(tradeId: UUID): Promise<TradeRecord> {
    const trade = await this.trades.findById(tradeId);
    if (!trade) throw new NotFoundError("Trade");
    return trade;
  }

  private toPublic(t: TradeRecord): PublicTrade {
    return {
      id: t.id,
      referenceCode: t.referenceCode,
      initiatorBusinessId: t.initiatorBusinessId,
      counterpartyBusinessId: t.counterpartyBusinessId,
      counterpartyName: t.counterpartyName,
      direction: t.direction,
      amountMinor: t.amountMinor,
      currency: t.currency,
      description: t.description,
      occurredOn: t.occurredOn,
      status: t.status,
      createdAt: t.createdAt,
    };
  }
}
