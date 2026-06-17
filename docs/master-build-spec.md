# TradeScore — Master Build Specification

> **This is the single source of truth for the project.** It is a living document.
> It must be updated at the end of every completed stage. Architectural decisions,
> audits, and roadmap changes are recorded here or in linked ADRs.

- **Document owner:** Engineering (acting CEO/CPO/Principal Architect)
- **Current stage:** Stage 1 — Foundation & Architecture
- **Deploy strategy:** Local-first (Docker Compose), cloud-ready, AWS as future target
- **Related docs:** [Trust Architecture Review](./trust-architecture-review.md), [ADRs](./adr/), [Infrastructure Plan](../infrastructure/README.md)

---

## 1. Product Vision

> Become **the Trust Layer for African Commerce.**

TradeScore is reputation infrastructure: a network that converts informal,
unstructured trust signals (referrals, "I know that guy", WhatsApp vouching) into
**structured, portable, verifiable reputation** that businesses can use before
extending credit or entering a commercial relationship.

## 2. Core Insight

Nigeria — and African commerce broadly — **runs on trust**, but trust has **no
infrastructure**. Today creditworthiness and reliability are assessed through
phone calls, personal relationships, and informal networks that do not scale, do
not travel, and cannot be queried. TradeScore makes trust a queryable asset.

## 3. Problem Statement

A supplier deciding whether to extend ₦2,000,000 of goods on credit to a new
buyer has **no reliable, portable record** of that buyer's payment history with
*other* suppliers. The information exists — it is just trapped in disconnected
human memory. This causes:

- Credit withheld from trustworthy businesses (lost commerce).
- Credit extended to unreliable ones (bad debt).
- New/relocated businesses unable to prove a clean history they actually have.

## 4. User Personas

| Persona | Who | Primary need |
|---|---|---|
| **Informal trader** | Computer Village stall owner, smartphone-first, low bandwidth | Prove reliability to unlock supplier credit |
| **SME owner** | Small distributor with a few staff | Assess new buyers/suppliers before committing |
| **Wholesaler / supplier** | Extends credit regularly | Reduce bad debt; check counterparty before fronting goods |
| **Business staff** | Employee logging trades on behalf of owner | Operate within limited authority |
| **Admin / Moderator** | TradeScore operations | Resolve disputes, investigate fraud, keep the graph clean |

## 5. MVP Scope (the hypothesis we are proving)

> **Businesses will use verified transaction history and reputation scores before
> extending credit or entering commercial relationships.**

Everything in the roadmap exists to test this. In scope for the MVP arc:
identity + verification, trade logging, **counterparty confirmation** (the core
trust-creating act), a v1 reputation score with explanations, and business
discovery.

## 6. Non-Goals (explicitly out of scope)

TradeScore is **not**: accounting software, bookkeeping, an ERP, an invoicing
tool, a payments processor, or a lender. We record that trades happened and
whether they went well — not the businesses' internal finances. We surface
reputation; we do not (in the MVP) ourselves extend credit.

## 7. Architecture Decisions (summary; see `/docs/adr`)

- **Monorepo (pnpm + Turborepo)** for shared types and atomic cross-cutting
  changes between `web` and `api`. → [ADR-0001](./adr/0001-monorepo.md)
- **PostgreSQL only.** No MongoDB, no Firebase. Trust data is relational, needs
  strong integrity and ad-hoc graph/aggregate queries. → [ADR-0002](./adr/0002-postgresql.md)
- **Event-driven core.** Domain events decouple identity → fraud → scoring so
  fraud and scoring become additive later. → [ADR-0003](./adr/0003-event-architecture.md)
- **OTP + JWT + revocable server-side sessions**, role-based access. → [ADR-0004](./adr/0004-authentication.md)
- **Clean Architecture / DDD layering:** domain logic in packages, framework glue
  in apps. Dependencies point inward.
- **Derived-vs-source separation** (see Trust Architecture Review §2): scores are
  recomputable projections, never source-of-truth columns.

## 8. Security Decisions

- OTP codes are **hashed** at rest, single-use, short TTL, rate-limited per
  identifier and per IP.
