import { describe, expect, it } from "vitest";
import { Role } from "@tradescore/shared";
import { can, Permission, permissionsFor } from "./rbac";
import { TokenService } from "./tokens";
import { OtpService } from "./otp";

describe("RBAC", () => {
  it("grants admins every permission", () => {
    expect(can(Role.ADMIN, Permission.USER_MANAGE)).toBe(true);
    expect(can(Role.ADMIN, Permission.BUSINESS_VERIFY)).toBe(true);
  });

  it("enforces separation of duties for staff vs owner", () => {
    expect(can(Role.BUSINESS_STAFF, Permission.BUSINESS_VIEW)).toBe(true);
    expect(can(Role.BUSINESS_STAFF, Permission.BUSINESS_CREATE)).toBe(false);
    expect(can(Role.BUSINESS_OWNER, Permission.BUSINESS_CREATE)).toBe(true);
    expect(can(Role.BUSINESS_OWNER, Permission.BUSINESS_VERIFY)).toBe(false);
  });

  it("lists permissions for a role", () => {
    expect(permissionsFor(Role.MODERATOR)).toContain(Permission.BUSINESS_VERIFY);
  });
});

describe("TokenService", () => {
  const svc = new TokenService({
    accessSecret: "x".repeat(32),
    accessTtlSeconds: 900,
    issuer: "tradescore",
  });

  it("round-trips access token claims", () => {
    const token = svc.signAccessToken({ sub: "u1", role: Role.ADMIN, sid: "s1" });
    const claims = svc.verifyAccessToken(token);
    expect(claims.sub).toBe("u1");
    expect(claims.role).toBe(Role.ADMIN);
    expect(claims.sid).toBe("s1");
  });

  it("rejects a tampered token", () => {
    expect(() => svc.verifyAccessToken("not.a.jwt")).toThrow();
  });
});

describe("OtpService", () => {
  const otp = new OtpService({ secret: "s".repeat(32), length: 6, ttlSeconds: 300, maxAttempts: 5 });

  it("generates a code of configured length", () => {
    expect(otp.generateCode()).toMatch(/^\d{6}$/);
  });

  it("verifies a correct code and rejects a wrong one", () => {
    const code = otp.generateCode();
    const challenge = otp.createChallenge("+234", code);
    expect(otp.verify(challenge, code).status).toBe("ok");
    expect(otp.verify(challenge, "000000").status).toBe("invalid");
  });

  it("reports expiry and attempt exhaustion", () => {
    const code = otp.generateCode();
    const expired = { ...otp.createChallenge("+234", code), expiresAt: new Date(Date.now() - 1) };
    expect(otp.verify(expired, code).status).toBe("expired");

    const exhausted = { ...otp.createChallenge("+234", code), attempts: 5 };
    expect(otp.verify(exhausted, code).status).toBe("too_many_attempts");

    expect(otp.verify(null, code).status).toBe("not_found");
  });
});
