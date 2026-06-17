# Stage 7 — Dispute System: Design Note (pre-build)

> Produced before code. Defines the dispute lifecycle, evidence, admin
> adjudication, and how a resolution flows back into the trade and the score.
> Honors the [Trust Architecture Review](../trust-architecture-review.md) (TAR).

## Purpose: a trust protection layer

Stages 4–5 grant trust when a counterparty confirms a trade. But confirmed trades
can go bad, and confirmations can be wrong. The dispute system lets a party
**formally contest a trade**, submit **evidence**, and have a **moderator/admin
adjudicate** — with the outcome flowing back into the trade status and (via events)
the reputation score. It also defends against **extortion via false disputes**
(TAR F6): disputes are evidence-backed and adjudicated, never auto-penalizing.

## Relationship to the Stage 4 confirmation-time dispute

Stage 4 lets a counterparty mark a *pending* trade `DISPUTED` during confirmation
(a quick "this claim is wrong"). Stage 7 adds the **formal case**: opened on a
`CONFIRMED` or `DISPUTED` trade, with evidence and admin resolution that drives
the trade to a final `CONFIRMED` or `REJECTED`.

## Dispute lifecycle

```
            raise (party)                  resolve (UPHELD)
  (trade CONFIRMED/DISPUTED) ──▶ OPEN ──review──▶ UNDER_REVIEW ──────────▶ RESOLVED
                                  │  \________________________ resolve (DISMISSED) ▲
                                  │                                               │
                                  └── withdraw (raiser) ──▶ WITHDRAWN              │
```

- **OPEN → UNDER_REVIEW**: a moderator/admin claims it.
- **resolve** (UPHELD | DISMISSED): moderator/admin only.
- **withdraw**: the raising business only, before resolution.

## Effect on the trade (and score)

Opening a dispute **freezes trust**: a `CONFIRMED` trade moves to `DISPUTED`
(stops contributing positively). The dispute stores `trade_status_before` so a
withdrawal can restore it. Resolution:

| Outcome | Trade status | Emitted event → score |
|---|---|---|
| **UPHELD** (dispute valid) | `REJECTED` | `trade.rejected` → trust removed |
| **DISMISSED** (dispute invalid) | `CONFIRMED` | `trade.confirmed` → trust granted |
| **WITHDRAWN** | restored to `trade_status_before` | corresponding event |

The reputation engine already subscribes to these trade events, so scores
recompute automatically — no new coupling.

## State-machine extension (trades)

Added to the pure allow-list: `CONFIRMED → DISPUTED` (raise), `DISPUTED →
CONFIRMED` (dismiss/withdraw), `DISPUTED → REJECTED` (uphold). These transitions
are only reachable through the dispute workflow; the service governs who/when.

## Data model

- **`disputes`**: `trade_id`, `raised_by_business_id`, `raised_by_user_id`,
  `reason`, `status`, `trade_status_before`, `resolution`, `resolution_note`,
  `reviewed_by_user_id`, `resolved_at`, timestamps. **One active dispute per trade**
  (partial unique index on OPEN/UNDER_REVIEW).
- **`dispute_evidence`** (append-only): `dispute_id`, `submitted_by_user_id`,
  `submitted_by_business_id`, `body`, `attachment_url?`, `created_at`.

(Real file upload uses the existing S3/local storage abstraction in a later stage;
Stage 7 records an optional attachment URL/key so the evidence model is complete.)

## Authorization

- **Raise / add evidence / withdraw**: members (OWNER/STAFF) of a party to the
  trade (initiator or counterparty). Withdraw is the **raising** business only.
- **Review / resolve**: a new RBAC permission `DISPUTE_RESOLVE`, granted to
  `ADMIN` and `MODERATOR` only. (Admins adjudicate; they still cannot manufacture
  trust by confirming trades — that remains counterparty-only from Stage 4.)
- **View**: parties + moderators/admin.

## Fraud & security controls

| Vector (TAR) | Control |
|---|---|
| F6 extortive/false disputes | Evidence-backed + admin-adjudicated; DISMISSED restores trust; raisers are attributable for repeat-abuse action (Stage 9). |
| F9 tampering | Dispute decision + trade transition + trade_event written atomically; append-only evidence; resolution attributable (`reviewed_by`). |
| AuthZ | Party-only raise/evidence; raiser-only withdraw; `DISPUTE_RESOLVE` for adjudication; one active dispute per trade (unique index). |

## Events

`dispute.opened`, `dispute.resolved` (for notifications/fraud later) + the trade
status events that drive score recompute.

## Out of scope (named stages)

File upload pipeline (later/Stage 13), automated fraud detection on dispute
patterns (Stage 9), notifying parties of dispute activity (Stage 10).
