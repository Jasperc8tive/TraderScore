# STAGE 9 REPORT — Fraud Engine v1

- **Project:** TradeScore — the trust layer for African commerce
- **Stage:** 9 of 13 (+ Final)
- **Status:** ✅ Complete — **awaiting human approval before Stage 10**
- **Companion docs:** [Stage 9 Design](./stage-09-design.md) · [Stage 9 Audits](./stage-09-audits.md) · [Trust Architecture Review](../trust-architecture-review.md) · [Master Build Spec](../master-build-spec.md)

---

## 1. Objectives Completed

| Stage 9 deliverable | Status |
|---|---|
| Sybil detection | ✅ |
| Suspicious transaction detection (wash, velocity, dispute-rate) | ✅ |
| Circular trading detection (2- and 3-cycles) | ✅ |
| Relationship risk scoring | ✅ |
| Fraud protection system (flags + review + scan, event-driven) | ✅ |

## 2. Files Created (high level)

- **Migration:** `0010_fraud_flags.sql` (flags-as-opinions; partial unique on open flags).
- **Shared/auth:** `FraudFlagType`/`FraudSubjectType`/`FraudSeverity`/`FraudFlagStatus`
  enums; `FRAUD_MANAGE` permission (ADMIN + MODERATOR).
- **Pure detectors:** `fraud/detectors/` — `sybil`, `circular`, `suspicious`,
  `relationship-risk` (+ `types`, `index`), heavily unit-tested.
- **Engine:** `fraud.repository.ts` (aggregates + idempotent, review-respecting flag
  upsert), `fraud.service.ts` (event-driven scoped detection + full scan + review),
  `fraud.controller.ts` (admin flags/review/scan), `fraud.module.ts`, `types.ts`.
- **Tests:** `detectors/detectors.test.ts` (10 cases across all four detectors).

## 3. Architecture Decisions

- **Flags are opinions (TAR §2).** The engine only writes `fraud_flags`; it never
  mutates trades, confirmations, or scores. Operators act via Stage 8 moderation.
- **Event-driven + on-demand.** Detection runs scoped to the two businesses on
  `trade.confirmed` (bounded, isolated), with an admin full scan for batch use.
- **Pure detectors.** All detection logic is pure functions over aggregates —
  exhaustively unit-testable and independent of the persistence layer.
- **Idempotent, review-respecting.** Re-detection refreshes open flags and does not
  re-create confirmed or recently dismissed ones.
- **Recompute-ready (TAR §4.5).** Confirmed flags can feed scoring as a v2
  down-weight with no schema change.

## 4. Fraud Findings

Four detector families implemented and verified; flags never corrupt trust data;
operator decisions respected on re-scan. Detail: [audits](./stage-09-audits.md).

## 5. Performance Findings

Per-event detection is scoped and isolated; cycle detection bounded to length ≤ 3
over distinct edges; aggregates are single indexed CTE queries; flag upsert is
idempotent (open-count stable across scans). Full scan is the only O(graph) op and
is admin/batch-only.

## 6. Risks Identified

- R1 Full scan is O(graph) — fine for MVP/admin, should be a scheduled/queued job at scale.
- R2 In-memory event bus (carried) — a missed event leaves detection until the next scan.
- R3 Detectors are heuristic v1 (thresholds not yet calibrated on real data).

## 7. Risks Mitigated

- Trust-data corruption by fraud logic (opinions-only), duplicate/zombie flags
  (idempotent review-respecting upsert), hot-path cost (scoped + bounded detection),
  detector failures breaking trades (subscriber isolation) — all addressed/verified.

## 8. Remaining Risks (accepted / deferred)

- R1 → scheduled scan job (post-Pilot/infra). R2 → durable transport + the full
  scan acts as reconcile. R3 → calibrate during Pilot (Stage 12); thresholds are
  centralized constants. None block Stage 10.

## 9. Test Results (verified on this machine)

| Check | Result |
|---|---|
| `pnpm build` | ✅ 9/9 |
| `pnpm typecheck` | ✅ 16/16 |
| `pnpm lint` | ✅ 16/16, 0/0 |
| `pnpm test` | ✅ all pass (API **63** tests incl. 10 detector cases) |
| `0010` migration vs live Postgres | ✅ applied (1 of 10) |
| e2e: event-driven circular detection | ✅ auto-flag on 2nd confirmation |
| e2e: full scan | ✅ 5 flags written |
| e2e: flags by type | ✅ sybil(1) + circular(2) + relationshipRisk(2) |
| e2e: review confirm → re-review | ✅ CONFIRMED then CONFLICT |
| e2e: RBAC (owner) | ✅ list 403, scan 403 |
| e2e: idempotency + review respect | ✅ open 5→5; confirm+rescan does not reopen |

## 10. Approval Recommendation

**Recommendation: APPROVE Stage 9.**

The Fraud Engine v1 turns the heuristic signals from Stage 8 into an automated,
event-driven detection system across all four required vectors. It strictly honors
the Trust Architecture Review — flags are opinions that never corrupt trust data —
runs bounded and isolated on the hot path, respects operator review, and is
verified live end-to-end.

> ⛔ **STOP — awaiting human approval. Stage 10 will not begin until Stage 9 is
> approved.**
