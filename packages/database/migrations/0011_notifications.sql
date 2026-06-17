-- 0011_notifications.sql
-- Communication infrastructure: a record of every notification, which doubles as
-- the in-app inbox and the delivery audit trail.
--
-- Notifications are persisted PENDING before any send attempt, so nothing is lost
-- if a provider fails; the status/attempts columns make delivery operable and
-- reconcilable.

CREATE TABLE notifications (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  recipient_user_id UUID REFERENCES users (id) ON DELETE CASCADE,
  channel           TEXT NOT NULL CHECK (channel IN ('SMS', 'WHATSAPP', 'EMAIL', 'IN_APP')),
  -- Destination address (phone/email); null for IN_APP-only.
  address           TEXT,

  -- Stable notification type key, e.g. 'TRADE_AWAITING_CONFIRMATION'.
  type              TEXT NOT NULL,
  title             TEXT NOT NULL,
  body              TEXT NOT NULL,
  payload           JSONB NOT NULL DEFAULT '{}'::jsonb,

  status            TEXT NOT NULL DEFAULT 'PENDING'
                      CHECK (status IN ('PENDING', 'SENT', 'FAILED')),
  attempts          INTEGER NOT NULL DEFAULT 0,
  error             TEXT,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at           TIMESTAMPTZ
);

-- Inbox lookup: a user's notifications, most recent first.
CREATE INDEX idx_notifications_recipient ON notifications (recipient_user_id, created_at DESC);
CREATE INDEX idx_notifications_status ON notifications (status);
