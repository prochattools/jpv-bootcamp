import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

import {
  buildPayloadPreferencesConstraintDownSql,
  buildPayloadPreferencesConstraintUpSql,
} from '../lib/payloadPreferencesConstraintMigrationSql'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql.raw(buildPayloadPreferencesConstraintUpSql()))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql.raw(buildPayloadPreferencesConstraintDownSql()))
}
