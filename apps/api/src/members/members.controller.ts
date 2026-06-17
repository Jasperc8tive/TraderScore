import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  UnauthorizedException,
} from "@nestjs/common";
import { MembersService, type MemberView } from "./members.service";
import { AddMemberDto } from "./dto";
import { CurrentUser } from "../common/auth/auth.decorators";
import type { AuthenticatedUser } from "../common/auth/authenticated-user";

/**
 * Membership management is scoped under a business. Authentication is enforced
 * globally; resource ownership (must be OWNER of this business) is enforced in
 * the service, since it is data-dependent.
 */
@Controller("businesses/:businessId/members")
export class MembersController {
  constructor(private readonly members: MembersService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param("businessId") businessId: string,
  ): Promise<MemberView[]> {
    if (!user) throw new UnauthorizedException();
    return this.members.list(user, businessId);
  }

  @Post()
  add(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param("businessId") businessId: string,
    @Body() dto: AddMemberDto,
  ): Promise<MemberView> {
    if (!user) throw new UnauthorizedException();
    return this.members.addStaff(user, businessId, dto);
  }

  @Delete(":userId")
  @HttpCode(204)
  async remove(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param("businessId") businessId: string,
    @Param("userId") userId: string,
  ): Promise<void> {
    if (!user) throw new UnauthorizedException();
    await this.members.remove(user, businessId, userId);
  }
}
