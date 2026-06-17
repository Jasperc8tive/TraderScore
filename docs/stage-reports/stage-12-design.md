# Stage 12 — Pilot Market Release (Computer Village): Design Note (pre-build)

> Produced before code. Defines what "pilot-ready" means for the Computer Village
> launch: onboarding traders, a growth loop, and the metrics to monitor behaviour
> and measure trust adoption.

## The pilot hypothesis (what we are testing)

> Businesses will **use verified transaction history and reputation scores** before
> extending credit or entering commercial relationships.

So the pilot must (1) get traders onboarded, (2) get trades logged **and
confirmed**, and (3) let us measure whether trust data is being created and viewed.

## Deliverables

### 1. Onboarding (operations)

- Self-service business registration already exists; the **Computer Village market
  cluster** is the pilot home. A **pilot seed** command provisions Computer Village
  plus a realistic set of businesses, members, confirmed trades, and a dispute — so
  the pilot environment is demonstrable and metrics are non-trivial on day one.

### 2. Referrals (growth)

A trader-to-trader growth loop:

- every business gets a unique **referral code**;
- a new business can be created **with a referrer's code**, recording a referral;
- referral stats (who referred whom, counts, a leaderboard) drive growth and are
  measurable.

### 3. Pilot analytics (monitor + measure)

A read-only metrics surface computing the adoption funnel and trust KPIs:

- businesses onboarded (total + Computer Village),
- **active** businesses (≥1 confirmed trade),
- trades logged vs **confirmed** → **confirmation rate** (the core trust signal),
- trust-score coverage + **band distribution** (trust adoption),
- dispute rate, and referral totals / top referrers.

Admin (`AUDIT_VIEW`) gets the full dashboard; a small **public pilot summary**
(headline adoption numbers) supports the landing page.

## Data model

- `businesses.referral_code` (unique) — backfilled for existing rows, generated on
  create for new ones.
- `referrals` (id, `referrer_business_id`, `referred_business_id` unique,
  `referral_code`, created_at) — one referrer per referred business.

## Authorization

- Referral code + my referral stats: the business **owner**.
- Pilot analytics dashboard: `AUDIT_VIEW` (admin/moderator).
- Public pilot summary: unauthenticated (headline numbers only).

## Audit lenses

- **Product-Market-Fit:** are we measuring the actual hypothesis (confirmed-trade
  rate, score coverage, profile views-as-trust-checks)?
- **Operations:** can we stand up the pilot environment and watch it (seed +
  dashboards + existing admin moderation/fraud)?
- **Growth:** is there a working acquisition loop (referrals) and is it measurable?

## Out of scope (named stages)

Billing/subscriptions (Stage 13), third-party analytics wiring (PostHog/Sentry are
configured but event instrumentation is Stage 13), incentive payouts for referrals,
A/B testing, and real device/field testing (run during the pilot itself).
