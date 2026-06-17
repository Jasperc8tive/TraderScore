import { IsString, IsOptional, IsIn, MaxLength } from "class-validator";
import { FraudFlagType, FraudFlagStatus } from "@tradescore/shared";

export class ListFlagsDto {
  @IsOptional()
  @IsIn(Object.values(FraudFlagStatus))
  status?: string;

  @IsOptional()
  @IsIn(Object.values(FraudFlagType))
  type?: string;
}

export class ReviewFlagDto {
  @IsIn([FraudFlagStatus.CONFIRMED, FraudFlagStatus.DISMISSED])
  status!: typeof FraudFlagStatus.CONFIRMED | typeof FraudFlagStatus.DISMISSED;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
