import type { Redis } from "ioredis";
import type { OtpChallenge, OtpStore } from "@tradescore/auth";

/**
 * Redis-backed OTP store (the persistence the Stage 1 `OtpStore` interface
 * promised). Challenges are short-lived: the Redis key TTL is the OTP TTL, so
 * expired challenges clean themselves up. Only the HMAC of the code is ever
 * stored — never the plaintext (Trust Architecture Review §3, F8).
 */
export class RedisOtpStore implements OtpStore {
  constructor(private readonly redis: Redis) {}

  private key(identifier: string): string {
    return `otp:challenge:${identifier}`;
  }

  async save(challenge: OtpChallenge): Promise<void> {
    const ttlMs = challenge.expiresAt.getTime() - Date.now();
    const ttlSeconds = Math.max(1, Math.ceil(ttlMs / 1000));
    await this.redis.set(
      this.key(challenge.identifier),
      JSON.stringify({
        identifier: challenge.identifier,
        codeHash: challenge.codeHash,
        expiresAt: challenge.expiresAt.toISOString(),
        attempts: challenge.attempts,
      }),
      "EX",
      ttlSeconds,
    );
  }

  async get(identifier: string): Promise<OtpChallenge | null> {
    const raw = await this.redis.get(this.key(identifier));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      identifier: string;
      codeHash: string;
      expiresAt: string;
      attempts: number;
    };
    return {
      identifier: parsed.identifier,
      codeHash: parsed.codeHash,
      expiresAt: new Date(parsed.expiresAt),
      attempts: parsed.attempts,
    };
  }

  async incrementAttempts(identifier: string): Promise<number> {
    const existing = await this.get(identifier);
    if (!existing) return 0;
    const attempts = existing.attempts + 1;
    // Preserve the remaining TTL while updating the attempt counter.
    await this.redis.set(
      this.key(identifier),
      JSON.stringify({ ...existing, expiresAt: existing.expiresAt.toISOString(), attempts }),
      "KEEPTTL",
    );
    return attempts;
  }

  async delete(identifier: string): Promise<void> {
    await this.redis.del(this.key(identifier));
  }
}
