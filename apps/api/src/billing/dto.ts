import { IsIn } from "class-validator";
import { PlanId } from "@tradescore/shared";

export class SubscribeDto {
  @IsIn(Object.values(PlanId))
  plan!: PlanId;
}
