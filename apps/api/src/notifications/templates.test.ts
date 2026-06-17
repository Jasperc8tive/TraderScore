import { describe, expect, it } from "vitest";
import { NotificationChannel } from "@tradescore/shared";
import { renderNotification, NotificationType } from "./templates";

describe("renderNotification", () => {
  it("renders every notification type with a title and body", () => {
    for (const type of Object.values(NotificationType)) {
      const r = renderNotification(type);
      expect(r.title.length).toBeGreaterThan(0);
      expect(r.body.length).toBeGreaterThan(0);
      expect(r.channel).toBe(NotificationChannel.SMS);
    }
  });

  it("includes formatted money when provided", () => {
    const r = renderNotification(NotificationType.TRADE_CONFIRMED, { amountMinor: 150000, currency: "NGN" });
    expect(r.body).toContain("NGN 1,500");
  });

  it("includes the resolution on a resolved dispute", () => {
    const r = renderNotification(NotificationType.DISPUTE_RESOLVED, { resolution: "UPHELD" });
    expect(r.body).toContain("upheld");
  });
});
