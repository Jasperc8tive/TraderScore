import { NotificationChannel } from "@tradescore/shared";

/** Stable notification type keys. */
export const NotificationType = {
  TRADE_AWAITING_CONFIRMATION: "TRADE_AWAITING_CONFIRMATION",
  TRADE_CONFIRMED: "TRADE_CONFIRMED",
  TRADE_REJECTED: "TRADE_REJECTED",
  TRADE_DISPUTED: "TRADE_DISPUTED",
  DISPUTE_OPENED: "DISPUTE_OPENED",
  DISPUTE_RESOLVED: "DISPUTE_RESOLVED",
  BUSINESS_VERIFIED: "BUSINESS_VERIFIED",
} as const;
export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];

export interface RenderedNotification {
  channel: NotificationChannel;
  title: string;
  body: string;
}

export interface TemplateData {
  amountMinor?: number;
  currency?: string;
  resolution?: string;
}

function money(data: TemplateData): string {
  if (data.amountMinor === undefined) return "";
  const major = (data.amountMinor / 100).toLocaleString();
  return ` (${data.currency ?? "NGN"} ${major})`;
}

/**
 * Render a notification for a type. Pure and deterministic. Messages are short,
 * SMS-first for the low-bandwidth trader audience; the persisted record also
 * serves the in-app inbox.
 */
export function renderNotification(type: NotificationType, data: TemplateData = {}): RenderedNotification {
  switch (type) {
    case NotificationType.TRADE_AWAITING_CONFIRMATION:
      return {
        channel: NotificationChannel.SMS,
        title: "Trade awaiting confirmation",
        body: `A trade${money(data)} is awaiting your confirmation on TradeScore.`,
      };
    case NotificationType.TRADE_CONFIRMED:
      return {
        channel: NotificationChannel.SMS,
        title: "Trade confirmed",
        body: `Your trade${money(data)} was confirmed. It now counts towards your TradeScore.`,
      };
    case NotificationType.TRADE_REJECTED:
      return {
        channel: NotificationChannel.SMS,
        title: "Trade rejected",
        body: `Your trade${money(data)} was rejected by the counterparty.`,
      };
    case NotificationType.TRADE_DISPUTED:
      return {
        channel: NotificationChannel.SMS,
        title: "Trade disputed",
        body: `Your trade${money(data)} has been disputed. Trust is paused until it is resolved.`,
      };
    case NotificationType.DISPUTE_OPENED:
      return {
        channel: NotificationChannel.SMS,
        title: "Dispute opened",
        body: "A dispute was opened on one of your trades. You can submit evidence on TradeScore.",
      };
    case NotificationType.DISPUTE_RESOLVED:
      return {
        channel: NotificationChannel.SMS,
        title: "Dispute resolved",
        body: `A dispute on your trade was resolved${data.resolution ? ` (${data.resolution.toLowerCase()})` : ""}.`,
      };
    case NotificationType.BUSINESS_VERIFIED:
      return {
        channel: NotificationChannel.SMS,
        title: "Business verified",
        body: "Your business has been verified on TradeScore. This strengthens your trust profile.",
      };
    default: {
      const exhaustive: never = type;
      throw new Error(`Unknown notification type: ${String(exhaustive)}`);
    }
  }
}
