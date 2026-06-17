import { Body, Controller, Get, Param, Post, Query, UnauthorizedException } from "@nestjs/common";
import { Permission } from "@tradescore/auth";
import { MarketClustersService, type PublicMarketCluster } from "./market-clusters.service";
import { CreateMarketClusterDto, ListMarketClustersDto } from "./dto";
import { Public, CurrentUser, RequirePermissions } from "../common/auth/auth.decorators";
import type { AuthenticatedUser } from "../common/auth/authenticated-user";

@Controller("market-clusters")
export class MarketClustersController {
  constructor(private readonly clusters: MarketClustersService) {}

  @Public()
  @Get()
  list(@Query() query: ListMarketClustersDto): Promise<PublicMarketCluster[]> {
    return this.clusters.list(query.state);
  }

  @Public()
  @Get(":slug")
  getBySlug(@Param("slug") slug: string): Promise<PublicMarketCluster> {
    return this.clusters.getBySlug(slug);
  }

  @RequirePermissions(Permission.MARKET_MANAGE)
  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Body() dto: CreateMarketClusterDto,
  ): Promise<PublicMarketCluster> {
    if (!user) throw new UnauthorizedException();
    return this.clusters.create(user, dto);
  }
}
