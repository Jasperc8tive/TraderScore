import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import {
  Role,
  UserStatus,
  UnauthorizedError,
  ValidationError,
  RateLimitedError,
  type UUID,
} from "@tradescore/shared";
import { normalizePhone } from "@tradescore/core";
import type {
  OtpService,
  TokenService} from "@tradescore/auth";
import {
  generateRefreshToken,
  hashRefreshToken,
  isSessionActive,
  type OtpStore,
  type SessionStore,
  type Session,
} from "@tradescore/auth";
import type { AppConfig } from "@tradescore/config";
import type { AuditLogger } from "@tradescore/logging";
import type { EventBus } from "@tradescore/events";
import { UsersRepository } from "../identity/users.repository";
import type { UserRecord } from "../identity/types";
import type { OtpDelivery } from "./otp-delivery";
import {
  APP_CONFIG,
  AUDIT_LOGGER,
  EVENT_BUS,
  OTP_DELIVERY,
  OTP_SERVICE,
  OTP_STORE,
  SESSION_STORE,
  TOKEN_SERVICE,
} from "../tokens";
import type { Redis } from "ioredis";
import { REDIS } from "../tokens";

export interface PublicUser {
  id: UUID;
  phone: string;
  role: Role;
  status: UserStatus;
  fullName: string | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: PublicUser;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersRepository,
    @Inject(OTP_SERVICE) private readonly otp: OtpService,
    @Inject(OTP_STORE) private readonly otpStore: OtpStore,
    @Inject(OTP_DELIVERY) private readonly delivery: OtpDelivery,
    @Inject(SESSION_STORE) private readonly sessions: SessionStore,
    @Inject(TOKEN_SERVICE) private readonly tokens: TokenService,
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    @Inject(AUDIT_LOGGER) private readonly audit: AuditLogger,
  ) {}

  /** Request an OTP for a phone. Rate-limited per phone via a Redis cooldown. */
  async requestOtp(rawPhone: string): Promise<{ sent: true; expiresInSeconds: number; devCode?: string }> {
    const phone = this.normalize(rawPhone);
    const cooldownKey = `otp:cooldown:${phone}`;
    if (await this.redis.exists(cooldownKey)) {
      this.audit.record({ action: "auth.otp.requested", outcome: "failure", metadata: { reason: "cooldown" } });
      throw new RateLimitedError("Please wait before requesting another code");
    }

    const user = await this.users.findOrCreateByPhone(phone, Role.BUSINESS_OWNER);
    const code = this.otp.generateCode();
    await this.otpStore.save(this.otp.createChallenge(phone, code));
    await this.redis.set(cooldownKey, "1", "EX", this.config.otp.resendCooldown);
    await this.delivery.send(phone, code);

    this.audit.record({
      action: "auth.otp.requested",
      resourceType: "user",
      resourceId: user.id,
      outcome: "success",
    });

    const exposeDev = this.delivery.exposesCode && !this.config.isProduction;
    return {
      sent: true,
      expiresInSeconds: this.config.otp.ttl,
      ...(exposeDev ? { devCode: code } : {}),
    };
  }

  /** Verify an OTP and, on success, establish a session and issue tokens. */
  async verifyOtp(rawPhone: string, code: string): Promise<AuthTokens> {
    const phone = this.normalize(rawPhone);
    const challenge = await this.otpStore.get(phone);
    const result = this.otp.verify(challenge, code);

    if (result.status !== "ok") {
      if (challenge && result.status === "invalid") {
        await this.otpStore.incrementAttempts(phone);
      }
      this.audit.record({
        action: "auth.otp.verified",
        outcome: "failure",
        metadata: { reason: result.status },
      });
      throw new UnauthorizedError("Invalid or expired code");
    }

    await this.otpStore.delete(phone);
    const existing = await this.users.findByPhone(phone);
    if (!existing) throw new UnauthorizedError("Account not found");
    // A suspended user cannot log back in — closes the loophole where OTP
    // verification would otherwise flip a moderated account back to ACTIVE.
    if (existing.status === UserStatus.SUSPENDED) {
      this.audit.record({
        action: "auth.otp.verified",
        resourceType: "user",
        resourceId: existing.id,
        outcome: "failure",
        metadata: { reason: "suspended" },
      });
      throw new UnauthorizedError("This account has been suspended");
    }

    const wasPending = existing.status === UserStatus.PENDING;
    const user = await this.users.activate(existing.id);

    const tokens = await this.issueSession(user);

    if (wasPending) {
      await this.events.publish("user.created", {
        userId: user.id,
        phone: user.phone,
        role: user.role,
      });
    }
    this.audit.record({
      action: "auth.otp.verified",
      resourceType: "user",
      resourceId: user.id,
      outcome: "success",
    });
    return tokens;
  }

  /** Rotate a refresh token: validate, revoke the old session, issue a new one. */
  async refresh(refreshToken: string): Promise<AuthTokens> {
    const hash = hashRefreshToken(refreshToken);
    const session = await this.sessions.findByRefreshTokenHash(hash);
    if (!session || !isSessionActive(session)) {
      throw new UnauthorizedError("Invalid refresh token");
    }
    const user = await this.users.findById(session.userId);
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedError("Account is not active");
    }
    // Rotation: the old session (and its refresh token) is revoked immediately.
    await this.sessions.revoke(session.id);
    const tokens = await this.issueSession(user);
    this.audit.record({
      action: "auth.token.refreshed",
      resourceType: "user",
      resourceId: user.id,
      outcome: "success",
    });
    return tokens;
  }

  async logout(sessionId: UUID): Promise<void> {
    await this.sessions.revoke(sessionId);
    this.audit.record({ action: "auth.logout", outcome: "success" });
  }

  private async issueSession(user: UserRecord): Promise<AuthTokens> {
    const { token: refreshToken, hash } = generateRefreshToken();
    const now = new Date();
    const session: Session = {
      id: randomUUID(),
      userId: user.id,
      refreshTokenHash: hash,
      createdAt: now,
      expiresAt: new Date(now.getTime() + this.config.auth.refreshTtl * 1000),
      revokedAt: null,
    };
    await this.sessions.create(session);
    const accessToken = this.tokens.signAccessToken({
      sub: user.id,
      role: user.role,
      sid: session.id,
    });
    return {
      accessToken,
      refreshToken,
      expiresIn: this.config.auth.accessTtl,
      user: this.toPublic(user),
    };
  }

  private toPublic(user: UserRecord): PublicUser {
    return {
      id: user.id,
      phone: user.phone,
      role: user.role,
      status: user.status,
      fullName: user.fullName,
    };
  }

  private normalize(rawPhone: string): string {
    const result = normalizePhone(rawPhone);
    if (!result.ok) throw new ValidationError("Invalid phone number");
    return result.value;
  }
}
