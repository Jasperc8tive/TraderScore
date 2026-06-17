import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UnauthorizedException,
} from "@nestjs/common";
import type { Paginated } from "@tradescore/shared";
import { ConfirmationsService } from "./confirmations.service";
import { DecisionNoteDto, DisputeDto, IncomingTradesDto } from "./dto";
import { CurrentUser } from "../common/auth/auth.decorators";
import type { AuthenticatedUser } from "../common/auth/authenticated-user";
import type { PublicTrade } from "../trades/trades.service";

/**
 * Counterparty confirmation workflow. A separate path namespace (`/confirmations`)
 * avoids any collision with `/trades/:id` routes. All routes require auth; the
 * counterparty-only integrity rule is enforced in the service.
 */
@Controller("confirmations")
export class ConfirmationsController {
  constructor(private readonly confirmations: ConfirmationsService) {}

  @Get("incoming")
  incoming(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Query() query: IncomingTradesDto,
  ): Promise<Paginated<PublicTrade>> {
    if (!user) throw new UnauthorizedException();
    return this.confirmations.listIncoming(user, query.businessId, query.page, query.pageSize);
  }

  @Post(":tradeId/confirm")
  confirm(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param("tradeId") tradeId: string,
    @Body() dto: DecisionNoteDto,
  ): Promise<PublicTrade> {
    if (!user) throw new UnauthorizedException();
    return this.confirmations.confirm(user, tradeId, dto.note);
  }

  @Post(":tradeId/reject")
  reject(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param("tradeId") tradeId: string,
    @Body() dto: DecisionNoteDto,
  ): Promise<PublicTrade> {
    if (!user) throw new UnauthorizedException();
    return this.confirmations.reject(user, tradeId, dto.note);
  }

  @Post(":tradeId/dispute")
  dispute(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param("tradeId") tradeId: string,
    @Body() dto: DisputeDto,
  ): Promise<PublicTrade> {
    if (!user) throw new UnauthorizedException();
    return this.confirmations.dispute(user, tradeId, dto.reason);
  }
}
