# Stage 5 — Mandatory Audits (Product, Fraud, Data)

Per the roadmap, Stage 5 requires Product, Fraud, and Data audits. Legend:
✅ resolved · 🟡 accepted (tracked) · ⬜ deferred to a named stage.

---

## 1. Product Audit

Does the reputation system deliver the MVP value: can a business assess another's
trustworthiness *before* extending credit?

| # | Question | Finding |
|---|---|---|
| P1 | Is a score available to a prospective creditor? | ✅ `GET /businesses/:id/score` is **public** — the core MVP action needs no account. |
| P2 | Is the score explainable? | ✅ Every score ships structured factors with weights + evidence (e.g. reliability=250, volume=129, diversity=80). Product Principle 3 satisfied. **Verified** e2e. |
| P3 | Does it reflect real, attested activity? | ✅ Only CONFIRMED trades contribute; unconfirmed claims score nothing. |
| P4 | Does a new business read sensibly? | ✅ No-history business is `NEW` / 0 — communicates "no track record" rather than a misleading number. **Verified**. |
| P5 | Is the score current? | ✅ Auto-recomputes on confirmation events; **verified** a rejection moved the score 459→384 with no manual action. |
| P6 | Are the bands meaningful? | ✅ NEW → BUILDING → ESTABLISHED → TRUSTED → HIGHLY_TRUSTED, with NEW reserved for no-history. |

**Verdict:** PASS. The hypothesis is now testable end-to-end: look up a business,
see a trust score and the reasons behind it.

---

## 2. Fraud Audit

| # | Vector (TAR) | Control in v1 | Status |
|---|---|---|---|
| F1/F2 | Fake / Sybil identity inflating score | `IDENTITY_ASSURANCE` rewards verified provenance; unverified businesses get 0 there. | ✅ |
| F3 | Phantom trust | Only CONFIRMED (counterparty-attested) trades score. | ✅ |
| F5 | Wash trading (same partners) | `COUNTERPARTY_DIVERSITY` capped at 5 distinct partners — repeating one counterparty cannot inflate the score; volume alone is diminishing. **Verified** (2 distinct → 80, capped). | ✅ |
| F6/F9 | False claims / bad faith | `CONFIRMATION_RELIABILITY` (confirmed/decided as initiator) + `DISPUTE_PENALTY` reduce the score for rejected/disputed claims. **Verified** (rejection → −25 + reliability drop). | ✅ |
| F4 | Circular rings | Captured for Stage 9; because scores are **recomputable**, a ring found later can be neutralized by down-weighting offenders and recomputing — **no schema change** (TAR §4.5). | ⬜ Stage 9 (architecturally enabled now) |

**Verdict:** PASS. v1 already blunts the cheapest manipulation (wash trading,
self-claims) and the architecture makes retroactive fraud response possible.

---

## 3. Data Audit

| # | Finding | Severity | Resolution |
|---|---------|----------|------------|
| D1 | No mutable score column (TAR §4.1) | High | ✅ Scores live only in append-only `score_snapshots`; `businesses` has no score column. |
| D2 | Versioning for algorithm evolution | High | ✅ `algorithm_version` on every snapshot; `computeScore` selects the version; v2 can run beside v1 with no migration. |
| D3 | Reproducibility | High | ✅ `inputs_hash` over the canonical input set; recompute over identical data yields an identical hash. **Verified**: repeated reads write no new snapshot. |
| D4 | Explanation integrity | Med | ✅ Factors persisted per snapshot in `score_factors`; each snapshot carries its own "why", valid for its version. |
| D5 | Determinism / precision | Med | ✅ Pure integer scoring (0–1000); unit-tested deterministic; clamped; `CHECK (score 0..1000)`. |
| D6 | Recompute correctness | High | ✅ Score = pure function of CONFIRMED trades + identity, read via one aggregate query path; **verified** the math end-to-end (459, 384). |
| D7 | Churn / event storms | Med | ✅ Idempotent: unchanged inputs+version → no new snapshot. **Verified** (history stable across repeated reads). |
| D8 | Performance | Med | ✅ `(business_id, computed_at DESC)` index for "current score"; factors indexed by snapshot. |

**Verdict:** PASS. The data model satisfies the Trust Architecture Review's
recomputability and evolvability requirements in full.

---

## Summary

All three mandated audits **PASS**. The reputation engine is explainable,
fraud-aware, public for the MVP use case, and — critically — built as a
versioned, append-only, recomputable projection so it can evolve for years
without a database redesign.
