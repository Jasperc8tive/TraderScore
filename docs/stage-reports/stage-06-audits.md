# Stage 6 — Mandatory Audits (UX, Product)

Per the roadmap, Stage 6 requires UX and Product audits. Legend:
✅ resolved · 🟡 accepted (tracked) · ⬜ deferred to a named stage.

---

## 1. UX Audit

| # | Finding | Severity | Resolution |
|---|---------|----------|------------|
| U1 | Trust must be the headline | High | ✅ Every result row and the profile lead with the score + `TrustBadge`; verification shown inline. **Verified** rendered live. |
| U2 | No-login lookup | High | ✅ `/discover` and `/business/[slug]` are public server-rendered pages backed by public API; no account needed. **Verified** 200s. |
| U3 | Explainability carries to the UI | Med | ✅ Profile shows the factor breakdown ("Why this score") with signed contributions. |
| U4 | Filtering/sorting is usable | Med | ✅ GET-form filters (name, band, sort) — bookmarkable URLs, works without JS (server components). |
| U5 | Graceful failure | Med | ✅ API-unreachable → friendly message; empty results → clear empty state; unknown business → 404 page. |
| U6 | Low-bandwidth friendliness | Med | ✅ Server-rendered, minimal client JS, no first-paint client fetch. Full PWA/offline is Stage 11. |
| U7 | Verification vs. score clarity | Low | 🟡 Badge (identity) and score (behaviour) are visually distinct; will user-test labels during Pilot. |

**Verdict:** PASS. The lookup experience surfaces trust clearly and works for the
target low-bandwidth audience.

---

## 2. Product Audit

| # | Question | Finding |
|---|---|---|
| P1 | Can a creditor find a business and judge it pre-credit? | ✅ Search → result with band/score/verification → profile with score + reasons. The MVP loop is complete and demonstrable. |
| P2 | Is the trust signal accurate to the engine? | ✅ Discovery reads the same versioned snapshots as Stage 5; **verified** ordering (486 > 419 > 128) and profile factors match. |
| P3 | Does verification add a distinct trust signal? | ✅ Badge reflects identity assurance separately from behavioural score (F1/F2 vs. trade history). |
| P4 | Is performance acceptable for lookup? | ✅ Search enriches with the latest score in ONE query (`LEFT JOIN LATERAL`), no N+1; indexed. |
| P5 | Are no-history businesses represented honestly? | ✅ Surface as NEW/0 rather than a misleading number. |
| P6 | Is the surface safe? | ✅ Read-only public endpoints; sort whitelisted (no SQL from input); all filters parameterized; unit-tested. |

**Verdict:** PASS. Business Discovery makes the core hypothesis tangible and
testable end-to-end (API + web).

---

## Summary

Both mandated audits **PASS**. Discovery surfaces trust as the headline, is public
and low-bandwidth friendly, reads accurately from the reputation engine, and is
efficient and injection-safe. Verified live across both the API and the rendered
web pages.
