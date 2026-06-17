import { Module } from "@nestjs/common";
import { UsersRepository } from "./users.repository";
import { BusinessesRepository } from "./businesses.repository";
import { BusinessMembersRepository } from "./business-members.repository";
import { MarketClustersRepository } from "./market-clusters.repository";

/**
 * Provides the identity persistence layer (repositories) to feature modules.
 * Repositories depend only on the DATABASE token from InfrastructureModule.
 */
@Module({
  providers: [
    UsersRepository,
    BusinessesRepository,
    BusinessMembersRepository,
    MarketClustersRepository,
  ],
  exports: [
    UsersRepository,
    BusinessesRepository,
    BusinessMembersRepository,
    MarketClustersRepository,
  ],
})
export class IdentityModule {}
