import { Controller, Get, Param, Post, UnauthorizedException } from "@nestjs/common";
import { Role, ForbiddenError } from "@tradescore/shared";
import {
  ReputationService,
  type ScorePresentation,
  type ScoreHistoryEntry,
} from "./reputation.service";
import { Public, CurrentUser } from "../common/auth/auth.decorators";
import type { AuthenticatedUser } from "../common/auth/authenticated-user";

/**
 * Reputation read endpoints are PUBLIC by design: letting a business check
 * another's trust before extending credit is the core MVP value. Recompute is an
 * admin-only operational action (scores otherwise recompute automatically on
 * confirmation events).
 */
@Controller("businesses/:businessId/score")
export class ReputationController {
  constructor(private readonly reputation: ReputationService) {}

  @Public()
  @Get()
  getScore(@Param("businessId") businessId: string): Promise<ScorePresentation> {
    return this.reputation.getScore(businessId);
  }

  @Public()
  @Get("history")
  getHistory(@Param("businessId") businessId: string): Promise<ScoreHistoryEntry[]> {
    return this.reputation.getHistory(businessId);
  }

  @Post("recompute")
  async recompute(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param("businessId") businessId: string,
  ): Promise<ScorePresentation> {
    if (!user) throw new UnauthorizedException();
    if (user.role !== Role.ADMIN) {
      throw new ForbiddenError("Only an administrator can force a score recompute");
    }
    await this.reputation.recompute(businessId);
    return this.reputation.getScore(businessId);
  }
}
