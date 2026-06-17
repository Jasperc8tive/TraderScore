# TradeScore — Admin / Operations Documentation

The operations platform is an API surface for ADMIN and MODERATOR roles, behind
least-privilege RBAC and fully audited. (A thin web console can layer on later.)

## Roles & permissions

| Permission | ADMIN | MODERATOR |
|---|:--:|:--:|
| business:view / verify / moderate | ✅ | ✅ |
| dispute:resolve | ✅ | ✅ |
| fraud:manage | ✅ | ✅ |
| market:manage | ✅ | ✅ |
| audit:view | ✅ | ✅ |
| user:manage | ✅ | — |
| business:create / update | ✅ (+ owners) | — |

## Moderation

- **Suspend / reactivate a business** — `POST /admin/businesses/:id/suspend|reactivate`
  (`business:moderate`). Suspended businesses are excluded from public discovery.
- **Suspend / reactivate a user** — `POST /admin/users/:id/suspend|reactivate`
  (`user:manage`, ADMIN). Suspending revokes all sessions and blocks OTP re-login.
- **Business review** — `GET /admin/businesses/:id`: identity, members, trade counts
  by status, dispute count, current score.

## Disputes

- Queue: `GET /admin/disputes?status=`. Adjudicate: `POST /disputes/:id/review` then
  `POST /disputes/:id/resolve { resolution: UPHELD|DISMISSED }`. UPHELD → trade
  REJECTED; DISMISSED → trade CONFIRMED. Outcomes recompute scores automatically.

## Fraud

- `GET /admin/fraud/overview` (heuristic signals) and `GET /admin/fraud/flags`.
- `POST /admin/fraud/scan` (full scan), `POST /admin/fraud/flags/:id/review`.

## Markets

- `GET /admin/market-clusters`, `PATCH /admin/market-clusters/:id`,
  `POST /market-clusters` (create).

## Monitoring & pilot

- `GET /admin/scores/overview` — band distribution + recent snapshots.
- `GET /admin/analytics/pilot` — businesses (total + Computer Village), active,
  confirmation rate, trust adoption, disputes, referral leaderboard.
- `GET /admin/billing/revenue` — active subscriptions by plan + MRR.

## Guarantees

Admins can suspend/restore and adjudicate, but **cannot fabricate scores or confirm
trades** — the counterparty-only confirmation and recomputable-score rules hold for
everyone. Every mutating admin action is audit-logged with the actor.
