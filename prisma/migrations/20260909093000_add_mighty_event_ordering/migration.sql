ALTER TABLE "jpvbootcamp"."mighty_access_sync"
  ADD COLUMN "last_stripe_event_created_at" TIMESTAMPTZ(3),
  ADD COLUMN "last_stripe_event_type" TEXT;
