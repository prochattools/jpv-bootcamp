import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

import { getPayloadMigrationSchemaSqlPrefix } from '../lib/payloadMigrationSchema'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  const schema = getPayloadMigrationSchemaSqlPrefix()
  await db.execute(sql.raw(`
    ALTER TYPE ${schema}."enum_payload_billing_actions_action_type"
      ADD VALUE IF NOT EXISTS 'reconcile_all';

    ALTER TABLE ${schema}."payload_payments"
      ADD COLUMN "invoice_number" varchar,
      ADD COLUMN "hosted_invoice_url" varchar,
      ADD COLUMN "invoice_pdf_url" varchar,
      ADD COLUMN "amount_due" numeric DEFAULT 0 NOT NULL,
      ADD COLUMN "amount_paid" numeric DEFAULT 0 NOT NULL,
      ADD COLUMN "amount_remaining" numeric DEFAULT 0 NOT NULL,
      ADD COLUMN "attempt_count" numeric DEFAULT 0 NOT NULL,
      ADD COLUMN "next_payment_attempt" timestamp(3) with time zone;

    CREATE INDEX "payload_payments_invoice_number_idx"
      ON ${schema}."payload_payments" ("invoice_number");
  `))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  const schema = getPayloadMigrationSchemaSqlPrefix()
  await db.execute(sql.raw(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM ${schema}."payload_billing_actions"
        WHERE "action_type"::text = 'reconcile_all'
      ) THEN
        RAISE EXCEPTION 'billing invoice visibility rollback requires zero reconcile_all action records';
      END IF;
    END $$;

    DROP INDEX IF EXISTS ${schema}."payload_payments_invoice_number_idx";
    ALTER TABLE ${schema}."payload_payments"
      DROP COLUMN IF EXISTS "next_payment_attempt",
      DROP COLUMN IF EXISTS "attempt_count",
      DROP COLUMN IF EXISTS "amount_remaining",
      DROP COLUMN IF EXISTS "amount_paid",
      DROP COLUMN IF EXISTS "amount_due",
      DROP COLUMN IF EXISTS "invoice_pdf_url",
      DROP COLUMN IF EXISTS "hosted_invoice_url",
      DROP COLUMN IF EXISTS "invoice_number";
  `))
}
