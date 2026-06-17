-- 0002_market_clusters.sql
-- Market clusters: physical/logical markets (e.g. "Computer Village, Ikeja").
-- Used for discovery and for localized fraud analysis (a circular-trading ring
-- often lives within one market). Created before businesses because businesses
-- reference a cluster.

CREATE TABLE market_clusters (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL,
  -- Free-form locality description; structured geo is a later concern.
  city        TEXT,
  state       TEXT,
  country     TEXT NOT NULL DEFAULT 'NG',
  description TEXT,

  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);

-- Slug is the stable, URL-safe identifier; unique among non-deleted clusters.
CREATE UNIQUE INDEX uq_market_clusters_slug
  ON market_clusters (slug)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_market_clusters_state ON market_clusters (state) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_market_clusters_updated_at
  BEFORE UPDATE ON market_clusters
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
