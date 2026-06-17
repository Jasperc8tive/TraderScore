# Stage 13 — Commercial Hardening: Design Note (pre-build)

> Produced before code. Defines the revenue infrastructure: plans/entitlements,
> billing, the paid "Verified Seller" badge, feature flags, telemetry, and revenue
> metrics — with security and financial correctness front of mind.

## Goal

Make TradeScore monetizable without compromising trust integrity: paid plans that
unlock real entitlements, server-authoritative billing, a premium verified badge,
runtime feature flags, and the metrics to track revenue.

## Plans & entitlements (code-defined, server-authoritative)

Plans are defined in code (not client/DB-mutable), each with a price (integer minor
units) and entitlements:

| Plan | Price (NGN) | Verified badge | Priority support |
|---|---|---|---|
| FREE | 0 | no | no |
| PRO | 5,000 / period | **yes** | no |
| ELITE | 15,000 / period | **yes** | yes |

A business with no subscription row is implicitly FREE. Entitlements are resolved
purely from the plan — never trusted from the client.

## Billing

- `subscriptions` (one active per business): plan, status, current period.
- `invoices`: amount (server-derived from the plan), currency, status, period,
  provider reference. **No card data is ever stored** — only a provider reference.
- A `BillingProvider` abstraction (dev provider auto-succeeds; a real PSP — e.g.
  Paystack/Stripe — slots in via config). Subscribe → create invoice → charge →
  on success mark subscription ACTIVE + invoice PAID.
- Idempotent: one active subscription per business; re-subscribing upgrades/
  renews rather than duplicating.

## Verified badge (paid)

A business on an active PRO/ELITE plan earns a **premium "Verified Seller" badge**
— distinct from identity assurance (Stage 6). Surfaced in discovery via a join to
active subscriptions (no N+1). It is a *commercial* signal, clearly separate from
the *behavioural* trust score, which money can never buy.

## Feature flags

Runtime flags with code defaults, overridable by environment (`FEATURE_<KEY>`), and
extendable with per-plan entitlement flags. `GET /feature-flags` returns the
effective flags (optionally business-scoped). Lets us dark-launch and gate features.

## Telemetry / analytics instrumentation

A `TelemetryService` records product events (subscription created/cancelled, …) via
a dev log provider; PostHog is config-gated (`POSTHOG_KEY`). Plus revenue KPIs
(active subscriptions by plan, MRR) on an admin endpoint.

## Security & finance principles

- **Server-authoritative amounts:** prices come from code, never the request body.
- **No card data:** only a provider reference is persisted (PCI surface minimized).
- **Owner-only billing:** subscribe/cancel/invoices require business ownership.
- **No trust laundering:** paid plans grant a *commercial* badge and features —
  never a higher trust score or the ability to self-confirm trades.
- **Auditable:** subscription/billing actions are audited; invoices are immutable
  records with integer money.

## Out of scope (named stages / post-launch)

Real PSP integration + webhooks (go-live), proration/refunds, tax, dunning, full
PostHog dashboards, and per-user entitlement UIs. The abstractions are ready for them.
