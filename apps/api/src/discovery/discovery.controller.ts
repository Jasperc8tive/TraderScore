import { Controller, Get, Param, Query } from "@nestjs/common";
import type { Paginated } from "@tradescore/shared";
import { DiscoveryService, type DiscoveryListItem, type TrustProfile } from "./discovery.service";
import { DiscoverySearchDto } from "./dto";
import { Public } from "../common/auth/auth.decorators";

/**
 * Public discovery surface. No authentication: letting anyone look up a business
 * and see its trust before doing business with it is the core MVP value.
 */
@Public()
@Controller("discovery")
export class DiscoveryController {
  constructor(private readonly discovery: DiscoveryService) {}

  @Get()
  search(@Query() query: DiscoverySearchDto): Promise<Paginated<DiscoveryListItem>> {
    return this.discovery.search(query);
  }

  @Get(":slug")
  profile(@Param("slug") slug: string): Promise<TrustProfile> {
    return this.discovery.profile(slug);
  }
}
