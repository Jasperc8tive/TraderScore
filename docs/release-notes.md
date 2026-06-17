# TradeScore — Release Notes

## v1.0.0 — Pilot Release (Computer Village)

The first complete TradeScore platform: reputation infrastructure that turns
counterparty-confirmed trades into portable, explainable trust for African
commerce. Built and verified across 13 stages plus a production-readiness review.

### Highlights

- **Identity** — phone-first OTP login, businesses, OWNER/STAFF membership, markets,
  moderator-gated verification.
- **Trades** — log trades with an append-only, attributable lifecycle and integer-
  precise money.
- **Counterparty confirmation** — trust is created only when the *counterparty*
  attests (never the initiator, never an admin).
- **Reputation v1** — explainable 0–1000 score from confirmed trades, stored as
  versioned, recomputable, append-only snapshots (no mutable score column).
- **Discovery** — public, trust-first search and business profiles with the "why".
- **Disputes** — evidence-backed, admin-adjudicated; freezes trust, never auto-penalizes.
- **Admin operations** — moderation with real teeth, dashboards, dispute queue.
- **Fraud engine** — Sybil, circular-trading, wash, velocity, dispute-rate, and
  relationship-risk detection as opinions that never corrupt trust data.
- **Notifications** — event-driven SMS/WhatsApp/Email/in-app, persist-first delivery.
- **Mobile PWA** — installable, offline-tolerant, low-bandwidth mode.
- **Pilot tooling** — Computer Village seed, adoption analytics, referral growth loop.
- **Commercial** — FREE/PRO/ELITE plans, server-authoritative billing, paid Verified
  Seller badge, feature flags, MRR reporting.

### Quality

- 102 automated tests; lint/typecheck/build all green; end-to-end verified against
  live Postgres + Redis at every stage; representative DB benchmark (~10k businesses
  / ~100k trades) with indexed sub-millisecond hot paths.

### Known limitations (deferred to go-live, behind existing abstractions)

- Real PSP and SMS/WhatsApp/Email provider integrations + webhooks.
- AWS infrastructure provisioning (Terraform/ECS/RDS/…); durable event transport.
- `pg_trgm` search index and a scheduled fraud scan for large scale.
- Refunds/proration/tax; persisted `activity_logs`; global HTTP rate limiting.
- Full-scale (100k/10M) load test on staging; device-level offline QA in the pilot.

### Upgrade / install

Greenfield. See [deployment.md](./deployment.md): `pnpm install` → `docker compose up`
→ `pnpm db:migrate` → `pnpm db:seed:pilot`.
