import { Inject, Injectable, type OnApplicationBootstrap } from "@nestjs/common";
import { NotificationChannel, type UUID } from "@tradescore/shared";
import type { EventBus } from "@tradescore/events";
import type { Logger } from "@tradescore/logging";
import { NotificationsRepository, type NotificationRecord } from "./notifications.repository";
import { LogNotificationProvider } from "./channels";
import { renderNotification, NotificationType, type TemplateData } from "./templates";
import { EVENT_BUS, LOGGER } from "../tokens";

const MAX_ATTEMPTS = 3;

@Injectable()
export class NotificationsService implements OnApplicationBootstrap {
  constructor(
    private readonly repo: NotificationsRepository,
    private readonly provider: LogNotificationProvider,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    @Inject(LOGGER) private readonly logger: Logger,
  ) {}

  /**
   * Notifications are a pure consumer of domain events (producers stay decoupled).
   * Each handler is isolated — a delivery failure never affects the trade/dispute
   * flow.
   */
  onApplicationBootstrap(): void {
    this.events.subscribe("trade.submitted", (e) =>
      this.notifyOwners(e.payload.counterpartyBusinessId, NotificationType.TRADE_AWAITING_CONFIRMATION, {}),
    );
    this.events.subscribe("trade.confirmed", (e) =>
      this.notifyOwners(e.payload.initiatorBusinessId, NotificationType.TRADE_CONFIRMED, {
        amountMinor: e.payload.amountMinor,
        currency: e.payload.currency,
      }),
    );
    this.events.subscribe("trade.rejected", (e) =>
      this.notifyOwners(e.payload.initiatorBusinessId, NotificationType.TRADE_REJECTED, {}),
    );
    this.events.subscribe("trade.disputed", (e) =>
      this.notifyOwners(e.payload.initiatorBusinessId, NotificationType.TRADE_DISPUTED, {}),
    );
    this.events.subscribe("dispute.opened", (e) =>
      this.notifyTradeParties(e.payload.tradeId, NotificationType.DISPUTE_OPENED, {}),
    );
    this.events.subscribe("dispute.resolved", (e) =>
      this.notifyTradeParties(e.payload.tradeId, NotificationType.DISPUTE_RESOLVED, {
        resolution: e.payload.resolution,
      }),
    );
    this.events.subscribe("business.verified", (e) =>
      this.notifyOwners(e.payload.businessId, NotificationType.BUSINESS_VERIFIED, {}),
    );
  }

  async listInbox(userId: UUID): Promise<NotificationRecord[]> {
    return this.repo.listForUser(userId);
  }

  /** Persist-then-dispatch a single notification with bounded retries. */
  async send(
    recipientUserId: UUID | null,
    address: string | null,
    type: NotificationType,
    data: TemplateData,
    payload: Record<string, unknown>,
  ): Promise<NotificationRecord> {
    const rendered = renderNotification(type, data);
    const record = await this.repo.create({
      recipientUserId,
      channel: rendered.channel,
      address,
      type,
      title: rendered.title,
      body: rendered.body,
      payload,
    });

    let attempts = 0;
    let lastError: unknown;
    while (attempts < MAX_ATTEMPTS) {
      attempts += 1;
      try {
        await this.provider.send({
          channel: rendered.channel,
          address,
          title: rendered.title,
          body: rendered.body,
        });
        await this.repo.markSent(record.id, attempts);
        return { ...record, status: "SENT", attempts, sentAt: new Date() };
      } catch (error) {
        lastError = error;
      }
    }
    const message = lastError instanceof Error ? lastError.message : String(lastError);
    await this.repo.markFailed(record.id, attempts, message);
    this.logger.error({ notificationId: record.id, type }, "notification delivery failed");
    return { ...record, status: "FAILED", attempts, error: message };
  }

  // --- recipient resolution + event helpers --------------------------------

  private async notifyOwners(
    businessId: UUID,
    type: NotificationType,
    data: TemplateData,
  ): Promise<void> {
    try {
      const channel = renderNotification(type, data).channel;
      const owners = await this.repo.getBusinessOwnerContacts(businessId);
      for (const owner of owners) {
        const address = channel === NotificationChannel.EMAIL ? owner.email : owner.phone;
        await this.send(owner.userId, address, type, data, { businessId });
      }
    } catch (error) {
      this.logger.error({ err: error, businessId, type }, "notifyOwners failed");
    }
  }

  private async notifyTradeParties(
    tradeId: UUID,
    type: NotificationType,
    data: TemplateData,
  ): Promise<void> {
    try {
      const parties = await this.repo.getTradePartyBusinessIds(tradeId);
      for (const businessId of parties) {
        await this.notifyOwners(businessId, type, data);
      }
    } catch (error) {
      this.logger.error({ err: error, tradeId, type }, "notifyTradeParties failed");
    }
  }
}
