import { Injectable } from "@nestjs/common";
import {
  ScoreBand,
  NotFoundError,
  type AssuranceLevel,
  type ScoreBand as ScoreBandType,
  type Paginated,
  type UUID,
} from "@tradescore/shared";
import type { PlanId } from "@tradescore/shared";
import { BusinessesRepository } from "../identity/businesses.repository";
import { MarketClustersRepository } from "../identity/market-clusters.repository";
import { ReputationService } from "../reputation/reputation.service";
import { BillingRepository } from "../billing/billing.repository";
import { entitlementsFor } from "../billing/plans";
import { DiscoveryRepository, type DiscoverySearchQuery } from "./discovery.repository";
import { verificationBadge, parseSort, type VerificationBadge } from "./discovery-helpers";

export interface DiscoveryListItem {
  id: UUID;
  name: string;
  slug: string;
  description: string | null;
  marketName: string | null;
  assuranceLevel: AssuranceLevel;
  verification: VerificationBadge;
  /** Paid "Verified Seller" badge (commercial; distinct from identity assurance). */
  premiumVerified: boolean;
  score: number;
  band: ScoreBandType;
}

export interface TrustProfile extends DiscoveryListItem {
  phone: string | null;
  email: string | null;
  scoreComputedAt: Date;
  algorithmVersion: string;
  factors: Array<{ key: string; direction: string; weight: number; detail: Record<string, unknown> }>;
}

@Injectable()
export class DiscoveryService {
  constructor(
    private readonly discovery: DiscoveryRepository,
    private readonly businesses: BusinessesRepository,
    private readonly clusters: MarketClustersRepository,
    private readonly reputation: ReputationService,
    private readonly billing: BillingRepository,
  ) {}

  async search(input: {
    query?: string | undefined;
    marketClusterId?: string | undefined;
    assuranceLevel?: AssuranceLevel | undefined;
    band?: ScoreBandType | undefined;
    minScore?: number | undefined;
    sort?: string | undefined;
    page?: number | undefined;
    pageSize?: number | undefined;
  }): Promise<Paginated<DiscoveryListItem>> {
    const page = input.page ?? 1;
    const pageSize = input.pageSize ?? 20;
    const query: DiscoverySearchQuery = {
      query: input.query,
      marketClusterId: input.marketClusterId,
      assuranceLevel: input.assuranceLevel,
      band: input.band,
      minScore: input.minScore,
      sort: parseSort(input.sort),
      page,
      pageSize,
    };
    const { items, total } = await this.discovery.search(query);
    return {
      items: items.map((r) => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        description: r.description,
        marketName: r.marketName,
        assuranceLevel: r.assuranceLevel,
        verification: verificationBadge(r.assuranceLevel),
        premiumVerified: entitlementsFor(r.activePlan as PlanId | null).verifiedBadge,
        // No snapshot yet → present as NEW / 0 (consistent with Stage 5).
        score: r.score ?? 0,
        band: r.band ?? ScoreBand.NEW,
      })),
      total,
      page,
      pageSize,
    };
  }

  /** Full trust profile for a business: identity + market + verification + score + why. */
  async profile(slug: string): Promise<TrustProfile> {
    const business = await this.businesses.findBySlug(slug);
    if (!business) throw new NotFoundError("Business");

    const score = await this.reputation.getScore(business.id);
    const marketName = business.marketClusterId
      ? ((await this.clusters.findById(business.marketClusterId))?.name ?? null)
      : null;
    const activePlan = (await this.billing.getActivePlans([business.id])).get(business.id) ?? null;

    return {
      id: business.id,
      name: business.name,
      slug: business.slug,
      description: business.description,
      marketName,
      assuranceLevel: business.assuranceLevel,
      verification: verificationBadge(business.assuranceLevel),
      premiumVerified: entitlementsFor(activePlan).verifiedBadge,
      phone: business.phone,
      email: business.email,
      score: score.score,
      band: score.band,
      scoreComputedAt: score.computedAt,
      algorithmVersion: score.algorithmVersion,
      factors: score.factors,
    };
  }
}
