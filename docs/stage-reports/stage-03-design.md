# Stage 3 — Trade Logging Engine: Design Note (pre-build)

> Produced before code. Defines the trade lifecycle, the append-only history
> model, and the fraud controls. Honors the [Trust Architecture Review](../trust-architecture-review.md) (TAR).

## Scope

Trade creation, editing, cancellation, history, and the status workflow. **Not**
in scope: counterparty confirmation (Stage 4) and scoring (Stage 5). This stage
*captures* trades; it does not yet make them count.

## The governing rule (TAR §3, F3)

> **A trade is worth nothing until counterparty-confirmed.**

So Stage 3 trades are *claims*, not trust. They live in pre-confirmation states.
Confirmation (Stage 4) and scoring (Stage 5) consume them later. Crucially, the
trade record and its **append-only event log** are designed now so those stages
are additive.

## Data model

**`trades`** — one logged commercial transaction, from the initiator's viewpoint:
- `initiator_business_id` (who logged it), `counterparty_business_id` (nullable —
  the other party, if a registered business), plus `counterparty_name/phone`
  snapshots for display when not yet registered.
- `direction` (`SALE` | `PURCHASE`) from the initiator's perspective.
- `amount_minor` (bigint, integer minor units) + `currency` — uses the Money
  contract from `@tradescore/core` (no floats; credit-grade correctness).
- `occurred_on` (date the trade happened), `description`, `reference_code`
  (human-friendly unique lookup).
- `status`, `created_by` (attribution), audit timestamps, soft delete.

**`trade_events`** — append-only lifecycle log (the history). Every create, edit,
status change, and cancellation appends a row (`event_type`, `from_status`,
`to_status`, `actor_user_id`, `reason`, `metadata` JSONB). This is the trade's
immutable provenance — edits never erase what was there (TAR §1).

## Status workflow (Stage 3 states)

```
            submit                     cancel
  DRAFT ───────────────▶ PENDING_CONFIRMATION ─────────▶ CANCELLED
    │  ▲                        │  ▲                ▲
    │  └──── edit (no transition)──┘                │
    └───────────────── cancel ──────────────────────┘

  reserved for Stage 4: CONFIRMED · DISPUTED · REJECTED  (cannot cancel once CONFIRMED)
```

- **create** → `DRAFT`.
- **submit** → `PENDING_CONFIRMATION` (requires a `counterparty_business_id`, since
  only a registered counterparty can confirm in Stage 4).
- **edit** → allowed only in `DRAFT` / `PENDING_CONFIRMATION`; appends an edit event.
- **cancel** → `CANCELLED` from `DRAFT` / `PENDING_CONFIRMATION` only.
- Transitions are validated by an explicit allow-list; illegal transitions are
  rejected (unit-tested).

## Authorization

Only a **member** (OWNER or STAFF) of the `initiator_business` may create/edit/
submit/cancel that business's trades (ADMIN bypass). Staff can operate trades —
that is their job — while business-identity changes remain owner-only (Stage 2).
Reads of a trade are limited to members of the initiator (and, in Stage 4, the
counterparty).

## Fraud controls (capture + early prevention)

| Vector (TAR) | Control this stage |
|---|---|
| F3 phantom trades | Status model: unconfirmed trades carry no trust; scoring ignores them. |
| F4 circular/self-dealing | `initiator_business_id <> counterparty_business_id` enforced (DB CHECK + service). Counterparty linkage captured for cycle detection in Stage 9. |
| F5 wash trading | Amount, counterparty, timestamp, and `created_by` recorded so repeated same-counterparty volume is detectable later. |
| F9 tampering | Append-only `trade_events`; edits are logged, never silent; amounts validated as positive integers. |

## Out of scope (named stages)

Confirmation / dispute / rejection workflow (Stage 4), scoring (Stage 5), fraud
*detection* (Stage 9), notifications to counterparties (Stage 10).
