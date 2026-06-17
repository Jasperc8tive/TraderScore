-- 0007_trade_confirmations.sql
-- The counterparty's decision on a submitted trade. This is what turns a logged
-- claim into verified trust (Trust Architecture Review §3, F3).
--
-- One decision per trade (trade_id unique). The decision is attributable
-- (decided_by) and is written in the same transaction as the trade's status
-- change and its trade_events row, so the verified record and the trade state can
-- never disagree. Dispute *resolution* (evidence, adjudication) is Stage 7.

CREATE TABLE trade_confirmations (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id                 UUID NOT NULL REFERENCES trades (id) ON DELETE CASCADE,

  -- The business that made the decision (must be the trade's counterparty).
  counterparty_business_id UUID NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,

  decision                 TEXT NOT NULL CHECK (decision IN ('CONFIRMED', 'REJECTED', 'DISPUTED')),
  note                     TEXT,

  -- Attribution: which user in the counterparty business decided (F9/insider).
  decided_by               UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,

  created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Exactly one confirmation decision per trade.
CREATE UNIQUE INDEX uq_trade_confirmations_trade ON trade_confirmations (trade_id);
CREATE INDEX idx_trade_confirmations_counterparty ON trade_confirmations (counterparty_business_id);
