import { Inject, Injectable } from "@nestjs/common";
import { Database } from "@tradescore/database";
import { DATABASE } from "../tokens";

export interface PilotMetrics {
  businesses: { total: number; computerVillage: number; active: number; verified: number };
  trades: {
    total: number;
    confirmed: number;
    pending: number;
    rejected: number;
    disputed: number;
    cancelled: number;
    confirmationRate: number; // confirmed / decided
  };
  trust: { scoredBusinesses: number; bandDistribution: Array<{ band: string; count: number }> };
  disputes: { total: number; open: number };
  growth: { totalReferrals: number; topReferrers: Array<{ name: string; referrals: number }> };
}

export interface PublicPilotSummary {
  businesses: number;
  confirmedTrades: number;
  trustedBusinesses: number;
}

@Injectable()
export class AnalyticsRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async pilotMetrics(): Promise<PilotMetrics> {
    const single = async (sql: string, params: unknown[] = []): Promise<number> => {
      const { rows } = await this.db.query<{ n: number }>(sql, params);
      return Number((rows[0] as { n: number } | undefined)?.n ?? 0);
    };

    const total = await single("SELECT count(*)::int AS n FROM businesses WHERE deleted_at IS NULL");
    const computerVillage = await single(
      `SELECT count(*)::int AS n FROM businesses b
       JOIN market_clusters mc ON mc.id = b.market_cluster_id
       WHERE b.deleted_at IS NULL AND mc.slug = 'computer-village-ikeja'`,
    );
    const active = await single(
      `SELECT count(DISTINCT bid)::int AS n FROM (
         SELECT initiator_business_id AS bid FROM trades WHERE status='CONFIRMED' AND deleted_at IS NULL
         UNION
         SELECT counterparty_business_id FROM trades WHERE status='CONFIRMED' AND deleted_at IS NULL AND counterparty_business_id IS NOT NULL
       ) z`,
    );
    const verified = await single(
      "SELECT count(*)::int AS n FROM businesses WHERE deleted_at IS NULL AND assurance_level <> 'UNVERIFIED'",
    );

    const statusCounts = await this.db.query<{ status: string; n: number }>(
      "SELECT status, count(*)::int AS n FROM trades WHERE deleted_at IS NULL GROUP BY status",
    );
    const s: Record<string, number> = {};
    for (const r of statusCounts.rows) s[r.status] = Number(r.n);
    const confirmed = s.CONFIRMED ?? 0;
    const rejected = s.REJECTED ?? 0;
    const disputed = s.DISPUTED ?? 0;
    const decided = confirmed + rejected + disputed;
    const tradesTotal = Object.values(s).reduce((a, b) => a + b, 0);

    const scoredBusinesses = await single(
      "SELECT count(DISTINCT business_id)::int AS n FROM score_snapshots",
    );
    const bandRows = await this.db.query<{ band: string; count: number }>(
      `SELECT s.band, count(*)::int AS count FROM businesses b
       JOIN LATERAL (SELECT band FROM score_snapshots ss WHERE ss.business_id=b.id ORDER BY computed_at DESC LIMIT 1) s ON true
       WHERE b.deleted_at IS NULL GROUP BY s.band ORDER BY count DESC`,
    );

    const disputesTotal = await single("SELECT count(*)::int AS n FROM disputes");
    const disputesOpen = await single("SELECT count(*)::int AS n FROM disputes WHERE status IN ('OPEN','UNDER_REVIEW')");

    const totalReferrals = await single("SELECT count(*)::int AS n FROM referrals");
    const topRows = await this.db.query<{ name: string; referrals: number }>(
      `SELECT b.name, count(*)::int AS referrals FROM referrals r
       JOIN businesses b ON b.id = r.referrer_business_id
       GROUP BY b.name ORDER BY referrals DESC LIMIT 5`,
    );

    return {
      businesses: { total, computerVillage, active, verified },
      trades: {
        total: tradesTotal,
        confirmed,
        pending: s.PENDING_CONFIRMATION ?? 0,
        rejected,
        disputed,
        cancelled: s.CANCELLED ?? 0,
        confirmationRate: decided > 0 ? Math.round((confirmed / decided) * 100) / 100 : 0,
      },
      trust: {
        scoredBusinesses,
        bandDistribution: bandRows.rows.map((r) => ({ band: r.band, count: Number(r.count) })),
      },
      disputes: { total: disputesTotal, open: disputesOpen },
      growth: {
        totalReferrals,
        topReferrers: topRows.rows.map((r) => ({ name: r.name, referrals: Number(r.referrals) })),
      },
    };
  }

  async publicSummary(): Promise<PublicPilotSummary> {
    const { rows: b } = await this.db.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM businesses WHERE deleted_at IS NULL AND status='ACTIVE'",
    );
    const { rows: t } = await this.db.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM trades WHERE status='CONFIRMED' AND deleted_at IS NULL",
    );
    const { rows: tr } = await this.db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM businesses b
       JOIN LATERAL (SELECT band FROM score_snapshots ss WHERE ss.business_id=b.id ORDER BY computed_at DESC LIMIT 1) s ON true
       WHERE b.deleted_at IS NULL AND s.band IN ('TRUSTED','HIGHLY_TRUSTED')`,
    );
    return {
      businesses: Number(b[0]?.n ?? 0),
      confirmedTrades: Number(t[0]?.n ?? 0),
      trustedBusinesses: Number(tr[0]?.n ?? 0),
    };
  }
}
