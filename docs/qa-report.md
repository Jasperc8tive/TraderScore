# TradeScore — QA Report

> Consolidated quality evidence across Stages 1–13 + Final. Every stage was built,
> tested, audited, fixed, re-verified, and approved before the next began.

## Automated quality gate (final run)

| Gate | Result |
|---|---|
| `pnpm build` | ✅ 9/9 packages & apps |
| `pnpm typecheck` | ✅ 16/16 (TypeScript strict, `node16`) |
| `pnpm lint` | ✅ 16/16, 0 errors / 0 warnings |
| `pnpm test` | ✅ **102 tests** passing (API 75 + packages 27) |

Unit-tested pure logic includes: Result/errors, config validation, request context,
event bus isolation, migration runner, phone/slug/money, RBAC, JWT, OTP, trade &
dispute state machines, scoring engine (v1), fraud detectors, discovery helpers,
notification templates, plans/entitlements, and feature flags.

## End-to-end verification (live Postgres + Redis)

Each stage was exercised against real infrastructure:

| Stage | Verified end-to-end |
|---|---|
| 1 Foundation | migrations + seed + idempotency; API boot; health + DB readiness; envelopes |
| 2 Identity | OTP→session→business→membership→verify→search; RBAC/ownership; refresh rotation; revocation |
| 3 Trades | create→edit→submit; append-only history; cancel guards; self-trade/future/zero rejected |
| 4 Confirmation | counterparty confirm/reject/dispute; **initiator/admin cannot confirm**; double-decision CONFLICT |
| 5 Reputation | score 459, auto-recompute 459→384 on rejection, append-only snapshots, hash idempotency, NEW state |
| 6 Discovery | trust-ranked search, filters, public profile; web `/discover` + `/business/[slug]` render (200) |
| 7 Disputes | freeze 345→0, evidence, admin UPHELD→195, withdraw restores, CONFLICT/403 |
| 8 Admin | RBAC 403s, dashboards, suspend business→discovery excluded, suspend user→login 401 |
| 9 Fraud | event-driven circular flag, full scan, 4 detector types, review CONFLICT, idempotency |
| 10 Notifications | event-driven SMS to right owners, persist-first, 5/5 SENT, inbox |
| 11 PWA | manifest/sw/icon/offline 200; low-bandwidth payload 80→2 blocks |
| 12 Pilot | analytics (confirmation rate 0.83), referral loop, invalid code/403 |
| 13 Commercial | subscribe→PAID invoice (server-priced), verified badge, MRR, 403, flags |

## Performance (representative benchmark)

~10k businesses / ~100k confirmed trades: indexed score read **0.07 ms**, trades
list **0.09 ms**, discovery enrichment **~10 ms**, full-graph fraud scan **~40 ms**.
See [database.md](./database.md).

## Real defects found and fixed during QA (examples)

- strict-mode `exactOptionalPropertyTypes` errors (Stage 1).
- Next `output: standalone` symlink failure on Windows → gated to Docker (Stage 1).
- incremental `tsbuildinfo` + `deleteOutDir` → partial API build → disabled
  incremental for the API (Stage 1).
- lint autofix converting NestJS-injected classes to `import type` → broke DI →
  disabled `consistent-type-imports` (Stage 2).
- zero-amount trade allowed by Money → service enforces `> 0` (Stage 3).
- fraud re-scan re-raising reviewed flags → review-respecting upsert (Stage 9).

## Outstanding (tracked, non-blocking)

Global HTTP rate limiting; `pg_trgm` search index; scheduled fraud scan; durable
event transport; persisted `activity_logs`; real provider adapters (SMS/PSP) + tax/
refunds; device-level offline QA (pilot); full-scale (100k/10M) load test on staging.

**QA verdict: PASS.** The system is internally consistent, well-tested, and verified
end-to-end at representative scale.
