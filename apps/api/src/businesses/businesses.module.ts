import { Module } from "@nestjs/common";
import { IdentityModule } from "../identity/identity.module";
import { BusinessesService } from "./businesses.service";
import { BusinessesController } from "./businesses.controller";
import { MembersService } from "../members/members.service";
import { MembersController } from "../members/members.controller";

@Module({
  imports: [IdentityModule],
  controllers: [BusinessesController, MembersController],
  providers: [BusinessesService, MembersService],
})
export class BusinessesModule {}
