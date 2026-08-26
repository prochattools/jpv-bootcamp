import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

import {
  buildAffiliateReportingMigrationDownSql,
  buildAffiliateReportingMigrationUpSql,
} from '../lib/affiliateReportingMigrationSql'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql.raw(buildAffiliateReportingMigrationUpSql()))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql.raw(buildAffiliateReportingMigrationDownSql()))
}
