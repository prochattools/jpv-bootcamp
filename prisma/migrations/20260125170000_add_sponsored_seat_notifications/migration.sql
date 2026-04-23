ALTER TABLE IF EXISTS jpvbootcamp.sponsored_seats
ADD COLUMN IF NOT EXISTS donor_email_sent_at timestamptz,
ADD COLUMN IF NOT EXISTS admin_notified_at timestamptz;
