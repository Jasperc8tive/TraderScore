import { Inject, Injectable } from "@nestjs/common";
import type { PoolClient } from "pg";
import {
  DisputeStatus,
  type DisputeResolution,
  type TradeStatus,
  type TradeEventType,
  type UUID,
} from "@tradescore/shared";
import { Database } from "@tradescore/database";
import { DATABASE } from "../tokens";
import { mapTrade } from "../trades/trades.repository";
import type { TradeRecord } from "../trades/types";
import type { DisputeRecord, DisputeEvidenceRecord } from "./types";

function mapDispute(r: Record<string, unknown>): DisputeRecord {
  return {
    id: r.id as string,
    tradeId: r.trade_id as string,
    raisedByBusinessId: r.raised_by_business_id as string,
    raisedByUserId: r.raised_by_user_id as string,
    reason: r.reason as string,
    status: r.status as DisputeStatus,
    tradeStatusBefore: r.trade_status_before as TradeStatus,
    resolution: (r.resolution as DisputeResolution | null) ?? null,
    resolutionNote: (r.resolution_note as string | null) ?? null,
    reviewedByUserId: (r.reviewed_by_user_id as string | null) ?? null,
    resolvedAt: r.resolved_at ? new Date(r.resolved_at as string) : null,
    createdAt: new Date(r.created_at as string),
    updatedAt: new Date(r.updated_at as string),
  };
}

function mapEvidence(r: Record<string, unknown>): DisputeEvidenceRecord {
  return {
    id: r.id as string,
    disputeId: r.dispute_id as string,
    submittedByUserId: r.submitted_by_user_id as string,
    submittedByBusinessId: r.submitted_by_business_id as string,
    body: r.body as string,
    attachmentUrl: (r.attachment_url as string | null) ?? null,
    createdAt: new Date(r.created_at as string),
  };
}

