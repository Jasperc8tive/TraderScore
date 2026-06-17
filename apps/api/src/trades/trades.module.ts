import { Module } from "@nestjs/common";
import { IdentityModule } from "../identity/identity.module";
import { TradesRepository } from "./trades.repository";
import { TradesService } from "./trades.service";
import { TradesController } from "./trades.controller";

@Module({
  imports: [IdentityModule],
  controllers: [TradesController],
  providers: [TradesRepository, TradesService],
})
export class TradesModule {}
