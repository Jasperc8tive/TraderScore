-- 0009_disputes.sql
-- The trust protection layer: formal dispute cases over trades, their evidence,
-- and the adjudicated outcome.
--
-- A dispute freezes a trade's trust until a moderator/admin resolves it
-- (Trust Architecture Review §3, F6). Resolution drives the trade to a final
-- status, which (via trade events) recomputes the affected scores. Evidence is
-- append-only; the resolution is attributable.

CREATE TABLE disputes (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id              UUID NOT NULL REFERENCES trades (id) ON DELETE CASCADE,

  raised_by_business_id UUID NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  raised_by_user_id     UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  reason                TEXT NOT NULL,

  status                TEXT NOT NULL DEFAULT 'OPEN'
                          CHECK (status IN ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'WITHDRAWN')),

  -- The trade's status at the moment the dispute was opened, so a withdrawal can
  -- restore it.
  trade_status_before   TEXT NOT NULL,

  -- Adjudication (null until resolved).
  resolution            TEXT CHECK (resolution IN ('UPHELD', 'DISMISSED')),
  resolution_note       TEXT,
  reviewed_by_user_id   UUID REFERENCES users (id) ON DELETE SET NULL,
  resolved_at           TIMESTAMPTZ,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- At most one ACTIVE (open/under-review) dispute per trade.
CREATE UNIQUE INDEX uq_disputes_active_per_trade
  ON disputes (trade_id)
  WHERE status IN ('OPEN', 'UNDER_REVIEW');

CREATE INDEX idx_disputes_trade ON disputes (trade_id);
CREATE INDEX idx_disputes_raised_by ON disputes (raised_by_business_id);
CREATE INDEX idx_disputes_status ON disputes (status);

CREATE TRIGGER trg_disputes_updated_at
  BEFORE UPDATE ON disputes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Append-only evidence submissions.
CREATE TABLE dispute_evidence (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id            UUID NOT NULL REFERENCES disputes (id) ON DELETE CASCADE,

  submitted_by_user_id     UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  submitted_by_business_id UUID NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,

  body                  TEXT NOT NULL,
  attachment_url        TEXT,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dispute_evidence_dispute ON dispute_evidence (dispute_id, created_at);
