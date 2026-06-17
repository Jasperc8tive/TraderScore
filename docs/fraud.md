# TradeScore — Fraud Documentation

## Principle

**Fraud flags are opinions about data. They never mutate trades, confirmations, or
scores** (Trust Architecture Review §2). The Fraud Engine reads immutable events
and writes `fraud_flags`; operators act via moderation (Stage 8). Because scores are
recomputable, confirmed flags can feed scoring as a down-weight in a future version
with no schema change (TAR §4.5).

## Structural defenses (across stages)

| Vector | Defense |
|---|---|
| F1 fake businesses | New businesses `UNVERIFIED`; assurance raised only by moderator/admin. |
| F2 Sybil | Phone-normalized identity, attribution (`created_by`), OTP rate-limit; Sybil detector. |
| F3 phantom trust | A trade is worth nothing until **counterparty-confirmed**; no self/admin confirm. |
| F4 circular trading | Self-trade blocked (DB CHECK); cycle detector (2-/3-cycles). |
| F5 wash trading | Score weights distinct counterparties (diversity cap); wash + velocity detectors. |
| F6 extortive disputes | Disputes freeze (not penalize), evidence-backed, admin-adjudicated. |
| F7 privilege abuse | OWNER vs STAFF separation; least-privilege RBAC. |
| F8 account takeover | OTP hardening, revocable rotating sessions. |
| F9 tampering | Append-only logs; atomic, attributable writes; recomputable scores detect drift. |
| F10 score gaming | Diminishing volume returns, recency, dispute penalty; disputes freeze contributions. |

## Detectors (Stage 9, pure + unit-tested)

- **SYBIL_CLUSTER** — one creator owning ≥ 3 businesses (severity scales).
- **CIRCULAR_TRADING** — 2-cycles (A↔B) and 3-cycles (A→B→C→A) over confirmed edges.
- **WASH_TRADING** — confirmed volume concentrated on a single counterparty (≥ 0.8).
- **VELOCITY_ANOMALY** — ≥ 10 confirmations in 24h.
- **HIGH_DISPUTE_RATE** — ≥ 50% of decided initiated trades rejected/disputed.
- **RELATIONSHIP_RISK** — high mutual volume + disputes on a pair.

## Execution

- **Event-driven (hot path):** on `trade.confirmed`, detection is **scoped to the two
  businesses** + a cheap global Sybil check; isolated and idempotent.
- **Full scan (batch/admin):** `POST /admin/fraud/scan` runs all detectors over the
  whole graph. ~40 ms over 100k trades; move to a scheduled/queued job at large scale.
- **Dedupe + review-respect:** one open flag per (type, subject); re-detection
  refreshes open flags and will not re-raise a CONFIRMED or recently DISMISSED one.

## Operator workflow

`GET /admin/fraud/flags` → triage → `POST /admin/fraud/flags/:id/review`
(CONFIRMED/DISMISSED) → act via moderation (suspend business/user). Heuristic
risk/Sybil signals also surface in `GET /admin/fraud/overview`.
