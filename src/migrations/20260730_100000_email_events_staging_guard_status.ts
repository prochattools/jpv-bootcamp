import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

import { getPayloadMigrationSchemaSqlPrefix } from '../lib/payloadMigrationSchema'

/** Adds the explicit terminal state used when the staging recipient guard blocks a queued event. */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  const schema = getPayloadMigrationSchemaSqlPrefix()
  await db.execute(sql.raw(`
    ALTER TYPE ${schema}."enum_payload_email_events_delivery_status"
      ADD VALUE IF NOT EXISTS 'blocked_by_staging_guard';
  `))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // PostgreSQL enum values cannot be removed safely. The terminal value becomes unused on rollback.
  const _ = db
}
