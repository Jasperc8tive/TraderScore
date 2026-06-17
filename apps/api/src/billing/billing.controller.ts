import { Body, Controller, Get, Param, Post, UnauthorizedException } from "@nestjs/common";
import { Permission } from "@tradescore/auth";
import { BillingService, type SubscriptionView, type RevenueMetrics } from "./billing.service";
import { SubscribeDto } from "./dto";
import { Public, RequirePermissions, CurrentUser } from "../common/auth/auth.decorators";
import type { AuthenticatedUser } from "../common/auth/authenticated-user";
import type { InvoiceRecord } from "./billing.repository";
import { PLANS } from "./plans";

@Controller()
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Public()
  @Get("billing/plans")
  plans(): typeof PLANS[keyof typeof PLANS][] {
    return this.billing.listPlans();
  }

  @Get("businesses/:id/subscription")
  getSubscription(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param("id") id: string,
  ): Promise<SubscriptionView> {
    if (!user) throw new UnauthorizedException();
    return this.billing.getSubscription(user, id);
  }

  @Post("businesses/:id/subscription")
  subscribe(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param("id") id: string,
    @Body() dto: SubscribeDto,
  ): Promise<SubscriptionView> {
    if (!user) throw new UnauthorizedException();
    return this.billing.subscribe(user, id, dto.plan);
  }

  @Post("businesses/:id/subscription/cancel")
  cancel(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param("id") id: string,
  ): Promise<SubscriptionView> {
    if (!user) throw new UnauthorizedException();
    return this.billing.cancel(user, id);
  }

  @Get("businesses/:id/invoices")
  invoices(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param("id") id: string,
  ): Promise<InvoiceRecord[]> {
    if (!user) throw new UnauthorizedException();
    return this.billing.listInvoices(user, id);
  }

  @RequirePermissions(Permission.AUDIT_VIEW)
  @Get("admin/billing/revenue")
  revenue(): Promise<RevenueMetrics> {
    return this.billing.getRevenueMetrics();
  }
}
