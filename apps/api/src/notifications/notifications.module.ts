import { Module } from "@nestjs/common";
import { NotificationsRepository } from "./notifications.repository";
import { NotificationsService } from "./notifications.service";
import { NotificationsController } from "./notifications.controller";
import { LogNotificationProvider } from "./channels";

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsRepository, NotificationsService, LogNotificationProvider],
})
export class NotificationsModule {}
