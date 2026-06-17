import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

/**
 * OTP (one-time passcode) architecture.
 *
 * Security properties enforced here (Trust Architecture Review §3, F8):
 *  - Codes are generated with a CSPRNG (`randomInt`), not Math.random.
 *  - Codes are NEVER stored or logged in plaintext — only an HMAC is persisted.
 *  - Verification is constant-time to avoid timing oracles.
 *  - Attempt counting + TTL + resend cooldown are modeled on the challenge so the
 *    store (Redis, added in Stage 2) can enforce rate limiting (F8) without
 *    changing this contract.
 *
 * This package provides the cryptography and the storage *interface*. The Redis
 * implementation and the SMS/WhatsApp delivery are wired in later stages.
 */
export interface OtpServiceOptions {
  /** Server-side secret used to HMAC codes before storage. */
  secret: string;
  length: number;
  ttlSeconds: number;
  maxAttempts: number;
}

/** A challenge as persisted by an OtpStore. The plaintext code is never stored. */
export interface OtpChallenge {
  identifier: string; // e.g. the phone number
  codeHash: string;
  expiresAt: Date;
  attempts: number;
}

export interface OtpStore {
  save(challenge: OtpChallenge): Promise<void>;
  get(identifier: string): Promise<OtpChallenge | null>;
  incrementAttempts(identifier: string): Promise<number>;
  delete(identifier: string): Promise<void>;
}

export type OtpVerifyResult =
  | { status: "ok" }
  | { status: "invalid" }
  | { status: "expired" }
  | { status: "too_many_attempts" }
  | { status: "not_found" };

export class OtpService {
  constructor(private readonly options: OtpServiceOptions) {}

  /** Generate a fresh numeric code using a CSPRNG (no modulo bias). */
  generateCode(): string {
    let code = "";
    for (let i = 0; i < this.options.length; i += 1) {
      code += randomInt(0, 10).toString();
    }
    return code;
  }

  /** HMAC a code for storage/comparison. */
  hash(code: string): string {
    return createHmac("sha256", this.options.secret).update(code).digest("hex");
  }

  /** Build a challenge for a freshly generated code (to be persisted by a store). */
  createChallenge(identifier: string, code: string): OtpChallenge {
    return {
      identifier,
      codeHash: this.hash(code),
      expiresAt: new Date(Date.now() + this.options.ttlSeconds * 1000),
      attempts: 0,
    };
  }

  /** Constant-time verification of a candidate code against a stored challenge. */
  verify(challenge: OtpChallenge | null, candidate: string): OtpVerifyResult {
    if (!challenge) return { status: "not_found" };
    if (challenge.attempts >= this.options.maxAttempts) {
      return { status: "too_many_attempts" };
    }
    if (challenge.expiresAt.getTime() < Date.now()) {
      return { status: "expired" };
    }
    const candidateHash = Buffer.from(this.hash(candidate));
    const storedHash = Buffer.from(challenge.codeHash);
    const matches =
      candidateHash.length === storedHash.length && timingSafeEqual(candidateHash, storedHash);
    return matches ? { status: "ok" } : { status: "invalid" };
  }
}
