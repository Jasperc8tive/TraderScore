import { Module } from "@nestjs/common";
import { IdentityModule } from "../identity/identity.module";
import { ReputationModule } from "../reputation/reputation.module";
import { BillingModule } from "../billing/billing.module";
import { DiscoveryRepository } from "./discovery.repository";
import { DiscoveryService } from "./discovery.service";
import { DiscoveryController } from "./discovery.controller";

@Module({
  imports: [IdentityModule, ReputationModule, BillingModule],
  controllers: [DiscoveryController],
  providers: [DiscoveryRepository, DiscoveryService],
})
export class DiscoveryModule {}
