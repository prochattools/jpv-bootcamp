ALTER TABLE IF EXISTS jpvbootcamp.sponsored_seats
ADD COLUMN IF NOT EXISTS reserved_by_application_id uuid,
ADD COLUMN IF NOT EXISTS reserved_at timestamptz;

CREATE INDEX IF NOT EXISTS sponsored_seats_reserved_by_application_id_idx
ON jpvbootcamp.sponsored_seats (reserved_by_application_id);

ALTER TABLE IF EXISTS jpvbootcamp.sponsored_applications
ADD COLUMN IF NOT EXISTS decision text,
ADD COLUMN IF NOT EXISTS decided_at timestamptz,
ADD COLUMN IF NOT EXISTS tier text DEFAULT 'pro',
ADD COLUMN IF NOT EXISTS seat_id uuid,
ADD COLUMN IF NOT EXISTS claim_token_sent_at timestamptz,
ADD COLUMN IF NOT EXISTS claimed_at timestamptz;

ALTER TABLE IF EXISTS jpvbootcamp.sponsored_applications
ALTER COLUMN account_id DROP NOT NULL;

UPDATE jpvbootcamp.sponsored_applications
SET tier = COALESCE(tier, 'pro')
WHERE tier IS NULL;

CREATE INDEX IF NOT EXISTS sponsored_applications_email_idx
ON jpvbootcamp.sponsored_applications (email);

CREATE INDEX IF NOT EXISTS sponsored_applications_seat_id_idx
ON jpvbootcamp.sponsored_applications (seat_id);
