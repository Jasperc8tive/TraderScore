# TradeScore — Trust Architecture Review (Pre-Build)

> **Status:** Required artifact produced **before any Stage 1 code is written.**
> **Purpose:** Establish how reputation data flows, where fraud can enter, and how
> the scoring engine can evolve for years **without database redesign**.
> **Audience:** Architecture, Security, Fraud, and Data reviewers.

This is the conceptual contract the rest of Stage 1 must not violate. If a later
implementation decision contradicts this document, the document wins or the
document must be formally amended (with an ADR).

---

## 1. The Core Asset We Are Protecting

TradeScore's only durable asset is **trustworthy reputation data**. Code,
infrastructure, and UI are replaceable. The reputation graph is not.

This produces a single overriding architectural law:

> **Raw trust events are immutable, append-only, and attributable.
> Reputation scores are derived, versioned, and disposable.**

Everything below follows from that law. If we can always recompute every score
from an immutable, attributable event log, then:

- A scoring bug is a *recompute*, never a data-loss event.
- A fraud ring discovered in 6 months can be *retroactively neutralized* by
  re-running scoring with the offenders' events down-weighted.
- An algorithm change is a *new score version*, never a migration.

---

## 2. How Reputation Data Flows Through the System

The system is modeled as a one-directional pipeline. Data only ever moves
**right**. Derived layers never write back into source layers.

```
                          (immutable, append-only)
  ┌─────────────┐   ┌──────────────────┐   ┌──────────────────┐
  │  Identity   │   │   Trust Events    │   │  Trust Signals    │
  │  (who)      │──▶│  (what happened)  │──▶│  (interpreted)    │
  └─────────────┘   └──────────────────┘   └──────────────────┘
   users               trades                  score_factors
   businesses          trade_confirmations     (Stage 5)
   market_clusters     trade_payments
                       trade_disputes
                       verification_events
                       relationships
                              │
                              ▼  (event bus, async)
                    ┌──────────────────────┐
                    │   Fraud Evaluation    │  ── writes ──▶ fraud_flags
                    │   (Stage 9)           │              (does NOT mutate events)
                    └──────────────────────┘
                              │
                              ▼  (recomputable projection)
                    ┌──────────────────────┐
                    │   Reputation Engine   │  ── writes ──▶ score_snapshots
                    │   (Stage 5)           │              score_factors
                    └──────────────────────┘
                              │
                              ▼  (read-only)
                    ┌──────────────────────┐
                    │   Discovery / Profiles│
                    └──────────────────────┘
```

### Flow narrative

1. **Identity layer** establishes *who* a participant is. A business is created,
   members are attached, verification raises an assurance level. These are the
   subjects of all trust.
2. **Trust event layer** records *what happened* between identities — a trade was
   logged, confirmed, paid, disputed. **These rows are never updated in a way
   that loses history.** Status transitions are themselves recorded events.
3. **Domain events** are emitted onto the **event bus** for every meaningful
   state change (`UserCreated`, `BusinessCreated`, `BusinessVerified`, and later
   `TradeConfirmed`, etc.). Consumers are decoupled and asynchronous.
4. **Fraud evaluation** subscribes to the bus. It *reads* events and *writes
   flags*. It never edits the underlying trade. A flag is an opinion about data,
   not a mutation of it.
5. **Reputation engine** is a **pure projection**: `score = f(events, signals,
   fraud_flags, algorithm_version)`. It writes `score_snapshots` (a point-in-time
   result) and `score_factors` (the human-readable *why*). It can be deleted and
   fully rebuilt from layers to its left.
6. **Discovery** reads only the latest snapshot + factors. It never computes.

### The non-negotiable rule of the pipeline

**No arrow points left.** Discovery cannot edit a score's inputs. The scoring
engine cannot edit a trade. Fraud cannot delete an event. This is what makes the
system auditable and what makes "explainable trust" (Product Principle 3)
mechanically guaranteed rather than aspirational.

---

## 3. Where Fraud Can Occur (Threat Model)

Reputation systems are adversarial from day one. We enumerate the attack
surface now so the schema and event design defend against it from Stage 1, even
though the *detection logic* ships in Stage 9.

| # | Attack | Mechanism | Stage 1 structural defense |
|---|--------|-----------|----------------------------|
| F1 | **Fake businesses** | Attacker registers many shell businesses to vouch for a target | Every business has an `assurance_level`; unverified businesses carry near-zero scoring weight. Identity is rate-limited per phone/owner. |
| F2 | **Sybil attack** | One human controls many "independent" identities | `created_by`, device/IP fingerprints, and phone numbers are captured as `verification_events`; shared signals collapse a Sybil cluster into one effective actor. |
| F3 | **Fake / phantom transactions** | A trade is logged that never happened | A trade is worth *nothing* until **counterparty-confirmed** (Stage 4). Self-asserted trades have zero reputation weight. Confirmation is a separate immutable event from a separate identity. |
| F4 | **Circular trade farming** | A→B→C→A log mutual trades to inflate all three | The relationship graph is first-class; cycle detection (Stage 9) runs over `business_relationships`. Trades store enough metadata (counterparty, value, time) to detect tight reciprocal loops. |
| F5 | **Reputation manipulation / wash trading** | Same counterparties trade repeatedly to farm volume | Scoring weights *distinct, diverse, verified* counterparties — encoded as `score_factors` so concentration is visible and penalizable without re-architecture. |
| F6 | **Collusive disputes / extortion** | Threatening false disputes to harm a competitor's score | Disputes (Stage 7) are evidence-backed and admin-resolved; a disputed trade's score impact is *frozen*, not auto-applied. |
| F7 | **Privilege abuse** | A business staff member acts beyond their authority | Role framework (Stage 1) separates `BUSINESS_OWNER` from `BUSINESS_STAFF`; sensitive actions are owner-only and audit-logged. |
| F8 | **Account takeover** | OTP/JWT theft | OTP rate limiting + hashing, short-lived access tokens, server-side revocable sessions, full audit log of auth events. |
| F9 | **Insider tampering** | An employee edits scores or trades in the DB | Append-only events + score recomputability mean tampering is *detectable* (recompute disagrees with stored snapshot) and *reversible*. |
| F10 | **Score gaming via timing** | Logging a burst of trades right before a credit check | Snapshots are timestamped and versioned; velocity is a `score_factor`; recency and steady history are weighted over bursts. |

