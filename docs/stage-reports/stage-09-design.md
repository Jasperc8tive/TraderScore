# Stage 9 — Fraud Engine v1: Design Note (pre-build)

> Produced before code. Defines the detectors, the flags-as-opinions model, and
> the event-driven + on-demand execution. Strictly honors the
> [Trust Architecture Review](../trust-architecture-review.md) (TAR §2, §3).

## Governing principle

> **Fraud flags are opinions about data. They never mutate trades, confirmations,
> or scores.** (TAR §2: no arrow points left.)

The engine is an **event subscriber**: it reads the immutable trust events and
writes `fraud_flags`. Flags are surfaced to operators (Stage 8 platform) who act
via moderation. Because scores are recomputable (TAR §4.5), a future v2 can feed
confirmed flags back into scoring as a down-weight — with no schema change — but
v1 deliberately does not auto-modify scores.

## Detectors (pure, unit-tested)

All detectors are pure functions over aggregated inputs (the Fraud audit core);
the repository supplies the aggregates, the engine persists the results.

| Detector | Targets (TAR) | v1 logic |
|---|---|---|
| **Sybil** | F1/F2 | One creator (`created_by`) owning ≥ N businesses → flag the user. Severity scales with count. |
| **Circular trading** | F4 | Cycles in the directed graph of CONFIRMED-trade edges: 2-cycles (A↔B) and 3-cycles (A→B→C→A). Flag the relationship. |
| **Suspicious transactions** | F5 | Per business: **wash** (confirmed volume concentrated on one counterparty), **velocity** (burst of confirmations in 24h), **high dispute/rejection rate** on initiated trades. |
| **Relationship risk** | F4/F5/F6 | Per pair: risk score from mutual volume + disputes; flag high-risk pairs. |

Each detector emits a normalized flag: `{ flagType, subjectType, subjectId,
severity, detail }`.

## Data model: `fraud_flags`

`flag_type`, `subject_type` (BUSINESS|USER|RELATIONSHIP|TRADE), `subject_id`
(uuid, or a composite key like `a|b` for relationships), `severity`
(LOW|MEDIUM|HIGH), `status` (OPEN|CONFIRMED|DISMISSED), `detail` JSONB,
`detected_at`, and review fields. **Dedupe:** a partial unique index on
`(flag_type, subject_id) WHERE status = 'OPEN'` so re-running detection updates the
existing open flag instead of piling up duplicates.

## Execution model (performance)

- **Event-driven, targeted:** on `trade.confirmed`, run detection **scoped to the
  two businesses** (their per-business stats, their pair, cycles containing them) +
  the cheap global Sybil GROUP BY. Bounded work per event — isolated and idempotent
  (a detector failure never breaks the trade flow).
- **On-demand full scan:** `POST /admin/fraud/scan` runs every detector over the
  whole graph for operators / batch use.
- Cycle detection is bounded to length ≤ 3 over the DISTINCT-relationship edge set
  (not unbounded DFS); flags are indexed; aggregates are single indexed queries.

## Surface (admin, permissioned)

- `GET /admin/fraud/flags?status=&type=` — list flags (`AUDIT_VIEW`).
- `POST /admin/fraud/flags/:id/review` — confirm/dismiss with note (`FRAUD_MANAGE`).
- `POST /admin/fraud/scan` — run a full scan (`FRAUD_MANAGE`).

New permission `FRAUD_MANAGE` → ADMIN + MODERATOR.

## Fraud & performance controls

| Concern | Control |
|---|---|
| Flags must not corrupt trust data | Engine only writes `fraud_flags`; never touches trades/scores (TAR §2). |
| Detector failure | Subscriber isolation (in-memory bus already isolates handlers); try/catch + log. |
| Duplicate flags | Partial unique index + upsert on open flags. |
| Cost per event | Scoped queries for the two businesses; bounded cycle length; cheap global Sybil. |
| Retroactive response | Recomputable scores mean a confirmed ring can later be neutralized (v2) without migration. |

## Out of scope (named stages)

Auto-down-weighting scores from flags (v2), ML/graph-DB detection, notifying
operators of new flags (Stage 10), a persisted `business_relationships` table
(derived from trades for v1).
