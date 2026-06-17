import type { AssuranceLevel, ScoreBand, UUID } from "@tradescore/shared";

/** A business as it appears in a discovery search result, enriched with trust. */
export interface DiscoveryRow {
  id: UUID;
  name: string;
  slug: string;
  description: string | null;
  marketClusterId: UUID | null;
  marketName: string | null;
  assuranceLevel: AssuranceLevel;
  score: number | null;
  band: ScoreBand | null;
  activePlan: string | null;
}
