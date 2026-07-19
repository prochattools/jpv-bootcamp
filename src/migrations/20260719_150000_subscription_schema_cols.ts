import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'
import { getPayloadMigrationSchemaSqlPrefix } from '../lib/payloadMigrationSchema'

export async function up({ db }: MigrateUpArgs): Promise<void> {
	const schema = getPayloadMigrationSchemaSqlPrefix()

	await db.execute(sql.raw(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = trim('"' FROM '${schema}')
          AND t.typname = 'enum_payload_subscriptions_billing_cadence'
      ) THEN
        CREATE TYPE ${schema}."enum_payload_subscriptions_billing_cadence"
          AS ENUM ('monthly_commitment', 'annual');
      END IF;
    END $$;

    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = trim('"' FROM '${schema}')
          AND t.typname = 'enum_payload_subscriptions_commitment_status'
      ) THEN
        CREATE TYPE ${schema}."enum_payload_subscriptions_commitment_status"
          AS ENUM ('pending', 'active', 'cancellation_requested', 'completed', 'terminated');
      END IF;
    END $$;

    ALTER TABLE ${schema}."payload_subscriptions"
      ADD COLUMN IF NOT EXISTS "stripe_subscription_schedule_id" varchar,
      ADD COLUMN IF NOT EXISTS "billing_cadence"
        ${schema}."enum_payload_subscriptions_billing_cadence",
      ADD COLUMN IF NOT EXISTS "commitment_status"
        ${schema}."enum_payload_subscriptions_commitment_status",
      ADD COLUMN IF NOT EXISTS "commitment_start_at" timestamp(3) with time zone,
      ADD COLUMN IF NOT EXISTS "commitment_end_at" timestamp(3) with time zone,
      ADD COLUMN IF NOT EXISTS "cancellation_effective_at" timestamp(3) with time zone,
      ADD COLUMN IF NOT EXISTS "payment_grace_ends_at" timestamp(3) with time zone;

    CREATE UNIQUE INDEX IF NOT EXISTS
      "payload_subscriptions_stripe_subscription_schedule_id_idx"
      ON ${schema}."payload_subscriptions" ("stripe_subscription_schedule_id");
  `))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
	const schema = getPayloadMigrationSchemaSqlPrefix()

	await db.execute(sql.raw(`
    DROP INDEX IF EXISTS ${schema}."payload_subscriptions_stripe_subscription_schedule_id_idx";

    ALTER TABLE ${schema}."payload_subscriptions"
      DROP COLUMN IF EXISTS "stripe_subscription_schedule_id",
      DROP COLUMN IF EXISTS "billing_cadence",
      DROP COLUMN IF EXISTS "commitment_status",
      DROP COLUMN IF EXISTS "commitment_start_at",
      DROP COLUMN IF EXISTS "commitment_end_at",
      DROP COLUMN IF EXISTS "cancellation_effective_at",
      DROP COLUMN IF EXISTS "payment_grace_ends_at";

    DROP TYPE IF EXISTS ${schema}."enum_payload_subscriptions_commitment_status";
    DROP TYPE IF EXISTS ${schema}."enum_payload_subscriptions_billing_cadence";
  `))
}
