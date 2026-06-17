-- 0004_businesses.sql
-- Businesses: the commercial entities whose reputation TradeScore exists to track.
--
-- CRITICAL DESIGN DECISION (Trust Architecture Review §4.1):
--   There is deliberately NO trust_score / reputation column on this table.
--   Scores are derived, versioned snapshots computed elsewhere and recomputable
--   at any time. Storing a mutable score here would force a migration on every
--   algorithm change and destroy score history. Do not add one.
--
--   `assurance_level` is NOT a score — it is the provenance of identity
--   verification (F1/F2 defense), an input to scoring, not an output of it.

CREATE TABLE businesses (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  name              TEXT NOT NULL,
  slug              TEXT NOT NULL,
  description       TEXT,
  phone             TEXT,
  email             TEXT,

  market_cluster_id UUID REFERENCES market_clusters (id) ON DELETE SET NULL,

  -- Provenance of trust in this identity. Defaults to UNVERIFIED so a brand-new
  -- business carries near-zero scoring weight until it proves itself.
  assurance_level   TEXT NOT NULL DEFAULT 'UNVERIFIED'
                      CHECK (assurance_level IN
                        ('UNVERIFIED', 'PHONE_VERIFIED', 'DOCUMENT_VERIFIED', 'FULLY_VERIFIED')),

  status            TEXT NOT NULL DEFAULT 'PENDING'
                      CHECK (status IN ('PENDING', 'ACTIVE', 'SUSPENDED')),

  -- Attribution: who created this business. Enables Sybil/insider analysis later
  -- (Trust Architecture Review §3, F2/F9) with no future migration required.
  created_by        UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,

  verified_at       TIMESTAMPTZ,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

CREATE UNIQUE INDEX uq_businesses_slug ON businesses (slug) WHERE deleted_at IS NULL;
CREATE INDEX idx_businesses_market_cluster ON businesses (market_cluster_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_businesses_created_by ON businesses (created_by);
CREATE INDEX idx_businesses_status ON businesses (status) WHERE deleted_at IS NULL;
CREATE INDEX idx_businesses_assurance ON businesses (assurance_level) WHERE deleted_at IS NULL;
-- Trigram-free simple search support; full search comes in Stage 6.
CREATE INDEX idx_businesses_name ON businesses (lower(name)) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_businesses_updated_at
  BEFORE UPDATE ON businesses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
