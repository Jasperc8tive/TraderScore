import { Inject, Injectable } from "@nestjs/common";
import type { UUID } from "@tradescore/shared";
import { Database } from "@tradescore/database";
import { DATABASE } from "../tokens";

export interface BusinessTradeCounts {
  draft: number;
  pendingConfirmation: number;
  confirmed: number;
  disputed: number;
  rejected: number;
  cancelled: number;
}

export interface RiskSignal {
  businessId: UUID;
  businessName: string;
  confirmed: number;
  disputed: number;
  rejected: number;
  riskScore: number; // heuristic: weighted bad outcomes
}

export interface SybilSignal {
  createdByUserId: UUID;
  phone: string;
  businessCount: number;
}

export interface BandDistribution {
  band: string;
  count: number;
}

@Injectable()
export class AdminRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /** Trade counts by status where the business is initiator OR counterparty. */
  async tradeCountsForBusiness(businessId: UUID): Promise<BusinessTradeCounts> {
    const { rows } = await this.db.query<{ status: string; c: number }>(
      `SELECT status, count(*)::int AS c
       FROM trades
       WHERE deleted_at IS NULL
         AND (initiator_business_id = $1 OR counterparty_business_id = $1)
       GROUP BY status`,
      [businessId],
    );
    const m: Record<string, number> = {};
    for (const r of rows) m[r.status] = Number(r.c);
    return {
      draft: m.DRAFT ?? 0,
      pendingConfirmation: m.PENDING_CONFIRMATION ?? 0,
      confirmed: m.CONFIRMED ?? 0,
      disputed: m.DISPUTED ?? 0,
      rejected: m.REJECTED ?? 0,
      cancelled: m.CANCELLED ?? 0,
    };
  }

  async disputeCountForBusiness(businessId: UUID): Promise<number> {
    const { rows } = await this.db.query<{ c: number }>(
      `SELECT count(*)::int AS c FROM disputes d
       JOIN trades t ON t.id = d.trade_id
       WHERE d.raised_by_business_id = $1
          OR t.initiator_business_id = $1
          OR t.counterparty_business_id = $1`,
      [businessId],
    );
    return Number(rows[0]?.c ?? 0);
  }

  /**
   * Heuristic risk signals (pre-Stage-9): businesses with the most bad outcomes
   * on trades they initiated. A disputed/rejected initiated trade weighs more than
   * a confirmed one. This is an operational hint, not an automated fraud verdict.
   */
  async riskSignals(limit = 20): Promise<RiskSignal[]> {
    const { rows } = await this.db.query(
      `SELECT b.id AS business_id, b.name AS business_name,
              count(*) FILTER (WHERE t.status = 'CONFIRMED')::int AS confirmed,
              count(*) FILTER (WHERE t.status = 'DISPUTED')::int AS disputed,
              count(*) FILTER (WHERE t.status = 'REJECTED')::int AS rejected
       FROM businesses b
       JOIN trades t ON t.initiator_business_id = b.id AND t.deleted_at IS NULL
       WHERE b.deleted_at IS NULL
       GROUP BY b.id, b.name
       HAVING count(*) FILTER (WHERE t.status IN ('DISPUTED','REJECTED')) > 0
       ORDER BY (count(*) FILTER (WHERE t.status = 'DISPUTED') * 2
               + count(*) FILTER (WHERE t.status = 'REJECTED')) DESC
       LIMIT $1`,
      [limit],
    );
    return rows.map((r) => {
      const disputed = Number(r.disputed);
      const rejected = Number(r.rejected);
      return {
        businessId: r.business_id as string,
        businessName: r.business_name as string,
        confirmed: Number(r.confirmed),
        disputed,
        rejected,
        riskScore: disputed * 2 + rejected,
      };
    });
  }

  /** Sybil hint: a single user that created an unusual number of businesses. */
  async sybilSignals(minBusinesses = 3, limit = 20): Promise<SybilSignal[]> {
    const { rows } = await this.db.query(
      `SELECT u.id AS created_by_user_id, u.phone, count(*)::int AS business_count
       FROM businesses b
       JOIN users u ON u.id = b.created_by
       WHERE b.deleted_at IS NULL
       GROUP BY u.id, u.phone
       HAVING count(*) >= $1
       ORDER BY count(*) DESC
       LIMIT $2`,
      [minBusinesses, limit],
    );
    return rows.map((r) => ({
      createdByUserId: r.created_by_user_id as string,
      phone: r.phone as string,
      businessCount: Number(r.business_count),
    }));
  }

  /** Current-score band distribution across all businesses (latest snapshot each). */
  async bandDistribution(): Promise<BandDistribution[]> {
    const { rows } = await this.db.query(
      `SELECT s.band, count(*)::int AS count
       FROM businesses b
       JOIN LATERAL (
         SELECT band FROM score_snapshots ss
         WHERE ss.business_id = b.id ORDER BY computed_at DESC LIMIT 1
       ) s ON true
       WHERE b.deleted_at IS NULL
       GROUP BY s.band
       ORDER BY count DESC`,
    );
    return rows.map((r) => ({ band: r.band as string, count: Number(r.count) }));
  }

  async recentSnapshots(limit = 20): Promise<
    Array<{ businessId: UUID; businessName: string; score: number; band: string; computedAt: Date }>
  > {
    const { rows } = await this.db.query(
      `SELECT ss.business_id, b.name AS business_name, ss.score, ss.band, ss.computed_at
       FROM score_snapshots ss
       JOIN businesses b ON b.id = ss.business_id
       ORDER BY ss.computed_at DESC
       LIMIT $1`,
      [limit],
    );
    return rows.map((r) => ({
      businessId: r.business_id as string,
      businessName: r.business_name as string,
      score: Number(r.score),
      band: r.band as string,
      computedAt: new Date(r.computed_at as string),
    }));
  }
}
