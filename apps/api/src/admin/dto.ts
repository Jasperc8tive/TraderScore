import { IsString, IsOptional, IsIn, MaxLength, MinLength } from "class-validator";
import { DisputeStatus } from "@tradescore/shared";

export class ModerationReasonDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

export class UpdateMarketDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  state?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}

export class DisputeQueueDto {
  @IsOptional()
  @IsIn(Object.values(DisputeStatus))
  status?: string;
}