- Access tokens are short-lived JWTs; refresh is via **server-side sessions** that
  can be revoked (logout-everywhere, takeover response).
- Passwords (where applicable) hashed with Argon2/bcrypt; OTP is the primary
  factor for the trader audience.
- Least privilege via four roles: `ADMIN`, `MODERATOR`, `BUSINESS_OWNER`,
  `BUSINESS_STAFF`.
- **Audit logging** of every privileged and auth-relevant action.
- Secrets only via environment/secret manager; never committed. `.env.example`
  documents required vars; real `.env` is git-ignored.
- Input validation at the boundary (DTO validation); parameterized SQL only.
- OWASP Top 10 reviewed each stage.

## 9. Fraud Prevention Principles (see Trust Architecture Review §3)

1. Fraud prevention is a **first-class system**, not a bolt-on.
2. **A trade is worth nothing until counterparty-confirmed.**
3. Capture every input a future detector needs **now** (attribution,
   fingerprints, counterparty linkage, immutable status history) so Stage 9 needs
   no migration.
4. Reputation weights **distinct, diverse, verified** counterparties; concentrated
   or circular activity is detectable and penalizable.
5. Flags are opinions about data; they never mutate the underlying events.

## 10. Domain Model

Bounded contexts (see roadmap for which stage builds each):

- **Identity:** users, businesses, business_members, market_clusters, verification_events
- **Trade Network:** trades, trade_confirmations, trade_payments, trade_disputes, business_relationships
- **Reputation:** score_snapshots, score_factors (derived, versioned)
- **Fraud:** fraud_flags (opinions over events)
- **Discovery:** read models over the above
- **Administration:** moderation, disputes, operations, activity_logs

**Stage 1 builds only the Identity foundation tables** (`users`, `businesses`,
`market_clusters`) plus the cross-cutting plumbing. Later tables are designed in
the Trust Architecture Review but **not** migrated yet.

## 11. Database Design (Stage 1 tables)

All tables: UUID PKs (`gen_random_uuid()`), `created_at`/`updated_at` (timestamptz),
soft-delete via `deleted_at` where appropriate, attribution columns, and indexes
on every foreign key and common filter.

- **`users`** — a human. Phone-first identity. `phone` unique, `role`, `status`.
- **`businesses`** — a commercial entity. `assurance_level` (provenance of trust),
  `status`, `market_cluster_id`, `created_by`. **No score column** (see TAR §4.1).
