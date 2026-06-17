# Stage 10 — Mandatory Audits (Reliability, UX)

Per the roadmap, Stage 10 requires Reliability and UX audits. Legend:
✅ resolved · 🟡 accepted (tracked) · ⬜ deferred to a named stage.

---

## 1. Reliability Audit

| # | Concern | Resolution |
|---|---------|------------|
| R1 | Lost notifications on provider failure | ✅ **Persist-then-dispatch:** a `notifications` row is written `PENDING` before any send; status moves to SENT/FAILED. Nothing is lost if dispatch throws. |
| R2 | Transient delivery failures | ✅ Bounded retries (up to 3 attempts) per send; terminal failure recorded as `FAILED` with error + attempt count for later resend/reconcile. |
| R3 | Notification failure breaking core flows | ✅ Sending runs in isolated event handlers (the bus isolates subscribers) with try/catch; a delivery failure never affects the trade/dispute/confirmation flow. **Verified**: trade/dispute flows succeeded while notifications were produced. |
| R4 | Delivery observability | ✅ Every notification is a persisted record (channel, address, status, attempts, error, sent_at) — an auditable delivery log. **Verified**: 5/5 SENT with channel+address. |
| R5 | Provider portability | ✅ `NotificationChannelProvider` abstraction; dev log provider locally, real Twilio/WhatsApp/SES adapters config-gated later — no caller changes. |
| R6 | Duplicate delivery | 🟡 In-memory bus delivers once; the persisted record enables reconciliation. A durable queue + idempotency keys are a future hardening item. |

**Verdict:** PASS. Notifications are durable (persist-first), retried, isolated,
and observable.

---

## 2. UX Audit

| # | Finding | Resolution |
|---|---------|------------|
| U1 | Right person, right moment | ✅ Owners are notified exactly when action/awareness is needed: a trade to confirm, a confirmation/rejection/dispute on their trade, dispute activity, verification. **Verified** recipients per event. |
| U2 | Low-bandwidth messaging | ✅ Short, SMS-first messages with the key fact (and amount where relevant); persisted for the in-app inbox. |
| U3 | In-app inbox | ✅ `GET /notifications` returns the user's notifications, most recent first; a user only sees their own. **Verified**. |
| U4 | Clarity of message | ✅ Distinct titles/bodies per type; money formatted; dispute resolution outcome included. Unit-tested templates. |
| U5 | Notification volume | 🟡 Disputing a confirmed trade produces both `TRADE_DISPUTED` and `DISPUTE_OPENED` (each a real state change); slightly chatty. Acceptable for v1; batching/preferences in Stage 13. |
| U6 | Channel fit for audience | ✅ SMS-first for traders; WhatsApp/Email channels modeled and ready to enable. |

**Verdict:** PASS. The right people are notified at the right time with clear,
low-bandwidth messages and an inbox to review them.

---

## Summary

Both mandated audits **PASS**. The notification system is reliable (persist-first,
retried, isolated, observable) and user-appropriate (timely, low-bandwidth,
inbox-backed), with a channel abstraction ready for real SMS/WhatsApp/Email
providers. Accepted items (chattiness, durable queue) are tracked for later stages.
