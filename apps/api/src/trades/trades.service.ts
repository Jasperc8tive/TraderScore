import { randomBytes } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import {
  Role,
  TradeStatus,
  TradeDirection,
  ValidationError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
  type UUID,
  type Paginated,
} from "@tradescore/shared";
import { Money } from "@tradescore/core";
import type { AuditLogger } from "@tradescore/logging";
import type { EventBus } from "@tradescore/events";
import { TradesRepository } from "./trades.repository";
import { BusinessesRepository } from "../identity/businesses.repository";
import { BusinessMembersRepository } from "../identity/business-members.repository";
import type { TradeRecord, TradeEventRecord } from "./types";
import { canTransition, isEditable, isCancellable } from "./trade-status";
import type { AuthenticatedUser } from "../common/auth/authenticated-user";
import { AUDIT_LOGGER, EVENT_BUS } from "../tokens";

export interface PublicTrade {
  id: UUID;
  referenceCode: string;
  initiatorBusinessId: UUID;
  counterpartyBusinessId: UUID | null;
  counterpartyName: string | null;
  direction: TradeDirection;
  amountMinor: number;
  currency: string;
  description: string | null;
  occurredOn: string;
  status: TradeStatus;
  createdAt: Date;
}

export interface CreateTradeData {
  initiatorBusinessId: UUID;
  counterpartyBusinessId?: string | undefined;
  counterpartyName?: string | undefined;
  counterpartyPhone?: string | undefined;
  direction: TradeDirection;
  amountMinor: number;
  currency?: string | undefined;
  description?: string | undefined;
  occurredOn: string;
}

export interface EditTradeData {
  counterpartyBusinessId?: string | undefined;
  counterpartyName?: string | undefined;
  counterpartyPhone?: string | undefined;
  direction?: TradeDirection | undefined;
  amountMinor?: number | undefined;
  currency?: string | undefined;
  description?: string | undefined;
  occurredOn?: string | undefined;
}

@Injectable()
export class TradesService {
  constructor(
    private readonly trades: TradesRepository,
    private readonly businesses: BusinessesRepository,
    private readonly members: BusinessMembersRepository,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    @Inject(AUDIT_LOGGER) private readonly audit: AuditLogger,
  ) {}

  async create(actor: AuthenticatedUser, data: CreateTradeData): Promise<PublicTrade> {
    await this.assertCanOperate(actor, data.initiatorBusinessId);
    const currency = data.currency ?? "NGN";
    this.assertValidMoney(data.amountMinor, currency);
    this.assertNotFuture(data.occurredOn);
    await this.validateCounterparty(data.initiatorBusinessId, data.counterpartyBusinessId);

    const trade = await this.trades.createWithEvent({
      referenceCode: this.generateReference(),
      initiatorBusinessId: data.initiatorBusinessId,
      counterpartyBusinessId: data.counterpartyBusinessId,
      counterpartyName: data.counterpartyName,
      counterpartyPhone: data.counterpartyPhone,
      direction: data.direction,
      amountMinor: data.amountMinor,
      currency,
      description: data.description,
      occurredOn: data.occurredOn,
      createdBy: actor.id,
    });

    await this.events.publish(
      "trade.logged",
      {
        tradeId: trade.id,
        initiatorBusinessId: trade.initiatorBusinessId,
        counterpartyBusinessId: trade.counterpartyBusinessId,
        amountMinor: trade.amountMinor,
        currency: trade.currency,
      },
      { actorId: actor.id },
    );
    this.audit.record({
      action: "trade.logged",
      resourceType: "trade",
      resourceId: trade.id,
      outcome: "success",
    });
    return this.toPublic(trade);
  }

  async get(actor: AuthenticatedUser, tradeId: UUID): Promise<PublicTrade> {
    const trade = await this.loadTrade(tradeId);
    await this.assertCanView(actor, trade);
    return this.toPublic(trade);
  }

  async list(
    actor: AuthenticatedUser,
    businessId: UUID,
    status: TradeStatus | undefined,
    page = 1,
    pageSize = 20,
  ): Promise<Paginated<PublicTrade>> {
    await this.assertCanOperate(actor, businessId);
    const { items, total } = await this.trades.list({
      initiatorBusinessId: businessId,
      status,
      page,
      pageSize,
    });
    return { items: items.map((t) => this.toPublic(t)), total, page, pageSize };
  }

  async history(actor: AuthenticatedUser, tradeId: UUID): Promise<TradeEventRecord[]> {
    const trade = await this.loadTrade(tradeId);
    await this.assertCanView(actor, trade);
    return this.trades.listEvents(tradeId);
  }

  async edit(actor: AuthenticatedUser, tradeId: UUID, data: EditTradeData): Promise<PublicTrade> {
    const trade = await this.loadTrade(tradeId);
    await this.assertCanOperate(actor, trade.initiatorBusinessId);
    if (!isEditable(trade.status)) {
      throw new ConflictError(`A trade in status ${trade.status} can no longer be edited`);
    }
    if (data.amountMinor !== undefined) {
      this.assertValidMoney(data.amountMinor, data.currency ?? trade.currency);
    }
    if (data.occurredOn !== undefined) this.assertNotFuture(data.occurredOn);
    if (data.counterpartyBusinessId !== undefined) {
      await this.validateCounterparty(trade.initiatorBusinessId, data.counterpartyBusinessId);
    }

    const updated = await this.trades.updateWithEvent(
      tradeId,
      {
        counterpartyBusinessId: data.counterpartyBusinessId,
        counterpartyName: data.counterpartyName,
        counterpartyPhone: data.counterpartyPhone,
        direction: data.direction,
        amountMinor: data.amountMinor,
        currency: data.currency,
        description: data.description,
        occurredOn: data.occurredOn,
      },
      {
        eventType: "EDITED",
        fromStatus: trade.status,
        toStatus: trade.status,
        actorUserId: actor.id,
        metadata: { changed: Object.keys(data).filter((k) => (data as Record<string, unknown>)[k] !== undefined) },
      },
    );
    this.audit.record({
      action: "trade.edited",
      resourceType: "trade",
      resourceId: tradeId,
      outcome: "success",
    });
    return this.toPublic(updated);
  }

