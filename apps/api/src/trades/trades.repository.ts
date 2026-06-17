import { Inject, Injectable } from "@nestjs/common";
import type { PoolClient } from "pg";
import {
  type TradeStatus,
  type TradeDirection,
  type TradeEventType,
  type UUID,
} from "@tradescore/shared";
import { Database } from "@tradescore/database";
import { DATABASE } from "../tokens";
import type { TradeRecord, TradeEventRecord } from "./types";

export function mapTrade(r: Record<string, unknown>): TradeRecord {
  return {
    id: r.id as string,
    referenceCode: r.reference_code as string,
    initiatorBusinessId: r.initiator_business_id as string,
    counterpartyBusinessId: (r.counterparty_business_id as string | null) ?? null,
    counterpartyName: (r.counterparty_name as string | null) ?? null,
    counterpartyPhone: (r.counterparty_phone as string | null) ?? null,
    direction: r.direction as TradeDirection,
    amountMinor: Number(r.amount_minor),
    currency: r.currency as string,
    description: (r.description as string | null) ?? null,
    occurredOn: String(r.occurred_on).slice(0, 10),
    status: r.status as TradeStatus,
    createdBy: r.created_by as string,
    createdAt: new Date(r.created_at as string),
    updatedAt: new Date(r.updated_at as string),
    deletedAt: r.deleted_at ? new Date(r.deleted_at as string) : null,
  };
}

function mapTradeEvent(r: Record<string, unknown>): TradeEventRecord {
  return {
    id: r.id as string,
    tradeId: r.trade_id as string,
    eventType: r.event_type as TradeEventType,
    fromStatus: (r.from_status as TradeStatus | null) ?? null,
    toStatus: (r.to_status as TradeStatus | null) ?? null,
    actorUserId: (r.actor_user_id as string | null) ?? null,
    reason: (r.reason as string | null) ?? null,
    metadata: (r.metadata as Record<string, unknown>) ?? {},
    createdAt: new Date(r.created_at as string),
  };
}

export interface CreateTradeInput {
  referenceCode: string;
  initiatorBusinessId: UUID;
  counterpartyBusinessId?: UUID | undefined;
  counterpartyName?: string | undefined;
  counterpartyPhone?: string | undefined;
  direction: TradeDirection;
  amountMinor: number;
  currency: string;
  description?: string | undefined;
  occurredOn: string;
  createdBy: UUID;
}

export interface TradeListQuery {
  initiatorBusinessId: UUID;
  status?: TradeStatus | undefined;
  page: number;
  pageSize: number;
}

export interface AppendEventInput {
  eventType: TradeEventType;
  fromStatus?: TradeStatus | null | undefined;
  toStatus?: TradeStatus | null | undefined;
  actorUserId: UUID;
  reason?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
}

