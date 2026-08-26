import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

import { getPayloadMigrationSchemaSqlPrefix } from '../lib/payloadMigrationSchema'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  const schema = getPayloadMigrationSchemaSqlPrefix()
  await db.execute(sql.raw(`
    ALTER TABLE ${schema}."payload_members"
      ADD COLUMN IF NOT EXISTS "is_administrator" boolean DEFAULT false NOT NULL;

    ALTER TABLE ${schema}."payload_users"
      ADD COLUMN IF NOT EXISTS "portal_member_id" integer;

    ALTER TABLE ${schema}."payload_users"
      DROP CONSTRAINT IF EXISTS "payload_users_portal_member_id_payload_members_id_fk";
    ALTER TABLE ${schema}."payload_users"
      ADD CONSTRAINT "payload_users_portal_member_id_payload_members_id_fk"
      FOREIGN KEY ("portal_member_id") REFERENCES ${schema}."payload_members"("id")
      ON DELETE SET NULL ON UPDATE no action;

    CREATE UNIQUE INDEX IF NOT EXISTS "payload_users_portal_member_id_idx"
      ON ${schema}."payload_users" USING btree ("portal_member_id");
    CREATE INDEX IF NOT EXISTS "payload_members_is_administrator_idx"
      ON ${schema}."payload_members" USING btree ("is_administrator");
  `))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  const schema = getPayloadMigrationSchemaSqlPrefix()
  await db.execute(sql.raw(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM ${schema}."payload_users"
        WHERE "portal_member_id" IS NOT NULL
        LIMIT 1
      ) THEN
        RAISE EXCEPTION 'administrator_member_identity_rollback_blocked_linked_accounts';
      END IF;
    END $$;

    DROP INDEX IF EXISTS ${schema}."payload_users_portal_member_id_idx";
    DROP INDEX IF EXISTS ${schema}."payload_members_is_administrator_idx";
    ALTER TABLE ${schema}."payload_users"
      DROP CONSTRAINT IF EXISTS "payload_users_portal_member_id_payload_members_id_fk";
    ALTER TABLE ${schema}."payload_users"
      DROP COLUMN IF EXISTS "portal_member_id";
    ALTER TABLE ${schema}."payload_members"
      DROP COLUMN IF EXISTS "is_administrator";
  `))
}
