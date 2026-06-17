# TradeScore — Launch Checklist

Status legend: ✅ done · 🔲 pre-launch task · ⬜ post-launch.

## Engineering readiness
- ✅ All 13 build stages complete, audited, and approved
- ✅ CI quality gate green (lint, typecheck, test, build)
- ✅ 102 automated tests; end-to-end verified at representative scale
- ✅ DB migrations forward-only + checksummed; representative benchmark passed
- 🔲 Full-scale load test (100k businesses / 10M trades) on staging hardware
- 🔲 Add `pg_trgm` GIN index for business-name search before large scale
- 🔲 Move full fraud scan to a scheduled/queued job

## Security
- ✅ OWASP Top 10 review (see security.md) — no unresolved High/Med in scope
- ✅ Authn (OTP + rotating revocable sessions) and two-layer authz verified
- ✅ Secrets via env/secret-manager abstraction; `.env` git-ignored
- 🔲 Generate strong production JWT secrets; configure AWS Secrets Manager
- 🔲 Add global HTTP rate limiting + WAF (CloudFront) at the edge
- 🔲 External penetration test

## Infrastructure & DR
- ✅ Local-first Docker Compose; cloud-ready (no app refactor needed)
- 🔲 Provision AWS (ECS/RDS Multi-AZ/ElastiCache/S3/Secrets Manager) — IaC
- 🔲 RDS automated backups + PITR; tested restore runbook
- 🔲 Durable event transport (SNS+SQS / Redis Streams) + reconcile job
- 🔲 Observability: ship structured logs to CloudWatch; wire Sentry + PostHog DSNs

## Product / pilot
- ✅ Computer Village pilot seed + analytics (confirmation rate, adoption, referrals)
- ✅ Mobile PWA (installable, offline, low-bandwidth) — device QA during pilot
- 🔲 Onboard first traders; monitor confirmation rate + dispute rate daily
- 🔲 Calibrate scoring weights + fraud thresholds on real pilot data

## Commercial
- ✅ Plans, server-authoritative billing, invoices, verified badge, MRR reporting
- 🔲 Integrate real PSP (Paystack/Stripe) + webhooks behind the existing abstraction
- 🔲 Real SMS/WhatsApp/Email providers behind the notification abstraction
- ⬜ Refunds / proration / tax / dunning

## Documentation
- ✅ Architecture, Database, API, Security, Fraud, Admin, Deployment, QA, Release Notes
- ✅ Trust Architecture Review, ADRs, per-stage reports + audits, infra plan
