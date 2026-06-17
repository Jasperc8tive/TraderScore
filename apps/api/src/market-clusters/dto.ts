import { IsString, IsOptional, MinLength, MaxLength } from "class-validator";

export class CreateMarketClusterDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

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
  @MaxLength(2)
  country?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}

export class ListMarketClustersDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  state?: string;
}
