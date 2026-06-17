# ADR-0004: Authentication — OTP + short-lived JWT + revocable sessions

- **Status:** Accepted
- **Date:** Stage 1
- **Deciders:** Principal Security Engineer

## Context

The primary audience is informal traders who are phone-first and may not manage
passwords well. Authentication must be low-friction yet resistant to account
takeover (Trust Architecture Review §3, F8), and we must be able to revoke access
immediately when takeover or abuse is detected. We also need stateless,
low-latency authorization on the hot path.

## Decision

- **OTP** (one-time passcode to phone) as the primary factor. Codes are CSPRNG-
  generated, stored only as an HMAC, single-use, TTL-bound, attempt-limited, and
  resend-cooldown-limited.
- **Short-lived JWT access tokens** carry `sub`, `role`, and `sid` for stateless
  authorization on each request.
- **Server-side, revocable sessions** back the refresh flow. The refresh token is
  high-entropy and stored only as a SHA-256 hash; sessions can be revoked
  individually or all-at-once for a user ("log out everywhere").
- **Capability-based RBAC** with four roles (ADMIN, MODERATOR, BUSINESS_OWNER,
  BUSINESS_STAFF) enforcing least privilege and separation of duties.

Stage 1 delivers the cryptography, token service, RBAC, and the OTP/session
*interfaces*. The Redis-backed stores and SMS/WhatsApp delivery are wired in
Stage 2.

## Alternatives considered

- **Password-only:** rejected — poor fit and security for the audience.
- **Long-lived stateless JWT with no server session:** rejected — cannot revoke;
  a stolen token is valid until expiry.
- **Opaque server-side sessions for everything:** rejected for the access path —
  a DB lookup on every request adds latency; short JWTs avoid it while sessions
  still provide revocation at the refresh boundary.

## Consequences

- (+) Low-friction login for traders; immediate revocation on compromise.
- (+) Fast stateless authorization; OTP secrets never stored in plaintext.
- (−) Access tokens remain valid until expiry even after session revocation —
  bounded by the short access TTL (a deliberate latency/security trade-off).
- (−) Requires a reliable SMS/WhatsApp delivery integration (Stage 10) and a
  Redis store for OTP/session state (Stage 2).
