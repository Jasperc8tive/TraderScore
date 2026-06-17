import { Controller, Get } from "@nestjs/common";
import { Permission } from "@tradescore/auth";
import {
  AnalyticsRepository,
  type PilotMetrics,
  type PublicPilotSummary,
} from "./analytics.repository";
import { Public, RequirePermissions } from "../common/auth/auth.decorators";

/**
 * Pilot monitoring & trust-adoption metrics. The full dashboard is admin-only
 * (AUDIT_VIEW); a small public summary supports the landing page.
 */
@Controller()
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsRepository) {}

  @RequirePermissions(Permission.AUDIT_VIEW)
  @Get("admin/analytics/pilot")
  pilot(): Promise<PilotMetrics> {
    return this.analytics.pilotMetrics();
  }

  @Public()
  @Get("pilot/stats")
  summary(): Promise<PublicPilotSummary> {
    return this.analytics.publicSummary();
  }
}
