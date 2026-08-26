-- Add nullable refund and dispute projection fields to customer_provisioning.
ALTER TABLE "customer_provisioning"
  ADD COLUMN IF NOT EXISTS "payment_refunded_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "payment_dispute_status" TEXT,
  ADD COLUMN IF NOT EXISTS "payment_disputed_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "payment_dispute_resolved_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "payment_last_charge_id" TEXT,
  ADD COLUMN IF NOT EXISTS "payment_last_payment_intent_id" TEXT;

COMMENT ON COLUMN "customer_provisioning"."payment_refunded_at" IS 'Most recent projected refund time';
COMMENT ON COLUMN "customer_provisioning"."payment_dispute_status" IS 'Latest Stripe dispute status';
COMMENT ON COLUMN "customer_provisioning"."payment_disputed_at" IS 'Most recent projected dispute-open time';
COMMENT ON COLUMN "customer_provisioning"."payment_dispute_resolved_at" IS 'Most recent projected dispute-resolution time';
COMMENT ON COLUMN "customer_provisioning"."payment_last_charge_id" IS 'Last Stripe charge applied to payment projection';
COMMENT ON COLUMN "customer_provisioning"."payment_last_payment_intent_id" IS 'Last Stripe payment intent applied to payment projection';
