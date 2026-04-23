-- Add event type for webhook idempotency
DO $$
BEGIN
  IF to_regclass('jpvbootcamp.stripe_webhook_events') IS NOT NULL THEN
    ALTER TABLE "jpvbootcamp"."stripe_webhook_events"
    ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'unknown';
  END IF;
END $$;

-- Create provisioning map table
CREATE TABLE IF NOT EXISTS "jpvbootcamp"."customer_provisioning" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "normalized_email" TEXT NOT NULL,
    "stripe_customer_id" TEXT NOT NULL,
    "stripe_subscription_id" TEXT,
    "wp_user_id" INTEGER,
    "plan" TEXT,
    "current_plan" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "last_event_id" TEXT,
    "last_notified_plan" TEXT,
    "last_notified_at" TIMESTAMP(3),
    "last_notified_event_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_provisioning_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "customer_provisioning_normalized_email_key"
  ON "jpvbootcamp"."customer_provisioning"("normalized_email");

CREATE UNIQUE INDEX IF NOT EXISTS "customer_provisioning_stripe_customer_id_key"
  ON "jpvbootcamp"."customer_provisioning"("stripe_customer_id");

CREATE UNIQUE INDEX IF NOT EXISTS "customer_provisioning_stripe_subscription_id_key"
  ON "jpvbootcamp"."customer_provisioning"("stripe_subscription_id");
