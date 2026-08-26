import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

import { getPayloadMigrationSchemaSqlPrefix } from '../lib/payloadMigrationSchema'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  const schema = getPayloadMigrationSchemaSqlPrefix()
  await db.execute(sql.raw(`
    ALTER TABLE ${schema}."payload_membership_review_queue_items"
      RENAME COLUMN "assigned_to" TO "assigned_to_id";
  `))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  const schema = getPayloadMigrationSchemaSqlPrefix()
  await db.execute(sql.raw(`
    ALTER TABLE ${schema}."payload_membership_review_queue_items"
      RENAME COLUMN "assigned_to_id" TO "assigned_to";
  `))
}