  async submit(actor: AuthenticatedUser, tradeId: UUID): Promise<PublicTrade> {
    const trade = await this.loadTrade(tradeId);
    await this.assertCanOperate(actor, trade.initiatorBusinessId);
    if (!canTransition(trade.status, TradeStatus.PENDING_CONFIRMATION)) {
      throw new ConflictError(`A trade in status ${trade.status} cannot be submitted`);
    }
    if (!trade.counterpartyBusinessId) {
      throw new ValidationError(
        "A registered counterparty business is required before submitting for confirmation",
      );
    }
    const updated = await this.trades.transitionWithEvent(tradeId, TradeStatus.PENDING_CONFIRMATION, {
      eventType: "SUBMITTED",
      fromStatus: trade.status,
      toStatus: TradeStatus.PENDING_CONFIRMATION,
      actorUserId: actor.id,
    });
    await this.events.publish(
      "trade.submitted",
      {
        tradeId,
        initiatorBusinessId: trade.initiatorBusinessId,
        counterpartyBusinessId: trade.counterpartyBusinessId,
      },
      { actorId: actor.id },
    );
    this.audit.record({
      action: "trade.submitted",
      resourceType: "trade",
      resourceId: tradeId,
      outcome: "success",
    });
    return this.toPublic(updated);
  }

  async cancel(actor: AuthenticatedUser, tradeId: UUID, reason?: string): Promise<PublicTrade> {
    const trade = await this.loadTrade(tradeId);
    await this.assertCanOperate(actor, trade.initiatorBusinessId);
    if (!isCancellable(trade.status)) {
      throw new ConflictError(`A trade in status ${trade.status} cannot be cancelled`);
    }
    const updated = await this.trades.transitionWithEvent(tradeId, TradeStatus.CANCELLED, {
      eventType: "CANCELLED",
      fromStatus: trade.status,
      toStatus: TradeStatus.CANCELLED,
      actorUserId: actor.id,
      ...(reason !== undefined ? { reason } : {}),
    });
    await this.events.publish(
      "trade.cancelled",
      { tradeId, initiatorBusinessId: trade.initiatorBusinessId },
      { actorId: actor.id },
    );
    this.audit.record({
      action: "trade.cancelled",
      resourceType: "trade",
      resourceId: tradeId,
      outcome: "success",
    });
    return this.toPublic(updated);
  }

  // --- helpers -------------------------------------------------------------

  private async loadTrade(tradeId: UUID): Promise<TradeRecord> {
    const trade = await this.trades.findById(tradeId);
    if (!trade) throw new NotFoundError("Trade");
    return trade;
  }

  /**
   * Read access: members of EITHER the initiator or the counterparty business may
   * view a trade (the counterparty must be able to review what it's confirming);
   * ADMIN may view any. Distinct from `assertCanOperate`, which is initiator-only.
   */
  private async assertCanView(actor: AuthenticatedUser, trade: TradeRecord): Promise<void> {
    if (actor.role === Role.ADMIN) return;
    const initiatorMembership = await this.members.find(trade.initiatorBusinessId, actor.id);
    if (initiatorMembership) return;
    if (trade.counterpartyBusinessId) {
      const counterpartyMembership = await this.members.find(trade.counterpartyBusinessId, actor.id);
      if (counterpartyMembership) return;
    }
    throw new ForbiddenError("You do not have access to this trade");
  }

  /** Any member (OWNER or STAFF) of the initiator may operate its trades; ADMIN bypasses. */
  private async assertCanOperate(actor: AuthenticatedUser, businessId: UUID): Promise<void> {
    if (actor.role === Role.ADMIN) return;
    const business = await this.businesses.findById(businessId);
    if (!business) throw new NotFoundError("Business");
    const membership = await this.members.find(businessId, actor.id);
    if (!membership) {
      throw new ForbiddenError("You are not a member of this business");
    }
  }

  private async validateCounterparty(
    initiatorBusinessId: UUID,
    counterpartyBusinessId?: string | undefined,
  ): Promise<void> {
    if (!counterpartyBusinessId) return;
    if (counterpartyBusinessId === initiatorBusinessId) {
      throw new ValidationError("A business cannot trade with itself");
    }
    const counterparty = await this.businesses.findById(counterpartyBusinessId);
    if (!counterparty) throw new ValidationError("Unknown counterparty business");
  }

  private assertValidMoney(amountMinor: number, currency: string): void {
    const money = Money.of(amountMinor, currency);
    if (!money.ok) throw new ValidationError(money.error.message);
    // A trade amount must be strictly positive (Money permits zero; a trade does not).
    if (amountMinor < 1) throw new ValidationError("Trade amount must be greater than zero");
  }

  private assertNotFuture(occurredOn: string): void {
    const date = new Date(`${occurredOn}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) throw new ValidationError("Invalid trade date");
    const today = new Date();
    today.setUTCHours(23, 59, 59, 999);
    if (date.getTime() > today.getTime()) {
      throw new ValidationError("Trade date cannot be in the future");
    }
  }

  private generateReference(): string {
    return `TS-${randomBytes(4).toString("hex").toUpperCase()}`;
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
