import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

import {
  buildPartnerSchemaReconciliationMigrationDownSql,
  buildPartnerSchemaReconciliationMigrationUpSql,
} from '../lib/partnerSchemaReconciliationMigrationSql'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql.raw(buildPartnerSchemaReconciliationMigrationUpSql()))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql.raw(buildPartnerSchemaReconciliationMigrationDownSql()))
}
