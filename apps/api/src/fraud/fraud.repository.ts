import { Inject, Injectable } from "@nestjs/common";
import type {
  FraudFlagType,
  FraudSubjectType,
  FraudSeverity,
  FraudFlagStatus,
  UUID,
} from "@tradescore/shared";
import { Database } from "@tradescore/database";
import { DATABASE } from "../tokens";
import type { CreatorCount, Edge, BusinessStat, PairStat, DetectedFlag } from "./detectors";
import type { FraudFlagRecord } from "./types";

function mapFlag(r: Record<string, unknown>): FraudFlagRecord {
  return {
    id: r.id as string,
    flagType: r.flag_type as FraudFlagType,
    subjectType: r.subject_type as FraudSubjectType,
    subjectId: r.subject_id as string,
    severity: r.severity as FraudSeverity,
    status: r.status as FraudFlagStatus,
    detail: (r.detail as Record<string, unknown>) ?? {},
    detectedAt: new Date(r.detected_at as string),
    reviewedBy: (r.reviewed_by as string | null) ?? null,
    reviewedAt: r.reviewed_at ? new Date(r.reviewed_at as string) : null,
    reviewNote: (r.review_note as string | null) ?? null,
  };
}

@Injectable()
export class FraudRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  // --- Aggregate inputs for the pure detectors -----------------------------

  async getCreatorCounts(minBusinesses: number): Promise<CreatorCount[]> {
    const { rows } = await this.db.query(
      `SELECT u.id AS user_id, u.phone, count(*)::int AS business_count
       FROM businesses b JOIN users u ON u.id = b.created_by
       WHERE b.deleted_at IS NULL
       GROUP BY u.id, u.phone
       HAVING count(*) >= $1`,
      [minBusinesses],
    );
    return rows.map((r) => ({
      userId: r.user_id as string,
      phone: r.phone as string,
      businessCount: Number(r.business_count),
    }));
  }

  async getConfirmedEdges(): Promise<Edge[]> {
    const { rows } = await this.db.query(
      `SELECT DISTINCT initiator_business_id AS f, counterparty_business_id AS t
       FROM trades
       WHERE status = 'CONFIRMED' AND deleted_at IS NULL AND counterparty_business_id IS NOT NULL`,
    );
    return rows.map((r) => ({ from: r.f as string, to: r.t as string }));
  }

  /** Per-business confirmed-trade stats. Optionally scoped to a set of businesses. */
  async getPerBusinessStats(businessIds?: UUID[]): Promise<BusinessStat[]> {
    const scoped = businessIds && businessIds.length > 0;
    const { rows } = await this.db.query(
      `WITH conf AS (
         SELECT initiator_business_id AS me, counterparty_business_id AS other FROM trades
           WHERE status='CONFIRMED' AND deleted_at IS NULL AND counterparty_business_id IS NOT NULL
         UNION ALL
         SELECT counterparty_business_id AS me, initiator_business_id AS other FROM trades
           WHERE status='CONFIRMED' AND deleted_at IS NULL AND counterparty_business_id IS NOT NULL
       ),
       per_cp AS (SELECT me, other, count(*)::int AS c FROM conf GROUP BY me, other),
       agg AS (SELECT me AS business_id, sum(c)::int AS confirmed_count, max(c)::int AS max_one FROM per_cp GROUP BY me),
       recent AS (
         SELECT business_id, count(*)::int AS rc FROM (
           SELECT t.initiator_business_id AS business_id FROM trade_events e JOIN trades t ON t.id=e.trade_id
             WHERE e.event_type='CONFIRMED' AND e.created_at > now() - interval '24 hours'
           UNION ALL
           SELECT t.counterparty_business_id FROM trade_events e JOIN trades t ON t.id=e.trade_id
             WHERE e.event_type='CONFIRMED' AND e.created_at > now() - interval '24 hours' AND t.counterparty_business_id IS NOT NULL
         ) z GROUP BY business_id
       ),
       initdec AS (
         SELECT initiator_business_id AS business_id,
           count(*) FILTER (WHERE status='CONFIRMED')::int AS ic,
           count(*) FILTER (WHERE status='REJECTED')::int AS ir,
           count(*) FILTER (WHERE status='DISPUTED')::int AS idi
         FROM trades WHERE deleted_at IS NULL AND status IN ('CONFIRMED','REJECTED','DISPUTED')
         GROUP BY initiator_business_id
       )
       SELECT b.id AS business_id,
         COALESCE(agg.confirmed_count,0) AS confirmed_count,
         COALESCE(agg.max_one,0) AS max_one,
         COALESCE(recent.rc,0) AS recent_count,
         COALESCE(initdec.ic,0) AS ic, COALESCE(initdec.ir,0) AS ir, COALESCE(initdec.idi,0) AS idi
       FROM businesses b
       LEFT JOIN agg ON agg.business_id = b.id
       LEFT JOIN recent ON recent.business_id = b.id
       LEFT JOIN initdec ON initdec.business_id = b.id
       WHERE b.deleted_at IS NULL
         AND (COALESCE(agg.confirmed_count,0) > 0 OR COALESCE(initdec.ic,0)+COALESCE(initdec.ir,0)+COALESCE(initdec.idi,0) > 0)
         ${scoped ? "AND b.id = ANY($1)" : ""}`,
      scoped ? [businessIds] : [],
    );
    return rows.map((r) => ({
      businessId: r.business_id as string,
      confirmedCount: Number(r.confirmed_count),
      maxWithOneCounterparty: Number(r.max_one),
      recentConfirmedCount: Number(r.recent_count),
      initiatorConfirmed: Number(r.ic),
      initiatorRejected: Number(r.ir),
      initiatorDisputed: Number(r.idi),
    }));
  }

  /** Per-pair confirmed-trade + dispute stats. Optionally scoped. */
  async getPairStats(businessIds?: UUID[]): Promise<PairStat[]> {
    const scoped = businessIds && businessIds.length > 0;
    const { rows } = await this.db.query(
      `WITH conf AS (
         SELECT LEAST(initiator_business_id, counterparty_business_id) AS a,
                GREATEST(initiator_business_id, counterparty_business_id) AS b,
                count(*) FILTER (WHERE initiator_business_id < counterparty_business_id)::int AS a_to_b,
                count(*) FILTER (WHERE initiator_business_id > counterparty_business_id)::int AS b_to_a
         FROM trades
         WHERE status='CONFIRMED' AND deleted_at IS NULL AND counterparty_business_id IS NOT NULL
         GROUP BY 1,2
       ),
       disp AS (
         SELECT LEAST(t.initiator_business_id, t.counterparty_business_id) AS a,
                GREATEST(t.initiator_business_id, t.counterparty_business_id) AS b,
                count(*)::int AS d
         FROM disputes dd JOIN trades t ON t.id = dd.trade_id
         WHERE t.counterparty_business_id IS NOT NULL
         GROUP BY 1,2
       )
       SELECT COALESCE(conf.a, disp.a) AS a, COALESCE(conf.b, disp.b) AS b,
              COALESCE(conf.a_to_b,0) AS a_to_b, COALESCE(conf.b_to_a,0) AS b_to_a,
              COALESCE(disp.d,0) AS disputes
       FROM conf FULL OUTER JOIN disp ON conf.a = disp.a AND conf.b = disp.b
       ${scoped ? "WHERE COALESCE(conf.a, disp.a) = ANY($1) OR COALESCE(conf.b, disp.b) = ANY($1)" : ""}`,
      scoped ? [businessIds] : [],
    );
    return rows.map((r) => ({
      a: r.a as string,
      b: r.b as string,
      aToB: Number(r.a_to_b),
      bToA: Number(r.b_to_a),
      disputes: Number(r.disputes),
    }));
  }

  // --- Flag persistence ----------------------------------------------------

  /**
   * Persist detected flags idempotently and respecting operator review:
   *  - an existing OPEN flag is refreshed (severity/detail/detected_at);
   *  - a CONFIRMED flag, or a recently DISMISSED one, is left alone (do not
   *    re-flag what an operator already judged);
   *  - otherwise a new OPEN flag is inserted.
   * Returns the number of flags inserted or refreshed (skips are not counted).
   */
  async upsertFlags(flags: DetectedFlag[]): Promise<number> {
    const DISMISS_COOLDOWN_DAYS = 30;
    let written = 0;
    for (const f of flags) {
      const existing = await this.db.query<{ id: string; status: string; recent_dismissal: boolean }>(
        `SELECT id, status,
                (status = 'DISMISSED' AND reviewed_at > now() - ($3 || ' days')::interval) AS recent_dismissal
         FROM fraud_flags
         WHERE flag_type = $1 AND subject_id = $2
         ORDER BY detected_at DESC LIMIT 1`,
        [f.flagType, f.subjectId, String(DISMISS_COOLDOWN_DAYS)],
      );
      const row = existing.rows[0];
      if (row) {
        if (row.status === "OPEN") {
          await this.db.query(
            "UPDATE fraud_flags SET severity = $2, detail = $3, detected_at = now() WHERE id = $1",
            [row.id, f.severity, JSON.stringify(f.detail)],
          );
          written += 1;
        }
        // CONFIRMED or recently DISMISSED → respect the operator's judgement, skip.
        if (row.status === "CONFIRMED" || row.recent_dismissal) continue;
        if (row.status === "DISMISSED" && !row.recent_dismissal) {
          // dismissal expired → allow re-flagging
          await this.db.query(
            `INSERT INTO fraud_flags (flag_type, subject_type, subject_id, severity, detail)
             VALUES ($1,$2,$3,$4,$5)`,
            [f.flagType, f.subjectType, f.subjectId, f.severity, JSON.stringify(f.detail)],
          );
          written += 1;
        }
        continue;
      }
      await this.db.query(
        `INSERT INTO fraud_flags (flag_type, subject_type, subject_id, severity, detail)
         VALUES ($1,$2,$3,$4,$5)`,
        [f.flagType, f.subjectType, f.subjectId, f.severity, JSON.stringify(f.detail)],
      );
      written += 1;
    }
    return written;
  }

  async listFlags(status?: string, flagType?: string, limit = 100): Promise<FraudFlagRecord[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let i = 1;
    if (status) {
      conditions.push(`status = $${i}`);
      params.push(status);
      i += 1;
    }
    if (flagType) {
      conditions.push(`flag_type = $${i}`);
      params.push(flagType);
      i += 1;
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    params.push(limit);
    const { rows } = await this.db.query(
      `SELECT * FROM fraud_flags ${where} ORDER BY detected_at DESC LIMIT $${i}`,
      params,
    );
    return rows.map(mapFlag);
  }

  async findFlag(id: UUID): Promise<FraudFlagRecord | null> {
    const { rows } = await this.db.query("SELECT * FROM fraud_flags WHERE id = $1", [id]);
    return rows[0] ? mapFlag(rows[0]) : null;
  }

  async reviewFlag(
    id: UUID,
    status: FraudFlagStatus,
    reviewerUserId: UUID,
    note: string | undefined,
  ): Promise<FraudFlagRecord> {
    const { rows } = await this.db.query(
      `UPDATE fraud_flags
       SET status = $2, reviewed_by = $3, reviewed_at = now(), review_note = $4
       WHERE id = $1 RETURNING *`,
      [id, status, reviewerUserId, note ?? null],
    );
    return mapFlag(rows[0]!);
  }

  async countOpen(): Promise<number> {
    const { rows } = await this.db.query("SELECT count(*)::int AS c FROM fraud_flags WHERE status='OPEN'");
    return Number((rows[0] as { c: number }).c);
  }
}
