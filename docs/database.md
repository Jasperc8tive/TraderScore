# TradeScore — Database Documentation

PostgreSQL is the single source of truth (ADR-0002). Forward-only SQL migrations
live in `packages/database/migrations`, applied by a checksummed runner
(`pnpm db:migrate`). All tables use UUID PKs (`gen_random_uuid()`), `created_at`/
`updated_at` (timestamptz, trigger-maintained), soft-delete (`deleted_at`) where
appropriate, attribution columns, and indexes on every FK + common filter.

## Migrations

| # | Migration | Adds |
|---|---|---|
| 0001 | extensions_and_helpers | pgcrypto, `set_updated_at()` trigger fn |
| 0002 | market_clusters | markets |
| 0003 | users | phone-first users + roles |
| 0004 | businesses | businesses (no score column) |
| 0005 | business_members | OWNER/STAFF membership |
| 0006 | trades | trades + append-only `trade_events` |
| 0007 | trade_confirmations | counterparty decisions |
| 0008 | score_snapshots | versioned scores + `score_factors` |
| 0009 | disputes | disputes + `dispute_evidence` |
| 0010 | fraud_flags | fraud opinions |
| 0011 | notifications | delivery log + inbox |
| 0012 | referrals | `businesses.referral_code` + `referrals` |
| 0013 | billing | `subscriptions` + `invoices` |

## Core tables (selected columns)

- **users**: `phone` (unique, E.164), `email?`, `full_name?`, `role`
  (ADMIN/MODERATOR/BUSINESS_OWNER/BUSINESS_STAFF), `status`, `phone_verified_at`.
- **businesses**: `name`, `slug` (unique), `market_cluster_id?`, `assurance_level`
  (provenance, **not** a score), `status`, `created_by`, `referral_code` (unique).
  **Deliberately no trust-score column** (TAR §4.1).
- **business_members**: `(business_id, user_id)` unique, `member_role`.
- **trades**: `reference_code` (unique), `initiator_business_id`,
  `counterparty_business_id?`, `direction`, `amount_minor` (BIGINT, > 0),
  `currency`, `occurred_on`, `status`, `created_by`. CHECK: no self-trade.
- **trade_events**: append-only lifecycle log (no update/delete columns).
- **trade_confirmations**: one decision per trade (`trade_id` unique), attributable.
- **score_snapshots**: `algorithm_version`, `score` (0–1000), `band`, `inputs_hash`,
  `metadata` JSONB, `computed_at`. Append-only; latest = current.
- **score_factors**: per-snapshot explanation (`factor_key`, `weight`, `direction`,
  `detail`).
- **disputes**: `status`, `trade_status_before`, `resolution`, `reviewed_by`; one
  active dispute per trade (partial unique). **dispute_evidence**: append-only.
- **fraud_flags**: `flag_type`, `subject_type`/`subject_id`, `severity`, `status`,
  `detail`; partial unique on open flags (dedupe).
- **notifications**: `recipient_user_id`, `channel`, `address`, `type`, `status`,
  `attempts` — persist-first delivery log + inbox.
- **referrals**: `(referred_business_id)` unique, no self-referral (CHECK).
- **subscriptions**: one active per business (partial unique), `plan`, period.
  **invoices**: `amount_minor` (server-derived), `status`, `provider_ref` (no card data).

## Integrity & safety

- Enum values enforced by `CHECK` constraints mirroring `@tradescore/shared`.
- Soft-delete-aware uniqueness via partial unique indexes (`WHERE deleted_at IS NULL`).
- Money is always integer minor units (no floats).
- State + its log/derived rows are written in one transaction (trades, confirmations,
  disputes, snapshots, billing).
- Applied migrations are immutable (checksum guard); idempotent runner.

## Performance (representative benchmark)

At ~10,000 businesses / ~100,000 confirmed trades (see
`infrastructure/benchmark/benchmark.sql`):

| Query | Plan | Execution |
|---|---|---|
| Latest score for a business | index scan (`idx_score_snapshots_business_latest`) | **0.07 ms** |
| Trades list for a business | bitmap index scan (`idx_trades_initiator`) | **0.09 ms** |
| Discovery search + score/sub enrichment | indexed lateral join (+ seq scan for ILIKE) | **~10 ms** |
| Fraud full-graph distinct edges | seq scan (batch/admin path) | **~40 ms** |

Indexed lookups are constant-time (B-tree) and stay fast at scale. The two linear
scans — leading-wildcard `ILIKE` search and the full-graph fraud scan — are flagged
for `pg_trgm` (GIN) and a scheduled/queued job respectively before large scale.

## Operations

- `pnpm db:migrate` · `pnpm db:migrate:status` · `pnpm db:seed` (dev) ·
  `pnpm db:seed:pilot` (Computer Village). Seeds refuse to run in production.
