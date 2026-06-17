import type { Logger } from "@tradescore/logging";
import { createEvent, type DomainEvent } from "./event";
import type { EventName, EventPayloads } from "./registry";

export type EventHandler<TName extends EventName> = (
  event: DomainEvent<TName, EventPayloads[TName]>,
) => Promise<void> | void;

/**
 * Transport-agnostic event bus.
 *
 * Publishers depend only on this interface. The in-memory implementation backs
 * local development; a Redis Streams / SNS-SQS implementation can be swapped in
 * for production with zero changes to publishers or subscribers — the cloud-ready
 * mandate (spec §15) and the decoupling that makes fraud/scoring additive
 * (Trust Architecture Review §2).
 */
export interface EventBus {
  publish<TName extends EventName>(
    name: TName,
    payload: EventPayloads[TName],
    options?: { actorId?: string; version?: number },
  ): Promise<void>;

  subscribe<TName extends EventName>(name: TName, handler: EventHandler<TName>): void;
}

/**
 * In-memory event bus.
 *
 * Handlers run after the publishing call resolves but are isolated: one failing
 * subscriber never breaks the publisher or other subscribers (a fraud handler
 * crash must not roll back a legitimate trade). Failures are logged for
 * investigation. Subscribers must be idempotent.
 */
export class InMemoryEventBus implements EventBus {
  private readonly handlers = new Map<EventName, Array<EventHandler<EventName>>>();

  constructor(private readonly logger: Logger) {}

  async publish<TName extends EventName>(
    name: TName,
    payload: EventPayloads[TName],
    options?: { actorId?: string; version?: number },
  ): Promise<void> {
    const event = createEvent(name, payload, {
      ...(options?.actorId !== undefined ? { actorId: options.actorId } : {}),
      ...(options?.version !== undefined ? { version: options.version } : {}),
    });

    this.logger.debug({ event: name, eventId: event.id }, `event published: ${name}`);

    const handlers = this.handlers.get(name) ?? [];
    await Promise.all(
      handlers.map(async (handler) => {
        try {
          await handler(event);
        } catch (error) {
          // Subscriber isolation: log and continue, never propagate.
          this.logger.error(
            { err: error, event: name, eventId: event.id },
            `event handler failed for ${name}`,
          );
        }
      }),
    );
  }

  subscribe<TName extends EventName>(name: TName, handler: EventHandler<TName>): void {
    const existing = this.handlers.get(name) ?? [];
    existing.push(handler as EventHandler<EventName>);
    this.handlers.set(name, existing);
  }
}
