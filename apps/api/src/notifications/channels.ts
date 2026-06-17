import { Inject, Injectable } from "@nestjs/common";
import type { NotificationChannel } from "@tradescore/shared";
import type { Logger } from "@tradescore/logging";
import { LOGGER } from "../tokens";

export interface OutboundMessage {
  channel: NotificationChannel;
  address: string | null;
  title: string;
  body: string;
}

/**
 * A channel provider actually delivers a message. Real adapters (Twilio SMS,
 * WhatsApp Business, SES email) implement this and are config-gated; locally the
 * dev provider logs the message. Callers depend on the interface, not the adapter.
 */
export interface NotificationChannelProvider {
  send(message: OutboundMessage): Promise<void>;
}

/**
 * Dev provider: "delivers" by logging. Used for all channels locally so the full
 * notification flow is exercisable without provider credentials.
 */
@Injectable()
export class LogNotificationProvider implements NotificationChannelProvider {
  constructor(@Inject(LOGGER) private readonly logger: Logger) {}

  async send(message: OutboundMessage): Promise<void> {
    this.logger.info(
      { channel: message.channel, address: message.address, title: message.title },
      `notification [${message.channel}] -> ${message.address ?? "in-app"}: ${message.title}`,
    );
  }
}