- **`market_clusters`** — physical/logical markets (e.g. "Computer Village,
  Ikeja"). Used for discovery and localized fraud analysis.

Migrations are forward-only SQL files with a tracked `schema_migrations` ledger.
Full DDL lives in `packages/database/migrations`.

## 12. Event Architecture

- A transport-agnostic **EventBus** interface (in-memory implementation for
  local; Redis/SNS-SQS swappable later — cloud-ready per local-first mandate).
- Events are typed, versioned, and carry a stable `name`, `id`, `occurredAt`, and
  a typed `payload`.
- Stage 1 events: `UserCreated`, `BusinessCreated`, `BusinessVerified`.
- Publishers never know their subscribers. Subscribers are idempotent.

## 13. API Standards

- **NestJS** (Clean Architecture: controllers → application services → domain).
- REST, JSON, versioned under `/api/v1`.
- DTO validation (`class-validator`) at every boundary.
- Consistent envelope: `{ data }` on success, `{ error: { code, message, details } }`
  on failure. Stable machine-readable `code`s.
- Every request carries a correlation/request id; it appears in all logs.
- Health (`/api/v1/health`) and readiness probes.

## 14. Coding Standards

- TypeScript **strict** everywhere; no implicit `any`; no unchecked `null`.
- SOLID, Clean Architecture, DDD, Event-Driven Design.
- ESLint + Prettier enforced in CI; the build fails on lint/type errors.
- Domain logic is framework-agnostic and unit-tested (Vitest/Jest); HTTP and DB
  edges covered by integration tests (Supertest); web E2E by Playwright (later).
- Conventional commits; small, reviewable changes.

## 15. Deployment Standards

- **Local-first:** `pnpm install` then `docker compose up` brings up web + api +
  postgres + redis. One command, full environment, hot reload.
- **Cloud-ready, not cloud-coupled:** all config via env vars; storage, cache,
  and DB accessed through abstractions so AWS (RDS/ElastiCache/S3) drops in with
  no application refactor. AWS infra is a **future stage** (see
  `infrastructure/README.md`). No Terraform in Stage 1.
- **CI** validates quality only (lint, typecheck, test, build). No deploy in
  Stage 1.

---

## 16. Development Roadmap (stage gates)

Each stage: **Build → Test → Audit → Fix → Re-test → Re-audit → Report → WAIT for approval.**
Never skip or jump ahead.

| Stage | Name | Status |
|---|---|---|
| 1 | Foundation & Architecture | ✅ Complete (approved) |
| 2 | Identity System | ✅ Complete (approved) |
| 3 | Trade Logging Engine | ✅ Complete (approved) |
| 4 | Counterparty Confirmation | ✅ Complete (approved) |
| 5 | Reputation Engine v1 | ✅ Complete (approved) |
| 6 | Business Discovery | ✅ Complete (approved) |
| 7 | Dispute System | ✅ Complete (approved) |
| 8 | Admin Operations Platform | ✅ Complete (approved) |
| 9 | Fraud Engine v1 | ✅ Complete (approved) |
| 10 | Notification System | ✅ Complete (approved) |
| 11 | Mobile Optimization (PWA) | ✅ Complete (approved) |
| 12 | Pilot Market Release (Computer Village) | ✅ Complete (approved) |
| 13 | Commercial Hardening | ✅ Complete (approved) |
| Final | Production Readiness Review | ✅ Complete (pilot-ready) |

---

## 17. Stage Log

### Stage 1 — Foundation & Architecture (✅ complete, awaiting approval)

- Trust Architecture Review completed (pre-build gate satisfied).
- This spec authored.
- Monorepo (pnpm + Turborepo), 7 packages, 2 apps, Docker Compose, CI, 4 ADRs,
  and the future-AWS infrastructure plan delivered.
- DB foundation + migrations (`users`, `businesses`, `market_clusters`) + seed.
- Auth (JWT/OTP/sessions/RBAC), event bus, structured+audit logging, validated config.
- **Verified end-to-end:** install, typecheck, 27 tests, lint, build all pass;
  migrations + seed run against live Postgres (idempotent); API boots and serves
  health + DB readiness + standard envelopes.
- See [Stage 1 Report](./stage-reports/stage-01-report.md) and
  [Stage 1 Audits](./stage-reports/stage-01-audits.md).
- **Stage 1 approved.**

### Stage 2 — Identity System (✅ complete, approved)

- OTP auth (request/verify) with hashed codes, attempt limits, per-phone cooldown.
- Revocable Redis sessions with refresh-token rotation; short-lived access JWTs.
- Two-layer authorization: RBAC guard + service-level resource ownership.
- Businesses (create/profile/update/verify), business membership (OWNER/STAFF),
  market clusters (public + admin create), and public paginated business search.
- New migration `0005_business_members`; `business.verified` trust elevation is
  moderator/admin-gated and event-emitting.
- **Verified end-to-end** against live Postgres + Redis: full OTP→session→business
  →membership→verify→search flow, RBAC/ownership denials, refresh rotation, and
  token revocation. 34 tests, lint, typecheck, build all pass.
- See [Stage 2 Design](./stage-reports/stage-02-design.md),
  [Stage 2 Report](./stage-reports/stage-02-report.md), and
  [Stage 2 Audits](./stage-reports/stage-02-audits.md).
- **Stage 2 approved.**

### Stage 3 — Trade Logging Engine (✅ complete, awaiting approval)

- Trade lifecycle: create (DRAFT) → edit → submit (PENDING_CONFIRMATION) → cancel,
  with an explicit, unit-tested status state machine.
- Append-only `trade_events` log written transactionally with every trade change
  (state and provenance can never diverge); integer-precise money (`BIGINT` minor units).
- Fraud controls: self-/circular-trade blocked (DB CHECK + service), amount > 0,
  no future dates, full attribution; trust withheld until confirmation (Stage 4).
- New migration `0006_trades`; events `trade.logged` / `trade.submitted` / `trade.cancelled`.
- **Verified end-to-end** against live Postgres + Redis: create→edit→submit, history
  (CREATED,EDITED,SUBMITTED), cancel + re-cancel CONFLICT, non-member 403, self-trade
  and counterparty-less submit rejected. Build/typecheck/lint/tests all pass.
- See [Stage 3 Design](./stage-reports/stage-03-design.md),
  [Stage 3 Report](./stage-reports/stage-03-report.md), and
  [Stage 3 Audits](./stage-reports/stage-03-audits.md).
- **Stage 3 approved.**

### Stage 4 — Counterparty Confirmation System (✅ complete, awaiting approval)

- The trust-creation stage: a submitted trade becomes `CONFIRMED` only when the
  **counterparty** independently attests to it (also `REJECTED` / `DISPUTED`).
- Integrity rule enforced in code: the initiator can never confirm its own trade
  (even as a member of both businesses); **no ADMIN bypass**.
- Decision + status change + append-only event written in one transaction; one
  decision per trade (`uq_trade_confirmations_trade`); counterparty inbox of
  incoming trades; trade read broadened to both parties.
- New migration `0007_trade_confirmations`; events `trade.confirmed` /
  `trade.rejected` / `trade.disputed` (feed Stage 5 scoring and Stage 9 fraud).
- **Verified end-to-end:** inbox, initiator self-confirm → FORBIDDEN, confirm/
  reject/dispute, double-confirm → CONFLICT, dispute-without-reason → 400,
  counterparty read access, history CREATED,SUBMITTED,CONFIRMED. 27 API tests,
  build/typecheck/lint all pass.
- See [Stage 4 Design](./stage-reports/stage-04-design.md),
  [Stage 4 Report](./stage-reports/stage-04-report.md), and
  [Stage 4 Audits](./stage-reports/stage-04-audits.md).
- **Stage 4 approved.**

### Stage 5 — Reputation Engine v1 (✅ complete, awaiting approval)

- Trust score (0–1000) computed by a pure, deterministic, versioned algorithm
  (v1.0.0) from CONFIRMED trades + identity; explainable structured factors.
- Factors: confirmed-trade volume (diminishing), counterparty diversity (anti-wash),
  confirmation reliability, identity assurance, dispute penalty. Bands NEW →
  BUILDING → ESTABLISHED → TRUSTED → HIGHLY_TRUSTED (NEW = no track record).
- **No mutable score column** — append-only `score_snapshots` + `score_factors`
  with `algorithm_version` + `inputs_hash`; fully recomputable, churn-free
  (idempotent on unchanged inputs), evolvable with no schema change (TAR §4).
- Reputation engine is a projection: auto-recomputes both businesses on
  `trade.confirmed` / `rejected` / `disputed`; public score/history/explanation
  reads; admin-only manual recompute.
- New migration `0008_score_snapshots`.
- **Verified end-to-end:** public score 459 (ESTABLISHED) with correct factors,
  auto-recompute 459→384 on a rejection, 5 append-only snapshots, inputs-hash
  idempotency, NEW for a no-history business, owner-recompute 403 / admin OK.
  35 API tests (incl. 8 scoring-engine), build/typecheck/lint all pass.
- See [Stage 5 Design](./stage-reports/stage-05-design.md),
  [Stage 5 Report](./stage-reports/stage-05-report.md), and
  [Stage 5 Audits](./stage-reports/stage-05-audits.md).
- **Stage 5 approved.**

### Stage 6 — Business Discovery (✅ complete, awaiting approval)

- Public **lookup system** (API + web): search, filtering (name, market, band,
  minScore, assurance) + sort, trust profile pages, verification badges.
- Discovery API enriches businesses with their latest trust score in ONE query
  (`LEFT JOIN LATERAL`, no N+1); sort whitelisted + filters parameterized.
- Web (Next.js server components): `/discover` results list and `/business/[slug]`
  trust profile with score meter + factor breakdown; `TrustBadge` + verification
  pill; graceful empty/error/404 states; low-JS, bookmarkable filters.
- No new migration (reuses existing tables); `ReputationService` exported for
  profile composition.
- **Verified end-to-end:** discovery sort 486>419>128, band/minScore filters,
  public profile (factors), 404 on unknown slug; web `/discover` and
  `/business/[slug]` render with live trust data (HTTP 200, score 486). 38 API
  tests, build/typecheck/lint all pass.
- See [Stage 6 Design](./stage-reports/stage-06-design.md),
  [Stage 6 Report](./stage-reports/stage-06-report.md), and
  [Stage 6 Audits](./stage-reports/stage-06-audits.md).
- **Stage 6 approved.**

### Stage 7 — Dispute System (✅ complete, awaiting approval)

- Trust protection layer: a party can formally **dispute** a CONFIRMED/DISPUTED
  trade, submit **evidence**, and a moderator/admin **adjudicates** (UPHELD →
  trade REJECTED; DISMISSED → CONFIRMED); raiser can **withdraw** (restores prior).
- Raising **freezes** trust immediately; outcomes flow atomically into trade
  status and (via trade events) recompute the reputation score. Never auto-penalizes
  (anti-extortion, F6); confirmation stays counterparty-only (admins can't self-confirm).
- New migration `0009_disputes` (+ append-only `dispute_evidence`, one active
  dispute per trade); `DISPUTE_RESOLVE` permission (ADMIN+MODERATOR); trade state
  machine extended; `dispute.opened`/`dispute.resolved` events.
- **Verified end-to-end:** raise→DISPUTED (score frozen 345→0), evidence from both
  parties, non-party raise 403, party resolve 403, admin UPHELD→REJECTED (score
  195), resolve-already-resolved CONFLICT, withdraw restores CONFIRMED. 49 API
  tests, build/typecheck/lint all pass.
- See [Stage 7 Design](./stage-reports/stage-07-design.md),
  [Stage 7 Report](./stage-reports/stage-07-report.md), and
  [Stage 7 Audits](./stage-reports/stage-07-audits.md).
- **Stage 7 approved.**

### Stage 8 — Admin Operations Platform (✅ complete, awaiting approval)

- Internal operations API (`/admin`, least-privilege): moderation (suspend/
  reactivate businesses and users), business review, fraud dashboard (heuristic
  risk and Sybil signals, dispute queue), market management (list/update), score
  monitoring (band distribution + recent snapshots).
- Moderation security effects: suspending a user **revokes sessions** and blocks
  OTP re-login; suspending a business **excludes it from discovery**; both
  reversible and audited. No new domain tables (statuses already existed).
- New `BUSINESS_MODERATE` permission; repo additions (business setStatus, market
  update, disputes-by-status).
- **Verified end-to-end:** owner→/admin 403, fraud/scores/business dashboards,
  suspend business → discovery 1→0→1, suspend user → login 401 then ACTIVE after
  reactivate, dispute queue + market list. 53 API tests, build/typecheck/lint pass.
- See [Stage 8 Design](./stage-reports/stage-08-design.md),
  [Stage 8 Report](./stage-reports/stage-08-report.md), and
  [Stage 8 Audits](./stage-reports/stage-08-audits.md).
- **Stage 8 approved.**

### Stage 9 — Fraud Engine v1 (✅ complete, awaiting approval)

- Automated fraud detection across four vectors: Sybil (one creator → many
  businesses), circular trading (2-/3-cycles over confirmed-trade edges),
  suspicious transactions (wash / velocity / high dispute rate), and relationship
  risk (mutual volume + disputes). Pure, unit-tested detectors.
- **Flags are opinions (TAR §2):** the engine only writes `fraud_flags`; it never
  mutates trades, confirmations, or scores. Runs scoped + isolated on
  `trade.confirmed`, plus an admin full scan; idempotent and respects operator
  review (won't re-flag confirmed/recently-dismissed).
- New migration `0010_fraud_flags`; `FRAUD_MANAGE` permission (ADMIN+MODERATOR);
  admin endpoints (flags / review / scan).
- **Verified end-to-end:** event-driven circular auto-flag on 2nd confirmation,
  full scan (5 flags), sybil/circular/relationship flags, review→CONFIRMED→re-review
  CONFLICT, owner 403, scan idempotency (open 5→5; confirm+rescan does not reopen).
  63 API tests (incl. 10 detector cases), build/typecheck/lint all pass.
- See [Stage 9 Design](./stage-reports/stage-09-design.md),
  [Stage 9 Report](./stage-reports/stage-09-report.md), and
  [Stage 9 Audits](./stage-reports/stage-09-audits.md).
- **Stage 9 approved.**

### Stage 10 — Notification System (✅ complete, awaiting approval)

- Communication infrastructure: event-driven notifications over SMS / WhatsApp /
  Email / in-app, with a per-user inbox. Pure consumer of domain events (producers
  stay decoupled).
- Notifies the right owners at the right moment: trade awaiting confirmation,
  confirmed/rejected/disputed, dispute opened/resolved, business verified.
- **Persist-then-dispatch** with bounded retries and isolated handlers (delivery
  failure never affects core flows); every notification is a durable, observable
  record. Channel abstraction — dev log provider now; Twilio/WhatsApp/SES adapters
  config-gated later.
- New migration `0011_notifications`; `NotificationChannel`/`NotificationStatus`
  enums; `GET /notifications` inbox.
- **Verified end-to-end:** submit→counterparty notified, confirm→initiator notified,
  dispute→both parties, resolve→both parties; inbox 5/5 SENT, channel=SMS,
  address=phone. 66 API tests, build/typecheck/lint all pass.
- See [Stage 10 Design](./stage-reports/stage-10-design.md),
  [Stage 10 Report](./stage-reports/stage-10-report.md), and
  [Stage 10 Audits](./stage-reports/stage-10-audits.md).
- **Stage 10 approved.**

### Stage 11 — Mobile Optimization (PWA) (✅ complete, awaiting approval)

- Mobile-first PWA: web manifest + maskable icon + theme-color/viewport
  (installable); hand-rolled versioned service worker (app-shell precache,
  network-first navigations → `/offline` fallback, SWR for static, and
  network-first-with-cache for discovery reads); offline fallback page.
- **Server-side low-bandwidth mode** (`lowbw` cookie): fewer rows (pageSize 6 vs
  20) and dropped secondary detail — real bytes saved on the server, user-toggleable.
- Web-only stage (no API/DB changes).
- **Verified against the running app:** manifest/sw.js/icon/offline all 200; sw has
  cache + offline-fallback logic; head has manifest link + theme-color + SW
  registration; low-bandwidth cookie flips `aria-pressed` and cuts payload
  (secondary-info blocks 80 → 2). build/typecheck/lint/tests all pass.
- See [Stage 11 Design](./stage-reports/stage-11-design.md),
  [Stage 11 Report](./stage-reports/stage-11-report.md), and
  [Stage 11 Audits](./stage-reports/stage-11-audits.md).
- **Stage 11 approved.**

### Stage 12 — Pilot Market Release (Computer Village) (✅ complete, awaiting approval)

- Pilot-ready: a one-command Computer Village environment (`pnpm db:seed:pilot`),
  a metrics dashboard that measures the actual hypothesis, and a referral growth loop.
- Referrals/growth: every business has a unique referral code; new businesses can
  sign up with a referrer's code (recorded atomically, one-referrer-per-business,
  no self-referral); owner-only referral stats. New migration `0012_referrals`.
- Analytics: admin `/admin/analytics/pilot` (businesses, Computer Village count,
  active, confirmation rate, score/band coverage, disputes, referral leaderboard),
  plus a public `/pilot/stats` summary.
- **Verified end-to-end:** dashboard (29 businesses, 6 CV, 19 active, confirmation
  rate 0.83, 3 referrals + leaderboard), public summary, referral loop (code →
  referred → totalReferred=1), invalid code VALIDATION_ERROR, non-owner 403.
  66 API tests, build/typecheck/lint all pass.
- See [Stage 12 Design](./stage-reports/stage-12-design.md),
  [Stage 12 Report](./stage-reports/stage-12-report.md), and
  [Stage 12 Audits](./stage-reports/stage-12-audits.md).
- **Stage 12 approved.**

### Stage 13 — Commercial Hardening (✅ complete, awaiting approval)

- Revenue infrastructure: code-defined plans (FREE/PRO/ELITE) with
  server-authoritative pricing + entitlements; subscriptions + invoices
  (persist-then-charge via a provider abstraction, no card data stored); paid
  "Verified Seller" badge surfaced in discovery; feature flags (code defaults +
  `FEATURE_<KEY>` env overrides); telemetry recorder + revenue/MRR KPIs.
- Money buys features, never trust: paid plans grant a commercial badge and
  entitlements only — the behavioural score and counterparty-only confirmation are
  untouched (TAR §2).
- New migration `0013_billing`; `PlanId`/`SubscriptionStatus`/`InvoiceStatus` enums.
- **Verified end-to-end:** public plans, subscribe PRO → ACTIVE + PAID invoice
  (server-priced 500000), verified badge FREE→ELITE→cancel in discovery profile +
  list, admin revenue MRR 500000, non-owner 403, feature-flags endpoint. 75 API
  tests, build/typecheck/lint all pass.
- See [Stage 13 Design](./stage-reports/stage-13-design.md),
  [Stage 13 Report](./stage-reports/stage-13-report.md), and
  [Stage 13 Audits](./stage-reports/stage-13-audits.md).
- **Stage 13 approved.**

### Final — Production Readiness Review (✅ complete, pilot-ready)

- Fresh full verification: build 9/9, **102 tests**, typecheck 16/16, lint 0/0.
- Representative load/DB benchmark (~10k businesses / ~100k confirmed trades):
  indexed hot paths sub-millisecond; linear scans (ILIKE search, full fraud scan)
  flagged for `pg_trgm` + scheduled job at large scale.
  Script: `infrastructure/benchmark/benchmark.sql`.
- Full audit battery PASS for built scope: OWASP Top 10, fraud, accessibility
  (WCAG AA baseline), infrastructure, disaster recovery (recomputable by design),
  compliance posture, documentation review.
- Documentation deliverables generated: [architecture](./architecture.md),
  [database](./database.md), [api](./api.md), [security](./security.md),
  [fraud](./fraud.md), [admin](./admin.md), [deployment](./deployment.md),
  [QA report](./qa-report.md), [launch checklist](./launch-checklist.md),
  [release notes](./release-notes.md).
- See [Final Production Readiness Review](./stage-reports/final-production-readiness-review.md).
- **TradeScore is PILOT-READY.** Remaining items are operational go-live tasks
  (AWS provisioning, real provider integrations, full-scale load test, DR runbook,
  legal/compliance) — all enumerated and behind existing abstractions.

---

## 🎉 Build complete

All 13 stages and the Production Readiness Review are done, each built → tested →
audited → verified end-to-end against live infrastructure → reported → approved.
TradeScore delivers its founding promise: **a trade becomes trust only when the
counterparty attests to it; that trust is explainable and recomputable; and no
amount of money or privilege can fabricate it.**

---

## 18. Project Structure

```text
tradescore/
  apps/
    web/                 # Next.js 15 (React 19, TS, Tailwind, shadcn/ui)
    api/                 # NestJS (Clean Architecture)
  packages/
    config/              # env loading + validation + secrets abstraction
    logging/             # structured / request / audit / error logging
    shared/              # cross-cutting types, errors, Result, constants
    events/              # EventBus + domain event definitions
    database/            # connection pool, migration runner, seeds, migrations
    auth/                # JWT, OTP, sessions, roles
    core/                # shared domain primitives
  infrastructure/        # future AWS plan (README only in Stage 1)
  docs/                  # spec, ADRs, trust review, stage reports
  .github/workflows/     # CI (lint, typecheck, test, build)
```
