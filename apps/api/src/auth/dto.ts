import { IsString, MinLength, MaxLength, Matches } from "class-validator";

export class RequestOtpDto {
  @IsString()
  @MinLength(7)
  @MaxLength(20)
  phone!: string;
}

export class VerifyOtpDto {
  @IsString()
  @MinLength(7)
  @MaxLength(20)
  phone!: string;

  @IsString()
  @Matches(/^\d{4,8}$/, { message: "code must be 4-8 digits" })
  code!: string;
}

export class RefreshDto {
  @IsString()
  @MinLength(16)
  refreshToken!: string;
}
