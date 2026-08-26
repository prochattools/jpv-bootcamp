-- Add the requester telephone captured by the public support form.
-- This is nullable so existing support requests remain valid and unchanged.
ALTER TABLE IF EXISTS "support_requests"
  ADD COLUMN IF NOT EXISTS "phone" TEXT;

-- Rollback note: do not drop this column after production data is written.
-- Recovery is restore-based or a forward migration approved by the operator.
