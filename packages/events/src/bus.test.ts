import { describe, expect, it, vi } from "vitest";
import type { Logger } from "@tradescore/logging";
import { InMemoryEventBus } from "./bus";

// Minimal logger stub — the bus only calls debug/error.
const stubLogger = { debug: () => {}, error: () => {} } as unknown as Logger;

describe("InMemoryEventBus", () => {
  it("delivers a published event to subscribers", async () => {
    const bus = new InMemoryEventBus(stubLogger);
    const handler = vi.fn();
    bus.subscribe("user.created", handler);

    await bus.publish("user.created", { userId: "u1", phone: "+234", role: "ADMIN" });

    expect(handler).toHaveBeenCalledOnce();
    const event = handler.mock.calls[0]![0];
    expect(event.name).toBe("user.created");
    expect(event.payload.userId).toBe("u1");
    expect(event.id).toBeTruthy();
  });

  it("isolates a failing subscriber from others", async () => {
    const bus = new InMemoryEventBus(stubLogger);
    const failing = vi.fn(() => {
      throw new Error("handler boom");
    });
    const healthy = vi.fn();
    bus.subscribe("business.created", failing);
    bus.subscribe("business.created", healthy);

    await expect(
      bus.publish("business.created", { businessId: "b1", ownerUserId: "u1", name: "Acme" }),
    ).resolves.toBeUndefined();

    expect(failing).toHaveBeenCalledOnce();
    expect(healthy).toHaveBeenCalledOnce();
  });
});
