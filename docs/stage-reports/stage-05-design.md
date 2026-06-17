# Stage 5 — Reputation Engine v1: Design Note (pre-build)

> Produced before code. Defines the scoring model, the bands, the explanation
> model, and — most importantly — how scores stay **recomputable and evolvable**.
> Strictly honors [Trust Architecture Review](../trust-architecture-review.md) §4 (TAR).

## The non-negotiable architecture (TAR §4)

- **No score column on `businesses`.** Scores are **versioned, append-only
  snapshots** (`score_snapshots`) computed by a pure function of stored data.
- **`score = f(confirmed trades, signals, algorithm_version)`** — fully
  recomputable. A bug is a recompute, not data loss; a new algorithm is a new
  `algorithm_version` writing new rows beside the old.
- **Explanations are structured factors** (`score_factors`), never prose — so
  Product Principle 3 ("every score change has reasons") holds for *every* version.
- Each snapshot stores an **`inputs_hash`** for reproducibility and churn-avoidance.

## What counts (and what doesn't)

Only **`CONFIRMED`** trades contribute positive trust — the Stage 4 guarantee.
`DRAFT`/`PENDING`/`CANCELLED` are ignored; `REJECTED`/`DISPUTED` (on trades the
business *initiated*) are reliability signals / penalties.

## Scoring model v1.0.0 (score 0–1000)

Pure, deterministic, explainable. Each factor records `weight` (points),
`direction`, and `detail` (the evidence).

| Factor | Direction | Model | Rationale |
|---|---|---|---|
| `CONFIRMED_TRADE_VOLUME` | + | `min(300, round(80·ln(n+1)))` | Real, attested activity; diminishing returns. |
| `COUNTERPARTY_DIVERSITY` | + | `min(200, distinct·40)` | **Anti-wash (F5):** trading with many distinct partners beats repeating one. |
| `CONFIRMATION_RELIABILITY` | + | `round(rate·250)`, rate = confirmed/decided (as initiator) | Are this business's *claims* truthful (confirmed, not rejected/disputed)? |
| `IDENTITY_ASSURANCE` | + | `assuranceRank·50` (0–150) | Verified identity provenance (F1/F2). |
| `DISPUTE_PENALTY` | − | `disputed·40 + rejected·25` | Bad-faith/disputed claims reduce trust. |

`score = clamp(Σ contributions, 0, 1000)`.

## Bands

A band is a human label derived from the score, with one override: a business with
**no confirmed trades is always `NEW`** (no track record), even if identity-verified.

```
volume == 0           → NEW
score < 250           → BUILDING
score < 500           → ESTABLISHED
score < 750           → TRUSTED
score ≥ 750           → HIGHLY_TRUSTED
```

## Evolvability proof (why this won't need a redesign — TAR §4.4)

- New maths → new `algorithm_version`, new snapshot rows; v1 and v2 can run in
  parallel (shadow scoring) and be compared on real data. No `ALTER TABLE`.
- New evidence shapes → `score_factors.detail` / `score_snapshots.metadata` JSONB;
  promote to a column only when proven hot. No forced migration.

## Data model

- **`score_snapshots`**: `business_id`, `algorithm_version`, `score`, `band`,
  `inputs_hash`, `metadata` JSONB, `computed_at`. Append-only; latest = current.
- **`score_factors`**: `snapshot_id`, `factor_key`, `weight`, `direction`,
  `detail` JSONB.

## Recompute triggers

The engine is a **projection**: it reacts to `trade.confirmed` / `trade.rejected`
/ `trade.disputed` (Stage 4 events) and recomputes **both** businesses involved.
Idempotent: if the new `inputs_hash` + `algorithm_version` match the latest
snapshot, no new row is written (event-storm safe). Reads lazily compute a first
snapshot for a never-scored business. An admin recompute endpoint exists for ops.

## Surface

- `GET /businesses/:id/score` (public) → score, band, version, computedAt, factors.
- `GET /businesses/:id/score/history` (public) → past snapshots.
- `POST /businesses/:id/score/recompute` (ADMIN) → force a recompute.

Public reads are intentional: letting a business check another's trust **before**
extending credit is the entire MVP hypothesis.

## Fraud notes (capture + early controls)

Diversity factor blunts wash trading (F5); reliability + dispute penalty punish
false claims (F6/F9); assurance rewards verified identity (F1/F2); because scores
are recomputable, a fraud ring discovered in Stage 9 can be **retroactively
neutralized** by down-weighting offenders and recomputing — no schema change.

## Out of scope (named stages)

Fraud *detection* and ring down-weighting logic (Stage 9), richer factors/decay,
peer-relative scoring, and the visual trust profile (Stage 6).
