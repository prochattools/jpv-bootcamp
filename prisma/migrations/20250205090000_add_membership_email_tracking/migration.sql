DO $$
BEGIN
  IF to_regclass('jpvbootcamp.customer_provisioning') IS NOT NULL THEN
    ALTER TABLE "jpvbootcamp"."customer_provisioning"
      ADD COLUMN IF NOT EXISTS "last_notified_plan" TEXT,
      ADD COLUMN IF NOT EXISTS "last_notified_at" TIMESTAMP(3),
      ADD COLUMN IF NOT EXISTS "last_notified_event_id" TEXT;
  END IF;
END $$;
