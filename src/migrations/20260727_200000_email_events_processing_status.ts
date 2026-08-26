import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

import { quotePgIdentifier } from '../lib/payloadMigrationSchema'

const schemaIdentifierPattern = /^[A-Za-z_][A-Za-z0-9_]*$/

function resolveSchema(databaseUrl = process.env.DATABASE_URL): string {
  if (databaseUrl == null || databaseUrl === '') {
    const appSlug = process.env.APP_SLUG ?? ''
    if (!schemaIdentifierPattern.test(appSlug)) {
      throw new Error('DATABASE_URL or a valid APP_SLUG is required')
    }
    return appSlug
  }
  let schema: string | null
  try {
    schema = new URL(databaseUrl).searchParams.get('schema')
  } catch {
    throw new Error('Malformed DATABASE_URL')
  }
  const resolved = schema || process.env.APP_SLUG
  if (!resolved || !schemaIdentifierPattern.test(resolved)) {
    throw new Error('DATABASE_URL schema or APP_SLUG is required')
  }
  return resolved
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  const schema = resolveSchema()
  const enumType = `${quotePgIdentifier(schema)}."enum_payload_email_events_delivery_status"`
  await db.execute(sql.raw(`
    ALTER TYPE ${enumType} ADD VALUE IF NOT EXISTS 'processing';
  `))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // PostgreSQL does not support removing enum values once added — down is a no-op.
  // The 'processing' value becomes unused after rollback; rows in 'processing'
  // state would need to be manually reset to 'queued' before this column is safe to ignore.
  const _ = db // suppress unused var warning
}
