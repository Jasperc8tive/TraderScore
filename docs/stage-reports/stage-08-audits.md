# Stage 8 — Mandatory Audits (Security, Operations)

Per the roadmap, Stage 8 requires Security and Operations audits. Legend:
✅ resolved · 🟡 accepted (tracked) · ⬜ deferred to a named stage.

---

## 1. Security Audit (OWASP-informed)

| # | Finding | Severity | Resolution |
|---|---------|----------|------------|
| S1 | Least privilege across the admin surface | High | ✅ Every `/admin` route is gated by a specific permission: `BUSINESS_MODERATE` (business moderation/review), `USER_MANAGE` (user moderation, ADMIN-only), `DISPUTE_RESOLVE` (queue), `MARKET_MANAGE` (markets), `AUDIT_VIEW` (dashboards). **Verified**: a business owner gets 403. |
| S2 | Suspended user must be locked out | High | ✅ Suspend sets status + **revokes all sessions**, AND `verifyOtp` refuses suspended accounts so they can't re-activate via login. **Verified** e2e (login → 401; reactivate → ACTIVE). |
| S3 | Suspended business must not appear trustworthy | High | ✅ Discovery excludes non-ACTIVE businesses. **Verified** (hits 1 → 0 on suspend → 1 on reactivate). |
| S4 | Moderation auditability | Med | ✅ Every suspend/reactivate/market-update is audited with actor (from request context) + target + reason. |
| S5 | No trust laundering via admin | High | ✅ Admin can suspend/restore but cannot fabricate scores or confirm trades — Stage 4 (counterparty-only) and Stage 5 (recomputable) rules untouched. |
| S6 | Injection / input validation | High | ✅ All queries parameterized (including aggregates); DTOs validate reason/market fields and dispute-status filter (whitelisted enum). |
| S7 | Object access on review | Med | ✅ Business review requires `BUSINESS_MODERATE`; not exposed publicly. |

**Verdict:** PASS. The admin surface is least-privilege, fully audited, and its
moderation actions have real, verified security effects without weakening trust
integrity.

---

## 2. Operations Audit

| # | Capability | Finding |
|---|---|---|
| O1 | Moderate bad actors | ✅ Suspend/reactivate businesses and users; user suspension forces immediate lockout. |
| O2 | Triage disputes | ✅ Dispute queue filterable by status (`/admin/disputes`); integrates with the Stage 7 resolution workflow. |
| O3 | Review a business | ✅ One call returns identity, members, trade counts by status, dispute count, and current score — enough to make a moderation decision. |
| O4 | Spot risk early | ✅ Fraud overview surfaces businesses with the most disputed/rejected initiated trades (weighted) and Sybil hints (one user → many businesses). Heuristic, pre-Stage-9. **Verified**: 3 risk signals returned. |
| O5 | Manage markets | ✅ List + update market clusters (create from Stage 2). |
| O6 | Monitor scores | ✅ Band distribution + recent snapshots. **Verified**: BUILDING:5, ESTABLISHED:3, NEW:1. |
| O7 | Performance | ✅ Aggregates are single indexed queries (lateral join for latest score, FILTER aggregates for counts); read-only. |
| O8 | Self-recovery | ✅ Reactivation paths for both users and businesses; reversible moderation. |

**Verdict:** PASS. Operators have the read dashboards and write actions needed to
keep the trust graph clean, all verified live.

---

## Summary

Both mandated audits **PASS**. The operations platform is least-privilege, audited,
and effective: moderation has verified security teeth (lockout, discovery exclusion,
no trust laundering), and the dashboards give operators real visibility into risk,
disputes, businesses, markets, and scores. Automated fraud flags follow in Stage 9.
