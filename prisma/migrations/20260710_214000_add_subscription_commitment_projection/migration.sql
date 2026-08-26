-- Add nullable Stripe commitment, consent, grace, and cancellation projection fields.
ALTER TABLE "customer_provisioning"
  ADD COLUMN IF NOT EXISTS "stripe_subscription_schedule_id" TEXT,
  ADD COLUMN IF NOT EXISTS "stripe_checkout_session_id" TEXT,
  ADD COLUMN IF NOT EXISTS "billing_cadence" TEXT,
  ADD COLUMN IF NOT EXISTS "commitment_status" TEXT,
  ADD COLUMN IF NOT EXISTS "commitment_start_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "commitment_end_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "cancellation_requested_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "cancellation_effective_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "payment_grace_ends_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "last_paid_invoice_id" TEXT,
  ADD COLUMN IF NOT EXISTS "last_payment_failure_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "contract_version" TEXT,
  ADD COLUMN IF NOT EXISTS "contract_accepted_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "immediate_access_consent_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "early_termination_reason" TEXT,
  ADD COLUMN IF NOT EXISTS "early_termination_approved_by" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "customer_provisioning_stripe_subscription_schedule_id_key"
  ON "customer_provisioning"("stripe_subscription_schedule_id");

CREATE UNIQUE INDEX IF NOT EXISTS "customer_provisioning_stripe_checkout_session_id_key"
  ON "customer_provisioning"("stripe_checkout_session_id");

COMMENT ON COLUMN "customer_provisioning"."stripe_subscription_schedule_id" IS 'Stripe Subscription Schedule authoritative for the commitment phase';
COMMENT ON COLUMN "customer_provisioning"."stripe_checkout_session_id" IS 'Checkout Session authoritative for initial contract acceptance';
COMMENT ON COLUMN "customer_provisioning"."billing_cadence" IS 'Projected billing cadence: monthly_commitment or annual';
COMMENT ON COLUMN "customer_provisioning"."commitment_status" IS 'Projected commitment lifecycle state';
COMMENT ON COLUMN "customer_provisioning"."commitment_start_at" IS 'Authoritative commitment phase start mirrored from Stripe';
COMMENT ON COLUMN "customer_provisioning"."commitment_end_at" IS 'Authoritative commitment phase end mirrored from Stripe';
COMMENT ON COLUMN "customer_provisioning"."cancellation_requested_at" IS 'Customer cancellation request timestamp';
COMMENT ON COLUMN "customer_provisioning"."cancellation_effective_at" IS 'Approved cancellation effective timestamp';
COMMENT ON COLUMN "customer_provisioning"."payment_grace_ends_at" IS 'Seven-day payment grace deadline';
COMMENT ON COLUMN "customer_provisioning"."last_paid_invoice_id" IS 'Last verified paid Stripe invoice';
COMMENT ON COLUMN "customer_provisioning"."last_payment_failure_at" IS 'Most recent verified payment failure';
COMMENT ON COLUMN "customer_provisioning"."contract_version" IS 'Accepted contract version';
COMMENT ON COLUMN "customer_provisioning"."contract_accepted_at" IS 'Contract acknowledgment timestamp';
COMMENT ON COLUMN "customer_provisioning"."immediate_access_consent_at" IS 'Immediate-access request timestamp';
COMMENT ON COLUMN "customer_provisioning"."early_termination_reason" IS 'Approved exceptional termination reason code';
COMMENT ON COLUMN "customer_provisioning"."early_termination_approved_by" IS 'Audited administrator approval reference';

-- Rollback notes (manual, only after application rollback):
-- DROP INDEX IF EXISTS "customer_provisioning_stripe_subscription_schedule_id_key";
-- DROP INDEX IF EXISTS "customer_provisioning_stripe_checkout_session_id_key";
-- ALTER TABLE "customer_provisioning" DROP COLUMN IF EXISTS each column added above.
