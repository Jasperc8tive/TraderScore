import { randomBytes } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type { Logger } from "@tradescore/logging";
import { LOGGER } from "../tokens";

export interface ChargeRequest {
  businessId: string;
  amountMinor: number;
  currency: string;
  description: string;
}

export interface ChargeResult {
  ref: string;
}

/**
 * Payment provider abstraction. A real PSP (Paystack/Stripe) implements this and
 * is config-gated; locally the dev provider auto-succeeds. NO card data passes
 * through or is stored here — only an opaque provider reference is returned.
 */
export interface BillingProvider {
  charge(request: ChargeRequest): Promise<ChargeResult>;
}

@Injectable()
export class DevBillingProvider implements BillingProvider {
  constructor(@Inject(LOGGER) private readonly logger: Logger) {}

  async charge(request: ChargeRequest): Promise<ChargeResult> {
    const ref = `dev_${randomBytes(8).toString("hex")}`;
    this.logger.info(
      { businessId: request.businessId, amountMinor: request.amountMinor, ref },
      `dev billing charge: ${request.currency} ${request.amountMinor / 100}`,
    );
    return { ref };
  }
}
