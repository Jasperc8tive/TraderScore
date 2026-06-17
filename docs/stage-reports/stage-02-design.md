# Stage 2 — Identity System: Design Note (pre-build)

> Produced before code, per project discipline. Defines the flows, the
> authorization model, and the fraud surface this stage must defend. Honors the
> [Trust Architecture Review](../trust-architecture-review.md) (TAR).

## Scope

Users, Businesses, Business Membership, OTP Verification, Business Profiles,
Market Clusters, Business Search. No trades/scores yet (later stages).

## Identity & auth flows

1. **Request OTP** — `POST /auth/otp/request { phone }`. Normalize to E.164,
   find-or-create a `PENDING` user, generate a CSPRNG code, store only its HMAC in
   Redis with TTL + resend cooldown, "deliver" it (dev: logged/returned; real
   SMS is Stage 10). Rate-limited per phone.
2. **Verify OTP** — `POST /auth/otp/verify { phone, code }`. Constant-time verify
   against the Redis challenge with attempt counting; on success mark the user
   `ACTIVE` + `phone_verified_at`, create a revocable server-side session in
   Redis, and issue a short-lived access JWT + an opaque refresh token. Emits
   `user.created` the first time a user is activated.
3. **Refresh** — `POST /auth/refresh { refreshToken }`. Look up the session by
   token hash; if active, **rotate** the refresh token and issue a new access JWT.
4. **Logout** — `POST /auth/logout`. Revoke the current session.

## Authorization model (two layers)

- **System role (RBAC, from Stage 1):** coarse capabilities via `@RequirePermissions`
  + `PermissionsGuard` (e.g. only MODERATOR/ADMIN may `business:verify`).
- **Resource ownership (new this stage):** capability is necessary but not
  sufficient — to mutate a *specific* business you must be its `OWNER` in
  `business_members`. Checked in the service layer, not the guard, because it is
  data-dependent. This separation (role vs. membership) directly implements
  TAR F7 (privilege abuse / separation of duties).

## New table: `business_members`

Links users ↔ businesses with a membership role (`OWNER` | `STAFF`), audit
timestamps, soft delete, and a partial unique `(business_id, user_id)`. This is
the join that lets staff operate a business without owning it.

## Fraud surface addressed now (capture, not yet detect)

- **F1 fake businesses / F3 phantom trust:** new businesses are created
  `UNVERIFIED`; only a MODERATOR/ADMIN can raise `assurance_level` via the verify
  endpoint, which writes an attributable change and emits `business.verified`.
- **F2 Sybil:** every user carries the phone used; every business carries
  `created_by`; memberships are attributable. OTP request is rate-limited per
  phone to slow mass-account creation.
- **F8 account takeover:** OTP hashed + attempt-limited; sessions revocable;
  refresh rotation invalidates a stolen refresh token after first use.

## Search (UX)

`GET /businesses?query=&cluster=&page=&pageSize=` — case-insensitive name match
(uses the `lower(name)` index), optional market-cluster filter, soft-delete
aware, paginated with a stable envelope. Public, read-only.

## Out of scope (named later stages)

Real SMS/WhatsApp delivery (Stage 10), trust badges/rich profiles (Stage 6),
trades & confirmations (Stages 3–4), fraud *detection* logic (Stage 9).
