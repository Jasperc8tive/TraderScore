import { IsString, IsOptional, MinLength, MaxLength } from "class-validator";

export class AddMemberDto {
  @IsString()
  @MinLength(7)
  @MaxLength(20)
  phone!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  fullName?: string;
}
