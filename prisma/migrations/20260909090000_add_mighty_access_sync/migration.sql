CREATE TABLE "jpvbootcamp"."mighty_access_sync" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "normalized_email" TEXT NOT NULL,
    "stripe_customer_id" TEXT,
    "stripe_subscription_id" TEXT,
    "last_stripe_event_id" TEXT,
    "plan" TEXT,
    "desired_access" TEXT NOT NULL DEFAULT 'DENIED',
    "sync_status" TEXT NOT NULL DEFAULT 'pending',
    "mighty_member_id" TEXT,
    "mighty_purchase_id" TEXT,
    "welcome_required" BOOLEAN NOT NULL DEFAULT false,
    "welcome_sent_at" TIMESTAMPTZ(3),
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "next_attempt_at" TIMESTAMPTZ(3),
    "lease_until" TIMESTAMPTZ(3),
    "last_succeeded_at" TIMESTAMPTZ(3),
    "last_reconciled_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mighty_access_sync_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "mighty_access_sync_normalized_email_key"
  ON "jpvbootcamp"."mighty_access_sync"("normalized_email");

CREATE UNIQUE INDEX "mighty_access_sync_stripe_customer_id_key"
  ON "jpvbootcamp"."mighty_access_sync"("stripe_customer_id");

CREATE UNIQUE INDEX "mighty_access_sync_stripe_subscription_id_key"
  ON "jpvbootcamp"."mighty_access_sync"("stripe_subscription_id");

CREATE INDEX "mighty_access_sync_due_idx"
  ON "jpvbootcamp"."mighty_access_sync"("sync_status", "next_attempt_at");

CREATE INDEX "mighty_access_sync_subscription_idx"
  ON "jpvbootcamp"."mighty_access_sync"("stripe_subscription_id");
