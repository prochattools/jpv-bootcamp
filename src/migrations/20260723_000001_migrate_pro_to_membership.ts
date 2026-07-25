import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

import { getPayloadMigrationSchema } from '../lib/payloadMigrationSchema'

/**
 * Uses the enum value committed by 20260723_000000, then removes the obsolete
 * allowed-plans join table and enum only after the subscription update succeeds.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  const schema = getPayloadMigrationSchema()

  await db.execute(sql.raw(`
DO $$
BEGIN
  IF to_regclass('${schema}.payload_subscriptions') IS NOT NULL THEN
    UPDATE ${schema}.payload_subscriptions
    SET plan = 'jpv_bootcamp_membership'::${schema}.enum_payload_subscriptions_plan
    WHERE plan::text = 'pro';
  END IF;

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

/**
 * Reverses subscription data first, then recreates the empty legacy access
 * policy objects. Historical join-table rows are not recoverable.
 */
export async function down({ db }: MigrateDownArgs): Promise<void> {
  const schema = getPayloadMigrationSchema()

  await db.execute(sql.raw(`
DO $$
BEGIN
  IF to_regclass('${schema}.payload_subscriptions') IS NOT NULL THEN
    UPDATE ${schema}.payload_subscriptions
    SET plan = 'pro'::${schema}.enum_payload_subscriptions_plan
    WHERE plan::text = 'jpv_bootcamp_membership';
  END IF;

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
