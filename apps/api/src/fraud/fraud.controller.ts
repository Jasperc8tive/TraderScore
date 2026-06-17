import { Body, Controller, Get, Param, Post, Query, UnauthorizedException } from "@nestjs/common";
import { Permission } from "@tradescore/auth";
import { FraudService } from "./fraud.service";
import { ListFlagsDto, ReviewFlagDto } from "./dto";
import { RequirePermissions, CurrentUser } from "../common/auth/auth.decorators";
import type { AuthenticatedUser } from "../common/auth/authenticated-user";
import type { FraudFlagRecord } from "./types";

/**
 * Fraud operations (admin). Viewing flags needs AUDIT_VIEW; acting on them
 * (review, full scan) needs FRAUD_MANAGE.
 */
@Controller("admin/fraud")
export class FraudController {
  constructor(private readonly fraud: FraudService) {}

  @RequirePermissions(Permission.AUDIT_VIEW)
  @Get("flags")
  listFlags(@Query() query: ListFlagsDto): Promise<FraudFlagRecord[]> {
    return this.fraud.listFlags(query.status, query.type);
  }

  @RequirePermissions(Permission.FRAUD_MANAGE)
  @Post("flags/:id/review")
  review(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param("id") id: string,
    @Body() dto: ReviewFlagDto,
  ): Promise<FraudFlagRecord> {
    if (!user) throw new UnauthorizedException();
    return this.fraud.reviewFlag(user, id, dto.status, dto.note);
  }

  @RequirePermissions(Permission.FRAUD_MANAGE)
  @Post("scan")
  scan(): Promise<{ flagsWritten: number }> {
    return this.fraud.runScan();
  }
}
