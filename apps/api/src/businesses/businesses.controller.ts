import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UnauthorizedException,
} from "@nestjs/common";
import { Permission } from "@tradescore/auth";
import type { Paginated } from "@tradescore/shared";
import { BusinessesService, type PublicBusiness } from "./businesses.service";
import { CreateBusinessDto, UpdateBusinessDto, VerifyBusinessDto, SearchBusinessesDto } from "./dto";
import { Public, CurrentUser, RequirePermissions } from "../common/auth/auth.decorators";
import type { AuthenticatedUser } from "../common/auth/authenticated-user";

@Controller("businesses")
export class BusinessesController {
  constructor(private readonly businesses: BusinessesService) {}

  @Public()
  @Get()
  search(@Query() query: SearchBusinessesDto): Promise<Paginated<PublicBusiness>> {
    return this.businesses.search(query);
  }

  @Public()
  @Get(":slug")
  getBySlug(@Param("slug") slug: string): Promise<PublicBusiness> {
    return this.businesses.getBySlug(slug);
  }

  @Get(":id/referrals")
  referrals(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param("id") id: string,
  ): ReturnType<BusinessesService["getReferrals"]> {
    if (!user) throw new UnauthorizedException();
    return this.businesses.getReferrals(user, id);
  }

  @RequirePermissions(Permission.BUSINESS_CREATE)
  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Body() dto: CreateBusinessDto,
  ): Promise<PublicBusiness> {
    if (!user) throw new UnauthorizedException();
    return this.businesses.create(user, dto);
  }

  @RequirePermissions(Permission.BUSINESS_UPDATE)
  @Patch(":id")
  update(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param("id") id: string,
    @Body() dto: UpdateBusinessDto,
  ): Promise<PublicBusiness> {
    if (!user) throw new UnauthorizedException();
    return this.businesses.update(user, id, dto);
  }

  @RequirePermissions(Permission.BUSINESS_VERIFY)
  @Post(":id/verify")
  verify(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param("id") id: string,
    @Body() dto: VerifyBusinessDto,
  ): Promise<PublicBusiness> {
    if (!user) throw new UnauthorizedException();
    return this.businesses.verify(user, id, dto.assuranceLevel);
  }
}
