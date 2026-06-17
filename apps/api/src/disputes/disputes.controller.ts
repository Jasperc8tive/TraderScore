import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UnauthorizedException,
} from "@nestjs/common";
import { Permission } from "@tradescore/auth";
import { DisputesService, type DisputeDetail } from "./disputes.service";
import { RaiseDisputeDto, AddEvidenceDto, ResolveDisputeDto, ListDisputesDto } from "./dto";
import { CurrentUser, RequirePermissions } from "../common/auth/auth.decorators";
import type { AuthenticatedUser } from "../common/auth/authenticated-user";
import type { DisputeRecord, DisputeEvidenceRecord } from "./types";

/**
 * Dispute workflow. All routes require authentication; party-membership and
 * adjudication rights are enforced in the service / via @RequirePermissions.
 */
@Controller()
export class DisputesController {
  constructor(private readonly disputes: DisputesService) {}

  @Post("trades/:tradeId/disputes")
  raise(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param("tradeId") tradeId: string,
    @Body() dto: RaiseDisputeDto,
  ): Promise<DisputeRecord> {
    if (!user) throw new UnauthorizedException();
    return this.disputes.raise(user, tradeId, dto.reason);
  }

  @Get("disputes")
  list(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Query() query: ListDisputesDto,
  ): Promise<DisputeRecord[]> {
    if (!user) throw new UnauthorizedException();
    return this.disputes.listForBusiness(user, query.businessId);
  }

  @Get("disputes/:id")
  get(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param("id") id: string,
  ): Promise<DisputeDetail> {
    if (!user) throw new UnauthorizedException();
    return this.disputes.get(user, id);
  }

  @Post("disputes/:id/evidence")
  addEvidence(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param("id") id: string,
    @Body() dto: AddEvidenceDto,
  ): Promise<DisputeEvidenceRecord> {
    if (!user) throw new UnauthorizedException();
    return this.disputes.addEvidence(user, id, dto.body, dto.attachmentUrl);
  }

  @Post("disputes/:id/withdraw")
  withdraw(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param("id") id: string,
  ): Promise<DisputeRecord> {
    if (!user) throw new UnauthorizedException();
    return this.disputes.withdraw(user, id);
  }

  @RequirePermissions(Permission.DISPUTE_RESOLVE)
  @Post("disputes/:id/review")
  review(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param("id") id: string,
  ): Promise<DisputeRecord> {
    if (!user) throw new UnauthorizedException();
    return this.disputes.review(user, id);
  }

  @RequirePermissions(Permission.DISPUTE_RESOLVE)
  @Post("disputes/:id/resolve")
  resolve(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param("id") id: string,
    @Body() dto: ResolveDisputeDto,
  ): Promise<DisputeRecord> {
    if (!user) throw new UnauthorizedException();
    return this.disputes.resolve(user, id, dto.resolution, dto.note);
  }
}
