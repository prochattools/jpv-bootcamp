ALTER TABLE "tenant_jpvbootcamp"."customer_provisioning"
ADD COLUMN "last_notified_plan" TEXT,
ADD COLUMN "last_notified_at" TIMESTAMP(3),
ADD COLUMN "last_notified_event_id" TEXT;
