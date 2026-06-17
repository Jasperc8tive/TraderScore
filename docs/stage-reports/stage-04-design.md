# Stage 4 — Counterparty Confirmation System: Design Note (pre-build)

> Produced before code. This is the stage that turns a logged *claim* into
> *verified trust*. Honors the [Trust Architecture Review](../trust-architecture-review.md) (TAR).

## Why this stage matters most

A trade logged in Stage 3 is one party's claim. **Trust is created only when the
counterparty independently confirms it** (TAR §3, F3). A `CONFIRMED` trade is the
atomic unit of reputation that Stage 5 will score. This stage produces "verified
transaction infrastructure."

## Scope

Trade confirmation, rejection, dispute, and the confirmation workflow (the
counterparty's inbox of incoming trades). Full dispute *resolution* (evidence,
admin adjudication) is Stage 7 — here a dispute simply records the counterparty's
disagreement and parks the trade in `DISPUTED`.

## Who may confirm — the integrity rule

- Only a **member (OWNER or STAFF) of the `counterparty_business`** may confirm,
  reject, or dispute a trade.
- The **initiator can never confirm their own trade** — that would make trust
  self-asserted and worthless (TAR §3, F3). This is the single most important
  control of the stage.
- **No ADMIN bypass for confirmation.** Admins resolve disputes (Stage 7) but must
  not manufacture trust by self-confirming. (Admins/initiator members *may still
  read* a trade; only the confirm decision is restricted to the counterparty.)

## State machine extension

```
PENDING_CONFIRMATION ──confirm──▶ CONFIRMED   (counts toward reputation)
        │            ──reject───▶ REJECTED
        │            ──dispute──▶ DISPUTED    (resolution deferred to Stage 7)
        └────────────cancel─────▶ CANCELLED   (initiator only, still allowed)
```

Confirmation is only possible from `PENDING_CONFIRMATION`. `CONFIRMED`, `REJECTED`,
`DISPUTED` are terminal in Stage 4 (Stage 7 may reopen `DISPUTED`). The transition
allow-list in `trade-status.ts` is extended; services keep delegating to it.

## Data model: `trade_confirmations`

One decision record per trade (`trade_id` unique): `decision`
(CONFIRMED/REJECTED/DISPUTED), `counterparty_business_id`, `decided_by` (user),
optional `note`/`reason`, `created_at`. The decision, the trade's status change,
and the append-only `trade_events` row are written in **one transaction** — the
verified record and the trade state can never diverge.

## Confirmation workflow (UX)

`GET /confirmations/incoming?businessId=…` returns the trades **pending my
business's confirmation** (`counterparty_business_id = me AND status =
PENDING_CONFIRMATION`) — the counterparty's action inbox. Read access to an
individual trade is broadened so the counterparty can review what they're being
asked to confirm.

## Fraud & security controls

| Vector (TAR) | Control |
|---|---|
| F3 phantom trust | Confirmation must come from the counterparty; initiator self-confirm impossible; no admin self-confirm. |
| F4/F5 circular/wash | Confirmed trades carry counterparty identity + amount + actor; `trade.confirmed` events feed Stage 9 cycle/volume detection. |
| F9 tampering | Decision + status + event written atomically and append-only; decision is attributable (`decided_by`). |
| AuthZ | Counterparty-membership enforced in the service; confirm endpoints reject initiator and non-members (403). |

## Events

`trade.confirmed`, `trade.rejected`, `trade.disputed` — consumed by the
Reputation Engine (Stage 5) and Fraud Engine (Stage 9).

## Out of scope (named stages)

Dispute resolution / evidence / adjudication (Stage 7), scoring (Stage 5),
notifying the counterparty that a trade awaits them (Stage 10).
