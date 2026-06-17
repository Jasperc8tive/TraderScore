import { IsOptional, IsString, IsUUID, IsIn, IsInt, Min, Max, MaxLength } from "class-validator";
import { Type } from "class-transformer";
import { AssuranceLevel, ScoreBand } from "@tradescore/shared";

export class DiscoverySearchDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  query?: string;

  @IsOptional()
  @IsUUID()
  marketClusterId?: string;

  @IsOptional()
  @IsIn(Object.values(AssuranceLevel))
  assuranceLevel?: AssuranceLevel;

  @IsOptional()
  @IsIn(Object.values(ScoreBand))
  band?: ScoreBand;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1000)
  minScore?: number;

  @IsOptional()
  @IsIn(["score", "name"])
  sort?: string;

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
