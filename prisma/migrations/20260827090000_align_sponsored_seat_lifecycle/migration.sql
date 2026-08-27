-- Pay-it-forward uses one sponsored tier. The original migration created
-- legacy `pro` checks, which prevented funded seats and grants from being
-- recorded by the current flow.
DO $$
BEGIN
  IF to_regclass('jpvbootcamp.sponsored_seats') IS NOT NULL THEN
    UPDATE jpvbootcamp.sponsored_seats
    SET tier = 'free'
    WHERE tier = 'pro';

    ALTER TABLE jpvbootcamp.sponsored_seats
      DROP CONSTRAINT IF EXISTS sponsored_seats_tier_check;

    ALTER TABLE jpvbootcamp.sponsored_seats
      ADD CONSTRAINT sponsored_seats_tier_check CHECK (tier IN ('free'));
  END IF;

  IF to_regclass('jpvbootcamp.sponsored_grants') IS NOT NULL THEN
    UPDATE jpvbootcamp.sponsored_grants
    SET tier = 'free'
    WHERE tier = 'pro';

    ALTER TABLE jpvbootcamp.sponsored_grants
      DROP CONSTRAINT IF EXISTS sponsored_grants_tier_check;

    ALTER TABLE jpvbootcamp.sponsored_grants
      ADD CONSTRAINT sponsored_grants_tier_check CHECK (tier IN ('free'));
  END IF;

  IF to_regclass('jpvbootcamp.sponsored_applications') IS NOT NULL THEN
    UPDATE jpvbootcamp.sponsored_applications
    SET tier = 'free'
    WHERE tier = 'pro';

    ALTER TABLE jpvbootcamp.sponsored_applications
      DROP CONSTRAINT IF EXISTS sponsored_applications_status_check;

    ALTER TABLE jpvbootcamp.sponsored_applications
      ADD CONSTRAINT sponsored_applications_status_check
      CHECK (status IN ('pending', 'processing', 'approved', 'claimed', 'rejected'));
  END IF;
END
$$;
