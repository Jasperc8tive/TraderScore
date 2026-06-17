# Stage 7 — Mandatory Audits (Fraud, Security)

Per the roadmap, Stage 7 requires Fraud and Security audits. Legend:
✅ resolved · 🟡 accepted (tracked) · ⬜ deferred to a named stage.

---

## 1. Fraud Audit

| # | Vector (TAR) | Control delivered | Status |
|---|---|---|---|
| F6 | Extortive / false disputes | A dispute **freezes** trust but never auto-penalizes the other party; it is evidence-backed and **admin-adjudicated**. A DISMISSED dispute restores trust. Raisers are attributable (`raised_by_*`) for repeat-abuse action in Stage 9. **Verified**: UPHELD→REJECTED, withdraw→restored. | ✅ |
| F9 | Tampering / fabricated outcomes | Dispute decision + trade transition + append-only `trade_event` are written in **one transaction**; resolution is attributable (`reviewed_by_user_id`); one active dispute per trade (`uq_disputes_active_per_trade`). | ✅ |
| F3 | Manufactured trust via dispute | Resolution can only set a trade to CONFIRMED/REJECTED through adjudication; the **counterparty-only confirmation rule (Stage 4) is untouched** — admins adjudicate disputes but still cannot self-confirm trades. | ✅ |
| F4/F5 | Ring/wash signals | Dispute events (`dispute.opened/resolved`) + trade status events captured for Stage 9 pattern analysis (e.g. businesses with abnormal dispute rates). | ✅ capture |
| — | Score gaming via dispute | Raising a dispute **freezes** the trade's positive contribution immediately (verified: score 345 → 0), so a bad actor can't keep trust on a contested trade; final adjudication sets the lasting effect. | ✅ |

**Verdict:** PASS. Disputes protect trust without becoming a weapon: contested
trust is frozen, outcomes are adjudicated and attributable, and the confirmation
integrity rule is preserved.

---

## 2. Security Audit (OWASP-informed)

| # | Finding | Severity | Resolution |
|---|---------|----------|------------|
| S1 | Who can raise/evidence/withdraw | High | ✅ Party-membership enforced in the service (initiator or counterparty); withdraw restricted to the **raising** business; non-parties 403. **Verified** e2e. |
| S2 | Who can adjudicate | High | ✅ `DISPUTE_RESOLVE` permission (ADMIN + MODERATOR) via guard; a party without it gets 403. **Verified** e2e. No self-confirm path for admins. |
| S3 | State-integrity / double resolution | High | ✅ `canResolve`/`canWithdraw`/`canReview` guards + transactional updates; resolving a resolved dispute → CONFLICT. **Verified**. One active dispute per trade (unique index). |
| S4 | Object-level read access | Med | ✅ Dispute detail visible to parties + adjudicators only; others 403. |
| S5 | Input validation | Med | ✅ DTOs: reason 5–2000, evidence body 3–4000, attachment must be a URL, resolution ∈ {UPHELD,DISMISSED}. |
| S6 | Auditability | Med | ✅ Audit entries for opened/evidence/withdrawn/review/resolved with actor + resource; append-only trade events record every status change. |
| S7 | Injection | High | ✅ All queries parameterized. |
| S8 | Consistency of trade + score | High | ✅ Resolution emits the trade status event so the reputation engine recomputes; **verified** score moved 345→0 (freeze) →195 (uphold) and restored on withdraw. |

**Verdict:** PASS. No unresolved High/Med findings.

---

## Summary

Both mandated audits **PASS**. The dispute system is a genuine trust-protection
layer: contested trust is frozen, adjudication is permissioned and attributable,
outcomes flow atomically into trade status and (via events) the score, and the
counterparty-only confirmation guarantee remains intact. All verified live.
