import { randomBytes } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { NotFoundError, type UUID } from "@tradescore/shared";
import { slugify } from "@tradescore/core";
import type { AuditLogger } from "@tradescore/logging";
import { MarketClustersRepository } from "../identity/market-clusters.repository";
import type { MarketClusterRecord } from "../identity/types";
import type { AuthenticatedUser } from "../common/auth/authenticated-user";
import { AUDIT_LOGGER } from "../tokens";

export interface PublicMarketCluster {
  id: UUID;
  name: string;
  slug: string;
  city: string | null;
  state: string | null;
  country: string;
  description: string | null;
}

@Injectable()
export class MarketClustersService {
  constructor(
    private readonly clusters: MarketClustersRepository,
    @Inject(AUDIT_LOGGER) private readonly audit: AuditLogger,
  ) {}

  async list(state?: string): Promise<PublicMarketCluster[]> {
    const rows = await this.clusters.list(state);
    return rows.map((c) => this.toPublic(c));
  }

  async getBySlug(slug: string): Promise<PublicMarketCluster> {
    const cluster = await this.clusters.findBySlug(slug);
    if (!cluster) throw new NotFoundError("Market cluster");
    return this.toPublic(cluster);
  }

  async create(
    _actor: AuthenticatedUser,
    input: {
      name: string;
      city?: string | undefined;
      state?: string | undefined;
      country?: string | undefined;
      description?: string | undefined;
    },
  ): Promise<PublicMarketCluster> {
    const slug = await this.uniqueSlug(input.name);
    const cluster = await this.clusters.create({
      name: input.name,
      slug,
      city: input.city,
      state: input.state,
      country: input.country,
      description: input.description,
    });
    this.audit.record({
      action: "market.created",
      resourceType: "market_cluster",
      resourceId: cluster.id,
      outcome: "success",
    });
    return this.toPublic(cluster);
  }

  private async uniqueSlug(name: string): Promise<string> {
    const base = slugify(name) || "market";
    if (!(await this.clusters.slugExists(base))) return base;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = `${base}-${randomBytes(2).toString("hex")}`;
      if (!(await this.clusters.slugExists(candidate))) return candidate;
    }
    return `${base}-${randomBytes(4).toString("hex")}`;
  }

  private toPublic(c: MarketClusterRecord): PublicMarketCluster {
    return {
      id: c.id,
      name: c.name,
      slug: c.slug,
      city: c.city,
      state: c.state,
      country: c.country,
      description: c.description,
    };
  }
}
