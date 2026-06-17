# Stage 13 — Mandatory Audits (Security, Finance, Performance)

Per the roadmap, Stage 13 requires Security, Finance, and Performance audits.
Legend: ✅ resolved · 🟡 accepted (tracked) · ⬜ deferred.

---

## 1. Security Audit (OWASP-informed)

| # | Finding | Severity | Resolution |
|---|---------|----------|------------|
| S1 | Price tampering via request | High | ✅ Amounts come from code-defined `PLANS`, never the request (the DTO only carries `plan`). **Verified**: PRO charged exactly 500000. |
| S2 | Card/PII exposure | High | ✅ No card data passes through or is stored — only an opaque provider reference. PCI surface minimized via the provider abstraction. |
| S3 | Billing authorization | High | ✅ Subscribe/cancel/invoices require business **ownership** (ADMIN bypass); non-owner → 403. **Verified**. |
| S4 | Trust laundering with money | High | ✅ Paid plans grant a **commercial** "Verified Seller" badge + features only — never a higher trust score or self-confirmation. The behavioural score is untouched by billing. |
| S5 | Double-charge / duplicate subscriptions | Med | ✅ One active subscription per business (unique index); subscribe upgrades/renews rather than duplicating. |
| S6 | Revenue endpoint exposure | Med | ✅ `/admin/billing/revenue` requires `AUDIT_VIEW`; public `/billing/plans` exposes only pricing. |
| S7 | Input validation | Med | ✅ `plan` constrained to the enum; invalid plan rejected. |
| S8 | Auditability | Med | ✅ subscribe/cancel/charge-failure are audited; telemetry records subscription events. |

**Verdict:** PASS. Money is server-authoritative, no card data is held, billing is
owner-gated, and paid status cannot buy trust.

---

## 2. Finance Audit

| # | Concern | Resolution |
|---|---------|------------|
| F1 | Monetary precision | ✅ Integer minor units throughout (`amount_minor BIGINT`, prices in code as integers); no floats. |
| F2 | Invoice integrity | ✅ Persist-then-charge: a `PENDING` invoice is written before charging; on success → `PAID` + provider ref + `paid_at`; on failure → `FAILED` + error. **Verified** PAID invoice with ref. |
| F3 | Authoritative pricing | ✅ Invoice amount = plan price from code; client cannot influence it. |
| F4 | Revenue reporting | ✅ MRR = Σ(active plan price × count); active-by-plan breakdown. **Verified**: PRO:1 → MRR 500000. |
| F5 | Lifecycle correctness | ✅ Subscribe → ACTIVE; cancel → CANCELLED (business reverts to FREE entitlements). **Verified** badge granted then removed. |
| F6 | Reconciliation hooks | 🟡 No PSP webhooks yet (dev provider auto-succeeds); the invoice/provider-ref model is ready for webhook reconciliation at go-live. |
| F7 | Refunds/proration/tax | ⬜ Deferred to go-live; out of scope for this stage. |

**Verdict:** PASS for the revenue-infrastructure scope: precise, authoritative,
auditable money with correct subscription lifecycle and MRR reporting.

---

## 3. Performance Audit

| # | Concern | Resolution |
|---|---------|------------|
| P1 | Discovery badge enrichment | ✅ Verified-badge resolved via a single `LEFT JOIN subscriptions` in the existing discovery query — no N+1. |
| P2 | Subscription/invoice lookups | ✅ Indexed by business (`idx_subscriptions_business`, `idx_invoices_business`); active-subscription uniqueness indexed. |
| P3 | Revenue aggregation | ✅ Single `GROUP BY` over active subscriptions. |
| P4 | Feature flags cost | ✅ Resolved from in-process env + code defaults (no I/O). |
| P5 | Charge on the request path | 🟡 Subscribe awaits the provider charge inline (acceptable; a real PSP would be async/webhook-driven at go-live). |

**Verdict:** PASS. Enrichment avoids N+1, lookups are indexed, and flags are I/O-free.

---

## Summary

All three mandated audits **PASS**. The revenue infrastructure is secure
(server-authoritative pricing, no card data, owner-gated, no trust laundering),
financially correct (integer money, persist-then-charge invoices, MRR), and
performant (no N+1, indexed). PSP integration, webhooks, refunds/tax, and full
PostHog dashboards are deliberately deferred to go-live behind the abstractions
already in place.
