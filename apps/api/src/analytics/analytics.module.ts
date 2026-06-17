import { Module } from "@nestjs/common";
import { AnalyticsRepository } from "./analytics.repository";
import { AnalyticsController } from "./analytics.controller";

@Module({
  controllers: [AnalyticsController],
  providers: [AnalyticsRepository],
})
export class AnalyticsModule {}
