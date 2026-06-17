# Stage 6 — Business Discovery: Design Note (pre-build)

> Produced before code. Defines the discovery API enrichment and the web UI that
> turns the trust data built in Stages 1–5 into a usable **lookup system**.

## Goal

A prospective supplier/creditor can find a business and see, at a glance, whether
to trust it — the MVP hypothesis made tangible. Discovery must surface **trust
(score + band)** and **verification** together with identity, with no login.

## What already exists (reused, not rebuilt)

- Public business search + profile-by-slug (Stage 2).
- Public score / history / explanation (Stage 5).

Stage 6 **enriches and composes** these into a discovery experience, plus the web
UI. It does not change the trust model.

## API: enriched discovery

A new read-only `DiscoveryModule` (public) that joins businesses to their **latest
score snapshot** efficiently (one query, `LEFT JOIN LATERAL`), avoiding N+1:

- `GET /discovery` — search + filter + sort:
  - filters: `query` (name), `marketClusterId`, `assuranceLevel`, `band`, `minScore`
  - sort: `score` (default, desc, nulls last) or `name`
  - returns: id, name, slug, marketName, **score, band**, **verification badge**,
    paginated `{items,total,page,pageSize}`.
- `GET /discovery/:slug` — full **trust profile**: identity + market + verification
  + score + band + the explanation factors (composed via `ReputationService`).

A business with no snapshot yet reads as `NEW` / 0 (consistent with Stage 5).

## Verification badges

Derived from `assurance_level` (pure mapping, unit-tested):
`FULLY_VERIFIED` / `DOCUMENT_VERIFIED` / `PHONE_VERIFIED` → verified badge with a
label; `UNVERIFIED` → not verified. The badge is presentation over the assurance
provenance — never a trust score itself.

## Web UI (Next.js 15, server components)

- `/discover` — search box + filters (band, verification, market) + results list;
  each row shows name, market, **TrustBadge** (band), and **VerificationBadge**.
- `/business/[slug]` — trust profile page: header with verification badge, big
  score + band, the factor breakdown ("why this score"), market and contact.
- Components: `TrustBadge` (band → label/colour), `VerificationBadge`,
  `ScoreMeter`. Server-side fetch via `INTERNAL_API_URL`; resilient to API
  downtime (graceful empty states).

## UX principles

- Trust is the headline, not an afterthought — band + score are the most prominent
  element on every result and profile.
- Explainability carries through: the profile shows *why* (factors), matching the
  "trust must be explainable" principle.
- Low-bandwidth friendly: server-rendered, minimal JS, no client data fetching on
  first paint (full PWA/offline work is Stage 11).

## Out of scope (named stages)

PWA/offline/low-bandwidth mode (Stage 11), notifications (Stage 10), richer
relationship/graph views, paid "verified" placement (Stage 13).
