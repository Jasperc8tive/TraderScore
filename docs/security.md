# TradeScore — Security Documentation

## Authentication

- **OTP (primary):** CSPRNG codes, stored only as an HMAC, single-use, TTL-bound,
  attempt-limited, with a per-phone resend cooldown (Redis). Suspended accounts
  cannot log in.
- **Access tokens:** short-lived JWTs (`sub`, `role`, `sid`) for stateless authz.
- **Sessions:** server-side, revocable; refresh tokens stored as SHA-256 hashes and
  **rotated** on every refresh; "log out everywhere" and immediate revocation on
  suspension.

## Authorization (two layers)

1. **Capability RBAC** (`PermissionsGuard` + `@RequirePermissions`): ADMIN,
   MODERATOR, BUSINESS_OWNER, BUSINESS_STAFF mapped to explicit permissions.
2. **Resource ownership** (service layer): e.g. only a business OWNER may manage it;
   **only the counterparty may confirm a trade** (never the initiator, never an admin).

## Trust integrity (the security property that matters most)

- Trades/confirmations are immutable, append-only, attributable.
- Reputation is a recomputable projection — no mutable score column to tamper with.
- Fraud flags are opinions; they never mutate facts or scores.
- **Money cannot buy trust:** paid plans grant a commercial badge/features only.

## Application security

- Input validation at every boundary (`whitelist` + `forbidNonWhitelisted` DTOs).
- Parameterized SQL everywhere (incl. dynamic search/update); whitelisted sort.
- Generic error envelope — internal faults never leak details to clients.
- Secret redaction in logs (password/otp/token/authorization/secret paths).
- CORS restricted to configured origins; secrets via env/secret-manager abstraction,
  never committed (`.env` git-ignored).
- Audit logging of privileged/auth/billing/moderation actions with actor + outcome.

## OWASP Top 10 (2021) posture

| Risk | Mitigation |
|---|---|
| A01 Broken Access Control | Global auth guard + RBAC + service-level ownership; counterparty-only confirmation; verified live (403s). |
| A02 Cryptographic Failures | OTP HMAC + constant-time compare; refresh tokens hashed; short JWTs; secrets via env. |
| A03 Injection | Parameterized SQL throughout; whitelisted sort; validated DTOs. |
| A04 Insecure Design | Trust Architecture Review (append-only facts, recomputable scores, fraud-as-opinion). |
| A05 Security Misconfiguration | Env validated at startup (zod); CORS locked; prod guards on seeds; fail-fast config. |
| A06 Vulnerable Components | Pinned deps; CI build gate; minimal surface. |
| A07 Auth Failures | OTP rate-limit + lockout, session revocation, rotation, suspended-login block. |
| A08 Integrity Failures | Append-only logs; atomic writes; migration checksums; one-decision-per-trade. |
| A09 Logging/Monitoring Failures | Structured logs + correlation ids + audit channel + redaction. |
| A10 SSRF | No user-controlled outbound requests in the API surface. |

## Known follow-ups (pre-public-scale)

- Global HTTP rate limiting (beyond OTP cooldown).
- Real SMS/PSP provider hardening + webhooks at go-live.
- Durable event transport + idempotency keys.
- Persisted `activity_logs` table (audit currently to structured logs).
