import jwt from "jsonwebtoken";
import type { Role, UUID } from "@tradescore/shared";

/**
 * JWT access tokens.
 *
 * Access tokens are short-lived and stateless: they assert "this user, this role,
 * for the next N minutes". They are intentionally NOT revocable on their own —
 * revocation is the job of the server-side session backing the refresh flow (see
 * session.ts). Keeping access tokens short-lived bounds the damage of a leaked
 * token (Trust Architecture Review §3, F8) without a database hit on every request.
 */
export interface AccessTokenClaims {
  /** Subject: the user id. */
  sub: UUID;
  role: Role;
  /** Session id this access token belongs to, for correlation/revocation checks. */
  sid: UUID;
}

export interface TokenServiceOptions {
  accessSecret: string;
  accessTtlSeconds: number;
  issuer: string;
}

export class TokenService {
  constructor(private readonly options: TokenServiceOptions) {}

  signAccessToken(claims: AccessTokenClaims): string {
    return jwt.sign(claims, this.options.accessSecret, {
      expiresIn: this.options.accessTtlSeconds,
      issuer: this.options.issuer,
    });
  }

  /** Verify and decode an access token. Throws if invalid/expired. */
  verifyAccessToken(token: string): AccessTokenClaims {
    const decoded = jwt.verify(token, this.options.accessSecret, {
      issuer: this.options.issuer,
    });
    if (typeof decoded === "string") {
      throw new Error("Unexpected token payload");
    }
    return { sub: decoded.sub as UUID, role: decoded.role as Role, sid: decoded.sid as UUID };
  }
}
