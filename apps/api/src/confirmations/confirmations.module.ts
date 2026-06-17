import { Module } from "@nestjs/common";
import { IdentityModule } from "../identity/identity.module";
import { TradesRepository } from "../trades/trades.repository";
import { ConfirmationsRepository } from "./confirmations.repository";
import { ConfirmationsService } from "./confirmations.service";
import { ConfirmationsController } from "./confirmations.controller";

@Module({
  imports: [IdentityModule],
  controllers: [ConfirmationsController],
  providers: [TradesRepository, ConfirmationsRepository, ConfirmationsService],
})
export class ConfirmationsModule {}
