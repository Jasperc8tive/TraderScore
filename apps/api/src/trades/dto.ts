import {
  IsString,
  IsOptional,
  IsUUID,
  IsIn,
  IsInt,
  Min,
  Max,
  Matches,
  MaxLength,
} from "class-validator";
import { Type } from "class-transformer";
import { TradeDirection, TradeStatus } from "@tradescore/shared";

const DIRECTIONS = [TradeDirection.SALE, TradeDirection.PURCHASE];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const CURRENCY_RE = /^[A-Z]{3}$/;

export class CreateTradeDto {
  @IsUUID()
  initiatorBusinessId!: string;

  @IsOptional()
  @IsUUID()
  counterpartyBusinessId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  counterpartyName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  counterpartyPhone?: string;

  @IsIn(DIRECTIONS)
  direction!: TradeDirection;

  @IsInt()
  @Min(1)
  amountMinor!: number;

  @IsOptional()
  @Matches(CURRENCY_RE, { message: "currency must be a 3-letter ISO code" })
  currency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @Matches(DATE_RE, { message: "occurredOn must be YYYY-MM-DD" })
  occurredOn!: string;
}

export class EditTradeDto {
  @IsOptional()
  @IsUUID()
  counterpartyBusinessId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  counterpartyName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  counterpartyPhone?: string;

  @IsOptional()
  @IsIn(DIRECTIONS)
  direction?: TradeDirection;

  @IsOptional()
  @IsInt()
  @Min(1)
  amountMinor?: number;

  @IsOptional()
  @Matches(CURRENCY_RE, { message: "currency must be a 3-letter ISO code" })
  currency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @Matches(DATE_RE, { message: "occurredOn must be YYYY-MM-DD" })
  occurredOn?: string;
}

export class CancelTradeDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class ListTradesDto {
  @IsUUID()
  businessId!: string;

  @IsOptional()
  @IsIn(Object.values(TradeStatus))
  status?: TradeStatus;

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
