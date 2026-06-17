import { Module } from "@nestjs/common";
import { FraudRepository } from "./fraud.repository";
import { FraudService } from "./fraud.service";
import { FraudController } from "./fraud.controller";

@Module({
  controllers: [FraudController],
  providers: [FraudRepository, FraudService],
})
export class FraudModule {}
