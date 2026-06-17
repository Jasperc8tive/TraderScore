-- 0003_users.sql
-- Users: the human actors. Phone-first identity for the trader audience.
--
-- Attribution note (Trust Architecture Review §5, F2/F9): we capture the signup
-- channel and the registration phone/email from day one so Sybil clustering and
-- insider/abuse investigation are possible later WITHOUT a migration.

CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- E.164 phone is the primary identifier for OTP login.
  phone           TEXT NOT NULL,
  email           TEXT,
  full_name       TEXT,

  -- System role. Mirrors @tradescore/shared Role; enforced by a CHECK so the DB
  -- and the application can never disagree on the allowed set.
  role            TEXT NOT NULL DEFAULT 'BUSINESS_OWNER'
                    CHECK (role IN ('ADMIN', 'MODERATOR', 'BUSINESS_OWNER', 'BUSINESS_STAFF')),

  -- Account lifecycle.
  status          TEXT NOT NULL DEFAULT 'PENDING'
                    CHECK (status IN ('PENDING', 'ACTIVE', 'SUSPENDED')),

  phone_verified_at TIMESTAMPTZ,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);

-- One active account per phone. Partial unique index allows a soft-deleted row
-- to coexist with a re-registration of the same number.
CREATE UNIQUE INDEX uq_users_phone ON users (phone) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX uq_users_email ON users (email) WHERE deleted_at IS NULL AND email IS NOT NULL;
CREATE INDEX idx_users_role ON users (role) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_status ON users (status) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
