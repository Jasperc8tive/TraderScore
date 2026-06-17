import { Inject, Injectable } from "@nestjs/common";
import type { UUID } from "@tradescore/shared";
import type { Database } from "@tradescore/database";
import { DATABASE } from "../tokens";
import { mapMarketCluster } from "./row-mappers";
import type { MarketClusterRecord } from "./types";

export interface CreateMarketClusterInput {
  name: string;
  slug: string;
  city?: string | undefined;
  state?: string | undefined;
  country?: string | undefined;
  description?: string | undefined;
}

@Injectable()
export class MarketClustersRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async list(state?: string): Promise<MarketClusterRecord[]> {
    if (state) {
      const { rows } = await this.db.query(
        "SELECT * FROM market_clusters WHERE deleted_at IS NULL AND state = $1 ORDER BY name ASC",
        [state],
      );
      return rows.map(mapMarketCluster);
    }
    const { rows } = await this.db.query(
      "SELECT * FROM market_clusters WHERE deleted_at IS NULL ORDER BY name ASC",
    );
    return rows.map(mapMarketCluster);
  }

  async findBySlug(slug: string): Promise<MarketClusterRecord | null> {
    const { rows } = await this.db.query(
      "SELECT * FROM market_clusters WHERE slug = $1 AND deleted_at IS NULL",
      [slug],
    );
    return rows[0] ? mapMarketCluster(rows[0]) : null;
  }

  async findById(id: UUID): Promise<MarketClusterRecord | null> {
    const { rows } = await this.db.query(
      "SELECT * FROM market_clusters WHERE id = $1 AND deleted_at IS NULL",
      [id],
    );
    return rows[0] ? mapMarketCluster(rows[0]) : null;
  }

  async slugExists(slug: string): Promise<boolean> {
    const { rows } = await this.db.query(
      "SELECT 1 FROM market_clusters WHERE slug = $1 AND deleted_at IS NULL",
      [slug],
    );
    return rows.length > 0;
  }

  async update(
    id: UUID,
    fields: { name?: string; city?: string; state?: string; description?: string },
  ): Promise<MarketClusterRecord | null> {
    const columnMap: Record<string, string> = {
      name: "name",
      city: "city",
      state: "state",
      description: "description",
    };
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
    if (sets.length === 0) return this.findById(id);
    params.push(id);
    const { rows } = await this.db.query(
      `UPDATE market_clusters SET ${sets.join(", ")} WHERE id = $${i} AND deleted_at IS NULL RETURNING *`,
      params,
    );
    return rows[0] ? mapMarketCluster(rows[0]) : null;
  }

  async create(input: CreateMarketClusterInput): Promise<MarketClusterRecord> {
    const { rows } = await this.db.query(
      `INSERT INTO market_clusters (name, slug, city, state, country, description)
       VALUES ($1, $2, $3, $4, COALESCE($5, 'NG'), $6)
       RETURNING *`,
      [
        input.name,
        input.slug,
        input.city ?? null,
        input.state ?? null,
        input.country ?? null,
        input.description ?? null,
      ],
    );
    return mapMarketCluster(rows[0]!);
  }
}
