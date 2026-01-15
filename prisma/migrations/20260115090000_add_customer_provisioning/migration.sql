-- Add event type for webhook idempotency
DO $$
BEGIN
  IF to_regclass('stripe_webhook_events') IS NOT NULL THEN
    ALTER TABLE "stripe_webhook_events"
    ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'unknown';
  END IF;
END $$;

-- Create provisioning map table
CREATE TABLE IF NOT EXISTS "customer_provisioning" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "stripe_customer_id" TEXT NOT NULL,
    "stripe_subscription_id" TEXT,
    "wp_user_id" INTEGER,
    "current_plan" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_provisioning_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "customer_provisioning_email_key"
  ON "customer_provisioning"("email");

CREATE UNIQUE INDEX IF NOT EXISTS "customer_provisioning_stripe_customer_id_key"
  ON "customer_provisioning"("stripe_customer_id");

CREATE UNIQUE INDEX IF NOT EXISTS "customer_provisioning_stripe_subscription_id_key"
  ON "customer_provisioning"("stripe_subscription_id");
