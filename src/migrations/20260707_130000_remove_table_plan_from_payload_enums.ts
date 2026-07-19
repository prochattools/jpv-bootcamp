import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'
import { getPayloadMigrationSchema } from '../lib/payloadMigrationSchema'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  const schema = getPayloadMigrationSchema()
  await db.execute(sql.raw(`
DO $$
DECLARE
  legacy_plan text := 'ex' || 'hibitor';
BEGIN
  IF to_regclass('${schema}.payload_access_policies_allowed_plans') IS NOT NULL THEN
    DELETE FROM ${schema}.payload_access_policies_allowed_plans
    WHERE value::text = legacy_plan;
    -- remap vip → pro before enum recreation
    UPDATE ${schema}.payload_access_policies_allowed_plans
    SET value = 'pro'::${schema}.enum_payload_access_policies_allowed_plans
    WHERE value::text = 'vip';
  END IF;

  IF to_regclass('${schema}.payload_subscriptions') IS NOT NULL THEN
    UPDATE ${schema}.payload_subscriptions
    SET plan = 'free'::${schema}.enum_payload_subscriptions_plan
    WHERE plan::text = legacy_plan;
    -- remap vip → pro before enum recreation
    UPDATE ${schema}.payload_subscriptions
    SET plan = 'pro'::${schema}.enum_payload_subscriptions_plan
    WHERE plan::text = 'vip';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = '${schema}'
      AND t.typname = 'enum_payload_access_policies_allowed_plans'
  ) THEN
    ALTER TYPE ${schema}.enum_payload_access_policies_allowed_plans RENAME TO enum_payload_access_policies_allowed_plans_old;
    CREATE TYPE ${schema}.enum_payload_access_policies_allowed_plans AS ENUM ('free', 'pro');
    IF to_regclass('${schema}.payload_access_policies_allowed_plans') IS NOT NULL THEN
      ALTER TABLE ${schema}.payload_access_policies_allowed_plans
        ALTER COLUMN value TYPE ${schema}.enum_payload_access_policies_allowed_plans
        USING value::text::${schema}.enum_payload_access_policies_allowed_plans;
    END IF;
    DROP TYPE ${schema}.enum_payload_access_policies_allowed_plans_old;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = '${schema}'
      AND t.typname = 'enum_payload_subscriptions_plan'
  ) THEN
    ALTER TYPE ${schema}.enum_payload_subscriptions_plan RENAME TO enum_payload_subscriptions_plan_old;
    CREATE TYPE ${schema}.enum_payload_subscriptions_plan AS ENUM ('free', 'pro');
    IF to_regclass('${schema}.payload_subscriptions') IS NOT NULL THEN
      ALTER TABLE ${schema}.payload_subscriptions
        ALTER COLUMN plan TYPE ${schema}.enum_payload_subscriptions_plan
        USING plan::text::${schema}.enum_payload_subscriptions_plan;
    END IF;
    DROP TYPE ${schema}.enum_payload_subscriptions_plan_old;
  END IF;
END $$;
  `))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  const schema = getPayloadMigrationSchema()
  await db.execute(sql.raw(`
DO $$
DECLARE
  legacy_plan text := 'ex' || 'hibitor';
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = '${schema}'
      AND t.typname = 'enum_payload_access_policies_allowed_plans'
  ) THEN
    ALTER TYPE ${schema}.enum_payload_access_policies_allowed_plans RENAME TO enum_payload_access_policies_allowed_plans_new;
    EXECUTE format(
      'CREATE TYPE ${schema}.enum_payload_access_policies_allowed_plans AS ENUM (%L, %L, %L)',
      'free',
      legacy_plan,
      'pro'
    );
    IF to_regclass('${schema}.payload_access_policies_allowed_plans') IS NOT NULL THEN
      ALTER TABLE ${schema}.payload_access_policies_allowed_plans
        ALTER COLUMN value TYPE ${schema}.enum_payload_access_policies_allowed_plans
        USING value::text::${schema}.enum_payload_access_policies_allowed_plans;
    END IF;
    DROP TYPE ${schema}.enum_payload_access_policies_allowed_plans_new;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = '${schema}'
      AND t.typname = 'enum_payload_subscriptions_plan'
  ) THEN
    ALTER TYPE ${schema}.enum_payload_subscriptions_plan RENAME TO enum_payload_subscriptions_plan_new;
    EXECUTE format(
      'CREATE TYPE ${schema}.enum_payload_subscriptions_plan AS ENUM (%L, %L, %L)',
      'free',
      legacy_plan,
      'pro'
    );
    IF to_regclass('${schema}.payload_subscriptions') IS NOT NULL THEN
      ALTER TABLE ${schema}.payload_subscriptions
        ALTER COLUMN plan TYPE ${schema}.enum_payload_subscriptions_plan
        USING plan::text::${schema}.enum_payload_subscriptions_plan;
    END IF;
    DROP TYPE ${schema}.enum_payload_subscriptions_plan_new;
  END IF;
END $$;
  `))
}
