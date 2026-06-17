import { Inject, Injectable } from "@nestjs/common";
import {
  type PlanId,
  type SubscriptionStatus,
  type InvoiceStatus,
  type UUID,
} from "@tradescore/shared";
import { Database } from "@tradescore/database";
import { DATABASE } from "../tokens";

export interface SubscriptionRecord {
  id: UUID;
  businessId: UUID;
  plan: PlanId;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
}

export interface InvoiceRecord {
  id: UUID;
  businessId: UUID;
  subscriptionId: UUID | null;
  plan: PlanId;
  amountMinor: number;
  currency: string;
  status: InvoiceStatus;
  providerRef: string | null;
  createdAt: Date;
  paidAt: Date | null;
}

function mapSub(r: Record<string, unknown>): SubscriptionRecord {
  return {
    id: r.id as string,
    businessId: r.business_id as string,
    plan: r.plan as PlanId,
    status: r.status as SubscriptionStatus,
    currentPeriodStart: new Date(r.current_period_start as string),
    currentPeriodEnd: new Date(r.current_period_end as string),
  };
}

function mapInvoice(r: Record<string, unknown>): InvoiceRecord {
  return {
    id: r.id as string,
    businessId: r.business_id as string,
    subscriptionId: (r.subscription_id as string | null) ?? null,
    plan: r.plan as PlanId,
    amountMinor: Number(r.amount_minor),
    currency: r.currency as string,
    status: r.status as InvoiceStatus,
    providerRef: (r.provider_ref as string | null) ?? null,
    createdAt: new Date(r.created_at as string),
    paidAt: r.paid_at ? new Date(r.paid_at as string) : null,
  };
}

@Injectable()
export class BillingRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async getActiveSubscription(businessId: UUID): Promise<SubscriptionRecord | null> {
    const { rows } = await this.db.query(
      "SELECT * FROM subscriptions WHERE business_id = $1 AND status IN ('ACTIVE','PAST_DUE')",
      [businessId],
    );
    return rows[0] ? mapSub(rows[0]) : null;
  }

  /** Activate or renew a business's subscription to a plan (one active per business). */
  async activateSubscription(
    businessId: UUID,
    plan: PlanId,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<SubscriptionRecord> {
    const existing = await this.getActiveSubscription(businessId);
    if (existing) {
      const { rows } = await this.db.query(
        `UPDATE subscriptions
         SET plan = $2, status = 'ACTIVE', current_period_start = $3, current_period_end = $4
         WHERE id = $1 RETURNING *`,
        [existing.id, plan, periodStart, periodEnd],
      );
      return mapSub(rows[0]!);
    }
    const { rows } = await this.db.query(
      `INSERT INTO subscriptions (business_id, plan, status, current_period_start, current_period_end)
       VALUES ($1, $2, 'ACTIVE', $3, $4) RETURNING *`,
      [businessId, plan, periodStart, periodEnd],
    );
    return mapSub(rows[0]!);
  }

  async cancelActiveSubscription(businessId: UUID): Promise<boolean> {
    const { rowCount } = await this.db.query(
      "UPDATE subscriptions SET status = 'CANCELLED' WHERE business_id = $1 AND status IN ('ACTIVE','PAST_DUE')",
      [businessId],
    );
    return (rowCount ?? 0) > 0;
  }

  async createInvoice(input: {
    businessId: UUID;
    subscriptionId: UUID | null;
    plan: PlanId;
    amountMinor: number;
    currency: string;
  }): Promise<InvoiceRecord> {
    const { rows } = await this.db.query(
      `INSERT INTO invoices (business_id, subscription_id, plan, amount_minor, currency)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [input.businessId, input.subscriptionId, input.plan, input.amountMinor, input.currency],
    );
    return mapInvoice(rows[0]!);
  }

  async markInvoicePaid(id: UUID, providerRef: string, subscriptionId: UUID): Promise<void> {
    await this.db.query(
      "UPDATE invoices SET status = 'PAID', provider_ref = $2, subscription_id = $3, paid_at = now() WHERE id = $1",
      [id, providerRef, subscriptionId],
    );
  }

  async markInvoiceFailed(id: UUID, error: string): Promise<void> {
    await this.db.query("UPDATE invoices SET status = 'FAILED', error = $2 WHERE id = $1", [
      id,
      error.slice(0, 500),
    ]);
  }

  async listInvoices(businessId: UUID): Promise<InvoiceRecord[]> {
    const { rows } = await this.db.query(
      "SELECT * FROM invoices WHERE business_id = $1 ORDER BY created_at DESC LIMIT 100",
      [businessId],
    );
    return rows.map(mapInvoice);
  }

  /** Active plan per business id (for discovery badge enrichment). */
  async getActivePlans(businessIds: UUID[]): Promise<Map<UUID, PlanId>> {
    if (businessIds.length === 0) return new Map();
    const { rows } = await this.db.query<{ business_id: string; plan: string }>(
      "SELECT business_id, plan FROM subscriptions WHERE status = 'ACTIVE' AND business_id = ANY($1)",
      [businessIds],
    );
    return new Map(rows.map((r) => [r.business_id as UUID, r.plan as PlanId]));
  }

  async revenueByPlan(): Promise<Array<{ plan: PlanId; count: number }>> {
    const { rows } = await this.db.query<{ plan: string; count: number }>(
      "SELECT plan, count(*)::int AS count FROM subscriptions WHERE status = 'ACTIVE' GROUP BY plan",
    );
    return rows.map((r) => ({ plan: r.plan as PlanId, count: Number(r.count) }));
  }
}
