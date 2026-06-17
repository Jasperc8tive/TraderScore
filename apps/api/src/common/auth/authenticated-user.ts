import type { Role, UUID } from "@tradescore/shared";

/** The authenticated principal attached to a request by JwtAuthGuard. */
export interface AuthenticatedUser {
  id: UUID;
  role: Role;
  sessionId: UUID;
}

/** Express request augmented with the authenticated user. */
export interface AuthedRequest {
  user?: AuthenticatedUser;
  headers: Record<string, string | string[] | undefined>;
}
