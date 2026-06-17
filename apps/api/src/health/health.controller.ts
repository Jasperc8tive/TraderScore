import { Controller, Get, Inject } from "@nestjs/common";
import type { Database } from "@tradescore/database";
import { DATABASE } from "../tokens";
import { Public } from "../common/auth/auth.decorators";

/**
 * Liveness/readiness endpoints.
 *
 * `/health` is a cheap liveness probe (the process is up). `/health/ready`
 * additionally checks the database, so an orchestrator (and, later, AWS ALB
 * target groups) only routes traffic once dependencies are reachable.
 */
@Public()
@Controller("health")
export class HealthController {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  @Get()
  liveness(): { status: string; uptime: number } {
    return { status: "ok", uptime: process.uptime() };
  }

  @Get("ready")
  async readiness(): Promise<{ status: string; checks: { database: boolean } }> {
    const database = await this.db.healthCheck();
    return { status: database ? "ok" : "degraded", checks: { database } };
  }
}
