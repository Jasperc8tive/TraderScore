-- 0013_billing.sql
-- Revenue infrastructure: subscriptions and invoices.
--
-- Money is integer minor units, server-derived from code-defined plans (never the
-- client). NO card data is stored — only a billing-provider reference. A paid plan
-- grants commercial entitlements (a "Verified Seller" badge, features); it never
-- raises a business's behavioural trust score (Trust Architecture Review §2).

CREATE TABLE subscriptions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id           UUID NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,

  plan                  TEXT NOT NULL CHECK (plan IN ('FREE', 'PRO', 'ELITE')),
  status                TEXT NOT NULL DEFAULT 'ACTIVE'
                          CHECK (status IN ('ACTIVE', 'PAST_DUE', 'CANCELLED')),

  current_period_start  TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_period_end    TIMESTAMPTZ NOT NULL,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- At most one ACTIVE/PAST_DUE subscription per business.
CREATE UNIQUE INDEX uq_subscriptions_active_per_business
  ON subscriptions (business_id)
  WHERE status IN ('ACTIVE', 'PAST_DUE');
CREATE INDEX idx_subscriptions_business ON subscriptions (business_id);

CREATE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE invoices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     UUID NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions (id) ON DELETE SET NULL,

  plan            TEXT NOT NULL CHECK (plan IN ('FREE', 'PRO', 'ELITE')),
  amount_minor    BIGINT NOT NULL CHECK (amount_minor >= 0),
  currency        TEXT NOT NULL DEFAULT 'NGN' CHECK (currency ~ '^[A-Z]{3}$'),

  status          TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PAID', 'FAILED')),
  -- Reference returned by the billing provider; never raw card data.
  provider_ref    TEXT,
  error           TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at         TIMESTAMPTZ
);

CREATE INDEX idx_invoices_business ON invoices (business_id, created_at DESC);
CREATE INDEX idx_invoices_status ON invoices (status);
