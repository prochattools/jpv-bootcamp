import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

import { getPayloadMigrationSchemaSqlPrefix } from '../lib/payloadMigrationSchema'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  const schema = getPayloadMigrationSchemaSqlPrefix()
  for (const actionType of ['pause_subscription', 'resume_paused_subscription']) {
    await db.execute(sql.raw(`
      ALTER TYPE ${schema}."enum_payload_billing_actions_action_type"
        ADD VALUE IF NOT EXISTS '${actionType}';
    `))
  }
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // PostgreSQL enum values cannot be removed safely in-place. The additive
  // values remain accepted if this migration is rolled back.
}
