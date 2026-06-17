# Stage 4 — Mandatory Audits (Fraud, Security)

Per the roadmap, Stage 4 requires Fraud and Security audits. Legend:
✅ resolved · 🟡 accepted (tracked) · ⬜ deferred to a named stage.

---

## 1. Fraud Audit

This stage creates trust, so it is the highest-stakes fraud surface so far.

| # | Vector (TAR) | Control delivered | Status |
|---|---|---|---|
| F3 | Self-asserted / phantom trust | **Only the counterparty can confirm.** The initiator can never confirm its own trade — even when one user is a member of *both* businesses (service checks counterparty membership AND absence of initiator membership). **No ADMIN bypass.** Verified e2e (initiator → FORBIDDEN) and unit (member-of-both → FORBIDDEN). | ✅ |
| F4 | Circular / reciprocal dealing | Confirmed trades carry both business ids + amount + `decided_by`; `trade.confirmed` events feed Stage 9 cycle detection; self-trade already blocked at logging (Stage 3). | ✅ capture |
| F5 | Wash / collusion volume | Each confirmation is attributable and one-per-trade (`uq_trade_confirmations_trade`); repeated same-counterparty confirmations are queryable for Stage 9. | ✅ capture |
| F6 | Collusive / extortive disputes | A dispute requires a reason and parks the trade in `DISPUTED` (no trust granted, no penalty auto-applied); resolution/adjudication is the access-controlled Stage 7. | ✅ contained |
| F9 | Tampering / fabricated confirmations | Decision + status change + append-only `trade_events` row written in **one transaction**; decision attributable to a user; double-decision impossible (status guard + unique index). Verified e2e (double-confirm → CONFLICT). | ✅ |

**Verdict:** PASS. The trust-creation path cannot be self-served. Every confirmed
trade is independently attested and fully attributable — exactly what the
reputation engine (Stage 5) needs to safely count it.

---

## 2. Security Audit (OWASP-informed)

| # | Finding | Severity | Resolution |
|---|---------|----------|------------|
| S1 | Authorization on decisions | High | ✅ Counterparty-membership required; initiator and non-members rejected (403). Enforced in the service (data-dependent), not a coarse guard. Verified e2e + unit. |
| S2 | Privilege bypass via ADMIN | High | ✅ Deliberately **no** admin bypass on confirm/reject/dispute — admins cannot manufacture trust. Unit-tested. |
| S3 | Broken object-level access (read) | Med | ✅ Trade read widened to members of initiator **or** counterparty only; everyone else 403. Verified (counterparty can read; earlier stage verified non-party 403). |
| S4 | State-integrity / race on decision | High | ✅ One decision per trade (`uq_trade_confirmations_trade`) + status guard (`isConfirmable`) + single transaction; a second decision fails with CONFLICT. |
| S5 | Input validation | Med | ✅ DTO validation: dispute requires a 3–1000 char reason (verified 400); notes length-bounded; ids are UUIDs. Service re-checks dispute reason (defense in depth). |
| S6 | Auditability | Med | ✅ `trade.confirmed/rejected/disputed` audit entries with actor + resource; append-only `trade_events` records the transition and the decider. |
| S7 | Injection | High | ✅ All queries parameterized. |

**Verdict:** PASS. No unresolved High/Med findings.

---

## Summary

Both mandated audits **PASS**. The integrity rule — *trust can only come from the
counterparty, never the initiator and never an admin* — is enforced in code, at the
data layer (one decision per trade), and verified live and in unit tests. Stage 4
delivers genuine "verified transaction infrastructure."
