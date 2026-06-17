import { randomUUID } from "node:crypto";
import type { UUID } from "@tradescore/shared";

/**
 * The envelope every domain event shares.
 *
 * Events are typed, versioned, and self-describing. `name` is the routing key,
 * `version` allows the payload shape to evolve safely, and `occurredAt` records
 * when the fact happened (not when it was processed). `actorId` preserves
 * attribution through the async pipeline (Trust Architecture Review §2).
 *
 * @typeParam TName    - the stable event name (discriminant)
 * @typeParam TPayload - the typed payload for this event
 */
export interface DomainEvent<TName extends string = string, TPayload = unknown> {
  readonly id: UUID;
  readonly name: TName;
  readonly version: number;
  readonly occurredAt: Date;
  readonly actorId?: UUID;
  readonly payload: TPayload;
}

/** Construct a well-formed domain event with generated id and timestamp. */
export function createEvent<TName extends string, TPayload>(
  name: TName,
  payload: TPayload,
  options?: { version?: number; actorId?: UUID; occurredAt?: Date },
): DomainEvent<TName, TPayload> {
  return {
    id: randomUUID(),
    name,
    version: options?.version ?? 1,
    occurredAt: options?.occurredAt ?? new Date(),
    ...(options?.actorId !== undefined ? { actorId: options.actorId } : {}),
    payload,
  };
}
