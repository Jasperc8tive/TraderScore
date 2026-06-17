import { Inject, Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { UnauthorizedError } from "@tradescore/shared";
import { TokenService, isSessionActive, type SessionStore } from "@tradescore/auth";
import { setActor } from "@tradescore/logging";
import { TOKEN_SERVICE, SESSION_STORE } from "../../tokens";
import { IS_PUBLIC_KEY } from "./auth.decorators";
import type { AuthedRequest } from "./authenticated-user";

/**
 * Authenticates every request unless the route is @Public.
 *
 * Verifies the access JWT (stateless, fast) AND confirms the backing session is
 * still active in the store. The session check is what makes revocation real: a
 * stolen access token stops working the moment its session is revoked — bounded
 * by the short access TTL even without it (Trust Architecture Review §3, F8).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(TOKEN_SERVICE) private readonly tokens: TokenService,
    @Inject(SESSION_STORE) private readonly sessions: SessionStore,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const token = this.extractBearer(request);
    if (!token) throw new UnauthorizedError("Missing bearer token");

    let claims;
    try {
      claims = this.tokens.verifyAccessToken(token);
    } catch {
      throw new UnauthorizedError("Invalid or expired token");
    }

    const session = await this.sessions.findById(claims.sid);
    if (!session || !isSessionActive(session)) {
      throw new UnauthorizedError("Session is no longer active");
    }

    request.user = { id: claims.sub, role: claims.role, sessionId: claims.sid };
    setActor(claims.sub, claims.role);
    return true;
  }

  private extractBearer(request: AuthedRequest): string | null {
    const header = request.headers["authorization"];
    const value = Array.isArray(header) ? header[0] : header;
    if (!value || !value.startsWith("Bearer ")) return null;
    return value.slice("Bearer ".length).trim() || null;
  }
}
