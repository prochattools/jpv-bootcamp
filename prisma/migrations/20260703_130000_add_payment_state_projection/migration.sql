-- Add nullable payment-state projection fields to customer_provisioning.
ALTER TABLE "customer_provisioning"
  ADD COLUMN IF NOT EXISTS "payment_status" TEXT,
  ADD COLUMN IF NOT EXISTS "payment_failed_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "payment_recovered_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "payment_updated_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "payment_last_event_id" TEXT,
  ADD COLUMN IF NOT EXISTS "payment_last_invoice_id" TEXT;

COMMENT ON COLUMN "customer_provisioning"."payment_status" IS 'Latest projected Stripe invoice payment state';
COMMENT ON COLUMN "customer_provisioning"."payment_failed_at" IS 'Most recent projected payment failure time';
COMMENT ON COLUMN "customer_provisioning"."payment_recovered_at" IS 'Most recent recovery time after a projected payment failure';
COMMENT ON COLUMN "customer_provisioning"."payment_updated_at" IS 'Timestamp of the latest payment-state projection';
COMMENT ON COLUMN "customer_provisioning"."payment_last_event_id" IS 'Last Stripe event applied to payment-state projection';
COMMENT ON COLUMN "customer_provisioning"."payment_last_invoice_id" IS 'Last Stripe invoice applied to payment-state projection';
