import { Module } from "@nestjs/common";
import { ReputationRepository } from "./reputation.repository";
import { ReputationService } from "./reputation.service";
import { ReputationController } from "./reputation.controller";

@Module({
  controllers: [ReputationController],
  providers: [ReputationRepository, ReputationService],
  exports: [ReputationService],
})
export class ReputationModule {}
