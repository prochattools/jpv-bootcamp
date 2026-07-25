import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

import { getPayloadMigrationSchema } from '../lib/payloadMigrationSchema'

/**
 * Adds the singular membership enum value only.
 *
 * PostgreSQL requires the transaction that adds an enum value to commit before
 * another transaction can safely use that value. Data migration and legacy
 * access-policy cleanup therefore live in 20260723_000001.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  const schema = getPayloadMigrationSchema()

  await db.execute(sql.raw(`
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = '${schema}'
      AND t.typname = 'enum_payload_subscriptions_plan'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = '${schema}'
      AND t.typname = 'enum_payload_subscriptions_plan'
      AND e.enumlabel = 'jpv_bootcamp_membership'
  ) THEN
    ALTER TYPE ${schema}.enum_payload_subscriptions_plan
      ADD VALUE 'jpv_bootcamp_membership';
  END IF;
END $$;
  `))
}

/**
 * PostgreSQL enum-value removal requires rebuilding the enum type and every
 * dependent column. That destructive contraction is intentionally not
 * performed here. The paired 000001 down migration reverses subscription data
 * and restores the removed legacy access-policy objects.
 */
export async function down({ db: _db }: MigrateDownArgs): Promise<void> {
  return Promise.resolve()
}
