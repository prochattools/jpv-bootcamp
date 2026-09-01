import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

import { getPayloadMigrationSchemaSqlPrefix } from '../lib/payloadMigrationSchema'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  const schema = getPayloadMigrationSchemaSqlPrefix()
  await db.execute(sql.raw(`
ALTER TABLE ${schema}."payload_member_notifications"
  ADD COLUMN IF NOT EXISTS "event_key" varchar;
CREATE UNIQUE INDEX IF NOT EXISTS "payload_member_notifications_event_key_idx"
  ON ${schema}."payload_member_notifications" ("event_key")
  WHERE "event_key" IS NOT NULL;
`))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  const schema = getPayloadMigrationSchemaSqlPrefix()
  await db.execute(sql.raw(`
DROP INDEX IF EXISTS ${schema}."payload_member_notifications_event_key_idx";
ALTER TABLE ${schema}."payload_member_notifications" DROP COLUMN IF EXISTS "event_key";
`))
}