async function appendTradeEvent(
  client: PoolClient,
  tradeId: UUID,
  eventType: TradeEventType,
  fromStatus: TradeStatus,
  toStatus: TradeStatus,
  actorUserId: UUID,
  reason: string | null,
): Promise<void> {
  await client.query(
    `INSERT INTO trade_events (trade_id, event_type, from_status, to_status, actor_user_id, reason)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [tradeId, eventType, fromStatus, toStatus, actorUserId, reason],
  );
}

export interface OpenDisputeInput {
  tradeId: UUID;
  raisedByBusinessId: UUID;
  raisedByUserId: UUID;
  reason: string;
  tradeStatusBefore: TradeStatus;
  newTradeStatus: TradeStatus; // DISPUTED (may equal before)
}

export interface ResolveDisputeInput {
  disputeId: UUID;
  resolution: DisputeResolution;
  note: string | undefined;
  reviewerUserId: UUID;
  tradeId: UUID;
  fromStatus: TradeStatus;
  newTradeStatus: TradeStatus; // CONFIRMED or REJECTED
}

export interface WithdrawDisputeInput {
  disputeId: UUID;
  reviewerUserId: UUID; // the raiser's user (actor)
  tradeId: UUID;
  fromStatus: TradeStatus;
  restoreStatus: TradeStatus;
}

@Injectable()
export class DisputesRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async findById(id: UUID): Promise<DisputeRecord | null> {
    const { rows } = await this.db.query("SELECT * FROM disputes WHERE id = $1", [id]);
    return rows[0] ? mapDispute(rows[0]) : null;
  }

  async findActiveByTrade(tradeId: UUID): Promise<DisputeRecord | null> {
    const { rows } = await this.db.query(
      "SELECT * FROM disputes WHERE trade_id = $1 AND status IN ('OPEN','UNDER_REVIEW')",
      [tradeId],
    );
    return rows[0] ? mapDispute(rows[0]) : null;
  }

  /** Admin queue: disputes filtered by status (or all), most recent first. */
  async listByStatus(status: string | undefined, limit = 100): Promise<DisputeRecord[]> {
    if (status) {
      const { rows } = await this.db.query(
        "SELECT * FROM disputes WHERE status = $1 ORDER BY created_at DESC LIMIT $2",
        [status, limit],
      );
      return rows.map(mapDispute);
    }
    const { rows } = await this.db.query(
      "SELECT * FROM disputes ORDER BY created_at DESC LIMIT $1",
      [limit],
    );
    return rows.map(mapDispute);
  }

  async listForTrade(tradeId: UUID): Promise<DisputeRecord[]> {
    const { rows } = await this.db.query(
      "SELECT * FROM disputes WHERE trade_id = $1 ORDER BY created_at DESC",
      [tradeId],
    );
    return rows.map(mapDispute);
  }

  async listForBusiness(businessId: UUID): Promise<DisputeRecord[]> {
    const { rows } = await this.db.query(
      `SELECT d.* FROM disputes d
       JOIN trades t ON t.id = d.trade_id
       WHERE d.raised_by_business_id = $1
          OR t.initiator_business_id = $1
          OR t.counterparty_business_id = $1
       ORDER BY d.created_at DESC`,
      [businessId],
    );
    return rows.map(mapDispute);
  }

  async getEvidence(disputeId: UUID): Promise<DisputeEvidenceRecord[]> {
    const { rows } = await this.db.query(
      "SELECT * FROM dispute_evidence WHERE dispute_id = $1 ORDER BY created_at ASC",
      [disputeId],
    );
    return rows.map(mapEvidence);
  }

  /** Open a dispute, freezing the trade (CONFIRMED → DISPUTED), atomically. */
  async open(input: OpenDisputeInput): Promise<DisputeRecord> {
    return this.db.withTransaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO disputes (trade_id, raised_by_business_id, raised_by_user_id, reason, trade_status_before, status)
         VALUES ($1,$2,$3,$4,$5,'OPEN') RETURNING *`,
        [input.tradeId, input.raisedByBusinessId, input.raisedByUserId, input.reason, input.tradeStatusBefore],
      );
      if (input.newTradeStatus !== input.tradeStatusBefore) {
        await client.query("UPDATE trades SET status = $2 WHERE id = $1", [input.tradeId, input.newTradeStatus]);
        await appendTradeEvent(
          client,
          input.tradeId,
          "DISPUTED",
          input.tradeStatusBefore,
          input.newTradeStatus,
          input.raisedByUserId,
          input.reason,
        );
      }
      return mapDispute(rows[0]!);
    });
  }

  async addEvidence(input: {
    disputeId: UUID;
    submittedByUserId: UUID;
    submittedByBusinessId: UUID;
    body: string;
    attachmentUrl: string | undefined;
  }): Promise<DisputeEvidenceRecord> {
    const { rows } = await this.db.query(
      `INSERT INTO dispute_evidence (dispute_id, submitted_by_user_id, submitted_by_business_id, body, attachment_url)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [input.disputeId, input.submittedByUserId, input.submittedByBusinessId, input.body, input.attachmentUrl ?? null],
    );
    return mapEvidence(rows[0]!);
  }

  async markUnderReview(disputeId: UUID, reviewerUserId: UUID): Promise<DisputeRecord> {
    const { rows } = await this.db.query(
      `UPDATE disputes SET status = 'UNDER_REVIEW', reviewed_by_user_id = $2
       WHERE id = $1 RETURNING *`,
      [disputeId, reviewerUserId],
    );
    return mapDispute(rows[0]!);
  }

  /** Resolve a dispute and drive the trade to its final status, atomically. */
  async resolve(input: ResolveDisputeInput): Promise<{ dispute: DisputeRecord; trade: TradeRecord }> {
    return this.db.withTransaction(async (client) => {
      const d = await client.query(
        `UPDATE disputes
         SET status = 'RESOLVED', resolution = $2, resolution_note = $3,
             reviewed_by_user_id = $4, resolved_at = now()
         WHERE id = $1 RETURNING *`,
        [input.disputeId, input.resolution, input.note ?? null, input.reviewerUserId],
      );
      const t = await client.query(
        "UPDATE trades SET status = $2 WHERE id = $1 RETURNING *",
        [input.tradeId, input.newTradeStatus],
      );
      await appendTradeEvent(
        client,
        input.tradeId,
        input.newTradeStatus as TradeEventType,
        input.fromStatus,
        input.newTradeStatus,
        input.reviewerUserId,
        input.note ?? null,
      );
      return { dispute: mapDispute(d.rows[0]!), trade: mapTrade(t.rows[0]!) };
    });
  }

  /** Withdraw a dispute and restore the trade's prior status, atomically. */
  async withdraw(input: WithdrawDisputeInput): Promise<{ dispute: DisputeRecord; trade: TradeRecord }> {
    return this.db.withTransaction(async (client) => {
      const d = await client.query(
        "UPDATE disputes SET status = 'WITHDRAWN' WHERE id = $1 RETURNING *",
        [input.disputeId],
      );
      const t = await client.query(
        "UPDATE trades SET status = $2 WHERE id = $1 RETURNING *",
        [input.tradeId, input.restoreStatus],
      );
      if (input.restoreStatus !== input.fromStatus) {
        await appendTradeEvent(
          client,
          input.tradeId,
          input.restoreStatus as TradeEventType,
          input.fromStatus,
          input.restoreStatus,
          input.reviewerUserId,
          "dispute withdrawn",
        );
      }
      return { dispute: mapDispute(d.rows[0]!), trade: mapTrade(t.rows[0]!) };
    });
  }
}
