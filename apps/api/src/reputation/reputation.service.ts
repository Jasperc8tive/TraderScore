import { createHash } from "node:crypto";
import { Inject, Injectable, type OnApplicationBootstrap } from "@nestjs/common";
import { NotFoundError, type ScoreBand, type ScoreFactorDirection, type UUID } from "@tradescore/shared";
import type { EventBus } from "@tradescore/events";
import type { Logger } from "@tradescore/logging";
import { ReputationRepository } from "./reputation.repository";
import { computeScore, CURRENT_ALGORITHM_VERSION, type ScoringInput } from "./scoring";
import type { ScoreSnapshotRecord } from "./types";
import { EVENT_BUS, LOGGER } from "../tokens";

export interface ScorePresentation {
  businessId: UUID;
  score: number;
  band: ScoreBand;
  algorithmVersion: string;
  computedAt: Date;
  factors: Array<{
    key: string;
    direction: ScoreFactorDirection;
    weight: number;
    detail: Record<string, unknown>;
  }>;
}

export interface ScoreHistoryEntry {
  score: number;
  band: ScoreBand;
  algorithmVersion: string;
  computedAt: Date;
}

@Injectable()
export class ReputationService implements OnApplicationBootstrap {
  constructor(
    private readonly repo: ReputationRepository,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    @Inject(LOGGER) private readonly logger: Logger,
  ) {}

  /**
   * The reputation engine is a projection: it reacts to confirmation-lifecycle
   * events and recomputes the two businesses involved. Subscribers are isolated
   * (a scoring failure never breaks the trade flow) and idempotent.
   */
  onApplicationBootstrap(): void {
    const recomputeBoth = async (initiator: UUID, counterparty: UUID): Promise<void> => {
      await this.safeRecompute(initiator);
      await this.safeRecompute(counterparty);
    };
    this.events.subscribe("trade.confirmed", (e) =>
      recomputeBoth(e.payload.initiatorBusinessId, e.payload.counterpartyBusinessId),
    );
    this.events.subscribe("trade.rejected", (e) =>
      recomputeBoth(e.payload.initiatorBusinessId, e.payload.counterpartyBusinessId),
    );
    this.events.subscribe("trade.disputed", (e) =>
      recomputeBoth(e.payload.initiatorBusinessId, e.payload.counterpartyBusinessId),
    );
  }

  /**
   * Recompute a business's score from current data. Idempotent: if the inputs and
   * algorithm version are unchanged from the latest snapshot, no new row is
   * written (event-storm safe). Throws if the business does not exist.
   */
  async recompute(businessId: UUID): Promise<ScoreSnapshotRecord> {
    const input = await this.repo.getScoringInput(businessId);
    if (!input) throw new NotFoundError("Business");

    const result = computeScore(input);
    const inputsHash = this.computeInputsHash(input);

    const latest = await this.repo.getLatest(businessId);
    if (
      latest &&
      latest.inputsHash === inputsHash &&
      latest.algorithmVersion === CURRENT_ALGORITHM_VERSION
    ) {
      return latest; // nothing changed — avoid snapshot churn
    }

    return this.repo.saveSnapshot({
      businessId,
      algorithmVersion: CURRENT_ALGORITHM_VERSION,
      score: result.score,
      band: result.band,
      inputsHash,
      metadata: {},
      factors: result.factors,
    });
  }

  /** Current score + explanation. Lazily computes the first snapshot on demand. */
  async getScore(businessId: UUID): Promise<ScorePresentation> {
    let snapshot = await this.repo.getLatest(businessId);
    if (!snapshot) snapshot = await this.recompute(businessId);
    const factors = await this.repo.getFactors(snapshot.id);
    return {
      businessId,
      score: snapshot.score,
      band: snapshot.band,
      algorithmVersion: snapshot.algorithmVersion,
      computedAt: snapshot.computedAt,
      factors: factors.map((f) => ({
        key: f.factorKey,
        direction: f.direction,
        weight: f.weight,
        detail: f.detail,
      })),
    };
  }

  async getHistory(businessId: UUID): Promise<ScoreHistoryEntry[]> {
    const snapshots = await this.repo.getHistory(businessId);
    return snapshots.map((s) => ({
      score: s.score,
      band: s.band,
      algorithmVersion: s.algorithmVersion,
      computedAt: s.computedAt,
    }));
  }

  private async safeRecompute(businessId: UUID): Promise<void> {
    try {
      await this.recompute(businessId);
    } catch (error) {
      this.logger.error({ err: error, businessId }, "score recompute failed");
    }
  }

  /**
   * Deterministic hash of the exact inputs scored. Two recomputes over the same
   * data produce the same hash, which both proves reproducibility and lets us skip
   * writing identical snapshots.
   */
  private computeInputsHash(input: ScoringInput): string {
    const canonical = JSON.stringify({
      algo: CURRENT_ALGORITHM_VERSION,
      ids: input.confirmedTradeIds,
      ic: input.initiatorConfirmed,
      ir: input.initiatorRejected,
      id: input.initiatorDisputed,
      assuranceRank: input.assuranceRank,
    });
    return createHash("sha256").update(canonical).digest("hex");
  }
}
