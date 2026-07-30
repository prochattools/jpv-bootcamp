import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

/** Reconciles the original short relationship column names with Payload's generated names. */
const upSql = `
ALTER TABLE "jpvbootcamp"."payload_membership_audit_history"
  ADD COLUMN IF NOT EXISTS "membership_support_id" integer,
  ADD COLUMN IF NOT EXISTS "voucher_id" integer,
  ADD COLUMN IF NOT EXISTS "funding_source_id" integer,
  ADD COLUMN IF NOT EXISTS "reconciliation_id" integer;
CREATE INDEX IF NOT EXISTS "payload_membership_audit_history_membership_support_id_idx"
  ON "jpvbootcamp"."payload_membership_audit_history" ("membership_support_id");
CREATE INDEX IF NOT EXISTS "payload_membership_audit_history_voucher_id_idx"
  ON "jpvbootcamp"."payload_membership_audit_history" ("voucher_id");
CREATE INDEX IF NOT EXISTS "payload_membership_audit_history_funding_source_id_idx"
  ON "jpvbootcamp"."payload_membership_audit_history" ("funding_source_id");
CREATE INDEX IF NOT EXISTS "payload_membership_audit_history_reconciliation_id_idx"
  ON "jpvbootcamp"."payload_membership_audit_history" ("reconciliation_id");
DO $$ BEGIN
  ALTER TABLE "jpvbootcamp"."payload_membership_audit_history" ADD CONSTRAINT "payload_membership_audit_history_membership_support_id_fk"
    FOREIGN KEY ("membership_support_id") REFERENCES "jpvbootcamp"."payload_membership_support_records" ("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "jpvbootcamp"."payload_membership_audit_history" ADD CONSTRAINT "payload_membership_audit_history_voucher_id_fk"
    FOREIGN KEY ("voucher_id") REFERENCES "jpvbootcamp"."payload_membership_vouchers" ("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "jpvbootcamp"."payload_membership_audit_history" ADD CONSTRAINT "payload_membership_audit_history_funding_source_id_fk"
    FOREIGN KEY ("funding_source_id") REFERENCES "jpvbootcamp"."payload_membership_funding_sources" ("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "jpvbootcamp"."payload_membership_audit_history" ADD CONSTRAINT "payload_membership_audit_history_reconciliation_id_fk"
    FOREIGN KEY ("reconciliation_id") REFERENCES "jpvbootcamp"."payload_membership_reconciliations" ("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;`

export async function up({ db }: MigrateUpArgs): Promise<void> {
  const schema = process.env.PAYLOAD_MIGRATION_SCHEMA?.trim() || 'jpvbootcamp'
  await db.execute(sql.raw(upSql.replaceAll('"jpvbootcamp"', `"${schema}"`)))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  const schema = process.env.PAYLOAD_MIGRATION_SCHEMA?.trim() || 'jpvbootcamp'
  await db.execute(sql.raw(`ALTER TABLE "${schema}"."payload_membership_audit_history" DROP COLUMN IF EXISTS "membership_support_id", DROP COLUMN IF EXISTS "voucher_id", DROP COLUMN IF EXISTS "funding_source_id", DROP COLUMN IF EXISTS "reconciliation_id"`))
}
