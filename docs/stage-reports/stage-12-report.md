# STAGE 12 REPORT — Pilot Market Release (Computer Village)

- **Project:** TradeScore — the trust layer for African commerce
- **Stage:** 12 of 13 (+ Final)
- **Status:** ✅ Complete — **awaiting human approval before Stage 13**
- **Companion docs:** [Stage 12 Design](./stage-12-design.md) · [Stage 12 Audits](./stage-12-audits.md) · [Master Build Spec](../master-build-spec.md)

---

## 1. Objectives Completed

| Stage 12 objective | Status |
|---|---|
| Onboard first traders (pilot environment + referral onboarding) | ✅ |
| Monitor behaviour (admin pilot dashboard + existing ops tools) | ✅ |
| Measure trust adoption (confirmation rate, score coverage, activity) | ✅ |
| Pilot-ready platform | ✅ |

## 2. Files Created / Changed (high level)

- **Migration:** `0012_referrals.sql` (`businesses.referral_code` + `referrals` table).
- **Referrals/growth:** referral-code generation on business create, referrer
  linkage (recorded atomically), `GET /businesses/:id/referrals` (owner), invalid-
  code rejection; `findByReferralCode` / `referralCodeExists` / `getReferralStats`.
- **Analytics:** `analytics.repository.ts` (pilot KPIs + public summary),
  `analytics.controller.ts` (`/admin/analytics/pilot`, public `/pilot/stats`),
  `analytics.module.ts`.
- **Pilot tooling:** `runPilotSeed` + `pnpm db:seed:pilot` (Computer Village
  businesses, members, referrals, confirmed trades); dev seed updated for the new
  NOT NULL `referral_code`.

## 3. Architecture Decisions

- **Measure the hypothesis, not vanity.** KPIs centre on confirmation rate, score
  coverage, and active businesses — the signals that "trust is being created and is
  usable".
- **Server-side, isolatable metrics.** Single indexed aggregate queries; Computer
  Village counted separately; public summary exposes only headline counts.
- **Referrals as first-class data.** A code per business + a `referrals` table with
  one-referrer-per-business and no self-referral — attributable and measurable.
- **One-command pilot environment.** Idempotent pilot seed, production-guarded.

## 4. PMF / Operations / Growth Findings

Metrics map onto the hypothesis (confirmation rate 0.83 in seed); operators can
provision/onboard/monitor; a verified, abuse-resistant referral loop exists with a
leaderboard. Detail: [audits](./stage-12-audits.md).

## 5. Risks Identified

- R1 Trust-check (profile/score view) analytics not yet event-instrumented.
- R2 No referral incentives → loop may be weak without them.
- R3 Pilot seed inserts confirmed trades directly; seeded businesses' scores
  compute lazily on first view/recompute (not pre-populated).

## 6. Risks Mitigated

- Diluted pilot signal (Computer Village isolated), unmeasured growth (referral
  analytics), referral abuse (unique/self-check/invalid-code), data leakage
  (owner-only referral stats, headline-only public summary) — all addressed/verified.

## 7. Remaining Risks (accepted / deferred)

- R1/R2 → Stage 13 (PostHog instrumentation + referral incentives). R3 → run a
  fraud/score scan after seeding, or view profiles (lazy compute). None block Stage 13.

## 8. Test Results (verified on this machine)

| Check | Result |
|---|---|
| `pnpm build` | ✅ 9/9 |
| `pnpm typecheck` | ✅ 16/16 |
| `pnpm lint` | ✅ 16/16, 0/0 |
| `pnpm test` | ✅ all pass (API **66** tests) |
| `0012` migration + backfill | ✅ applied (1 of 12) |
| `pnpm db:seed:pilot` | ✅ Computer Village dataset created |
| admin pilot analytics | ✅ 29 businesses (6 CV), 19 active, confirmationRate 0.83, 3 referrals + leaderboard |
| public `/pilot/stats` | ✅ headline counts (no auth) |
| referral loop | ✅ code → referred business → totalReferred=1 |
| invalid referral code | ✅ VALIDATION_ERROR |
| non-owner referral view | ✅ 403 |

## 9. Approval Recommendation

**Recommendation: APPROVE Stage 12.**

TradeScore is pilot-ready for Computer Village: a one-command pilot environment, a
dashboard that measures the real hypothesis (confirmation rate, trust adoption,
activity), and a verified, abuse-resistant referral growth loop — all checked live.

> ⛔ **STOP — awaiting human approval. Stage 13 will not begin until Stage 12 is
> approved.**
