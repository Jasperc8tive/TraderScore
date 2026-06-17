import { Inject, Injectable, type OnApplicationBootstrap } from "@nestjs/common";
import {
  FraudFlagStatus,
  ConflictError,
  NotFoundError,
  type UUID,
} from "@tradescore/shared";
import type { EventBus } from "@tradescore/events";
import type { Logger } from "@tradescore/logging";
import { FraudRepository } from "./fraud.repository";
import {
  detectSybil,
  detectCircularTrading,
  detectSuspicious,
  detectRelationshipRisk,
  SYBIL_MIN_BUSINESSES,
  type DetectedFlag,
} from "./detectors";
import type { FraudFlagRecord } from "./types";
import type { AuthenticatedUser } from "../common/auth/authenticated-user";
import { EVENT_BUS, LOGGER } from "../tokens";

@Injectable()
export class FraudService implements OnApplicationBootstrap {
  constructor(
    private readonly repo: FraudRepository,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    @Inject(LOGGER) private readonly logger: Logger,
  ) {}

  /**
   * The fraud engine reacts to confirmation events with detection scoped to the
   * two businesses (bounded work), plus the cheap global Sybil check. Isolated and
   * idempotent: a detector failure never breaks the trade flow.
   */
  onApplicationBootstrap(): void {
    this.events.subscribe("trade.confirmed", (e) =>
      this.safeDetectForBusinesses([e.payload.initiatorBusinessId, e.payload.counterpartyBusinessId]),
    );
  }

  /** Full-graph scan (admin/batch). Runs every detector over all data. */
  async runScan(): Promise<{ flagsWritten: number }> {
    const [creators, edges, stats, pairs] = await Promise.all([
      this.repo.getCreatorCounts(SYBIL_MIN_BUSINESSES),
      this.repo.getConfirmedEdges(),
      this.repo.getPerBusinessStats(),
      this.repo.getPairStats(),
    ]);
    const flags: DetectedFlag[] = [
      ...detectSybil(creators),
      ...detectCircularTrading(edges),
      ...detectSuspicious(stats),
      ...detectRelationshipRisk(pairs),
    ];
    const flagsWritten = await this.repo.upsertFlags(flags);
    this.logger.info({ flagsWritten }, "fraud full scan complete");
    return { flagsWritten };
  }

  async listFlags(status?: string, flagType?: string): Promise<FraudFlagRecord[]> {
    return this.repo.listFlags(status, flagType);
  }

  /** Operator confirms or dismisses an open flag. */
  async reviewFlag(
    actor: AuthenticatedUser,
    id: UUID,
    status: FraudFlagStatus,
    note: string | undefined,
  ): Promise<FraudFlagRecord> {
    const flag = await this.repo.findFlag(id);
    if (!flag) throw new NotFoundError("Fraud flag");
    if (flag.status !== FraudFlagStatus.OPEN) {
      throw new ConflictError("This flag has already been reviewed");
    }
    return this.repo.reviewFlag(id, status, actor.id, note);
  }

  // --- internals -----------------------------------------------------------

  private async safeDetectForBusinesses(ids: UUID[]): Promise<void> {
    try {
      const scope = ids.filter((x): x is UUID => Boolean(x));
      if (scope.length === 0) return;
      const [creators, edges, stats, pairs] = await Promise.all([
        this.repo.getCreatorCounts(SYBIL_MIN_BUSINESSES),
        this.repo.getConfirmedEdges(),
        this.repo.getPerBusinessStats(scope),
        this.repo.getPairStats(scope),
      ]);
      const cycles = detectCircularTrading(edges).filter((f) => {
        const members = (f.detail.members as string[]) ?? [];
        return members.some((m) => scope.includes(m));
      });
      const flags: DetectedFlag[] = [
        ...detectSybil(creators),
        ...cycles,
        ...detectSuspicious(stats),
        ...detectRelationshipRisk(pairs),
      ];
      const written = await this.repo.upsertFlags(flags);
      if (written > 0) {
        this.logger.debug({ scope, written }, "fraud detection (event-scoped) wrote flags");
      }
    } catch (error) {
      this.logger.error({ err: error, ids }, "fraud detection failed");
    }
  }
}