**Stage 1 commitment:** We will not build detectors yet, but we *will* capture
every input those detectors need (attribution, fingerprints, counterparty
linkage, immutable status history) so Stage 9 needs **zero schema migration** to
begin detecting.

---

## 4. How Scoring Can Evolve Without Database Redesign

This is the single most important forward-compatibility decision in the project.
We separate **what we store** from **how we interpret it**.

### 4.1 We never store "the score" as a mutable column on `businesses`

A naive design puts `trust_score INT` on the business row and updates it. That
design is fatal: every algorithm change is a migration + a backfill + a loss of
history. We reject it.

### 4.2 Scores are versioned, append-only snapshots

```
score_snapshots
  id, business_id,
  algorithm_version   -- e.g. "v1.0.0", "v2.3.1"
  score               -- numeric result
  band                -- derived label (e.g. NEW, BUILDING, TRUSTED)
  computed_at
  inputs_hash         -- hash of the exact event set scored, for reproducibility
  metadata JSONB      -- algorithm-specific extras, no migration needed
```

A new algorithm = a new `algorithm_version` writing **new rows alongside** the
old. We can run v1 and v2 in parallel (shadow scoring), compare them on real
data, and cut over by simply reading the newer version. **No column changes.**

### 4.3 Explanations are structured factors, not prose

```
score_factors
  id, snapshot_id,
  factor_key          -- stable machine key, e.g. "VERIFIED_COUNTERPARTY_COUNT"
  weight              -- contribution to the score
  direction           -- POSITIVE | NEGATIVE
  detail JSONB        -- evidence: which trades, which counterparties
```

Because every snapshot ships its own factors, Product Principle 3 ("every score
change must have reasons") is satisfied for *every version of the algorithm*,
including future ones we haven't designed.

### 4.4 The two extensibility escape valves

1. **`algorithm_version` (the time axis):** lets the *math* change freely.
2. **`metadata`/`detail` JSONB (the shape axis):** lets a new algorithm record
   new kinds of evidence without `ALTER TABLE`. When a JSONB field proves
   permanent and queried-hot, we promote it to a real column via migration — a
   deliberate, reviewed act, not a forced one.

### 4.5 Recomputability is the safety net

Because scores are a pure function of immutable events, we can always answer:

- "What would every score be under algorithm v3?" → run v3 over the event log.
- "This business was in a fraud ring — undo its influence." → down-weight its
  events, recompute affected snapshots.
- "Did someone tamper with a stored score?" → recompute and compare to
  `inputs_hash`.

**This is why Stage 1 invests in an immutable event layer and an event bus
before a single score is ever calculated.** The hard part of a reputation network
is not the formula; it is guaranteeing the formula can always change. Stage 1
builds that guarantee.

---

## 5. Stage 1 Implications (what this review forces us to build now)

1. **Audit timestamps + soft-delete** on all entities → history is never lost.
2. **Attribution columns** (`created_by`, etc.) from the first migration → Sybil
   and insider analysis are possible later with no migration.
3. **`verification_events` as an append-only table** (designed now, even if
   lightly used) → assurance level has provenance.
4. **An event bus + first three domain events** → the decoupling that makes
   fraud and scoring pluggable later.
5. **Audit logging** of every privileged/auth action → F7, F8, F9 are
   investigable.
6. **A role framework** (`ADMIN`, `MODERATOR`, `BUSINESS_OWNER`, `BUSINESS_STAFF`)
   → least privilege from day one.
7. **No score columns anywhere** → we will not paint ourselves into the corner
   described in §4.1.

If Stage 1 delivers these, Stages 4, 5, 7, and 9 become *additive* rather than
*re-architecting*. That is the test of whether Stage 1 succeeded.

---

## 6. Review Sign-off Criteria

Stage 1 may be marked complete only if a reviewer can answer **yes** to all:

- [ ] Can every future score be recomputed purely from stored data?
- [ ] Is it impossible for a derived layer to mutate a source layer?
- [ ] Are all trust events append-only with full attribution?
- [ ] Can a new scoring algorithm ship without an `ALTER TABLE`?
- [ ] Is every privileged action audit-logged?
- [ ] Are the inputs to all 10 fraud vectors (F1–F10) already being captured?

— End of Trust Architecture Review —
