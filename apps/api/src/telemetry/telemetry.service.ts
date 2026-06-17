import { Inject, Injectable } from "@nestjs/common";
import type { AppConfig } from "@tradescore/config";
import type { Logger } from "@tradescore/logging";
import { APP_CONFIG, LOGGER } from "../tokens";

/**
 * Product analytics instrumentation. Records typed product events; locally (and
 * whenever PostHog is not configured) it logs on a dedicated channel. A PostHog
 * sink is config-gated (`POSTHOG_KEY`) and can be wired without changing callers.
 */
@Injectable()
export class TelemetryService {
  private readonly log: Logger;
  private readonly posthogEnabled: boolean;

  constructor(
    @Inject(LOGGER) logger: Logger,
    @Inject(APP_CONFIG) config: AppConfig,
  ) {
    this.log = logger.child({ channel: "telemetry" });
    this.posthogEnabled = Boolean(config.observability.posthogKey);
  }

  record(event: string, properties: Record<string, unknown> = {}): void {
    this.log.info({ telemetry: true, event, properties, sink: this.posthogEnabled ? "posthog" : "log" }, `event:${event}`);
    // When posthogEnabled, a PostHog client capture() call slots in here.
  }
}
