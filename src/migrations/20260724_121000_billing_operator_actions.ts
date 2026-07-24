import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

import { getPayloadMigrationSchemaSqlPrefix } from '../lib/payloadMigrationSchema'

const addedActionTypes = [
  'sync_subscription',
  'cancel_at_period_end',
  'resume_subscription',
  'payment_refunded',
  'payment_disputed',
  'dispute_resolved',
] as const

export async function up({ db }: MigrateUpArgs): Promise<void> {
  const schema = getPayloadMigrationSchemaSqlPrefix()

  for (const actionType of addedActionTypes) {
    await db.execute(sql.raw(`
      ALTER TYPE ${schema}."enum_payload_billing_actions_action_type"
        ADD VALUE IF NOT EXISTS '${actionType}';
    `))
  }

  await db.execute(sql.raw(`
    ALTER TABLE ${schema}."payload_billing_actions"
      ADD COLUMN "subscription_id" integer,
      ADD COLUMN "requested_by_id" integer,
      ADD COLUMN "completed_at" timestamp(3) with time zone,
      ADD COLUMN "result" jsonb;

    ALTER TABLE ${schema}."payload_billing_actions"
      ADD CONSTRAINT "payload_billing_actions_subscription_id_payload_subscriptions_id_fk"
      FOREIGN KEY ("subscription_id") REFERENCES ${schema}."payload_subscriptions"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION;

    ALTER TABLE ${schema}."payload_billing_actions"
      ADD CONSTRAINT "payload_billing_actions_requested_by_id_payload_users_id_fk"
      FOREIGN KEY ("requested_by_id") REFERENCES ${schema}."payload_users"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION;

    CREATE INDEX "payload_billing_actions_subscription_idx"
      ON ${schema}."payload_billing_actions" ("subscription_id");
    CREATE INDEX "payload_billing_actions_requested_by_idx"
      ON ${schema}."payload_billing_actions" ("requested_by_id");
  `))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  const schema = getPayloadMigrationSchemaSqlPrefix()

  await db.execute(sql.raw(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM ${schema}."payload_billing_actions"
        WHERE "action_type"::text IN (
          'sync_subscription',
          'cancel_at_period_end',
          'resume_subscription',
          'payment_refunded',
          'payment_disputed',
          'dispute_resolved'
        )
      ) THEN
        RAISE EXCEPTION 'billing_operator_actions rollback requires zero records using added action types';
      END IF;
    END $$;

    DROP INDEX IF EXISTS ${schema}."payload_billing_actions_requested_by_idx";
    DROP INDEX IF EXISTS ${schema}."payload_billing_actions_subscription_idx";
    ALTER TABLE ${schema}."payload_billing_actions"
      DROP CONSTRAINT IF EXISTS "payload_billing_actions_requested_by_id_payload_users_id_fk",
      DROP CONSTRAINT IF EXISTS "payload_billing_actions_subscription_id_payload_subscriptions_id_fk",
      DROP COLUMN IF EXISTS "result",
      DROP COLUMN IF EXISTS "completed_at",
      DROP COLUMN IF EXISTS "requested_by_id",
      DROP COLUMN IF EXISTS "subscription_id";

    ALTER TABLE ${schema}."payload_billing_actions"
      ALTER COLUMN "action_type" TYPE varchar USING "action_type"::text;
    DROP TYPE ${schema}."enum_payload_billing_actions_action_type";
    CREATE TYPE ${schema}."enum_payload_billing_actions_action_type" AS ENUM(
      'checkout_completed',
      'subscription_created',
      'subscription_updated',
      'subscription_canceled',
      'payment_succeeded',
      'payment_failed',
      'access_blocked',
      'access_restored'
    );
    ALTER TABLE ${schema}."payload_billing_actions"
      ALTER COLUMN "action_type" TYPE ${schema}."enum_payload_billing_actions_action_type"
      USING "action_type"::${schema}."enum_payload_billing_actions_action_type";
  `))
}
