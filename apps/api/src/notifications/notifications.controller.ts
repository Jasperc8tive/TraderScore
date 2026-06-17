import { Controller, Get, UnauthorizedException } from "@nestjs/common";
import { NotificationsService } from "./notifications.service";
import { CurrentUser } from "../common/auth/auth.decorators";
import type { AuthenticatedUser } from "../common/auth/authenticated-user";
import type { NotificationRecord } from "./notifications.repository";

/**
 * The authenticated user's notification inbox. Authentication is enforced
 * globally; a user only ever sees their own notifications.
 */
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  inbox(@CurrentUser() user: AuthenticatedUser | undefined): Promise<NotificationRecord[]> {
    if (!user) throw new UnauthorizedException();
    return this.notifications.listInbox(user.id);
  }
}
