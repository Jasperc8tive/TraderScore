-- 0012_referrals.sql
-- Growth loop for the pilot: every business has a referral code, and referrals
-- between businesses are recorded (one referrer per referred business).

-- Referral code on each business.
ALTER TABLE businesses ADD COLUMN referral_code TEXT;

-- Backfill existing rows with a deterministic code derived from the id.
UPDATE businesses
SET referral_code = upper(substr(replace(id::text, '-', ''), 1, 8))
WHERE referral_code IS NULL;

ALTER TABLE businesses ALTER COLUMN referral_code SET NOT NULL;
CREATE UNIQUE INDEX uq_businesses_referral_code ON businesses (referral_code);

CREATE TABLE referrals (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_business_id  UUID NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  referred_business_id  UUID NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  referral_code         TEXT NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- A business is referred at most once, and cannot refer itself.
  CONSTRAINT chk_referrals_no_self CHECK (referrer_business_id <> referred_business_id)
);

CREATE UNIQUE INDEX uq_referrals_referred ON referrals (referred_business_id);
CREATE INDEX idx_referrals_referrer ON referrals (referrer_business_id);
