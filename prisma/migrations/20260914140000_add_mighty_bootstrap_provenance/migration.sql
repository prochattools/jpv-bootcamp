ALTER TABLE "mighty_access_sync"
  ADD COLUMN "state_source" TEXT NOT NULL DEFAULT 'stripe_webhook',
  ADD COLUMN "state_observed_at" TIMESTAMPTZ(3);

UPDATE "mighty_access_sync"
SET "state_observed_at" = "last_stripe_event_created_at"
WHERE "state_observed_at" IS NULL
  AND "last_stripe_event_created_at" IS NOT NULL;
