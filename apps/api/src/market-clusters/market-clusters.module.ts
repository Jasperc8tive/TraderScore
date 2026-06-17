import { Module } from "@nestjs/common";
import { IdentityModule } from "../identity/identity.module";
import { MarketClustersService } from "./market-clusters.service";
import { MarketClustersController } from "./market-clusters.controller";

@Module({
  imports: [IdentityModule],
  controllers: [MarketClustersController],
  providers: [MarketClustersService],
})
export class MarketClustersModule {}
