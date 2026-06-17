-- 0006_trades.sql
-- The trade logging engine: logged commercial transactions and their append-only
-- lifecycle history.
--
-- GOVERNING RULE (Trust Architecture Review §3, F3): a trade is worth nothing
-- until counterparty-confirmed. Trades therefore start unconfirmed; scoring
-- (Stage 5) will only ever count CONFIRMED trades. The `trade_events` table is
-- the immutable provenance of each trade — edits append, never overwrite (TAR §1).

CREATE TABLE trades (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Human-friendly unique lookup code (e.g. "TS-3F9A2C").
  reference_code           TEXT NOT NULL,

  -- The business that logged the trade.
  initiator_business_id    UUID NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,

  -- The other party. Either a registered business (preferred — it can confirm in
  -- Stage 4) or a free-text snapshot until/if they register.
  counterparty_business_id UUID REFERENCES businesses (id) ON DELETE SET NULL,
  counterparty_name        TEXT,
  counterparty_phone       TEXT,

  direction                TEXT NOT NULL CHECK (direction IN ('SALE', 'PURCHASE')),

  -- Money as integer minor units (no floats) + ISO currency. Must be positive.
  amount_minor             BIGINT NOT NULL CHECK (amount_minor > 0),
  currency                 TEXT NOT NULL DEFAULT 'NGN' CHECK (currency ~ '^[A-Z]{3}$'),

  description              TEXT,
  occurred_on              DATE NOT NULL,

  status                   TEXT NOT NULL DEFAULT 'DRAFT'
                             CHECK (status IN
                               ('DRAFT', 'PENDING_CONFIRMATION', 'CONFIRMED',
                                'DISPUTED', 'REJECTED', 'CANCELLED')),

  -- Attribution: which user logged this (Sybil/insider analysis, Stage 9).
  created_by               UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,

  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at               TIMESTAMPTZ,

  -- Anti-self-dealing (TAR F4): a business cannot trade with itself.
  CONSTRAINT chk_trades_no_self_trade
    CHECK (counterparty_business_id IS NULL OR counterparty_business_id <> initiator_business_id)
);

CREATE UNIQUE INDEX uq_trades_reference_code ON trades (reference_code) WHERE deleted_at IS NULL;
CREATE INDEX idx_trades_initiator ON trades (initiator_business_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_trades_counterparty ON trades (counterparty_business_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_trades_status ON trades (status) WHERE deleted_at IS NULL;
CREATE INDEX idx_trades_created_by ON trades (created_by);
-- Supports counterparty-confirmation lookups and time-window fraud queries (Stage 9).
CREATE INDEX idx_trades_counterparty_status ON trades (counterparty_business_id, status)
  WHERE deleted_at IS NULL;

CREATE TRIGGER trg_trades_updated_at
  BEFORE UPDATE ON trades
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Append-only lifecycle log. No updated_at/deleted_at: these rows are immutable.
CREATE TABLE trade_events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id       UUID NOT NULL REFERENCES trades (id) ON DELETE CASCADE,

  event_type     TEXT NOT NULL
                   CHECK (event_type IN
                     ('CREATED', 'EDITED', 'SUBMITTED', 'CANCELLED',
                      'CONFIRMED', 'DISPUTED', 'REJECTED')),
  from_status    TEXT,
  to_status      TEXT,
  actor_user_id  UUID REFERENCES users (id) ON DELETE SET NULL,
  reason         TEXT,
  metadata       JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_trade_events_trade ON trade_events (trade_id, created_at);
