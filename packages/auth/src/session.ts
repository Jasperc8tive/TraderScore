import { randomBytes, createHash } from "node:crypto";
import type { UUID } from "@tradescore/shared";

/**
 * Server-side sessions (the revocable half of the auth model).
 *
 * The refresh credential is a high-entropy opaque token handed to the client.
 * We store only its SHA-256 hash, so a database/store leak does not expose usable
 * refresh tokens. Because sessions live server-side, we can revoke them — enabling
 * "log out everywhere" and immediate response to account takeover (Trust
 * Architecture Review §3, F8). The store implementation (Redis/Postgres) arrives
 * in Stage 2; this defines the contract and the token cryptography.
 */
export interface Session {
  id: UUID;
  userId: UUID;
  refreshTokenHash: string;
  createdAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  /** Coarse client fingerprint for anomaly detection (F2/F8). */
  userAgent?: string;
  ipAddress?: string;
}

export interface SessionStore {
  create(session: Session): Promise<void>;
  findById(id: UUID): Promise<Session | null>;
  /** Look up the active session a refresh token belongs to, by its hash. */
  findByRefreshTokenHash(hash: string): Promise<Session | null>;
  revoke(id: UUID): Promise<void>;
  revokeAllForUser(userId: UUID): Promise<void>;
}

/** Generate an opaque refresh token (returned to client) and its stored hash. */
export function generateRefreshToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("hex");
  return { token, hash: hashRefreshToken(token) };
}

export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** A session is usable only if it is neither revoked nor expired. */
export function isSessionActive(session: Session, now: Date = new Date()): boolean {
  return session.revokedAt === null && session.expiresAt.getTime() > now.getTime();
}
