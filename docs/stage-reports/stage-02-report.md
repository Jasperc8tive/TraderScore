# STAGE 2 REPORT — Identity System

- **Project:** TradeScore — the trust layer for African commerce
- **Stage:** 2 of 13 (+ Final)
- **Status:** ✅ Complete — **awaiting human approval before Stage 3**
- **Companion docs:** [Stage 2 Design Note](./stage-02-design.md) · [Stage 2 Audits](./stage-02-audits.md) · [Trust Architecture Review](../trust-architecture-review.md) · [Master Build Spec](../master-build-spec.md)

---

## 1. Objectives Completed

| Stage 2 deliverable | Status |
|---|---|
| Users (phone-first identity, lifecycle) | ✅ |
| Businesses (create / profile / update) | ✅ |
| Business Membership (OWNER/STAFF, add/list/remove) | ✅ |
| OTP Verification (request / verify, hashed, rate-limited) | ✅ |
| Sessions (revocable, refresh rotation) | ✅ |
| Authorization (RBAC guard + resource ownership) | ✅ |
| Business Profiles (public profile by slug) | ✅ |
| Market Clusters (public list/detail + admin create) | ✅ |
| Business Search (paginated, filterable, public) | ✅ |
| Domain events emitted (`user.created`, `business.created`, `business.verified`) | ✅ |

## 2. Files Created (high level)

- **Migration:** `0005_business_members.sql`; new `BusinessMemberRole` enum in `@tradescore/shared`.
- **Infra:** Redis client wired into `InfrastructureModule`; `OtpService`, OTP store, session store, OTP delivery bound to DI tokens.
- **Auth stores:** `RedisOtpStore`, `RedisSessionStore`, `DevOtpDelivery`.
- **Identity layer:** `types`, `row-mappers`, and repositories for users, businesses, business-members, market-clusters (+ `IdentityModule`).
- **Common auth:** `@Public` / `@CurrentUser` / `@RequirePermissions`, `JwtAuthGuard`, `PermissionsGuard`.
- **Feature modules:** `auth` (service/controller/dto), `businesses` (service/controller/dto), `members` (service/controller/dto), `market-clusters` (service/controller/dto).
- **Tests:** `businesses.service.test.ts`, `members.service.test.ts`.

## 3. Architecture Decisions

- **Two-layer authorization.** Coarse capabilities via RBAC guard; data-dependent
  ownership ("OWNER of *this* business") enforced in services. Implements
  separation of duties (TAR F7).
- **Stateless access + stateful session.** Short JWT on the hot path; a revocable
  Redis session enables logout/takeover response. Refresh tokens **rotate** on use.
- **Atomic business creation.** A business and its OWNER membership are inserted in
  one transaction — a business can never exist without an owner.
- **Trust elevation is centralized.** `assurance_level` only rises through one
  access-controlled endpoint that emits `business.verified` (TAR F1).

## 4. Security Findings

Detail in the [audits](./stage-02-audits.md). All High/Med resolved: OTP brute-force
& flooding controls, refresh rotation, session revocation, layered authz, strict
DTO validation, dev-only OTP exposure. A High DI-correctness bug (a lint autofix
converting injected classes to `import type`, which breaks NestJS reflection DI)
was caught during the build and fixed; verified by live boot + full e2e.

## 5. Fraud Findings

Structural controls for F1, F2, F3, F7, F8, F9 are in place (capture + containment);
trust elevation is access-controlled and attributable. Detection logic remains Stage 9.

## 6. UX Findings

Phone-first OTP login (local + international formats), consistent response
envelopes, collision-safe slugs, paginated public search, discoverable markets,
actionable permission errors.

## 7. Risks Identified

- R1 In-memory event bus still non-durable (carried from Stage 1).
- R2 OTP delivery is dev-only (logs/returns code); real SMS/WhatsApp is Stage 10.
- R3 Search uses `ILIKE %term%` (no trigram index yet) — fine at MVP scale.
- R4 No global HTTP rate limiting beyond the OTP cooldown.

## 8. Risks Mitigated

- Account takeover, OTP brute-force/flooding, refresh-token replay, privilege
  escalation, self-verification of trust, Sybil via phone-format variance,
  last-owner lockout — all addressed and (where testable) verified.

## 9. Remaining Risks (accepted / deferred)

- R2 → **Stage 10** (notifications). R3 → **Stage 6** (discovery/search hardening,
  `pg_trgm`). R4 → a hardening item (global throttler) before pilot. R1 → durable
  transport with the infra stage. None block Stage 3.

## 10. Test Results (verified on this machine)

| Check | Result |
|---|---|
| `pnpm build` | ✅ 9/9 |
| `pnpm test` | ✅ **34 tests** (api now 9), all passing |
| `pnpm lint` | ✅ 16/16, 0 errors / 0 warnings |
| `pnpm typecheck` | ✅ 16/16 |
| `0005` migration vs live Postgres | ✅ applied; idempotent |
| Live API boot (DI integrity) | ✅ all modules initialized, listening |
| OTP request → verify → tokens | ✅ BUSINESS_OWNER activated |
| Create business / public profile / search | ✅ slug, profile, total=1 |
| Add staff / list members | ✅ 2 members (owner+staff) |
| RBAC: owner → market create | ✅ 403 FORBIDDEN |
| Ownership/role: admin verifies business | ✅ FULLY_VERIFIED |
| Admin create market cluster + list | ✅ 2 clusters |
| Unauthenticated write | ✅ 401 |
| Refresh rotation | ✅ new tokens; old refresh → 401 |

## 11. Approval Recommendation

**Recommendation: APPROVE Stage 2.**

The identity system is implemented to a production-grade standard and verified
end-to-end against live Postgres + Redis: OTP auth with rotation and revocation,
businesses with membership and ownership-based authorization, moderator-gated
verification, market clusters, and public search. The design keeps trust
elevation centralized and attributable, so Trade Logging (Stage 3) and
Confirmation (Stage 4) can build on a trustworthy identity layer.

> ⛔ **STOP — awaiting human approval. Stage 3 will not begin until Stage 2 is
> approved.**
