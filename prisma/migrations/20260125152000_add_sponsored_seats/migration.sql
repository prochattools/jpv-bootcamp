-- Sponsored seats, applications, and grants (jpvbootcamp)
CREATE TABLE IF NOT EXISTS jpvbootcamp.sponsored_seats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  tier text NOT NULL,
  stripe_payment_intent_id text NOT NULL UNIQUE,
  stripe_checkout_session_id text NOT NULL UNIQUE,
  donated_by_email_hash text NULL,
  claimed_by_wp_user_id integer NULL,
  claimed_at timestamptz NULL,
  CONSTRAINT sponsored_seats_tier_check CHECK (tier IN ('pro', 'vip'))
);

CREATE INDEX IF NOT EXISTS sponsored_seats_claimed_by_wp_user_id_idx
  ON jpvbootcamp.sponsored_seats (claimed_by_wp_user_id);

CREATE INDEX IF NOT EXISTS sponsored_seats_created_at_idx
  ON jpvbootcamp.sponsored_seats (created_at);

CREATE TABLE IF NOT EXISTS jpvbootcamp.sponsored_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL,
  wp_user_id integer NOT NULL,
  email_hash text NOT NULL,
  name text NOT NULL,
  message text NULL,
  reviewed_by_wp_user_id integer NULL,
  reviewed_at timestamptz NULL,
  decision_note text NULL,
  CONSTRAINT sponsored_applications_status_check CHECK (status IN ('pending', 'approved', 'rejected'))
);

CREATE INDEX IF NOT EXISTS sponsored_applications_status_idx
  ON jpvbootcamp.sponsored_applications (status);

CREATE INDEX IF NOT EXISTS sponsored_applications_wp_user_id_idx
  ON jpvbootcamp.sponsored_applications (wp_user_id);

CREATE TABLE IF NOT EXISTS jpvbootcamp.sponsored_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  wp_user_id integer NOT NULL,
  tier text NOT NULL,
  seat_id uuid NOT NULL REFERENCES jpvbootcamp.sponsored_seats(id),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  revoked_at timestamptz NULL,
  CONSTRAINT sponsored_grants_tier_check CHECK (tier IN ('pro', 'vip'))
);

CREATE INDEX IF NOT EXISTS sponsored_grants_wp_user_id_idx
  ON jpvbootcamp.sponsored_grants (wp_user_id);

CREATE INDEX IF NOT EXISTS sponsored_grants_ends_at_idx
  ON jpvbootcamp.sponsored_grants (ends_at);
