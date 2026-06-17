import { IsString, IsOptional, IsIn, IsUUID, MinLength, MaxLength, IsUrl } from "class-validator";
import { DisputeResolution } from "@tradescore/shared";

export class RaiseDisputeDto {
  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  reason!: string;
}

export class AddEvidenceDto {
  @IsString()
  @MinLength(3)
  @MaxLength(4000)
  body!: string;

  @IsOptional()
  @IsUrl()
  @MaxLength(2000)
  attachmentUrl?: string;
}

export class ResolveDisputeDto {
  @IsIn([DisputeResolution.UPHELD, DisputeResolution.DISMISSED])
  resolution!: DisputeResolution;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

export class ListDisputesDto {
  @IsUUID()
  businessId!: string;
}
