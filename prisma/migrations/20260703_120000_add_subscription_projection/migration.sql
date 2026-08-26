-- Add nullable subscription projection fields to customer_provisioning.
ALTER TABLE "customer_provisioning"
  ADD COLUMN IF NOT EXISTS "stripe_price_id" TEXT,
  ADD COLUMN IF NOT EXISTS "subscription_status" TEXT,
  ADD COLUMN IF NOT EXISTS "subscription_current_period_end" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "subscription_cancel_at_period_end" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "subscription_updated_at" TIMESTAMP(3);

COMMENT ON COLUMN "customer_provisioning"."stripe_price_id" IS 'Stripe price ID from the current subscription item';
COMMENT ON COLUMN "customer_provisioning"."subscription_status" IS 'Exact Stripe subscription status';
COMMENT ON COLUMN "customer_provisioning"."subscription_current_period_end" IS 'Current Stripe billing period end';
COMMENT ON COLUMN "customer_provisioning"."subscription_cancel_at_period_end" IS 'Whether Stripe will cancel at period end';
COMMENT ON COLUMN "customer_provisioning"."subscription_updated_at" IS 'Last successful subscription projection sync';
