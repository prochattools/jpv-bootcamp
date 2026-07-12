-- Create the dedicated durable support-request record required for M1-01.
-- This migration is additive and must remain unapplied until the normal release migration process.
CREATE TABLE IF NOT EXISTS "support_requests" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "normalized_email" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "question" TEXT NOT NULL,
  "source" TEXT,
  "page" TEXT,
  "dedupe_key" TEXT NOT NULL,
  "review_status" TEXT NOT NULL DEFAULT 'pending',
  "notification_status" TEXT NOT NULL DEFAULT 'pending',
  "notification_attempt_count" INTEGER NOT NULL DEFAULT 0,
  "notification_last_attempt_at" TIMESTAMP(3),
  "notification_next_attempt_at" TIMESTAMP(3),
  "notification_last_error_code" TEXT,
  "reviewed_at" TIMESTAMP(3),
  "reviewed_by_account_id" INTEGER,

  CONSTRAINT "support_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "support_requests_dedupe_key_key"
  ON "support_requests"("dedupe_key");

CREATE INDEX IF NOT EXISTS "support_requests_normalized_email_idx"
  ON "support_requests"("normalized_email");

CREATE INDEX IF NOT EXISTS "support_requests_review_status_idx"
  ON "support_requests"("review_status");

CREATE INDEX IF NOT EXISTS "support_requests_notification_status_idx"
  ON "support_requests"("notification_status");

CREATE INDEX IF NOT EXISTS "support_requests_created_at_idx"
  ON "support_requests"("created_at");

COMMENT ON TABLE "support_requests" IS 'Durable support intake records; runtime remains preview-only until the M1-01 workflow packet is completed';
COMMENT ON COLUMN "support_requests"."dedupe_key" IS 'Concurrency-safe idempotency key derived from validated normalized request fields and a bounded window';
COMMENT ON COLUMN "support_requests"."review_status" IS 'Support review lifecycle state; initial value pending';
COMMENT ON COLUMN "support_requests"."notification_status" IS 'Queued-notification lifecycle state; initial value pending';
COMMENT ON COLUMN "support_requests"."notification_attempt_count" IS 'Number of durable notification delivery attempts';
COMMENT ON COLUMN "support_requests"."notification_last_error_code" IS 'Safe machine-readable notification failure code; never raw provider output';

-- Rollback notes (manual, only after the application and runtime workflow are rolled back):
-- DROP INDEX IF EXISTS "support_requests_created_at_idx";
-- DROP INDEX IF EXISTS "support_requests_notification_status_idx";
-- DROP INDEX IF EXISTS "support_requests_review_status_idx";
-- DROP INDEX IF EXISTS "support_requests_normalized_email_idx";
-- DROP INDEX IF EXISTS "support_requests_dedupe_key_key";
-- DROP TABLE IF EXISTS "support_requests";
