# TradeScore — API Documentation

Base URL: `/api/v1`. JSON only. Success → `{ "data": ... }`. Error →
`{ "error": { "code", "message", "details? } }` with stable codes
(`VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`,
`RATE_LIMITED`, `INTERNAL`). Auth: `Authorization: Bearer <accessToken>`. Routes
are authenticated by default; `@Public` ones are noted. Lists are paginated
`{ items, total, page, pageSize }`.

## Health
- `GET /health` — liveness. **Public**
- `GET /health/ready` — readiness (DB check). **Public**

## Auth
- `POST /auth/otp/request` `{ phone }` → `{ sent, expiresInSeconds, devCode? }`. **Public**, rate-limited.
- `POST /auth/otp/verify` `{ phone, code }` → `{ accessToken, refreshToken, expiresIn, user }`. **Public**
- `POST /auth/refresh` `{ refreshToken }` → new tokens (rotates). **Public**
- `POST /auth/logout` → revokes the current session.

## Businesses
- `GET /businesses?query=&marketClusterId=&page=&pageSize=` — search. **Public**
- `GET /businesses/:slug` — public profile. **Public**
- `POST /businesses` `{ name, description?, phone?, email?, marketClusterId?, referralCode? }` — `business:create`
- `PATCH /businesses/:id` — owner of the business
- `POST /businesses/:id/verify` `{ assuranceLevel }` — `business:verify` (moderator/admin)
- `GET /businesses/:id/referrals` — owner: referral code + stats

## Members
- `GET /businesses/:businessId/members` — members of the business
- `POST /businesses/:businessId/members` `{ phone, fullName? }` — owner adds staff
- `DELETE /businesses/:businessId/members/:userId` — owner (cannot remove last owner)

## Market clusters
- `GET /market-clusters?state=` · `GET /market-clusters/:slug` — **Public**
- `POST /market-clusters` — `market:manage`

## Trades
- `POST /trades` `{ initiatorBusinessId, counterpartyBusinessId?, counterpartyName?, direction, amountMinor, currency?, occurredOn, description? }`
- `GET /trades?businessId=&status=&page=&pageSize=` · `GET /trades/:id` · `GET /trades/:id/history`
- `PATCH /trades/:id` (pre-confirmation) · `POST /trades/:id/submit` · `POST /trades/:id/cancel`

## Confirmations (counterparty only)
- `GET /confirmations/incoming?businessId=` — inbox of trades to decide
- `POST /confirmations/:tradeId/confirm|reject` `{ note? }`
- `POST /confirmations/:tradeId/dispute` `{ reason }`

## Reputation
- `GET /businesses/:businessId/score` — score, band, factors. **Public**
- `GET /businesses/:businessId/score/history` — snapshots. **Public**
- `POST /businesses/:businessId/score/recompute` — ADMIN

## Discovery
- `GET /discovery?query=&marketClusterId=&assuranceLevel=&band=&minScore=&sort=&page=&pageSize=` — **Public**
- `GET /discovery/:slug` — full trust profile (+ premiumVerified). **Public**

## Disputes
- `POST /trades/:tradeId/disputes` `{ reason }` — a party raises a dispute
- `GET /disputes?businessId=` · `GET /disputes/:id`
- `POST /disputes/:id/evidence` `{ body, attachmentUrl? }` · `POST /disputes/:id/withdraw`
- `POST /disputes/:id/review` · `POST /disputes/:id/resolve` `{ resolution, note? }` — `dispute:resolve`

## Admin
- `POST /admin/businesses/:id/suspend|reactivate` — `business:moderate`
- `GET /admin/businesses/:id` — review — `business:moderate`
- `POST /admin/users/:id/suspend|reactivate` — `user:manage`
- `GET /admin/fraud/overview` · `GET /admin/scores/overview` — `audit:view`
- `GET /admin/disputes?status=` — `dispute:resolve`
- `GET /admin/market-clusters` · `PATCH /admin/market-clusters/:id` — `market:manage`

## Fraud
- `GET /admin/fraud/flags?status=&type=` — `audit:view`
- `POST /admin/fraud/flags/:id/review` `{ status, note? }` · `POST /admin/fraud/scan` — `fraud:manage`

## Notifications
- `GET /notifications` — the current user's inbox

## Analytics
- `GET /admin/analytics/pilot` — `audit:view` · `GET /pilot/stats` — **Public** summary

## Billing
- `GET /billing/plans` — **Public**
- `GET /businesses/:id/subscription` · `POST /businesses/:id/subscription` `{ plan }`
  · `POST /businesses/:id/subscription/cancel` · `GET /businesses/:id/invoices` — owner
- `GET /admin/billing/revenue` — `audit:view`

## Feature flags
- `GET /feature-flags` — effective flags. **Public**
