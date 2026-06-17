import { Module } from "@nestjs/common";
import { IdentityModule } from "../identity/identity.module";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";

@Module({
  imports: [IdentityModule],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
