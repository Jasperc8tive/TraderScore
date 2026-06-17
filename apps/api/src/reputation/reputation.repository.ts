import { Inject, Injectable } from "@nestjs/common";
import {
  ASSURANCE_RANK,
  TradeStatus,
  type AssuranceLevel,
  type ScoreBand,
  type ScoreFactorDirection,
  type UUID,
} from "@tradescore/shared";
import { Database } from "@tradescore/database";
import { DATABASE } from "../tokens";
import type { ScoringInput, ComputedFactor } from "./scoring";
import type { ScoreSnapshotRecord, ScoreFactorRecord } from "./types";

function mapSnapshot(r: Record<string, unknown>): ScoreSnapshotRecord {
  return {
    id: r.id as string,
    businessId: r.business_id as string,
    algorithmVersion: r.algorithm_version as string,
    score: Number(r.score),
    band: r.band as ScoreBand,
    inputsHash: r.inputs_hash as string,
    metadata: (r.metadata as Record<string, unknown>) ?? {},
    computedAt: new Date(r.computed_at as string),
  };
}

export interface SaveSnapshotInput {
  businessId: UUID;
  algorithmVersion: string;
  score: number;
  band: ScoreBand;
  inputsHash: string;
  metadata: Record<string, unknown>;
  factors: ComputedFactor[];
}

@Injectable()
export class ReputationRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /**
   * Build the exact scoring input for a business from stored, CONFIRMED data.
   * Returns null if the business does not exist. This is the single source of the
   * inputs that make scoring a pure, reproducible function (TAR §4).
   */
  async getScoringInput(businessId: UUID): Promise<ScoringInput | null> {
    const biz = await this.db.query<{ assurance_level: string }>(
      "SELECT assurance_level FROM businesses WHERE id = $1 AND deleted_at IS NULL",
      [businessId],
    );
    if (biz.rows.length === 0) return null;
    const assuranceLevel = biz.rows[0]!.assurance_level as AssuranceLevel;

    const confirmed = await this.db.query<{ id: string; other_id: string | null }>(
      `SELECT id,
              CASE WHEN initiator_business_id = $1 THEN counterparty_business_id
                   ELSE initiator_business_id END AS other_id
       FROM trades
       WHERE deleted_at IS NULL AND status = $2
         AND (initiator_business_id = $1 OR counterparty_business_id = $1)`,
      [businessId, TradeStatus.CONFIRMED],
    );
    const confirmedTradeIds = confirmed.rows.map((r) => r.id).sort((a, b) => a.localeCompare(b));
    const distinct = new Set(
      confirmed.rows.map((r) => r.other_id).filter((x): x is string => x !== null),
    );

    const decided = await this.db.query<{ status: string; c: number }>(
      `SELECT status, count(*)::int AS c
       FROM trades
       WHERE deleted_at IS NULL AND initiator_business_id = $1
         AND status IN ('CONFIRMED', 'REJECTED', 'DISPUTED')
       GROUP BY status`,
      [businessId],
    );
    const counts: Record<string, number> = {};
    for (const row of decided.rows) counts[row.status] = Number(row.c);

    return {
      businessId,
      assuranceLevel,
      assuranceRank: ASSURANCE_RANK[assuranceLevel] ?? 0,
      confirmedTradeCount: confirmedTradeIds.length,
      distinctCounterparties: distinct.size,
      confirmedTradeIds,
      initiatorConfirmed: counts[TradeStatus.CONFIRMED] ?? 0,
      initiatorRejected: counts[TradeStatus.REJECTED] ?? 0,
      initiatorDisputed: counts[TradeStatus.DISPUTED] ?? 0,
    };
  }

  /** Persist a snapshot and its factors atomically (append-only). */
  async saveSnapshot(input: SaveSnapshotInput): Promise<ScoreSnapshotRecord> {
    return this.db.withTransaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO score_snapshots (business_id, algorithm_version, score, band, inputs_hash, metadata)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          input.businessId,
          input.algorithmVersion,
          input.score,
          input.band,
          input.inputsHash,
          JSON.stringify(input.metadata),
        ],
      );
      const snapshot = mapSnapshot(rows[0]!);
      for (const f of input.factors) {
        await client.query(
          `INSERT INTO score_factors (snapshot_id, factor_key, weight, direction, detail)
           VALUES ($1, $2, $3, $4, $5)`,
          [snapshot.id, f.key, f.weight, f.direction, JSON.stringify(f.detail)],
        );
      }
      return snapshot;
    });
  }

  async getLatest(businessId: UUID): Promise<ScoreSnapshotRecord | null> {
    const { rows } = await this.db.query(
      "SELECT * FROM score_snapshots WHERE business_id = $1 ORDER BY computed_at DESC LIMIT 1",
      [businessId],
    );
    return rows[0] ? mapSnapshot(rows[0]) : null;
  }

  async getHistory(businessId: UUID, limit = 50): Promise<ScoreSnapshotRecord[]> {
    const { rows } = await this.db.query(
      "SELECT * FROM score_snapshots WHERE business_id = $1 ORDER BY computed_at DESC LIMIT $2",
      [businessId, limit],
    );
    return rows.map(mapSnapshot);
  }

  async getFactors(snapshotId: UUID): Promise<ScoreFactorRecord[]> {
    const { rows } = await this.db.query(
      "SELECT * FROM score_factors WHERE snapshot_id = $1 ORDER BY weight DESC",
      [snapshotId],
    );
    return rows.map((r) => ({
      id: r.id as string,
      snapshotId: r.snapshot_id as string,
      factorKey: r.factor_key as string,
      weight: Number(r.weight),
      direction: r.direction as ScoreFactorDirection,
      detail: (r.detail as Record<string, unknown>) ?? {},
    }));
  }
}
