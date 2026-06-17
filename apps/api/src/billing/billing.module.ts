import { Module } from "@nestjs/common";
import { IdentityModule } from "../identity/identity.module";
import { BillingRepository } from "./billing.repository";
import { BillingService } from "./billing.service";
import { BillingController } from "./billing.controller";
import { DevBillingProvider } from "./billing-provider";
import { TelemetryService } from "../telemetry/telemetry.service";

@Module({
  imports: [IdentityModule],
  controllers: [BillingController],
  providers: [BillingRepository, BillingService, DevBillingProvider, TelemetryService],
  exports: [BillingRepository],
})
export class BillingModule {}
