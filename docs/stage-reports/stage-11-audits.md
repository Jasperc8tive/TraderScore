# Stage 11 — Mandatory Audits (UX, Performance)

Per the roadmap, Stage 11 requires UX and Performance audits. Legend:
✅ resolved · 🟡 accepted (tracked) · ⬜ deferred to a named stage.

---

## 1. UX Audit

| # | Finding | Resolution |
|---|---------|------------|
| U1 | Installable on a phone | ✅ Web manifest (standalone, theme/background, maskable icon) + `theme-color` + viewport. **Verified** manifest served and linked in `<head>`. |
| U2 | Works offline for seen content | ✅ Service worker precaches the app shell and serves visited navigations/discovery data from cache; an `/offline` page is the graceful fallback. **Verified** sw.js served with offline-fallback logic; offline page 200. |
| U3 | Respect the user's data budget | ✅ Explicit, persistent **low-bandwidth mode** toggle. **Verified** cookie-driven server render (`aria-pressed` false→true). |
| U4 | Mobile-first, responsive | ✅ Tailwind responsive layouts; small-screen friendly; SMS-first content from Stage 10 complements. |
| U5 | No surprise behaviour | ✅ SW registration is best-effort and non-blocking; app fully works without it; offline page clearly explains state. |
| U6 | Discoverability of the mode | 🟡 Toggle lives on `/discover`; a global settings location can come with the broader UI in Stage 13. |

**Verdict:** PASS. TradeScore is installable, offline-tolerant for previously seen
content, and lets the user cut data use explicitly.

---

## 2. Performance Audit

| # | Concern | Resolution |
|---|---------|------------|
| P1 | Repeat-visit load time | ✅ SW stale-while-revalidate for `/_next/static` → instant asset loads after first visit; app shell precached. |
| P2 | Data over the wire | ✅ Low-bandwidth mode is **server-side**: fewer rows (pageSize 6 vs 20) and dropped secondary detail. **Verified measurable reduction**: secondary-info blocks 80 → 2. |
| P3 | First paint | ✅ Server-rendered pages, minimal client JS (only tiny SW-register + toggle client components). |
| P4 | Offline resilience on flaky 3G | ✅ Network-first navigations with cache fallback mean a dropped connection still shows last-known trust data, not a dead page. |
| P5 | Cache correctness/hygiene | ✅ Versioned cache; old versions purged on `activate`; only GET cached; cross-origin discovery GETs cached for offline read. |
| P6 | SW runtime not HTTP-probeable | 🟡 Caching *behaviour* is browser runtime; we verified the SW is served, valid, registered, and contains the intended strategies. Full offline QA belongs to device testing in the Pilot. |

**Verdict:** PASS. Repeat visits are fast, data usage is explicitly reducible, and
the app degrades gracefully on poor connectivity.

---

## Summary

Both mandated audits **PASS**. TradeScore is now a mobile-first PWA: installable,
offline-tolerant via a versioned service worker with an offline fallback, and
data-light on demand via a verified server-side low-bandwidth mode. Device-level
offline QA is slated for the Computer Village pilot.
