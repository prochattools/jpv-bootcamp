-- Move runtime tables from public -> tenant schema (if still present)
DO $$
BEGIN
  IF to_regclass('public."Audiences"') IS NOT NULL THEN
    IF to_regclass('tenant_jpvbootcamp."Audiences"') IS NOT NULL THEN
      INSERT INTO "tenant_jpvbootcamp"."Audiences" ("id", "resend_id", "name")
      SELECT "id", "resend_id", "name" FROM "public"."Audiences"
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public."Project"') IS NOT NULL THEN
    IF to_regclass('tenant_jpvbootcamp."Project"') IS NOT NULL THEN
      INSERT INTO "tenant_jpvbootcamp"."Project" (
        "id",
        "connection_id",
        "webhook_id",
        "scenario_id",
        "user_clerk_id",
        "type",
        "status",
        "createdAt",
        "updatedAt",
        "assistant_id",
        "webhookLink"
      )
      SELECT
        "id",
        "connection_id",
        "webhook_id",
        "scenario_id",
        "user_clerk_id",
        "type",
        "status",
        "createdAt",
        "updatedAt",
        "assistant_id",
        "webhookLink"
      FROM "public"."Project"
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public."Subscription"') IS NOT NULL THEN
    IF to_regclass('tenant_jpvbootcamp."Subscription"') IS NOT NULL THEN
      INSERT INTO "tenant_jpvbootcamp"."Subscription" (
        "id",
        "user_email",
        "sub_status",
        "sub_type",
        "createdAt",
        "updatedAt",
        "last_stripe_cs_id",
        "stripe_customer_id",
        "sub_stripe_id",
        "user_clerk_id"
      )
      SELECT
        "id",
        "user_email",
        "sub_status"::text::"tenant_jpvbootcamp"."SubscriptionStatus",
        "sub_type",
        "createdAt",
        "updatedAt",
        "last_stripe_cs_id",
        "stripe_customer_id",
        "sub_stripe_id",
        "user_clerk_id"
      FROM "public"."Subscription"
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public."email_subscribers"') IS NOT NULL THEN
    IF to_regclass('tenant_jpvbootcamp."email_subscribers"') IS NOT NULL THEN
      INSERT INTO "tenant_jpvbootcamp"."email_subscribers" (
        "id",
        "email",
        "name",
        "source",
        "createdAt",
        "updatedAt"
      )
      SELECT
        "id",
        "email",
        "name",
        "source",
        "createdAt",
        "updatedAt"
      FROM "public"."email_subscribers"
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
END $$;

-- Ensure stripe_webhook_events matches Prisma schema before copying data
DO $$
BEGIN
  IF to_regclass('tenant_jpvbootcamp."stripe_webhook_events"') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
        FROM information_schema.columns
       WHERE table_schema = 'tenant_jpvbootcamp'
         AND table_name = 'stripe_webhook_events'
         AND column_name = 'received_at'
    ) THEN
      IF EXISTS (
        SELECT 1
          FROM information_schema.columns
         WHERE table_schema = 'tenant_jpvbootcamp'
           AND table_name = 'stripe_webhook_events'
           AND column_name = 'created_at'
      ) THEN
        ALTER TABLE "tenant_jpvbootcamp"."stripe_webhook_events"
          RENAME COLUMN "created_at" TO "received_at";
      ELSE
        ALTER TABLE "tenant_jpvbootcamp"."stripe_webhook_events"
          ADD COLUMN "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
      END IF;
    END IF;

    IF NOT EXISTS (
      SELECT 1
        FROM information_schema.columns
       WHERE table_schema = 'tenant_jpvbootcamp'
         AND table_name = 'stripe_webhook_events'
         AND column_name = 'type'
    ) THEN
      ALTER TABLE "tenant_jpvbootcamp"."stripe_webhook_events"
        ADD COLUMN "type" TEXT NOT NULL DEFAULT 'unknown';
    END IF;

    IF NOT EXISTS (
      SELECT 1
        FROM information_schema.columns
       WHERE table_schema = 'tenant_jpvbootcamp'
         AND table_name = 'stripe_webhook_events'
         AND column_name = 'livemode'
    ) THEN
      ALTER TABLE "tenant_jpvbootcamp"."stripe_webhook_events"
        ADD COLUMN "livemode" BOOLEAN NOT NULL DEFAULT false;
    END IF;

    IF NOT EXISTS (
      SELECT 1
        FROM information_schema.columns
       WHERE table_schema = 'tenant_jpvbootcamp'
         AND table_name = 'stripe_webhook_events'
         AND column_name = 'processed_at'
    ) THEN
      ALTER TABLE "tenant_jpvbootcamp"."stripe_webhook_events"
        ADD COLUMN "processed_at" TIMESTAMP(3);
    END IF;

    IF NOT EXISTS (
      SELECT 1
        FROM information_schema.columns
       WHERE table_schema = 'tenant_jpvbootcamp'
         AND table_name = 'stripe_webhook_events'
         AND column_name = 'payload'
    ) THEN
      ALTER TABLE "tenant_jpvbootcamp"."stripe_webhook_events"
        ADD COLUMN "payload" JSONB;
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public."stripe_webhook_events"') IS NOT NULL THEN
    IF to_regclass('tenant_jpvbootcamp."stripe_webhook_events"') IS NOT NULL THEN
      IF EXISTS (
        SELECT 1
          FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'stripe_webhook_events'
           AND column_name = 'received_at'
      ) THEN
        INSERT INTO "tenant_jpvbootcamp"."stripe_webhook_events" (
          "event_id",
          "received_at",
          "type",
          "livemode",
          "processed_at",
          "payload"
        )
        SELECT
          "event_id",
          "received_at",
          'unknown',
          false,
          NULL,
          NULL
        FROM "public"."stripe_webhook_events"
        ON CONFLICT DO NOTHING;
      ELSE
        INSERT INTO "tenant_jpvbootcamp"."stripe_webhook_events" (
          "event_id",
          "received_at",
          "type",
          "livemode",
          "processed_at",
          "payload"
        )
        SELECT
          "event_id",
          "created_at",
          'unknown',
          false,
          NULL,
          NULL
        FROM "public"."stripe_webhook_events"
        ON CONFLICT DO NOTHING;
      END IF;
    END IF;
  END IF;
END $$;

-- Ensure SubscriptionStatus enum lives in tenant schema
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_type t
      JOIN pg_namespace n ON n.oid = t.typnamespace
     WHERE n.nspname = 'tenant_jpvbootcamp'
       AND t.typname = 'SubscriptionStatus'
  ) THEN
    CREATE TYPE "tenant_jpvbootcamp"."SubscriptionStatus" AS ENUM ('active', 'inactive');
  END IF;

  IF to_regclass('tenant_jpvbootcamp."Subscription"') IS NOT NULL THEN
    ALTER TABLE "tenant_jpvbootcamp"."Subscription"
      ALTER COLUMN "sub_status"
      TYPE "tenant_jpvbootcamp"."SubscriptionStatus"
      USING "sub_status"::text::"tenant_jpvbootcamp"."SubscriptionStatus";
  END IF;
END $$;
