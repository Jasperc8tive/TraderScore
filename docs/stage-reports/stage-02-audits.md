# Stage 2 — Mandatory Audits

Three audits were required for Stage 2: **Security, Fraud, and UX**. Each finding
records root cause, fix, and re-test status. Findings discovered during the build
are included for transparency.

Legend: ✅ resolved · 🟡 accepted risk (tracked) · ⬜ deferred to a named stage.

---

## 1. Security Audit

**Scope:** authentication, session lifecycle, authorization, input handling, secret exposure.

| # | Finding | Severity | Resolution |
|---|---------|----------|------------|
| S1 | Brute-forcing OTP codes | High | ✅ Attempt-limited (max 5) + short TTL + constant-time HMAC compare; verified failure returns generic 401 (no oracle). |
| S2 | OTP request flooding (SMS bomb / mass account creation) | High | ✅ Per-phone Redis cooldown gate; verified second immediate request → `RATE_LIMITED`. |
| S3 | OTP code exposure in responses | High | ✅ `devCode` returned **only** when delivery `exposesCode` AND `!isProduction`. Real providers set `exposesCode=false`. |
| S4 | Stolen refresh token reuse | High | ✅ Refresh **rotation**: old session revoked on use; verified old refresh token → 401 after rotation. Hashes only stored. |
| S5 | Stolen access token after logout | Med | ✅ JwtAuthGuard checks session is still active in Redis; revoked session → 401. Bounded by short access TTL regardless. |
| S6 | Privilege escalation via role-only checks | High | ✅ Two-layer authz: RBAC guard (`@RequirePermissions`) + service-level ownership. Verified: owner→403 on market-create; non-owner→403 on business update. |
| S7 | Unauthsenticated access to protected routes | High | ✅ Global `JwtAuthGuard`; only `@Public` routes (auth, health, public reads) bypass. Verified: no token → 401. |
| S8 | Mass-assignment / invalid input | Med | ✅ DTO validation (`whitelist` + `forbidNonWhitelisted`) on every write; phone normalized + validated. |
| S9 | `consistent-type-imports` autofix erased DI tokens → broken auth at runtime | High | ✅ **Found during build.** Rule is incompatible with NestJS reflection DI; disabled it and restored value imports. Verified by live boot + full e2e. |
| S10 | Account enumeration via OTP request | Low | 🟡 Accepted: request returns success regardless of whether the phone existed (find-or-create), so it does not reveal account existence. |

**Verdict:** PASS. Authentication, rotation, revocation, and layered authorization
are implemented and verified end-to-end.

---

## 2. Fraud Audit

**Scope:** the fraud vectors Stage 2 must *structurally* defend (capture/contain),
per Trust Architecture Review (TAR) §3. Detection logic remains Stage 9.

| # | Vector | Stage 2 control | Status |
|---|--------|-----------------|--------|
| F1 | Fake businesses | New businesses are `UNVERIFIED`; assurance can be raised **only** via the verify endpoint, gated to MODERATOR/ADMIN. Verified: owner cannot self-verify. | ✅ |
| F2 | Sybil / mass accounts | Per-phone OTP cooldown slows account farming; every user keyed by normalized E.164 phone; `created_by` on businesses; `added_by` on memberships — all attributable for later clustering. | ✅ capture |
| F3 | Phantom trust via fake identities | A business carries no trust weight yet (no trades/scores until Stage 3+); identity alone proves nothing. | ✅ by design |
| F7 | Privilege abuse / separation of duties | OWNER vs STAFF membership enforced; staff cannot manage members or verify; last-owner removal blocked (verified by unit test). | ✅ |
| F8 | Account takeover | OTP hashed + attempt-limited; sessions revocable; refresh rotation; audit log of every auth event. | ✅ |
| F9 | Insider tampering | Every privileged action (`business.verified`, `member.added/removed`, `market.created`) is audit-logged with actor + outcome. | ✅ capture |

**Phone normalization note:** all phone entry points (`auth`, member add) route
through `@tradescore/core` `normalizePhone`, so the same human cannot trivially
appear as multiple identities via formatting variants — closing a Sybil gap (F2).

**Verdict:** PASS. All inputs the Stage 9 detectors need are captured and
attributable; trust elevation is centralized and access-controlled.

---

## 3. UX Audit

**Scope:** flow friction, response consistency, discoverability, error clarity.

| # | Finding | Severity | Resolution |
|---|---------|----------|------------|
| U1 | Trader-friendly login | — | ✅ Phone + OTP only; accepts local (`0801…`) and international formats, normalized server-side. |
| U2 | Consistent client contract | Med | ✅ All responses use the `{data}` / `{error:{code,message}}` envelopes; stable error codes for client branching. |
| U3 | Slug collisions break profile URLs | Med | ✅ Server generates a unique slug (entropy suffix on collision); verified `test-mart-lagos`. |
| U4 | Search usability on low bandwidth | Med | ✅ Public, paginated, case-insensitive name search with cluster filter; sensible defaults (page 1, size 20). |
| U5 | Discoverable markets | Low | ✅ Public market-cluster list/detail to anchor a business's location. |
| U6 | Clear permission errors | Low | ✅ 403s return an actionable message ("Only the business owner…", "You do not have permission…"). |
| U7 | OTP resend guidance | Low | 🟡 Cooldown enforced; surfacing remaining seconds to the client is a Stage 6/10 polish item. |

**Verdict:** PASS for Stage 2 scope. Rich profiles and trust badges are Stage 6.

---

## Audit summary

All three audits **PASS**. Every High/Med finding is ✅ resolved, including a
High DI-correctness bug (S9) caught during the build and fixed before completion.
Accepted Low items (S10, U7) are documented and non-blocking.
