import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

import {
  buildMemberAccountActionPurposeDownSql,
  buildMemberAccountActionPurposeUpSql,
} from '../lib/auth/memberAccountActionMigrationSql'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql.raw(buildMemberAccountActionPurposeUpSql()))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql.raw(buildMemberAccountActionPurposeDownSql()))
}
