# STAGE 5 REPORT — Reputation Engine v1

- **Project:** TradeScore — the trust layer for African commerce
- **Stage:** 5 of 13 (+ Final)
- **Status:** ✅ Complete — **awaiting human approval before Stage 6**
- **Companion docs:** [Stage 5 Design](./stage-05-design.md) · [Stage 5 Audits](./stage-05-audits.md) · [Trust Architecture Review](../trust-architecture-review.md) · [Master Build Spec](../master-build-spec.md)

---

## 1. Objectives Completed

| Stage 5 deliverable | Status |
|---|---|
| Trust score calculation (algorithm v1.0.0) | ✅ |
| Score bands (NEW → HIGHLY_TRUSTED) | ✅ |
| Score history (append-only snapshots) | ✅ |
| Score explanations (structured factors) | ✅ |
| Working reputation system (auto-recompute on events) | ✅ |

## 2. Files Created (high level)

- **Migration:** `0008_score_snapshots.sql` (`score_snapshots` + `score_factors`,
  no score column on `businesses`).
- **Shared:** `ScoreBand`, `ScoreFactorDirection` enums.
- **Pure engine:** `reputation/scoring/` — `types.ts`, `v1.ts` (deterministic
  factors + bands), `index.ts` (version selector). Heavily unit-tested.
- **Reputation module:** `reputation.repository.ts` (scoring-input aggregates +
  append-only snapshot persistence), `reputation.service.ts` (recompute,
  getScore, history, inputs-hash idempotency, event subscriber),
  `reputation.controller.ts`, `reputation.module.ts`, `types.ts`.
- **Tests:** `reputation/scoring/v1.test.ts` (8 cases).

## 3. Architecture Decisions

- **Scores are projections, not state.** No mutable score column anywhere; the
  current score is the latest append-only snapshot. Fully recomputable from
  CONFIRMED trades + identity (TAR §4).
- **Versioned + reproducible.** Every snapshot carries `algorithm_version` and an
  `inputs_hash`; a new algorithm ships as a new version beside the old — no
  `ALTER TABLE`. Identical inputs never write a duplicate snapshot.
- **Explainability is structural.** Each snapshot persists its own factors; the
  "why" is data, not prose, and is valid for that snapshot's version.
- **Projection reacts to events.** Confirmation-lifecycle events trigger an
  isolated, idempotent recompute of both businesses.
- **Public reads.** Score/history/explanation are public — the MVP value is one
  business assessing another before extending credit.

## 4. Product Findings

Public, explainable scores; sensible NEW state for no-history businesses; live
auto-recompute. The MVP hypothesis is now end-to-end testable. Detail: [audits](./stage-05-audits.md).

## 5. Fraud Findings

v1 blunts wash trading (diversity cap), self-claims (CONFIRMED-only), and false
claims (reliability + dispute penalty); rewards verified identity. Ring detection
is Stage 9 — and recomputability means it can be applied retroactively with no
schema change.

## 6. Data Findings

No mutable score column; versioned, reproducible, deterministic, churn-free
snapshots with persisted factors; indexed for "current score" reads. Satisfies
TAR §4 in full.

## 7. Risks Identified

- R1 In-memory event bus (carried): a missed event between restarts could leave a
  score briefly stale — mitigated by lazy recompute on read and idempotent recompute.
- R2 v1 weights are heuristic (not yet calibrated on real data).
- R3 No score decay/recency weighting yet.

## 8. Risks Mitigated

- Algorithm-change migrations (versioned snapshots), score tampering (recompute +
  inputs_hash), wash/self/false-claim inflation (factor design), snapshot churn
  (hash idempotency) — all addressed and verified.

## 9. Remaining Risks (accepted / deferred)

- R1 → durable transport + a periodic reconcile job (infra/later); lazy recompute
  covers reads now. R2 → calibrate during/after Pilot (Stage 12); versioning makes
  re-tuning safe. R3 → a v2 factor (Stage 9+). None block Stage 6.

## 10. Test Results (verified on this machine)

| Check | Result |
|---|---|
| `pnpm build` | ✅ 9/9 |
| `pnpm typecheck` | ✅ 16/16 |
| `pnpm lint` | ✅ 16/16, 0/0 |
| `pnpm test` | ✅ all pass (API **35** tests incl. 8 scoring-engine) |
| `0008` migration vs live Postgres | ✅ applied (1 of 8) |
| e2e: public score + factors | ✅ 459 ESTABLISHED (reliability 250 / volume 129 / diversity 80) |
| e2e: auto-recompute on rejection | ✅ 459 → 384, penalty −25, no manual call |
| e2e: append-only history | ✅ 5 snapshots |
| e2e: inputs-hash idempotency | ✅ repeated reads add no snapshot |
| e2e: new business | ✅ NEW / 0 |
| e2e: recompute authz | ✅ owner 403, admin OK |

## 11. Approval Recommendation

**Recommendation: APPROVE Stage 5.**

The reputation engine is production-grade and verified end-to-end: explainable,
fraud-aware scores that recompute automatically from counterparty-confirmed
trades, stored as versioned, reproducible, append-only snapshots. The platform
now turns verified trades into the trust signal that is its entire reason to
exist — ready for Business Discovery (Stage 6) to surface it.

> ⛔ **STOP — awaiting human approval. Stage 6 will not begin until Stage 5 is
> approved.**
