import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

import { getPayloadMigrationSchemaSqlPrefix } from '../lib/payloadMigrationSchema'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  const schema = getPayloadMigrationSchemaSqlPrefix()
  await db.execute(sql.raw(`
    ALTER TYPE ${schema}."enum_payload_stripe_shadow_projections_shadow_state" ADD VALUE IF NOT EXISTS 'matched';
    ALTER TYPE ${schema}."enum_payload_stripe_shadow_projections_shadow_state" ADD VALUE IF NOT EXISTS 'mismatch';
    ALTER TYPE ${schema}."enum_payload_stripe_shadow_projections_shadow_state" ADD VALUE IF NOT EXISTS 'failed';
  `))
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // PostgreSQL enum values cannot be removed safely in-place. Historical and
  // current values remain accepted if this additive migration is rolled back.
}
