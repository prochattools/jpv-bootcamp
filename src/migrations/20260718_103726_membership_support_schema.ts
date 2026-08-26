import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

import {
  buildMembershipSupportMigrationDownSql,
  buildMembershipSupportMigrationUpSql,
} from '../lib/billing/membershipSupportMigrationSql'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql.raw(buildMembershipSupportMigrationUpSql()))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql.raw(buildMembershipSupportMigrationDownSql()))
}
