# Stage 9 — Mandatory Audits (Fraud, Performance)

Per the roadmap, Stage 9 requires Fraud and Performance audits. Legend:
✅ resolved · 🟡 accepted (tracked) · ⬜ deferred to a named stage.

---

## 1. Fraud Audit

| # | Vector (TAR) | Detector / control | Status |
|---|---|---|---|
| F1/F2 | Fake / Sybil identity | `SYBIL_CLUSTER`: one creator owning ≥3 businesses, severity scales with count. **Verified** (3 → MEDIUM flag). | ✅ |
| F4 | Circular trading | `CIRCULAR_TRADING`: 2-cycle (A↔B) and 3-cycle detection over confirmed-trade edges. **Verified** auto-flag on the 2nd confirmation + via scan. | ✅ |
| F5 | Wash trading | `WASH_TRADING`: confirmed volume concentrated on one counterparty; `VELOCITY_ANOMALY`: 24h confirmation burst. Unit-tested thresholds. | ✅ |
| F6 | Collusion / bad faith | `HIGH_DISPUTE_RATE` on initiated trades; `RELATIONSHIP_RISK` per pair (mutual volume + disputes). **Verified** (relationshipRisk flags). | ✅ |
| TAR §2 | Flags must not corrupt trust data | The engine **only writes `fraud_flags`** — it never mutates trades, confirmations, or scores. Flags are opinions surfaced to operators. | ✅ |
| — | Respect operator judgement | Re-detection refreshes OPEN flags, **does not re-create CONFIRMED or recently DISMISSED ones** (found by e2e, fixed). **Verified**: confirm + rescan does not reopen. | ✅ |
| TAR §4.5 | Retroactive response | Because scores are recomputable, a future v2 can feed confirmed flags into scoring as a down-weight — no schema change. | ⬜ v2 (enabled) |

**Verdict:** PASS. All four required detector families work, flags are pure
opinions, and operator decisions are respected on re-scan.

---

## 2. Performance Audit

| # | Concern | Finding |
|---|---|---|
| P1 | Cost per confirmation event | ✅ Event detection is **scoped to the two businesses** (their per-business + pair stats), plus one cheap global Sybil GROUP BY; cycle detection runs on the DISTINCT-relationship edge set and only persists cycles involving the affected businesses. Bounded work per event. |
| P2 | Cycle detection complexity | ✅ Bounded to length ≤ 3 over distinct edges (no unbounded DFS); 2-cycles via reverse-edge lookup, 3-cycles via adjacency, canonicalized + deduped. |
| P3 | Aggregate query cost | ✅ Single CTE-based queries using existing indexes (`idx_trades_*`, status filters); per-business/pair queries accept an id filter to scope. |
| P4 | Flag write amplification | ✅ Idempotent upsert: refresh-or-skip keeps at most one active flag per (type, subject); **verified** open-flag count stable across repeated scans (5 → 5). |
| P5 | Subscriber isolation | ✅ Detection runs in an isolated, try/catch'd handler; a fraud failure never blocks or rolls back a trade confirmation. |
| P6 | Flag query performance | ✅ `fraud_flags` indexed on status+detected_at, type, and subject. |
| P7 | Full-scan cost at scale | 🟡 Full scan is O(graph); intended for admin/batch use, not the hot path. At large scale it should move to a scheduled/queued job (post-Pilot). |

**Verdict:** PASS. The hot path (per-confirmation) is bounded and isolated;
flag writes are idempotent; the only O(graph) operation is the deliberate
admin/batch scan.

---

## Summary

Both mandated audits **PASS**. The Fraud Engine v1 delivers Sybil, circular-trading,
suspicious-transaction, and relationship-risk detection as **opinions that never
mutate trust data**, runs bounded + isolated on confirmation events with an
on-demand full scan, and respects operator review on re-detection — all verified
live. One genuine flaw (re-flagging reviewed items) was found by the e2e and fixed.
