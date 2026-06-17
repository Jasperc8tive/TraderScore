import { Inject, Injectable } from "@nestjs/common";
import { TradeStatus, type UUID } from "@tradescore/shared";
import { Database } from "@tradescore/database";
import { DATABASE } from "../tokens";
import { mapTrade } from "../trades/trades.repository";
import type { TradeRecord } from "../trades/types";
import type { ConfirmationDecision } from "../trades/trade-status";

export interface DecideInput {
  tradeId: UUID;
  counterpartyBusinessId: UUID;
  decision: ConfirmationDecision;
  decidedBy: UUID;
  note?: string | undefined;
}

@Injectable()
export class ConfirmationsRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /**
   * Record the counterparty's decision, transition the trade, and append the
   * lifecycle event — all in one transaction so the verified record and the trade
   * status can never diverge.
   */
  async decide(input: DecideInput): Promise<TradeRecord> {
    return this.db.withTransaction(async (client) => {
      await client.query(
        `INSERT INTO trade_confirmations (trade_id, counterparty_business_id, decision, note, decided_by)
         VALUES ($1, $2, $3, $4, $5)`,
        [input.tradeId, input.counterpartyBusinessId, input.decision, input.note ?? null, input.decidedBy],
      );
      const { rows } = await client.query(
        "UPDATE trades SET status = $2 WHERE id = $1 AND deleted_at IS NULL RETURNING *",
        [input.tradeId, input.decision],
      );
      await client.query(
        `INSERT INTO trade_events (trade_id, event_type, from_status, to_status, actor_user_id, reason)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          input.tradeId,
          input.decision,
          TradeStatus.PENDING_CONFIRMATION,
          input.decision,
          input.decidedBy,
          input.note ?? null,
        ],
      );
      return mapTrade(rows[0]!);
    });
  }

  /** Trades awaiting this business's confirmation (the counterparty inbox). */
  async listIncoming(
    counterpartyBusinessId: UUID,
    page: number,
    pageSize: number,
  ): Promise<{ items: TradeRecord[]; total: number }> {
    const where =
      "deleted_at IS NULL AND counterparty_business_id = $1 AND status = 'PENDING_CONFIRMATION'";
    const countRes = await this.db.query(
      `SELECT count(*)::int AS total FROM trades WHERE ${where}`,
      [counterpartyBusinessId],
    );
    const total = (countRes.rows[0] as { total: number }).total;
    const listRes = await this.db.query(
      `SELECT * FROM trades WHERE ${where} ORDER BY created_at ASC LIMIT $2 OFFSET $3`,
      [counterpartyBusinessId, pageSize, (page - 1) * pageSize],
    );
    return { items: listRes.rows.map(mapTrade), total };
  }
}
