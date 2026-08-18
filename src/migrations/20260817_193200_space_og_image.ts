import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'
import { getPayloadMigrationSchemaSqlPrefix } from '../lib/payloadMigrationSchema'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  const schema = getPayloadMigrationSchemaSqlPrefix()
  await db.execute(sql.raw(`
ALTER TABLE ${schema}."payload_spaces" ADD COLUMN IF NOT EXISTS "og_image_id" integer;
ALTER TABLE ${schema}."payload_spaces" ADD CONSTRAINT "payload_spaces_og_image_id_payload_media_id_fk" FOREIGN KEY ("og_image_id") REFERENCES ${schema}."payload_media"("id") ON DELETE set null ON UPDATE no action;
CREATE INDEX IF NOT EXISTS "payload_spaces_og_image_idx" ON ${schema}."payload_spaces" USING btree ("og_image_id");
`))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  const schema = getPayloadMigrationSchemaSqlPrefix()
  await db.execute(sql.raw(`
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM ${schema}."payload_spaces" WHERE "og_image_id" IS NOT NULL LIMIT 1) THEN
    RAISE EXCEPTION 'space_og_image_rollback_blocked_populated_references';
  END IF;
END $$;
DROP INDEX IF EXISTS ${schema}."payload_spaces_og_image_idx";
ALTER TABLE ${schema}."payload_spaces" DROP CONSTRAINT IF EXISTS "payload_spaces_og_image_id_payload_media_id_fk";
ALTER TABLE ${schema}."payload_spaces" DROP COLUMN IF EXISTS "og_image_id";
`))
}
