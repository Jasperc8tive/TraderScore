import {
  IsString,
  IsOptional,
  MinLength,
  MaxLength,
  IsEmail,
  IsUUID,
  IsIn,
  IsInt,
  Min,
  Max,
} from "class-validator";
import { Type } from "class-transformer";
import { AssuranceLevel } from "@tradescore/shared";

export class CreateBusinessDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsUUID()
  marketClusterId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  referralCode?: string;
}

export class UpdateBusinessDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsUUID()
  marketClusterId?: string;
}

export class VerifyBusinessDto {
  @IsIn([
    AssuranceLevel.PHONE_VERIFIED,
    AssuranceLevel.DOCUMENT_VERIFIED,
    AssuranceLevel.FULLY_VERIFIED,
  ])
  assuranceLevel!: AssuranceLevel;
}

export class SearchBusinessesDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  query?: string;

  @IsOptional()
  @IsUUID()
  marketClusterId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
