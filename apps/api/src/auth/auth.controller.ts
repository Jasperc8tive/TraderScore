import { Body, Controller, Post, UnauthorizedException } from "@nestjs/common";
import { AuthService, type AuthTokens } from "./auth.service";
import { RequestOtpDto, VerifyOtpDto, RefreshDto } from "./dto";
import { Public, CurrentUser } from "../common/auth/auth.decorators";
import type { AuthenticatedUser } from "../common/auth/authenticated-user";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post("otp/request")
  requestOtp(@Body() dto: RequestOtpDto): Promise<{ sent: true; expiresInSeconds: number; devCode?: string }> {
    return this.auth.requestOtp(dto.phone);
  }

  @Public()
  @Post("otp/verify")
  verifyOtp(@Body() dto: VerifyOtpDto): Promise<AuthTokens> {
    return this.auth.verifyOtp(dto.phone, dto.code);
  }

  @Public()
  @Post("refresh")
  refresh(@Body() dto: RefreshDto): Promise<AuthTokens> {
    return this.auth.refresh(dto.refreshToken);
  }

  @Post("logout")
  async logout(@CurrentUser() user: AuthenticatedUser | undefined): Promise<{ success: true }> {
    if (!user) throw new UnauthorizedException();
    await this.auth.logout(user.sessionId);
    return { success: true };
  }
}
