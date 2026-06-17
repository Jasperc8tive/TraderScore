-- 0008_score_snapshots.sql
-- The reputation engine's output: versioned, append-only score snapshots and the
-- structured factors that explain them.
--
-- CRITICAL (Trust Architecture Review §4): there is deliberately NO score column
-- on `businesses`. A score is a point-in-time projection of CONFIRMED trades,
-- recomputable at any time. A new algorithm writes NEW rows with a new
-- `algorithm_version` beside the old — never an ALTER TABLE, never lost history.

CREATE TABLE score_snapshots (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id       UUID NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,

  algorithm_version TEXT NOT NULL,
  score             INTEGER NOT NULL CHECK (score >= 0 AND score <= 1000),
  band              TEXT NOT NULL
                      CHECK (band IN ('NEW', 'BUILDING', 'ESTABLISHED', 'TRUSTED', 'HIGHLY_TRUSTED')),

  -- Hash of the exact inputs scored, for reproducibility and churn-avoidance.
  inputs_hash       TEXT NOT NULL,
  -- Algorithm-specific extras without requiring a migration (TAR §4.4).
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,

  computed_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- "Current score" = latest snapshot per business; this index makes that O(log n).
CREATE INDEX idx_score_snapshots_business_latest
  ON score_snapshots (business_id, computed_at DESC);

CREATE TABLE score_factors (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id  UUID NOT NULL REFERENCES score_snapshots (id) ON DELETE CASCADE,

  -- Stable machine key, e.g. 'CONFIRMED_TRADE_VOLUME'.
  factor_key   TEXT NOT NULL,
  -- Magnitude of the contribution (always >= 0; sign comes from direction).
  weight       INTEGER NOT NULL,
  direction    TEXT NOT NULL CHECK (direction IN ('POSITIVE', 'NEGATIVE')),
  -- The evidence behind the factor (counts, ids, rates).
  detail       JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_score_factors_snapshot ON score_factors (snapshot_id);
