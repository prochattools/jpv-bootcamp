ALTER TABLE IF EXISTS tenant_jpvbootcamp.sponsored_seats
ADD COLUMN IF NOT EXISTS reserved_by_application_id uuid,
ADD COLUMN IF NOT EXISTS reserved_at timestamptz;

CREATE INDEX IF NOT EXISTS sponsored_seats_reserved_by_application_id_idx
ON tenant_jpvbootcamp.sponsored_seats (reserved_by_application_id);
