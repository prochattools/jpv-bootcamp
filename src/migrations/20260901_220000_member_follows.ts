import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

import { getPayloadMigrationSchemaSqlPrefix } from '../lib/payloadMigrationSchema'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  const schema = getPayloadMigrationSchemaSqlPrefix()
  await db.execute(sql.raw(`
CREATE TABLE IF NOT EXISTS ${schema}."payload_member_follows" (
  "id" serial PRIMARY KEY NOT NULL,
  "follower_member_id" integer NOT NULL,
  "followed_member_id" integer NOT NULL,
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "payload_member_follows_not_self" CHECK ("follower_member_id" <> "followed_member_id")
);
ALTER TABLE ${schema}."payload_member_follows"
  DROP CONSTRAINT IF EXISTS "payload_member_follows_follower_member_id_payload_members_id_fk";
ALTER TABLE ${schema}."payload_member_follows"
  ADD CONSTRAINT "payload_member_follows_follower_member_id_payload_members_id_fk"
  FOREIGN KEY ("follower_member_id") REFERENCES ${schema}."payload_members"("id") ON DELETE CASCADE ON UPDATE no action;
ALTER TABLE ${schema}."payload_member_follows"
  DROP CONSTRAINT IF EXISTS "payload_member_follows_followed_member_id_payload_members_id_fk";
ALTER TABLE ${schema}."payload_member_follows"
  ADD CONSTRAINT "payload_member_follows_followed_member_id_payload_members_id_fk"
  FOREIGN KEY ("followed_member_id") REFERENCES ${schema}."payload_members"("id") ON DELETE CASCADE ON UPDATE no action;
CREATE UNIQUE INDEX IF NOT EXISTS "payload_member_follows_follower_followed_unique_idx"
  ON ${schema}."payload_member_follows" ("follower_member_id", "followed_member_id");
CREATE INDEX IF NOT EXISTS "payload_member_follows_follower_idx"
  ON ${schema}."payload_member_follows" USING btree ("follower_member_id");
CREATE INDEX IF NOT EXISTS "payload_member_follows_followed_idx"
  ON ${schema}."payload_member_follows" USING btree ("followed_member_id");
CREATE INDEX IF NOT EXISTS "payload_member_follows_created_at_idx"
  ON ${schema}."payload_member_follows" USING btree ("created_at");
ALTER TABLE ${schema}."payload_locked_documents_rels"
  ADD COLUMN IF NOT EXISTS "payload_member_follows_id" integer;
ALTER TABLE ${schema}."payload_locked_documents_rels"
  DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_member_follows_fk";
ALTER TABLE ${schema}."payload_locked_documents_rels"
  ADD CONSTRAINT "payload_locked_documents_rels_member_follows_fk"
  FOREIGN KEY ("payload_member_follows_id") REFERENCES ${schema}."payload_member_follows"("id") ON DELETE CASCADE ON UPDATE no action;
CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_member_follows_id_idx"
  ON ${schema}."payload_locked_documents_rels" USING btree ("payload_member_follows_id");
`))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  const schema = getPayloadMigrationSchemaSqlPrefix()
  await db.execute(sql.raw(`
ALTER TABLE ${schema}."payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_member_follows_fk";
DROP INDEX IF EXISTS ${schema}."payload_locked_documents_rels_member_follows_id_idx";
ALTER TABLE ${schema}."payload_locked_documents_rels" DROP COLUMN IF EXISTS "payload_member_follows_id";
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM ${schema}."payload_member_follows" LIMIT 1) THEN
    RAISE EXCEPTION 'member_follows_rollback_blocked_populated_table';
  END IF;
END $$;
DROP TABLE IF EXISTS ${schema}."payload_member_follows";
`))
}
