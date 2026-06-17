import { Module } from "@nestjs/common";
import { IdentityModule } from "../identity/identity.module";
import { TradesRepository } from "../trades/trades.repository";
import { DisputesRepository } from "./disputes.repository";
import { DisputesService } from "./disputes.service";
import { DisputesController } from "./disputes.controller";

@Module({
  imports: [IdentityModule],
  controllers: [DisputesController],
  providers: [TradesRepository, DisputesRepository, DisputesService],
})
export class DisputesModule {}
