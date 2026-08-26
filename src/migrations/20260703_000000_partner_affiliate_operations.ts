import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

import {
  buildPartnerAffiliateOperationsMigrationDownSql,
  buildPartnerAffiliateOperationsMigrationUpSql,
} from '../lib/partnerAffiliateOperationsMigrationSql'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql.raw(buildPartnerAffiliateOperationsMigrationUpSql()))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql.raw(buildPartnerAffiliateOperationsMigrationDownSql()))
}
