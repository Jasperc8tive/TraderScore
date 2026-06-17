import { SetMetadata, createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { Permission } from "@tradescore/auth";
import type { AuthenticatedUser, AuthedRequest } from "./authenticated-user";

/** Marks a route as public (skips JwtAuthGuard). */
export const IS_PUBLIC_KEY = "isPublic";
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);

/** Declares the permissions a route requires (checked by PermissionsGuard). */
export const PERMISSIONS_KEY = "requiredPermissions";
export const RequirePermissions = (
  ...permissions: Permission[]
): MethodDecorator & ClassDecorator => SetMetadata(PERMISSIONS_KEY, permissions);

/** Injects the authenticated user into a handler parameter. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser | undefined => {
    const request = ctx.switchToHttp().getRequest<AuthedRequest>();
    return request.user;
  },
);
