# TradeScore — Architecture Documentation

> The trust layer for African commerce. This document describes the system as
> built across Stages 1–13. See also: [Trust Architecture Review](./trust-architecture-review.md),
> [ADRs](./adr/), [Master Build Spec](./master-build-spec.md).

## 1. System overview

TradeScore converts informal trust signals into structured, portable reputation.
Businesses log trades; counterparties confirm them; confirmed trades feed a
versioned reputation score; anyone can look up a business's trust before extending
credit. Disputes, moderation, fraud detection, notifications, a mobile PWA, a
referral growth loop, and paid plans complete the platform.

## 2. Topology (local-first, cloud-ready)

```
            Browser / PWA
                 │
        ┌────────▼─────────┐         ┌──────────────┐
        │  web (Next.js 15)│──SSR──▶ │ api (NestJS) │
        └──────────────────┘         └──────┬───────┘
                                            │
                       ┌────────────────────┼───────────────────┐
                       ▼                    ▼                    ▼
                 ┌───────────┐        ┌───────────┐        ┌───────────┐
                 │ PostgreSQL│        │   Redis   │        │ EventBus  │
                 │ (source   │        │ (OTP/     │        │ (in-proc; │
                 │  of truth)│        │  sessions)│        │  swappable)│
                 └───────────┘        └───────────┘        └───────────┘
```

Everything runs locally via `docker compose up`. All external dependencies sit
behind abstractions (DB pool, Redis, EventBus, storage, billing/notification
providers, secrets) so AWS (RDS / ElastiCache / SNS-SQS / S3 / Secrets Manager)
drops in with no application refactor. See [infrastructure/README.md](../infrastructure/README.md).

## 3. Monorepo layout

```
apps/
  web/    Next.js 15 PWA (discovery, trust profiles, low-bandwidth mode)
  api/    NestJS API (all bounded contexts)
packages/
  shared/   types, errors, Result, enums (single source of truth)
  config/   env validation (zod) + secrets abstraction
  logging/  pino structured logging + request context + audit
  events/   EventBus interface + typed domain-event registry
  database/ pg pool, migration runner, seeds, SQL migrations
  auth/     JWT, OTP crypto, sessions, capability RBAC
  core/     domain primitives (phone, slug, money, clock)
```

Framework-agnostic packages contain domain/infra logic; NestJS lives only in
`apps/api` and is bound to packages via DI tokens (Clean Architecture).

## 4. Bounded contexts (apps/api modules)

| Context | Module | Responsibility |
|---|---|---|
| Identity | `identity`, `auth`, `businesses`, `members`, `market-clusters` | users, OTP auth, businesses, membership, markets |
| Trade Network | `trades`, `confirmations`, `disputes` | logging, counterparty confirmation, dispute resolution |
| Reputation | `reputation` | versioned, recomputable trust scores |
| Discovery | `discovery` | public trust-first search + profiles |
| Fraud | `fraud` | Sybil/circular/wash/relationship detection (flags) |
| Notifications | `notifications` | event-driven SMS/WhatsApp/Email/in-app |
| Administration | `admin`, `analytics` | moderation, dashboards, pilot KPIs |
| Commercial | `billing`, `feature-flags`, `telemetry` | plans, invoices, badges, flags |

## 5. The trust pipeline (one-directional)

```
Identity ─▶ Trade events ─▶ Confirmation ─▶ Reputation (projection)
                  │                              ▲
                  └────────▶ Fraud (opinions) ───┘ (recompute can down-weight, v2)
```

**No arrow points left.** Trades/confirmations are immutable, append-only,
attributable facts. Reputation is a recomputable projection (versioned snapshots +
factors). Fraud writes *opinions* (`fraud_flags`), never mutating facts or scores.
This is the core invariant from the [Trust Architecture Review](./trust-architecture-review.md).

## 6. Request pipeline (API)

1. `RequestContextMiddleware` assigns a correlation id (in all logs).
2. `JwtAuthGuard` (global) authenticates via access JWT + active server session,
   unless the route is `@Public`.
3. `PermissionsGuard` (global) enforces capability RBAC via `@RequirePermissions`.
4. Service layer enforces **resource ownership** (data-dependent authorization).
5. `ValidationPipe` rejects unknown/invalid DTOs at the boundary.
6. `ResponseEnvelopeInterceptor` wraps success as `{ data }`.
7. `AllExceptionsFilter` maps errors to `{ error: { code, message, details } }`.

## 7. Event-driven decoupling

Domain events (`user.created`, `business.*`, `trade.*`, `dispute.*`) are published
to an `EventBus`. Reputation, fraud, and notifications are **isolated, idempotent
subscribers** — a failure in one never breaks the trade flow, and producers never
know their consumers. The in-memory bus is swappable for Redis Streams / SNS-SQS.

## 8. Key cross-cutting decisions (ADRs)

- [ADR-0001](./adr/0001-monorepo.md) pnpm + Turborepo monorepo
- [ADR-0002](./adr/0002-postgresql.md) PostgreSQL only
- [ADR-0003](./adr/0003-event-architecture.md) event-driven core
- [ADR-0004](./adr/0004-authentication.md) OTP + short JWT + revocable sessions

## 9. Technology

Next.js 15 / React 19 / Tailwind (web) · NestJS 10 (api) · PostgreSQL 16 · Redis 7
· TypeScript strict (`node16` modules) · pnpm + Turborepo · Vitest · Docker Compose
· pino · zod · class-validator · jsonwebtoken · ioredis · pg.