@Injectable()
export class TradesRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async findById(id: UUID): Promise<TradeRecord | null> {
    const { rows } = await this.db.query(
      "SELECT * FROM trades WHERE id = $1 AND deleted_at IS NULL",
      [id],
    );
    return rows[0] ? mapTrade(rows[0]) : null;
  }

  /** Create a trade in DRAFT and append the CREATED event, atomically. */
  async createWithEvent(input: CreateTradeInput): Promise<TradeRecord> {
    return this.db.withTransaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO trades
           (reference_code, initiator_business_id, counterparty_business_id,
            counterparty_name, counterparty_phone, direction, amount_minor,
            currency, description, occurred_on, created_by, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'DRAFT')
         RETURNING *`,
        [
          input.referenceCode,
          input.initiatorBusinessId,
          input.counterpartyBusinessId ?? null,
          input.counterpartyName ?? null,
          input.counterpartyPhone ?? null,
          input.direction,
          input.amountMinor,
          input.currency,
          input.description ?? null,
          input.occurredOn,
          input.createdBy,
        ],
      );
      const trade = mapTrade(rows[0]!);
      await this.insertEvent(client, trade.id, {
        eventType: "CREATED",
        toStatus: trade.status,
        actorUserId: input.createdBy,
      });
      return trade;
    });
  }

  /** Apply field edits and append an EDITED event, atomically. */
  async updateWithEvent(
    id: UUID,
    fields: {
      counterpartyBusinessId?: UUID | null | undefined;
      counterpartyName?: string | null | undefined;
      counterpartyPhone?: string | null | undefined;
      direction?: TradeDirection | undefined;
      amountMinor?: number | undefined;
      currency?: string | undefined;
      description?: string | null | undefined;
      occurredOn?: string | undefined;
    },
    event: AppendEventInput,
  ): Promise<TradeRecord> {
    const columnMap: Record<string, string> = {
      counterpartyBusinessId: "counterparty_business_id",
      counterpartyName: "counterparty_name",
      counterpartyPhone: "counterparty_phone",
      direction: "direction",
      amountMinor: "amount_minor",
      currency: "currency",
      description: "description",
      occurredOn: "occurred_on",
    };
    return this.db.withTransaction(async (client) => {
      const sets: string[] = [];
      const params: unknown[] = [];
      let i = 1;
      for (const [key, col] of Object.entries(columnMap)) {
        const value = (fields as Record<string, unknown>)[key];
        if (value !== undefined) {
          sets.push(`${col} = $${i}`);
          params.push(value);
          i += 1;
        }
      }
      let trade: TradeRecord;
      if (sets.length > 0) {
        params.push(id);
        const { rows } = await client.query(
          `UPDATE trades SET ${sets.join(", ")} WHERE id = $${i} AND deleted_at IS NULL RETURNING *`,
          params,
        );
        trade = mapTrade(rows[0]!);
      } else {
        const { rows } = await client.query("SELECT * FROM trades WHERE id = $1", [id]);
        trade = mapTrade(rows[0]!);
      }
      await this.insertEvent(client, id, event);
      return trade;
    });
  }

  /** Change status and append a lifecycle event, atomically. */
  async transitionWithEvent(
    id: UUID,
    toStatus: TradeStatus,
    event: AppendEventInput,
  ): Promise<TradeRecord> {
    return this.db.withTransaction(async (client) => {
      const { rows } = await client.query(
        "UPDATE trades SET status = $2 WHERE id = $1 AND deleted_at IS NULL RETURNING *",
        [id, toStatus],
      );
      const trade = mapTrade(rows[0]!);
      await this.insertEvent(client, id, event);
      return trade;
    });
  }

  async listEvents(tradeId: UUID): Promise<TradeEventRecord[]> {
    const { rows } = await this.db.query(
      "SELECT * FROM trade_events WHERE trade_id = $1 ORDER BY created_at ASC, id ASC",
      [tradeId],
    );
    return rows.map(mapTradeEvent);
  }

  async list(q: TradeListQuery): Promise<{ items: TradeRecord[]; total: number }> {
    const conditions = ["deleted_at IS NULL", "initiator_business_id = $1"];
    const params: unknown[] = [q.initiatorBusinessId];
    let i = 2;
    if (q.status) {
      conditions.push(`status = $${i}`);
      params.push(q.status);
      i += 1;
    }
    const where = conditions.join(" AND ");
    const countRes = await this.db.query(
      `SELECT count(*)::int AS total FROM trades WHERE ${where}`,
      params,
    );
    const total = (countRes.rows[0] as { total: number }).total;
    const listRes = await this.db.query(
      `SELECT * FROM trades WHERE ${where} ORDER BY occurred_on DESC, created_at DESC LIMIT $${i} OFFSET $${i + 1}`,
      [...params, q.pageSize, (q.page - 1) * q.pageSize],
    );
    return { items: listRes.rows.map(mapTrade), total };
  }

  private async insertEvent(
    client: PoolClient,
    tradeId: UUID,
    event: AppendEventInput,
  ): Promise<void> {
    await client.query(
      `INSERT INTO trade_events (trade_id, event_type, from_status, to_status, actor_user_id, reason, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        tradeId,
        event.eventType,
        event.fromStatus ?? null,
        event.toStatus ?? null,
        event.actorUserId,
        event.reason ?? null,
        JSON.stringify(event.metadata ?? {}),
      ],
    );
  }
}
