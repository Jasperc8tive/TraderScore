import { Inject, Injectable } from "@nestjs/common";
import type { AssuranceLevel, ScoreBand, UUID } from "@tradescore/shared";
import { Database } from "@tradescore/database";
import { DATABASE } from "../tokens";
import { sortToOrderBy, type DiscoverySort } from "./discovery-helpers";
import type { DiscoveryRow } from "./types";

export interface DiscoverySearchQuery {
  query?: string | undefined;
  marketClusterId?: UUID | undefined;
  assuranceLevel?: AssuranceLevel | undefined;
  band?: ScoreBand | undefined;
  minScore?: number | undefined;
  sort: DiscoverySort;
  page: number;
  pageSize: number;
}

function mapRow(r: Record<string, unknown>): DiscoveryRow {
  return {
    id: r.id as string,
    name: r.name as string,
    slug: r.slug as string,
    description: (r.description as string | null) ?? null,
    marketClusterId: (r.market_cluster_id as string | null) ?? null,
    marketName: (r.market_name as string | null) ?? null,
    assuranceLevel: r.assurance_level as AssuranceLevel,
    score: r.score === null || r.score === undefined ? null : Number(r.score),
    band: (r.band as ScoreBand | null) ?? null,
    activePlan: (r.active_plan as string | null) ?? null,
  };
}

@Injectable()
export class DiscoveryRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /**
   * Search businesses enriched with their latest trust score in ONE query via a
   * LATERAL join (no N+1). All filter values are bound parameters; the sort is a
   * pre-whitelisted clause, so no user input is ever interpolated into SQL.
   */
  async search(q: DiscoverySearchQuery): Promise<{ items: DiscoveryRow[]; total: number }> {
    // Only ACTIVE businesses are discoverable — suspended ones must not appear
    // trustworthy in public search (Stage 8 moderation effect).
    const conditions: string[] = ["b.deleted_at IS NULL", "b.status = 'ACTIVE'"];
    const params: unknown[] = [];
    let i = 1;

    if (q.query) {
      conditions.push(`b.name ILIKE '%' || $${i} || '%'`);
      params.push(q.query);
      i += 1;
    }
    if (q.marketClusterId) {
      conditions.push(`b.market_cluster_id = $${i}`);
      params.push(q.marketClusterId);
      i += 1;
    }
    if (q.assuranceLevel) {
      conditions.push(`b.assurance_level = $${i}`);
      params.push(q.assuranceLevel);
      i += 1;
    }
    if (q.band) {
      conditions.push(`s.band = $${i}`);
      params.push(q.band);
      i += 1;
    }
    if (q.minScore !== undefined) {
      conditions.push(`s.score >= $${i}`);
      params.push(q.minScore);
      i += 1;
    }

    const where = conditions.join(" AND ");
    const lateral = `
      LEFT JOIN market_clusters mc ON mc.id = b.market_cluster_id AND mc.deleted_at IS NULL
      LEFT JOIN subscriptions sub ON sub.business_id = b.id AND sub.status = 'ACTIVE'
      LEFT JOIN LATERAL (
        SELECT score, band FROM score_snapshots ss
        WHERE ss.business_id = b.id
        ORDER BY ss.computed_at DESC
        LIMIT 1
      ) s ON true`;

    const countRes = await this.db.query(
      `SELECT count(*)::int AS total FROM businesses b ${lateral} WHERE ${where}`,
      params,
    );
    const total = (countRes.rows[0] as { total: number }).total;

    const listRes = await this.db.query(
      `SELECT b.id, b.name, b.slug, b.description, b.market_cluster_id,
              b.assurance_level, mc.name AS market_name, s.score, s.band, sub.plan AS active_plan
       FROM businesses b ${lateral}
       WHERE ${where}
       ORDER BY ${sortToOrderBy(q.sort)}
       LIMIT $${i} OFFSET $${i + 1}`,
      [...params, q.pageSize, (q.page - 1) * q.pageSize],
    );
    return { items: listRes.rows.map(mapRow), total };
  }
}
