# STAGE 6 REPORT — Business Discovery

- **Project:** TradeScore — the trust layer for African commerce
- **Stage:** 6 of 13 (+ Final)
- **Status:** ✅ Complete — **awaiting human approval before Stage 7**
- **Companion docs:** [Stage 6 Design](./stage-06-design.md) · [Stage 6 Audits](./stage-06-audits.md) · [Master Build Spec](../master-build-spec.md)

---

## 1. Objectives Completed

| Stage 6 deliverable | Status |
|---|---|
| Business profiles (public trust profile) | ✅ |
| Search | ✅ |
| Filtering (name, market, band, minScore, assurance) + sort | ✅ |
| Trust profile pages (web) | ✅ |
| Verification badges | ✅ |
| Business lookup system (API + web, end-to-end) | ✅ |

## 2. Files Created (high level)

- **API discovery module:** `discovery-helpers.ts` (verification badge + sort
  whitelist, unit-tested), `discovery.repository.ts` (one-query enrichment via
  `LEFT JOIN LATERAL` to latest snapshot), `discovery.service.ts`,
  `discovery.controller.ts` (public `/discovery`, `/discovery/:slug`),
  `discovery.module.ts`; `ReputationService` now exported for profile composition.
- **Web UI:** `/discover` (search + filters + results), `/business/[slug]` (trust
  profile with score meter + factor breakdown), `components/badges.tsx`
  (`TrustBadge`, `VerificationPill`), extended `lib/api.ts` discovery client, home
  CTA.
- **Tests:** `discovery-helpers.test.ts`.

## 3. Architecture Decisions

- **Enrich, don't duplicate.** Discovery composes the existing identity + reputation
  data; no new trust state. Search joins the latest snapshot in one query (no N+1).
- **Public by design.** Reads are unauthenticated — the MVP value is open lookup.
- **Server-rendered, low-JS.** Next.js server components for the trader audience;
  bookmarkable filter URLs; works without client JS.
- **Verification ≠ score.** Badge (identity provenance) is presented distinctly
  from the behavioural trust score.

## 4. UX Findings

Trust is the headline on every row and profile; explainable factor breakdown on
the profile; graceful empty/error/404 states; bookmarkable filters. Detail:
[audits](./stage-06-audits.md).

## 5. Product Findings

The MVP loop is now demonstrable end-to-end: search → trust-ranked results →
profile with reasons. Discovery reads accurately from the reputation engine
(verified ordering and factors).

## 6. Risks Identified

- R1 `ILIKE %term%` search (no trigram index) — fine at MVP scale, slow at large scale.
- R2 Score freshness depends on event-driven recompute (carried from Stage 5).
- R3 No rate limiting on public discovery endpoints yet.

## 7. Risks Mitigated

- SQL injection via sort/filter (whitelist + parameterization, unit-tested), N+1
  on enrichment (lateral join), misleading scores for no-history businesses (NEW/0).

## 8. Remaining Risks (accepted / deferred)

- R1 → `pg_trgm` / search hardening before scale (post-Pilot). R2 → durable
  transport + reconcile job (infra). R3 → global throttler in commercial hardening
  (Stage 13). None block Stage 7.

## 9. Test Results (verified on this machine)

| Check | Result |
|---|---|
| `pnpm build` | ✅ 9/9 (incl. web `next build`) |
| `pnpm typecheck` | ✅ 16/16 |
| `pnpm lint` | ✅ 16/16, 0/0 |
| `pnpm test` | ✅ all pass (API **38** tests) |
| e2e: public discovery search + sort | ✅ score order 486 > 419 > 128 |
| e2e: filters (band, minScore) | ✅ correct counts |
| e2e: public trust profile | ✅ score 486, factors, market |
| e2e: unknown slug | ✅ 404 |
| web: `/discover` rendered | ✅ HTTP 200, results + bands |
| web: `/business/[slug]` rendered | ✅ HTTP 200, score 486 + name + factors |

## 10. Approval Recommendation

**Recommendation: APPROVE Stage 6.**

Business Discovery turns the trust the platform computes into a usable lookup
system — public, trust-first, explainable, efficient, and verified across both the
API and the rendered web pages. The MVP hypothesis is now demonstrable end-to-end.

> ⛔ **STOP — awaiting human approval. Stage 7 will not begin until Stage 6 is
> approved.**
