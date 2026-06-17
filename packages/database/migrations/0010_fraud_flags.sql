-- 0010_fraud_flags.sql
-- The Fraud Engine's output: flags that are OPINIONS about data.
--
-- CRITICAL (Trust Architecture Review §2): a fraud flag never mutates a trade, a
-- confirmation, or a score. The engine reads immutable events and writes flags
-- here; operators act on them via moderation (Stage 8). Because scores are
-- recomputable, a future version can feed confirmed flags into scoring as a
-- down-weight with no schema change.

CREATE TABLE fraud_flags (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  flag_type     TEXT NOT NULL
                  CHECK (flag_type IN
                    ('SYBIL_CLUSTER', 'CIRCULAR_TRADING', 'WASH_TRADING',
                     'VELOCITY_ANOMALY', 'HIGH_DISPUTE_RATE', 'RELATIONSHIP_RISK')),

  subject_type  TEXT NOT NULL CHECK (subject_type IN ('BUSINESS', 'USER', 'RELATIONSHIP', 'TRADE')),
  -- A uuid, or a composite key for relationships (e.g. "a|b" of sorted ids).
  subject_id    TEXT NOT NULL,

  severity      TEXT NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH')),
  status        TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CONFIRMED', 'DISMISSED')),

  detail        JSONB NOT NULL DEFAULT '{}'::jsonb,

  detected_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by   UUID REFERENCES users (id) ON DELETE SET NULL,
  reviewed_at   TIMESTAMPTZ,
  review_note   TEXT
);

-- Dedupe: at most one OPEN flag per (type, subject). Re-detection upserts it.
CREATE UNIQUE INDEX uq_fraud_flags_open
  ON fraud_flags (flag_type, subject_id)
  WHERE status = 'OPEN';

CREATE INDEX idx_fraud_flags_status ON fraud_flags (status, detected_at DESC);
CREATE INDEX idx_fraud_flags_type ON fraud_flags (flag_type);
CREATE INDEX idx_fraud_flags_subject ON fraud_flags (subject_type, subject_id);
