import { Module } from "@nestjs/common";
import { IdentityModule } from "../identity/identity.module";
import { ReputationModule } from "../reputation/reputation.module";
import { DisputesRepository } from "../disputes/disputes.repository";
import { AdminRepository } from "./admin.repository";
import { AdminService } from "./admin.service";
import { AdminController } from "./admin.controller";

@Module({
  imports: [IdentityModule, ReputationModule],
  controllers: [AdminController],
  providers: [DisputesRepository, AdminRepository, AdminService],
})
export class AdminModule {}
