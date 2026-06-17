import { Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ForbiddenError, UnauthorizedError } from "@tradescore/shared";
import { can, type Permission } from "@tradescore/auth";
import { PERMISSIONS_KEY } from "./auth.decorators";
import type { AuthedRequest } from "./authenticated-user";

/**
 * Coarse, role-based capability check (the RBAC layer). Resource-level ownership
 * (e.g. "owner of THIS business") is enforced separately in services, because it
 * is data-dependent (see Stage 2 design note). Runs after JwtAuthGuard.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const user = request.user;
    if (!user) throw new UnauthorizedError();

    const allowed = required.every((permission) => can(user.role, permission));
    if (!allowed) {
      throw new ForbiddenError("You do not have permission to perform this action");
    }
    return true;
  }
}
