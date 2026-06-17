# Stage 8 — Admin Operations Platform: Design Note (pre-build)

> Produced before code. Defines the internal operations surface for ADMIN /
> MODERATOR and the real-world effects of moderation. Honors the
> [Trust Architecture Review](../trust-architecture-review.md) (TAR).

## Goal

Give operators the tools to keep the trust graph clean: moderate bad actors,
triage disputes, review businesses, manage markets, and monitor scores — all
behind least-privilege RBAC and fully audited.

## Scope & approach

Stage 8 is primarily an **operational API** that aggregates the data built in
Stages 1–7, plus a few **moderation actions** with real security effects. **No new
domain tables** are required (statuses already exist); automated fraud *flags* are
Stage 9, so the "fraud dashboard" here surfaces **heuristic risk signals computed
from existing data** plus the live dispute queue.

## Surface (`/admin`, all permissioned)

**Moderation**
- `POST /admin/businesses/:id/suspend` · `/reactivate` — `BUSINESS_MODERATE`
- `POST /admin/users/:id/suspend` · `/reactivate` — `USER_MANAGE` (admin only)

**Business review**
- `GET /admin/businesses/:id` — full operational view: identity, members, trade
  counts by status, dispute counts, current score. `BUSINESS_MODERATE`.

**Fraud dashboard**
- `GET /admin/fraud/overview` — risk signals from existing data (top businesses by
  disputed+rejected initiated trades; high dispute involvement; rapid multi-business
  creation by one user → Sybil hint). `AUDIT_VIEW`.
- `GET /admin/disputes?status=` — the adjudication queue. `DISPUTE_RESOLVE`.

**Market management**
- `GET /admin/market-clusters` (list all) · `PATCH /admin/market-clusters/:id`
  (update). `MARKET_MANAGE`. (Create already exists from Stage 2.)

**Score monitoring**
- `GET /admin/scores/overview` — band distribution + most recent snapshots.
  `AUDIT_VIEW`.

## Moderation effects (security teeth)

- **Suspend user** → set status `SUSPENDED` **and revoke all sessions** (immediate
  lockout, TAR F8). Crucially, **a suspended user cannot re-activate via OTP login**
  — `verifyOtp` now refuses suspended accounts (closes the loophole where OTP
  verification would otherwise flip status back to ACTIVE).
- **Suspend business** → status `SUSPENDED`; **excluded from public discovery**
  (a suspended business must not appear trustworthy). Profile-by-link still resolves
  for operators.
- All actions **audited** with actor + target + reason.

## New permission

`BUSINESS_MODERATE` (suspend/reactivate/review businesses) → granted to ADMIN +
MODERATOR. `USER_MANAGE` (existing, ADMIN-only) gates user suspension.

## Operations principles

- **Least privilege:** every endpoint requires a specific permission; moderators
  get moderation + adjudication + market + audit, not user management.
- **Observability:** operational aggregates are read-only and indexed; moderation
  is fully audited.
- **No trust laundering:** moderation can suspend/restore but cannot fabricate
  scores or confirmations (those rules from Stages 4–5 are untouched).

## Out of scope (named stages)

Automated fraud detection + `fraud_flags` table (Stage 9), persisted `activity_logs`
table (audit currently flows to structured logs), a dedicated admin web console
(the API is the platform; a thin web console can layer on later), notifications
(Stage 10).
