DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'jpvbootcamp'
      AND table_name = 'customer_provisioning'
      AND column_name = 'wp_user_id'
  ) THEN
    ALTER TABLE jpvbootcamp.customer_provisioning
      RENAME COLUMN wp_user_id TO account_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'jpvbootcamp'
      AND table_name = 'partner_sessions'
      AND column_name = 'wp_user_id'
  ) THEN
    ALTER TABLE jpvbootcamp.partner_sessions
      RENAME COLUMN wp_user_id TO account_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'jpvbootcamp'
      AND table_name = 'partner_sessions'
      AND column_name = 'wp_email_hash'
  ) THEN
    ALTER TABLE jpvbootcamp.partner_sessions
      RENAME COLUMN wp_email_hash TO account_email_hash;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'jpvbootcamp'
      AND table_name = 'partner_sessions'
      AND column_name = 'wp_name'
  ) THEN
    ALTER TABLE jpvbootcamp.partner_sessions
      RENAME COLUMN wp_name TO account_name;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'jpvbootcamp'
      AND table_name = 'partner_clicks'
      AND column_name = 'wp_user_id'
  ) THEN
    ALTER TABLE jpvbootcamp.partner_clicks
      RENAME COLUMN wp_user_id TO account_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'jpvbootcamp'
      AND table_name = 'sponsored_seats'
      AND column_name = 'claimed_by_wp_user_id'
  ) THEN
    ALTER TABLE jpvbootcamp.sponsored_seats
      RENAME COLUMN claimed_by_wp_user_id TO claimed_by_account_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'jpvbootcamp'
      AND table_name = 'sponsored_applications'
      AND column_name = 'wp_user_id'
  ) THEN
    ALTER TABLE jpvbootcamp.sponsored_applications
      RENAME COLUMN wp_user_id TO account_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'jpvbootcamp'
      AND table_name = 'sponsored_applications'
      AND column_name = 'reviewed_by_wp_user_id'
  ) THEN
    ALTER TABLE jpvbootcamp.sponsored_applications
      RENAME COLUMN reviewed_by_wp_user_id TO reviewed_by_account_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'jpvbootcamp'
      AND table_name = 'sponsored_grants'
      AND column_name = 'wp_user_id'
  ) THEN
    ALTER TABLE jpvbootcamp.sponsored_grants
      RENAME COLUMN wp_user_id TO account_id;
  END IF;
END $$;

DROP INDEX IF EXISTS jpvbootcamp.partner_sessions_wp_user_id_idx;
DROP INDEX IF EXISTS jpvbootcamp.partner_clicks_wp_user_id_idx;
DROP INDEX IF EXISTS jpvbootcamp.sponsored_seats_claimed_by_wp_user_id_idx;
DROP INDEX IF EXISTS jpvbootcamp.sponsored_applications_wp_user_id_idx;
DROP INDEX IF EXISTS jpvbootcamp.sponsored_grants_wp_user_id_idx;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'jpvbootcamp'
      AND table_name = 'partner_sessions'
      AND column_name = 'account_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS partner_sessions_account_id_idx
      ON jpvbootcamp.partner_sessions (account_id);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'jpvbootcamp'
      AND table_name = 'partner_clicks'
      AND column_name = 'account_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS partner_clicks_account_id_idx
      ON jpvbootcamp.partner_clicks (account_id);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'jpvbootcamp'
      AND table_name = 'sponsored_seats'
      AND column_name = 'claimed_by_account_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS sponsored_seats_claimed_by_account_id_idx
      ON jpvbootcamp.sponsored_seats (claimed_by_account_id);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'jpvbootcamp'
      AND table_name = 'sponsored_applications'
      AND column_name = 'account_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS sponsored_applications_account_id_idx
      ON jpvbootcamp.sponsored_applications (account_id);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'jpvbootcamp'
      AND table_name = 'sponsored_grants'
      AND column_name = 'account_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS sponsored_grants_account_id_idx
      ON jpvbootcamp.sponsored_grants (account_id);
  END IF;
END $$;
