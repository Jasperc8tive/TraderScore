import { Inject, Injectable } from "@nestjs/common";
import {
  PlanId,
  SubscriptionStatus,
  Role,
  NotFoundError,
  ForbiddenError,
  InternalError,
  type UUID,
} from "@tradescore/shared";
import type { AuditLogger } from "@tradescore/logging";
import { BusinessesRepository } from "../identity/businesses.repository";
import { BusinessMembersRepository } from "../identity/business-members.repository";
import { BillingRepository, type InvoiceRecord } from "./billing.repository";
import { DevBillingProvider } from "./billing-provider";
import { TelemetryService } from "../telemetry/telemetry.service";
import { PLANS, getPlan, entitlementsFor, isPaidPlan, type PlanEntitlements } from "./plans";
import type { AuthenticatedUser } from "../common/auth/authenticated-user";
import { AUDIT_LOGGER } from "../tokens";

const PERIOD_DAYS = 30;

export interface SubscriptionView {
  plan: PlanId;
  status: SubscriptionStatus;
  currentPeriodEnd: Date | null;
  entitlements: PlanEntitlements;
}

export interface RevenueMetrics {
  activeByPlan: Array<{ plan: PlanId; count: number }>;
  mrrMinor: number;
  currency: string;
}

@Injectable()
export class BillingService {
  constructor(
    private readonly billing: BillingRepository,
    private readonly businesses: BusinessesRepository,
    private readonly members: BusinessMembersRepository,
    private readonly provider: DevBillingProvider,
    private readonly telemetry: TelemetryService,
    @Inject(AUDIT_LOGGER) private readonly audit: AuditLogger,
  ) {}

  listPlans(): typeof PLANS[PlanId][] {
    return Object.values(PLANS);
  }

  async getSubscription(actor: AuthenticatedUser, businessId: UUID): Promise<SubscriptionView> {
    await this.assertOwner(actor, businessId);
    return this.viewFor(businessId);
  }

  async listInvoices(actor: AuthenticatedUser, businessId: UUID): Promise<InvoiceRecord[]> {
    await this.assertOwner(actor, businessId);
    return this.billing.listInvoices(businessId);
  }

  /** Subscribe / upgrade / downgrade. Amounts are server-authoritative (from PLANS). */
  async subscribe(
    actor: AuthenticatedUser,
    businessId: UUID,
    planId: PlanId,
  ): Promise<SubscriptionView> {
    await this.assertOwner(actor, businessId);

    if (!isPaidPlan(planId)) {
      // Downgrade to FREE = cancel any active paid subscription.
      await this.billing.cancelActiveSubscription(businessId);
      this.telemetry.record("subscription.downgraded", { businessId, plan: planId });
      this.audit.record({ action: "billing.downgraded", resourceType: "business", resourceId: businessId, outcome: "success", metadata: { plan: planId } });
      return this.viewFor(businessId);
    }

    const plan = getPlan(planId);
    // Persist a PENDING invoice BEFORE charging (no lost record on failure).
    const invoice = await this.billing.createInvoice({
      businessId,
      subscriptionId: null,
      plan: plan.id,
      amountMinor: plan.priceMinor,
      currency: plan.currency,
    });

    let ref: string;
    try {
      const result = await this.provider.charge({
        businessId,
        amountMinor: plan.priceMinor, // from code, never the request
        currency: plan.currency,
        description: `TradeScore ${plan.name} subscription`,
      });
      ref = result.ref;
    } catch (error) {
      const message = error instanceof Error ? error.message : "charge failed";
      await this.billing.markInvoiceFailed(invoice.id, message);
      this.audit.record({ action: "billing.charge_failed", resourceType: "business", resourceId: businessId, outcome: "failure", metadata: { plan: plan.id } });
      throw new InternalError("Payment could not be processed");
    }

    const now = new Date();
    const periodEnd = new Date(now.getTime() + PERIOD_DAYS * 24 * 60 * 60 * 1000);
    const subscription = await this.billing.activateSubscription(businessId, plan.id, now, periodEnd);
    await this.billing.markInvoicePaid(invoice.id, ref, subscription.id);

    this.telemetry.record("subscription.created", { businessId, plan: plan.id, amountMinor: plan.priceMinor });
    this.audit.record({ action: "billing.subscribed", resourceType: "business", resourceId: businessId, outcome: "success", metadata: { plan: plan.id } });
    return this.viewFor(businessId);
  }

  async cancel(actor: AuthenticatedUser, businessId: UUID): Promise<SubscriptionView> {
    await this.assertOwner(actor, businessId);
    const cancelled = await this.billing.cancelActiveSubscription(businessId);
    if (cancelled) {
      this.telemetry.record("subscription.cancelled", { businessId });
      this.audit.record({ action: "billing.cancelled", resourceType: "business", resourceId: businessId, outcome: "success" });
    }
    return this.viewFor(businessId);
  }

  async getRevenueMetrics(): Promise<RevenueMetrics> {
    const activeByPlan = await this.billing.revenueByPlan();
    const mrrMinor = activeByPlan.reduce((sum, r) => sum + (PLANS[r.plan]?.priceMinor ?? 0) * r.count, 0);
    return { activeByPlan, mrrMinor, currency: "NGN" };
  }

  // --- helpers -------------------------------------------------------------

  private async viewFor(businessId: UUID): Promise<SubscriptionView> {
    const sub = await this.billing.getActiveSubscription(businessId);
    const plan = sub?.plan ?? PlanId.FREE;
    return {
      plan,
      status: sub?.status ?? SubscriptionStatus.ACTIVE,
      currentPeriodEnd: sub?.currentPeriodEnd ?? null,
      entitlements: entitlementsFor(plan),
    };
  }

  private async assertOwner(actor: AuthenticatedUser, businessId: UUID): Promise<void> {
    if (actor.role === Role.ADMIN) return;
    const business = await this.businesses.findById(businessId);
    if (!business) throw new NotFoundError("Business");
    const membership = await this.members.find(businessId, actor.id);
    if (!membership || membership.memberRole !== "OWNER") {
      throw new ForbiddenError("Only the business owner can manage billing");
    }
  }
}
