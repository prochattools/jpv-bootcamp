import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'
import { getPayloadMigrationSchemaSqlPrefix } from '../lib/payloadMigrationSchema'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  const schema = getPayloadMigrationSchemaSqlPrefix()
  await db.execute(sql.raw(`
-- Make legacy-required columns nullable to support automated seat records
ALTER TABLE ${schema}."payload_pay_it_forward_funding"
  ALTER COLUMN "support_id" DROP NOT NULL,
  ALTER COLUMN "member_id" DROP NOT NULL,
  ALTER COLUMN "member_email" DROP NOT NULL,
  ALTER COLUMN "donor_name" DROP NOT NULL,
  ALTER COLUMN "allocated_amount_minor" DROP NOT NULL,
  ALTER COLUMN "approval_reference" DROP NOT NULL,
  ALTER COLUMN "reason" DROP NOT NULL;

-- Add seat-tracking columns
ALTER TABLE ${schema}."payload_pay_it_forward_funding"
  ADD COLUMN "sponsor_email" varchar,
  ADD COLUMN "stripe_checkout_session_id" varchar,
  ADD COLUMN "stripe_payment_intent_id" varchar,
  ADD COLUMN "amount_paid_minor" integer,
  ADD COLUMN "purchased_at" timestamp(3) with time zone,
  ADD COLUMN "seat_status" varchar DEFAULT 'available',
  ADD COLUMN "redeemed_by_name" varchar,
  ADD COLUMN "redeemed_by_email" varchar;

CREATE INDEX "payload_pay_it_forward_funding_sponsor_email_idx" ON ${schema}."payload_pay_it_forward_funding" USING btree ("sponsor_email");
CREATE INDEX "payload_pay_it_forward_funding_stripe_checkout_session_id_idx" ON ${schema}."payload_pay_it_forward_funding" USING btree ("stripe_checkout_session_id");
CREATE INDEX "payload_pay_it_forward_funding_stripe_payment_intent_id_idx" ON ${schema}."payload_pay_it_forward_funding" USING btree ("stripe_payment_intent_id");
CREATE INDEX "payload_pay_it_forward_funding_seat_status_idx" ON ${schema}."payload_pay_it_forward_funding" USING btree ("seat_status");
CREATE INDEX "payload_pay_it_forward_funding_purchased_at_idx" ON ${schema}."payload_pay_it_forward_funding" USING btree ("purchased_at");

-- Create PayItForwardSettings global table
CREATE TABLE ${schema}."pay_it_forward_settings" (
  "id" serial PRIMARY KEY NOT NULL,
  "admin_emails_text" text,
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
CREATE INDEX "pay_it_forward_settings_updated_at_idx" ON ${schema}."pay_it_forward_settings" USING btree ("updated_at");
CREATE INDEX "pay_it_forward_settings_created_at_idx" ON ${schema}."pay_it_forward_settings" USING btree ("created_at");
`))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  const schema = getPayloadMigrationSchemaSqlPrefix()
  await db.execute(sql.raw(`
DROP TABLE IF EXISTS ${schema}."pay_it_forward_settings";

ALTER TABLE ${schema}."payload_pay_it_forward_funding"
  DROP COLUMN IF EXISTS "sponsor_email",
  DROP COLUMN IF EXISTS "stripe_checkout_session_id",
  DROP COLUMN IF EXISTS "stripe_payment_intent_id",
  DROP COLUMN IF EXISTS "amount_paid_minor",
  DROP COLUMN IF EXISTS "purchased_at",
  DROP COLUMN IF EXISTS "seat_status",
  DROP COLUMN IF EXISTS "redeemed_by_name",
  DROP COLUMN IF EXISTS "redeemed_by_email";

ALTER TABLE ${schema}."payload_pay_it_forward_funding"
  ALTER COLUMN "support_id" SET NOT NULL,
  ALTER COLUMN "member_id" SET NOT NULL,
  ALTER COLUMN "member_email" SET NOT NULL,
  ALTER COLUMN "donor_name" SET NOT NULL,
  ALTER COLUMN "allocated_amount_minor" SET NOT NULL,
  ALTER COLUMN "approval_reference" SET NOT NULL,
  ALTER COLUMN "reason" SET NOT NULL;
`))
}
