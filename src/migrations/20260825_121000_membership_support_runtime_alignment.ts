import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

import { getPayloadMigrationSchemaSqlPrefix } from '../lib/payloadMigrationSchema'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  const schema = getPayloadMigrationSchemaSqlPrefix()
  await db.execute(sql.raw(`
    ALTER TABLE ${schema}."payload_membership_support_records"
      RENAME COLUMN "funding_source" TO "funding_source_type";
    ALTER TABLE ${schema}."payload_membership_support_records"
      RENAME COLUMN "issued_by" TO "issued_by_id";
    ALTER TABLE ${schema}."payload_membership_support_records"
      RENAME COLUMN "approved_by" TO "approved_by_id";
  `))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  const schema = getPayloadMigrationSchemaSqlPrefix()
  await db.execute(sql.raw(`
    ALTER TABLE ${schema}."payload_membership_support_records"
      RENAME COLUMN "approved_by_id" TO "approved_by";
    ALTER TABLE ${schema}."payload_membership_support_records"
      RENAME COLUMN "issued_by_id" TO "issued_by";
    ALTER TABLE ${schema}."payload_membership_support_records"
      RENAME COLUMN "funding_source_type" TO "funding_source";
  `))
}
