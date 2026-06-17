# TradeScore Infrastructure

> **Stage 1 scope:** local-first only. This document is the **future AWS
> architecture plan**. There is intentionally **no Terraform / ECS / EKS / IAM /
> VPC / Route53 / CloudFront / RDS provisioning** in Stage 1 — that work belongs
> to a dedicated infrastructure stage *after* product validation (Pilot, Stage 12).
>
> The application is built **cloud-ready**: all configuration is env-driven and
> external dependencies (DB, cache, storage, events) sit behind abstractions, so
> moving to the architecture below requires **no application refactor**.

## Current state (Stage 1)

Everything runs locally via Docker Compose:

```
docker compose up
```

| Service  | Local (Docker Compose) | Future AWS target |
|----------|------------------------|-------------------|
| Web      | `web` container (Next.js) | ECS Fargate behind CloudFront |
| API      | `api` container (NestJS)  | ECS Fargate behind ALB |
| Database | `postgres` container      | Amazon RDS for PostgreSQL (Multi-AZ) |
| Cache    | `redis` container         | Amazon ElastiCache for Redis |
| Storage  | local filesystem driver   | Amazon S3 |
| Secrets  | `.env` via EnvSecretProvider | AWS Secrets Manager |
| Events   | in-memory EventBus        | SNS + SQS (or Redis Streams) |

## Future AWS architecture (planning only)

```
                          ┌────────────┐
        users  ─────────▶ │ CloudFront │ (CDN, TLS, WAF)
                          └─────┬──────┘
                                │
                  ┌─────────────┴──────────────┐
                  ▼                            ▼
            ┌───────────┐               ┌────────────┐
            │   ALB     │               │  S3 (web    │
            │ (api)     │               │  static/    │
            └─────┬─────┘               │  uploads)   │
                  │                     └────────────┘
        ┌─────────┴─────────┐
        ▼                   ▼
  ┌───────────┐       ┌───────────┐
  │ ECS Fargate│      │ ECS Fargate│
  │   api      │      │   web (SSR)│
  └─────┬──────┘      └────────────┘
        │
  ┌─────┼───────────────┬──────────────┐
  ▼     ▼               ▼              ▼
┌─────┐ ┌──────────┐ ┌────────────┐ ┌──────────────┐
│ RDS │ │ElastiCache│ │ SNS + SQS │ │ Secrets Mgr  │
│ PG  │ │  Redis   │ │ (events)  │ │              │
└─────┘ └──────────┘ └────────────┘ └──────────────┘
```

### Recommendations

- **Compute: ECS Fargate** (not EKS) — serverless containers, no cluster to
  operate; revisit EKS only if/when workload complexity demands it.
- **Database: Amazon RDS for PostgreSQL**, Multi-AZ, automated backups + PITR,
  parameter group tuned for the connection pool. (See ADR-0002.)
- **Cache: Amazon ElastiCache for Redis** — OTP store, session store, rate limits.
- **Storage: Amazon S3** behind the existing `STORAGE_DRIVER=s3` abstraction
  (verification documents, dispute evidence).
- **CDN/Edge: CloudFront** in front of web + S3; **WAF** for OWASP rule sets.
- **DNS: Route53**; **TLS: ACM**.
- **Secrets: AWS Secrets Manager** via a future `AwsSecretsManagerProvider`
  implementing the existing `SecretProvider` interface — no app changes.
- **Events: SNS + SQS** (or Redis Streams) implementing the existing `EventBus`
  interface for durable, distributed delivery.
- **Networking:** private subnets for ECS/RDS/ElastiCache; public only at ALB/CDN.
- **Observability:** CloudWatch logs (our logs are already structured JSON),
  Sentry for errors, PostHog for product analytics.

### When this gets built

Per the roadmap, real infrastructure provisioning (Terraform, networking, RDS,
etc.) follows **Stage 12 (Pilot)** once product-market signal justifies the
operational investment. Until then, this README is the contract that keeps the
codebase ready for it.
