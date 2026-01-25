ALTER TABLE IF EXISTS tenant_jpvbootcamp.sponsored_applications
ADD COLUMN IF NOT EXISTS email text;
