# TradeScore

> The trust layer for African commerce — reputation infrastructure that turns
> informal trust signals into structured, portable, verifiable reputation.

This repository is a **pnpm + Turborepo monorepo**. It is **local-first**: one
command brings up the full stack (web, api, postgres, redis) via Docker Compose,
and the codebase is structured to deploy to AWS later without refactoring.

## Quick start

```bash
# 1. Install dependencies
pnpm install

# 2. Create your local env file
cp .env.example .env

# 3. Bring up the full stack (web + api + postgres + redis)
docker compose up

# 4. (first run, in another terminal) apply database migrations + seed
pnpm db:migrate
pnpm db:seed
```

Then:

- Web: <http://localhost:3000>
- API health: <http://localhost:4000/api/v1/health>

## Without Docker (individual services)

```bash
pnpm install
pnpm dev          # runs all apps in dev (needs local postgres + redis)
```

## Repository layout

```text
apps/
  web/          Next.js 15 (React 19, TS, Tailwind, shadcn/ui)
  api/          NestJS API (Clean Architecture)
packages/
  config/       env loading, validation, secrets abstraction
  logging/      structured / request / audit / error logging
  shared/       cross-cutting types, errors, Result, constants
  events/       EventBus + domain events
  database/     connection pool, migration runner, seeds, SQL migrations
  auth/         JWT, OTP, sessions, role framework
  core/         shared domain primitives
infrastructure/ future AWS architecture plan (no Terraform in Stage 1)
docs/           master build spec, ADRs, trust review, stage reports
```

## Common scripts

| Command | Description |
|---|---|
| `pnpm dev` | Run all apps in watch mode |
| `pnpm build` | Build all packages and apps |
| `pnpm lint` | ESLint across the monorepo |
| `pnpm typecheck` | TypeScript project-wide typecheck |
| `pnpm test` | Run all tests |
| `pnpm format` | Prettier write |
| `pnpm db:migrate` | Apply pending database migrations |
| `pnpm db:seed` | Seed local development data |

## Documentation

- [Master Build Specification](./docs/master-build-spec.md) — single source of truth
- [Trust Architecture Review](./docs/trust-architecture-review.md)
- [Architecture Decision Records](./docs/adr/)
- [Infrastructure Plan (future AWS)](./infrastructure/README.md)

## Project discipline

Development proceeds in **stage gates**. Each stage is built, tested, audited,
fixed, re-audited, reported, and then **waits for human approval** before the
next stage begins. The current stage and history are tracked in the
[master build spec](./docs/master-build-spec.md).
