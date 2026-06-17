# TradeScore — Deployment Guide

## Local (the supported path today)

Prerequisites: Docker, Node 20+, pnpm 10+.

```bash
pnpm install
cp .env.example .env            # fill values; never commit .env
docker compose up               # web + api + postgres + redis
# first run, in another terminal:
pnpm db:migrate
pnpm db:seed                    # dev data
pnpm db:seed:pilot              # optional: Computer Village pilot dataset
```

- Web: <http://localhost:3000> · API: <http://localhost:4000/api/v1/health>
- Hot reload: `docker compose watch`.
- Port conflicts: set `POSTGRES_HOST_PORT` / `REDIS_HOST_PORT` (host publish only).

## Configuration

All config is environment-driven and validated at startup (`@tradescore/config`,
zod) — the process fails fast on missing/invalid values. See `.env.example` for the
full list (API/web ports, Postgres, Redis, JWT secrets, OTP, storage, observability).
Generate strong secrets for non-dev (`openssl rand -hex 32`).

Feature flags: `FEATURE_<KEY>=true|false` (e.g. `FEATURE_DISPUTES_ENABLED=false`).

## CI

`.github/workflows/ci.yml` runs lint → typecheck → test → build on every push/PR.
It is a **quality gate only** (no deploy).

## Production images

Multi-stage Dockerfiles (`infrastructure/docker/{api,web}.Dockerfile`) provide a
`prod` target:
- API: compiled `dist`, run `node apps/api/dist/main.js`.
- Web: Next standalone output (`BUILD_STANDALONE=true`, set in the web Dockerfile).

## Future AWS target (post-pilot)

Per `infrastructure/README.md`: ECS Fargate (api/web) behind ALB + CloudFront,
Amazon RDS for PostgreSQL (Multi-AZ), ElastiCache for Redis, S3 (storage), Secrets
Manager, SNS+SQS (durable events). The application is already cloud-ready — all
dependencies sit behind abstractions — so this requires **no application refactor**,
only the (deliberately deferred) infrastructure-as-code work.

## Go-live checklist pointer

See [launch-checklist.md](./launch-checklist.md).
