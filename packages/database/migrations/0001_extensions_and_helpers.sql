-- 0001_extensions_and_helpers.sql
-- Foundational database primitives shared by all later migrations.

-- pgcrypto provides gen_random_uuid() for UUID primary keys.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- A reusable trigger function that keeps `updated_at` honest on every UPDATE.
-- Putting this in the database (not application code) guarantees the audit
-- timestamp is correct even for ad-hoc/admin writes (Trust Architecture Review
-- §5: history is never lost).
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
