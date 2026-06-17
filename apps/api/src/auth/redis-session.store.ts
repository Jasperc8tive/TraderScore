import type { Redis } from "ioredis";
import type { Session, SessionStore } from "@tradescore/auth";

/**
 * Redis-backed session store (the revocable half of the auth model).
 *
 * Two key spaces:
 *  - `session:{id}`        → the session record (TTL = session lifetime)
 *  - `session:refresh:{h}` → maps a refresh-token hash to its session id
 *  - `user:sessions:{uid}` → a set of a user's session ids (for log-out-everywhere)
 *
 * Revocation deletes the keys; a deleted session is treated as not-found and
 * therefore rejected — immediate, durable revocation (Trust Architecture Review
 * §3, F8). Only refresh-token hashes are stored, never the tokens themselves.
 */
export class RedisSessionStore implements SessionStore {
  constructor(private readonly redis: Redis) {}

  private sessionKey(id: string): string {
    return `session:${id}`;
  }
  private refreshKey(hash: string): string {
    return `session:refresh:${hash}`;
  }
  private userKey(userId: string): string {
    return `user:sessions:${userId}`;
  }

  async create(session: Session): Promise<void> {
    const ttl = Math.max(1, Math.ceil((session.expiresAt.getTime() - Date.now()) / 1000));
    const payload = JSON.stringify({
      ...session,
      createdAt: session.createdAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
      revokedAt: session.revokedAt ? session.revokedAt.toISOString() : null,
    });
    await this.redis
      .multi()
      .set(this.sessionKey(session.id), payload, "EX", ttl)
      .set(this.refreshKey(session.refreshTokenHash), session.id, "EX", ttl)
      .sadd(this.userKey(session.userId), session.id)
      .expire(this.userKey(session.userId), ttl)
      .exec();
  }

  async findById(id: string): Promise<Session | null> {
    const raw = await this.redis.get(this.sessionKey(id));
    return raw ? this.deserialize(raw) : null;
  }

  async findByRefreshTokenHash(hash: string): Promise<Session | null> {
    const id = await this.redis.get(this.refreshKey(hash));
    return id ? this.findById(id) : null;
  }

  async revoke(id: string): Promise<void> {
    const session = await this.findById(id);
    if (!session) return;
    await this.redis
      .multi()
      .del(this.sessionKey(id))
      .del(this.refreshKey(session.refreshTokenHash))
      .srem(this.userKey(session.userId), id)
      .exec();
  }

  async revokeAllForUser(userId: string): Promise<void> {
    const ids = await this.redis.smembers(this.userKey(userId));
    for (const id of ids) {
      await this.revoke(id);
    }
    await this.redis.del(this.userKey(userId));
  }

  private deserialize(raw: string): Session {
    const p = JSON.parse(raw) as Record<string, unknown>;
    return {
      id: p.id as string,
      userId: p.userId as string,
      refreshTokenHash: p.refreshTokenHash as string,
      createdAt: new Date(p.createdAt as string),
      expiresAt: new Date(p.expiresAt as string),
      revokedAt: p.revokedAt ? new Date(p.revokedAt as string) : null,
      ...(p.userAgent ? { userAgent: p.userAgent as string } : {}),
      ...(p.ipAddress ? { ipAddress: p.ipAddress as string } : {}),
    };
  }
}
