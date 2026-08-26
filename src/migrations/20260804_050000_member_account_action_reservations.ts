import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

import {
  buildMemberAccountActionReservationDownSql,
  buildMemberAccountActionReservationUpSql,
} from '../lib/auth/memberAccountActionReservationMigrationSql'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql.raw(buildMemberAccountActionReservationUpSql()))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql.raw(buildMemberAccountActionReservationDownSql()))
}
