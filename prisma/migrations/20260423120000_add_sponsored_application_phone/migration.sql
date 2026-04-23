ALTER TABLE IF EXISTS jpvbootcamp.sponsored_applications
ADD COLUMN IF NOT EXISTS phone text NOT NULL DEFAULT '';

UPDATE jpvbootcamp.sponsored_applications
SET phone = COALESCE(phone, '')
WHERE phone IS NULL;
