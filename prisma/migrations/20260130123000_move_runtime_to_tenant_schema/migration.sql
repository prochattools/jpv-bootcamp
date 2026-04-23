-- Move runtime tables from public -> tenant schema (if still present)
DO $$
BEGIN
  IF to_regclass('public."Audiences"') IS NOT NULL THEN
    IF to_regclass('jpvbootcamp."Audiences"') IS NOT NULL THEN
      INSERT INTO "jpvbootcamp"."Audiences" ("id", "resend_id", "name")
      SELECT "id", "resend_id", "name" FROM "public"."Audiences"
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public."Project"') IS NOT NULL THEN
    IF to_regclass('jpvbootcamp."Project"') IS NOT NULL THEN
      INSERT INTO "jpvbootcamp"."Project" (
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
    IF to_regclass('jpvbootcamp."Subscription"') IS NOT NULL THEN
      INSERT INTO "jpvbootcamp"."Subscription" (
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
        "sub_status"::text::"jpvbootcamp"."SubscriptionStatus",
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
    IF to_regclass('jpvbootcamp."email_subscribers"') IS NOT NULL THEN
      INSERT INTO "jpvbootcamp"."email_subscribers" (
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
  IF to_regclass('jpvbootcamp."stripe_webhook_events"') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
        FROM information_schema.columns
       WHERE table_schema = 'jpvbootcamp'
         AND table_name = 'stripe_webhook_events'
         AND column_name = 'received_at'
    ) THEN
      IF EXISTS (
        SELECT 1
          FROM information_schema.columns
         WHERE table_schema = 'jpvbootcamp'
           AND table_name = 'stripe_webhook_events'
           AND column_name = 'created_at'
      ) THEN
        ALTER TABLE "jpvbootcamp"."stripe_webhook_events"
          RENAME COLUMN "created_at" TO "received_at";
      ELSE
        ALTER TABLE "jpvbootcamp"."stripe_webhook_events"
          ADD COLUMN "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
      END IF;
    END IF;

    IF NOT EXISTS (
      SELECT 1
        FROM information_schema.columns
       WHERE table_schema = 'jpvbootcamp'
         AND table_name = 'stripe_webhook_events'
         AND column_name = 'type'
    ) THEN
      ALTER TABLE "jpvbootcamp"."stripe_webhook_events"
        ADD COLUMN "type" TEXT NOT NULL DEFAULT 'unknown';
    END IF;

    IF NOT EXISTS (
      SELECT 1
        FROM information_schema.columns
       WHERE table_schema = 'jpvbootcamp'
         AND table_name = 'stripe_webhook_events'
         AND column_name = 'livemode'
    ) THEN
      ALTER TABLE "jpvbootcamp"."stripe_webhook_events"
        ADD COLUMN "livemode" BOOLEAN NOT NULL DEFAULT false;
    END IF;

    IF NOT EXISTS (
      SELECT 1
        FROM information_schema.columns
       WHERE table_schema = 'jpvbootcamp'
         AND table_name = 'stripe_webhook_events'
         AND column_name = 'processed_at'
    ) THEN
      ALTER TABLE "jpvbootcamp"."stripe_webhook_events"
        ADD COLUMN "processed_at" TIMESTAMP(3);
    END IF;

    IF NOT EXISTS (
      SELECT 1
        FROM information_schema.columns
       WHERE table_schema = 'jpvbootcamp'
         AND table_name = 'stripe_webhook_events'
         AND column_name = 'payload'
    ) THEN
      ALTER TABLE "jpvbootcamp"."stripe_webhook_events"
        ADD COLUMN "payload" JSONB;
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public."stripe_webhook_events"') IS NOT NULL THEN
    IF to_regclass('jpvbootcamp."stripe_webhook_events"') IS NOT NULL THEN
      IF EXISTS (
        SELECT 1
          FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'stripe_webhook_events'
           AND column_name = 'received_at'
      ) THEN
        INSERT INTO "jpvbootcamp"."stripe_webhook_events" (
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
        INSERT INTO "jpvbootcamp"."stripe_webhook_events" (
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
     WHERE n.nspname = 'jpvbootcamp'
       AND t.typname = 'SubscriptionStatus'
  ) THEN
    CREATE TYPE "jpvbootcamp"."SubscriptionStatus" AS ENUM ('active', 'inactive');
  END IF;

  IF to_regclass('jpvbootcamp."Subscription"') IS NOT NULL THEN
    ALTER TABLE "jpvbootcamp"."Subscription"
      ALTER COLUMN "sub_status"
      TYPE "jpvbootcamp"."SubscriptionStatus"
      USING "sub_status"::text::"jpvbootcamp"."SubscriptionStatus";
  END IF;
END $$;
