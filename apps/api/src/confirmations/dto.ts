import { IsString, IsOptional, IsUUID, IsInt, Min, Max, MinLength, MaxLength } from "class-validator";
import { Type } from "class-transformer";

export class DecisionNoteDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class DisputeDto {
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  reason!: string;
}

export class IncomingTradesDto {
  @IsUUID()
  businessId!: string;

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
