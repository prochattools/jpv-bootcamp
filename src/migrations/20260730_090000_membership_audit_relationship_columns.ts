import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

import { getPayloadMigrationSchemaSqlPrefix } from '../lib/payloadMigrationSchema'

/** Reconciles the original short relationship column names with Payload's generated names. */
const upSql = (schema: string) => `
ALTER TABLE ${schema}."payload_membership_audit_history"
  ADD COLUMN IF NOT EXISTS "membership_support_id" integer,
  ADD COLUMN IF NOT EXISTS "voucher_id" integer,
  ADD COLUMN IF NOT EXISTS "funding_source_id" integer,
  ADD COLUMN IF NOT EXISTS "reconciliation_id" integer;
CREATE INDEX IF NOT EXISTS "payload_membership_audit_history_membership_support_id_idx"
  ON ${schema}."payload_membership_audit_history" ("membership_support_id");
CREATE INDEX IF NOT EXISTS "payload_membership_audit_history_voucher_id_idx"
  ON ${schema}."payload_membership_audit_history" ("voucher_id");
CREATE INDEX IF NOT EXISTS "payload_membership_audit_history_funding_source_id_idx"
  ON ${schema}."payload_membership_audit_history" ("funding_source_id");
CREATE INDEX IF NOT EXISTS "payload_membership_audit_history_reconciliation_id_idx"
  ON ${schema}."payload_membership_audit_history" ("reconciliation_id");
DO $$ BEGIN
  ALTER TABLE ${schema}."payload_membership_audit_history" ADD CONSTRAINT "payload_membership_audit_history_membership_support_id_fk"
    FOREIGN KEY ("membership_support_id") REFERENCES ${schema}."payload_membership_support_records" ("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE ${schema}."payload_membership_audit_history" ADD CONSTRAINT "payload_membership_audit_history_voucher_id_fk"
    FOREIGN KEY ("voucher_id") REFERENCES ${schema}."payload_membership_vouchers" ("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE ${schema}."payload_membership_audit_history" ADD CONSTRAINT "payload_membership_audit_history_funding_source_id_fk"
    FOREIGN KEY ("funding_source_id") REFERENCES ${schema}."payload_membership_funding_sources" ("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE ${schema}."payload_membership_audit_history" ADD CONSTRAINT "payload_membership_audit_history_reconciliation_id_fk"
    FOREIGN KEY ("reconciliation_id") REFERENCES ${schema}."payload_membership_reconciliations" ("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;`

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql.raw(upSql(getPayloadMigrationSchemaSqlPrefix())))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // This reconciliation can encounter pre-existing columns. Do not risk deleting values
  // that were not created by this migration; use the approved database restore path instead.
  const _ = db
}
