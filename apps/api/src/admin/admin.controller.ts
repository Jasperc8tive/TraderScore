import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UnauthorizedException,
} from "@nestjs/common";
import { Permission } from "@tradescore/auth";
import { AdminService } from "./admin.service";
import { ModerationReasonDto, UpdateMarketDto, DisputeQueueDto } from "./dto";
import { RequirePermissions, CurrentUser } from "../common/auth/auth.decorators";
import type { AuthenticatedUser } from "../common/auth/authenticated-user";

/**
 * Internal operations platform. Every route is gated by a specific permission
 * (least privilege) and every mutating action is audited in the service.
 */
@Controller("admin")
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  // --- Moderation: businesses (ADMIN + MODERATOR) --------------------------

  @RequirePermissions(Permission.BUSINESS_MODERATE)
  @Post("businesses/:id/suspend")
  async suspendBusiness(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param("id") id: string,
    @Body() dto: ModerationReasonDto,
  ): Promise<{ success: true }> {
    if (!user) throw new UnauthorizedException();
    await this.admin.suspendBusiness(user, id, dto.reason);
    return { success: true };
  }

  @RequirePermissions(Permission.BUSINESS_MODERATE)
  @Post("businesses/:id/reactivate")
  async reactivateBusiness(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param("id") id: string,
  ): Promise<{ success: true }> {
    if (!user) throw new UnauthorizedException();
    await this.admin.reactivateBusiness(user, id);
    return { success: true };
  }

  @RequirePermissions(Permission.BUSINESS_MODERATE)
  @Get("businesses/:id")
  review(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param("id") id: string,
  ): Promise<Record<string, unknown>> {
    if (!user) throw new UnauthorizedException();
    return this.admin.businessReview(id);
  }

  // --- Moderation: users (ADMIN only) --------------------------------------

  @RequirePermissions(Permission.USER_MANAGE)
  @Post("users/:id/suspend")
  async suspendUser(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param("id") id: string,
    @Body() dto: ModerationReasonDto,
  ): Promise<{ success: true }> {
    if (!user) throw new UnauthorizedException();
    await this.admin.suspendUser(user, id, dto.reason);
    return { success: true };
  }

  @RequirePermissions(Permission.USER_MANAGE)
  @Post("users/:id/reactivate")
  async reactivateUser(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param("id") id: string,
  ): Promise<{ success: true }> {
    if (!user) throw new UnauthorizedException();
    await this.admin.reactivateUser(user, id);
    return { success: true };
  }

  // --- Fraud dashboard -----------------------------------------------------

  @RequirePermissions(Permission.AUDIT_VIEW)
  @Get("fraud/overview")
  fraudOverview(): Promise<Record<string, unknown>> {
    return this.admin.fraudOverview();
  }

  @RequirePermissions(Permission.DISPUTE_RESOLVE)
  @Get("disputes")
  disputeQueue(@Query() query: DisputeQueueDto): ReturnType<AdminService["disputeQueue"]> {
    return this.admin.disputeQueue(query.status);
  }

  // --- Market management ---------------------------------------------------

  @RequirePermissions(Permission.MARKET_MANAGE)
  @Get("market-clusters")
  listMarkets(): ReturnType<AdminService["listMarkets"]> {
    return this.admin.listMarkets();
  }

  @RequirePermissions(Permission.MARKET_MANAGE)
  @Patch("market-clusters/:id")
  updateMarket(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param("id") id: string,
    @Body() dto: UpdateMarketDto,
  ): Promise<unknown> {
    if (!user) throw new UnauthorizedException();
    return this.admin.updateMarket(user, id, dto);
  }

  // --- Score monitoring ----------------------------------------------------

  @RequirePermissions(Permission.AUDIT_VIEW)
  @Get("scores/overview")
  scoreOverview(): Promise<Record<string, unknown>> {
    return this.admin.scoreOverview();
  }
}
