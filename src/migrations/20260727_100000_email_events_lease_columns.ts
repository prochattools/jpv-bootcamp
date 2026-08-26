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
  const schema = quotePgIdentifier(resolveSchema())
  await db.execute(sql.raw(`
    ALTER TABLE ${schema}."payload_email_events"
      ADD COLUMN IF NOT EXISTS "claimed_at" timestamp(3),
      ADD COLUMN IF NOT EXISTS "worker_claim_id" varchar(255);

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = '${resolveSchema()}'
          AND tablename = 'payload_email_events'
          AND indexname = 'payload_email_events_delivery_status_idx'
      ) THEN
        CREATE INDEX payload_email_events_delivery_status_idx
          ON ${schema}."payload_email_events" ("delivery_status");
      END IF;
    END $$;
  `))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  const schema = quotePgIdentifier(resolveSchema())
  await db.execute(sql.raw(`
    ALTER TABLE ${schema}."payload_email_events"
      DROP COLUMN IF EXISTS "claimed_at",
      DROP COLUMN IF EXISTS "worker_claim_id";
  `))
}
