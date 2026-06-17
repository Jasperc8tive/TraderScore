-- 0005_business_members.sql
-- Membership join between users and businesses.
--
-- This is the authorization backbone of the identity system: it records WHO may
-- act on behalf of WHICH business, and in what capacity (OWNER vs STAFF). Owner
-- vs staff separation enforces separation of duties (Trust Architecture Review
-- §3, F7). Memberships are attributable and soft-deletable so revocations are
-- auditable and never lose history.

CREATE TABLE business_members (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  business_id  UUID NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,

  member_role  TEXT NOT NULL DEFAULT 'STAFF'
                 CHECK (member_role IN ('OWNER', 'STAFF')),

  -- Attribution: which user added this member (for abuse/insider investigation).
  added_by     UUID REFERENCES users (id) ON DELETE SET NULL,

  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at   TIMESTAMPTZ
);

-- A user holds at most one active membership per business.
CREATE UNIQUE INDEX uq_business_members_business_user
  ON business_members (business_id, user_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_business_members_user ON business_members (user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_business_members_business ON business_members (business_id) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_business_members_updated_at
  BEFORE UPDATE ON business_members
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
