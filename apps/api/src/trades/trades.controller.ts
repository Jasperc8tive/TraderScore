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
import type { Paginated } from "@tradescore/shared";
import { TradesService, type PublicTrade } from "./trades.service";
import { CreateTradeDto, EditTradeDto, CancelTradeDto, ListTradesDto } from "./dto";
import { CurrentUser } from "../common/auth/auth.decorators";
import type { AuthenticatedUser } from "../common/auth/authenticated-user";
import type { TradeEventRecord } from "./types";

/**
 * All trade routes require authentication (global JwtAuthGuard). Resource access
 * (membership of the initiator business) is enforced in the service.
 */
@Controller("trades")
export class TradesController {
  constructor(private readonly trades: TradesService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Body() dto: CreateTradeDto,
  ): Promise<PublicTrade> {
    if (!user) throw new UnauthorizedException();
    return this.trades.create(user, dto);
  }

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Query() query: ListTradesDto,
  ): Promise<Paginated<PublicTrade>> {
    if (!user) throw new UnauthorizedException();
    return this.trades.list(user, query.businessId, query.status, query.page, query.pageSize);
  }

  @Get(":id")
  get(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param("id") id: string,
  ): Promise<PublicTrade> {
    if (!user) throw new UnauthorizedException();
    return this.trades.get(user, id);
  }

  @Get(":id/history")
  history(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param("id") id: string,
  ): Promise<TradeEventRecord[]> {
    if (!user) throw new UnauthorizedException();
    return this.trades.history(user, id);
  }

  @Patch(":id")
  edit(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param("id") id: string,
    @Body() dto: EditTradeDto,
  ): Promise<PublicTrade> {
    if (!user) throw new UnauthorizedException();
    return this.trades.edit(user, id, dto);
  }

  @Post(":id/submit")
  submit(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param("id") id: string,
  ): Promise<PublicTrade> {
    if (!user) throw new UnauthorizedException();
    return this.trades.submit(user, id);
  }

  @Post(":id/cancel")
  cancel(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param("id") id: string,
    @Body() dto: CancelTradeDto,
  ): Promise<PublicTrade> {
    if (!user) throw new UnauthorizedException();
    return this.trades.cancel(user, id, dto.reason);
  }
}
