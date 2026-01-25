ALTER TABLE IF EXISTS tenant_jpvbootcamp.sponsored_applications
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now(),
ADD COLUMN IF NOT EXISTS last_admin_email_sent_at timestamptz;

UPDATE tenant_jpvbootcamp.sponsored_applications
SET updated_at = COALESCE(updated_at, created_at)
WHERE updated_at IS NULL;
