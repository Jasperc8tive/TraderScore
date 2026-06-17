# Stage 10 — Notification System: Design Note (pre-build)

> Produced before code. Defines the channel abstraction, the event-driven
> notifications, recipient resolution, and the reliability model.

## Goal

A communication layer that keeps businesses informed of the things that matter to
trust: a trade awaiting their confirmation, a confirmation/rejection/dispute on
their trade, dispute activity, and verification — over SMS, WhatsApp, Email, and an
in-app inbox.

## Channel abstraction (cloud-ready)

A `NotificationChannelProvider` interface (`send(address, title, body)`) with a
**dev log provider** used for all channels locally. Real adapters (Twilio SMS,
WhatsApp Business, SES email) are config-gated implementations that slot in without
touching callers — same pattern as the storage/event abstractions (spec §15). No
provider credentials are required to run locally.

## Event-driven notifications

The service subscribes to existing domain events and sends notifications — it is a
pure consumer (like fraud/scoring), so producers stay decoupled:

| Event | Recipient | Message |
|---|---|---|
| `trade.submitted` | counterparty owners | "A trade is awaiting your confirmation." |
| `trade.confirmed` | initiator owners | "Your trade was confirmed." |
| `trade.rejected` | initiator owners | "Your trade was rejected." |
| `trade.disputed` | initiator owners | "Your trade was disputed." |
| `dispute.opened` | both parties' owners | "A dispute was opened on a trade." |
| `dispute.resolved` | both parties' owners | "A dispute was resolved." |
| `business.verified` | that business's owners | "Your business was verified." |

Recipient resolution maps a `businessId` to its **OWNER members'** contacts
(phone/email) via the membership table.

## Data model: `notifications`

`recipient_user_id`, `channel` (SMS|WHATSAPP|EMAIL|IN_APP), `address`
(phone/email/null), `type`, `title`, `body`, `payload` JSONB, `status`
(PENDING|SENT|FAILED), `attempts`, `error`, `created_at`, `sent_at`. Every
notification is persisted — it doubles as the **in-app inbox** and the delivery
audit trail.

## Reliability model

- **Persist first, then dispatch:** a notification row is written `PENDING` before
  any send, so nothing is lost if dispatch fails.
- **Bounded retries:** dispatch retries up to N times; terminal failure is recorded
  as `FAILED` with the error and attempt count (operable/resendable later).
- **Subscriber isolation:** notification sending runs in isolated handlers; a
  delivery failure never affects the trade/dispute flow.
- **Idempotency note:** in-memory bus delivers once; the persisted record + status
  make re-delivery and reconciliation possible.

## Surface

- `GET /notifications` — the authenticated user's inbox (most recent first).

OTP remains a transactional SMS (its existing dev delivery); in production it uses
the same SMS channel/provider this system introduces.

## UX principles

- **Right person, right moment:** owners are notified exactly when an action is
  needed (a trade to confirm) or a status they care about changes.
- **Low-bandwidth:** short SMS-first messages; the in-app inbox is server-rendered
  data (UI can layer on in the PWA stage).
- **No spam:** one notification per meaningful event per recipient.

## Out of scope (named stages)

Real provider credentials/adapters (wired when going live), push notifications &
the in-app inbox UI (PWA, Stage 11), user notification preferences/opt-out
(commercial hardening, Stage 13), digesting/batching.
