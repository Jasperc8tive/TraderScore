# Stage 3 — Mandatory Audits (Fraud, Database, QA)

Per the roadmap, Stage 3 requires Fraud, Database, and QA audits. Legend:
✅ resolved · 🟡 accepted (tracked) · ⬜ deferred to a named stage.

---

## 1. Fraud Audit

| # | Vector (TAR) | Control delivered this stage | Status |
|---|---|---|---|
| F3 | Phantom / fabricated trades | Trades start `DRAFT`; trust requires counterparty confirmation (Stage 4). Scoring (Stage 5) will only count `CONFIRMED`. An unconfirmed trade carries zero trust. | ✅ structural |
| F4 | Self-dealing / circular | A business cannot trade with itself: enforced in the service **and** a DB `CHECK` (`counterparty_business_id <> initiator_business_id`). **Verified** e2e → VALIDATION_ERROR. Counterparty linkage + indexes captured for cycle detection in Stage 9. | ✅ |
| F5 | Wash trading | Amount, counterparty, `occurred_on`, and `created_by` recorded on every trade; `idx_trades_counterparty_status` supports later volume/repetition analysis. | ✅ capture |
| F9 | Tampering / silent edits | `trade_events` is append-only (no update/delete columns); every create/edit/submit/cancel appends an attributable event. **Verified**: history returned `CREATED,EDITED,SUBMITTED`. Amounts constrained `> 0` (DB + service). | ✅ |
| F2 | Sybil (carried) | `created_by` attribution on trades feeds the same Sybil signals as Stage 2. | ✅ capture |
| — | Future-dated trades | Rejected (service): trade date cannot be in the future. **Verified** unit test. | ✅ |

**Verdict:** PASS. Detection logic remains Stage 9; Stage 3 enforces the
structural controls and captures every input those detectors will need.

---

## 2. Database Audit

| # | Finding | Severity | Resolution |
|---|---------|----------|------------|
| D1 | Money precision | High | ✅ `amount_minor BIGINT` (integer minor units) + `currency CHAR(3)` CHECK; no floats anywhere (credit-grade). |
| D2 | Status integrity | Med | ✅ `status` CHECK mirrors `TradeStatus`; `direction` and `event_type` CHECKs mirror their enums. |
| D3 | Append-only history | High | ✅ `trade_events` has no `updated_at`/`deleted_at` — rows are immutable by design (TAR §1). Writes go through one transactional path with the trade mutation. |
| D4 | Atomicity of state + log | High | ✅ Create/edit/transition each wrap the trade write **and** its event insert in a single `withTransaction` — a trade can never change without a logged event. |
| D5 | Query performance | Med | ✅ Indexes on initiator, counterparty, status, created_by, `(counterparty_business_id, status)` for Stage-4 confirmation lookups, and `(trade_id, created_at)` on events. |
| D6 | Self-trade at the data layer | Med | ✅ DB `CHECK` constraint, not only app logic — defense in depth. |
| D7 | Reference code uniqueness | Low | ✅ Partial unique index on `reference_code` (soft-delete aware). |
| D8 | Migration safety | Med | ✅ Forward-only `0006_trades.sql`; **verified** applied against live Postgres (1 of 6; idempotent runner). |

**Verdict:** PASS.

---

## 3. QA Audit (flows, edge cases, failure modes)

| Scenario | Expected | Verified |
|---|---|---|
| Create trade | DRAFT + reference code + CREATED event | ✅ e2e |
| Edit pre-confirmation | fields change, EDITED event appended | ✅ e2e |
| Submit with registered counterparty | → PENDING_CONFIRMATION, SUBMITTED event, `trade.submitted` emitted | ✅ e2e |
| Submit without counterparty | VALIDATION_ERROR | ✅ e2e |
| Cancel pre-confirmation | → CANCELLED | ✅ e2e |
| Cancel an already-cancelled/confirmed trade | CONFLICT | ✅ e2e + unit |
| Edit a cancelled trade | CONFLICT | ✅ unit |
| Illegal status transitions | rejected by allow-list | ✅ unit (state machine) |
| Self-trade | VALIDATION_ERROR | ✅ e2e + unit |
| Non-positive amount | VALIDATION_ERROR | ✅ unit (found a gap: Money allows 0; service now enforces > 0) |
| Future trade date | VALIDATION_ERROR | ✅ unit |
| Non-member access to a trade | 403 FORBIDDEN | ✅ e2e |
| List trades for a business | paginated envelope | ✅ e2e |
| History | append-only ordered events | ✅ e2e |

**Build quality:** `pnpm build` 9/9, `pnpm typecheck` 16/16, `pnpm lint` 0/0,
`pnpm test` **all pass (API 20 tests; ~45 workspace-wide)**.

**Verdict:** PASS. One real gap (zero-amount trades) was found by a unit test and
fixed (service now requires amount > 0, matching the DB CHECK and DTO).

---

## Summary

All three mandated audits **PASS**. The trade engine is append-only and
attributable, the state machine is explicit and tested, money is integer-precise,
and every fraud-detection input for Stages 4/5/9 is now captured. No blocking
findings.
