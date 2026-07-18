-- Add claimed_by_account_id column to sponsored_seats if missing
-- This ensures the column exists in staging database
ALTER TABLE IF EXISTS jpvbootcamp.sponsored_seats
ADD COLUMN IF NOT EXISTS claimed_by_account_id integer NULL;

-- Create index for the column if it doesn't exist
CREATE INDEX IF NOT EXISTS sponsored_seats_claimed_by_account_id_idx
ON jpvbootcamp.sponsored_seats (claimed_by_account_id);
