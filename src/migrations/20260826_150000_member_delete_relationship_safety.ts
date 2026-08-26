import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

import { getPayloadMigrationSchema } from '../lib/payloadMigrationSchema'
import {
	buildMemberDeleteRelationshipDownSql,
	buildMemberDeleteRelationshipUpSql,
} from '../lib/memberDeleteRelationshipMigrationSql'

export async function up({ db }: MigrateUpArgs): Promise<void> {
	await db.execute(sql.raw(buildMemberDeleteRelationshipUpSql(getPayloadMigrationSchema())))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
	await db.execute(sql.raw(buildMemberDeleteRelationshipDownSql(getPayloadMigrationSchema())))
}
