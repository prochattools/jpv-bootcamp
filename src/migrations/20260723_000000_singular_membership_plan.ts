import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'
import { getPayloadMigrationSchema } from '../lib/payloadMigrationSchema'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  const schema = getPayloadMigrationSchema()
  await db.execute(sql.raw(`
DO $$
BEGIN
  -- Add jpv_bootcamp_membership to subscription plan enum (idempotent)
  IF EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = '${schema}'
      AND t.typname = 'enum_payload_subscriptions_plan'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = '${schema}'
      AND t.typname = 'enum_payload_subscriptions_plan'
      AND e.enumlabel = 'jpv_bootcamp_membership'
  ) THEN
    ALTER TYPE ${schema}.enum_payload_subscriptions_plan ADD VALUE 'jpv_bootcamp_membership';
  END IF;

  -- Migrate existing pro subscriptions to jpv_bootcamp_membership (staging only: 0 or 1 rows)
  IF to_regclass('${schema}.payload_subscriptions') IS NOT NULL THEN
    UPDATE ${schema}.payload_subscriptions
    SET plan = 'jpv_bootcamp_membership'::${schema}.enum_payload_subscriptions_plan
    WHERE plan::text = 'pro';
  END IF;

  -- Drop allowedPlans join table and enum — no longer used by AccessControl collection
  IF to_regclass('${schema}.payload_access_policies_allowed_plans') IS NOT NULL THEN
    DROP TABLE ${schema}.payload_access_policies_allowed_plans CASCADE;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = '${schema}'
      AND t.typname = 'enum_payload_access_policies_allowed_plans'
  ) THEN
    DROP TYPE ${schema}.enum_payload_access_policies_allowed_plans;
  END IF;
END $$;
  `))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  const schema = getPayloadMigrationSchema()
  await db.execute(sql.raw(`
DO $$
BEGIN
  -- Revert jpv_bootcamp_membership subscriptions to pro (best-effort)
  IF to_regclass('${schema}.payload_subscriptions') IS NOT NULL THEN
    UPDATE ${schema}.payload_subscriptions
    SET plan = 'pro'::${schema}.enum_payload_subscriptions_plan
    WHERE plan::text = 'jpv_bootcamp_membership';
  END IF;

  -- Recreate allowedPlans enum and table (empty — data is not recoverable)
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = '${schema}'
      AND t.typname = 'enum_payload_access_policies_allowed_plans'
  ) THEN
    CREATE TYPE ${schema}.enum_payload_access_policies_allowed_plans AS ENUM ('free', 'pro');
  END IF;

  IF to_regclass('${schema}.payload_access_policies_allowed_plans') IS NULL THEN
    CREATE TABLE ${schema}.payload_access_policies_allowed_plans (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" text PRIMARY KEY,
      "value" ${schema}.enum_payload_access_policies_allowed_plans
    );
  END IF;
END $$;
  `))
}
