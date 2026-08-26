import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

import {
  buildMemberEmailVerificationDownSql,
  buildMemberEmailVerificationUpSql,
} from '../lib/auth/memberEmailVerificationSql'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql.raw(buildMemberEmailVerificationUpSql()))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql.raw(buildMemberEmailVerificationDownSql()))
}
