import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'
import { getPayloadMigrationSchemaSqlPrefix } from '../lib/payloadMigrationSchema'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  const schema = getPayloadMigrationSchemaSqlPrefix()
  await db.execute(sql.raw(`
ALTER TABLE ${schema}."payload_member_profiles" ADD COLUMN "cover_image_id" integer;
ALTER TABLE ${schema}."payload_member_profiles" ADD COLUMN "website" varchar;
ALTER TABLE ${schema}."payload_member_profiles" ADD COLUMN "biography" jsonb;
ALTER TABLE ${schema}."payload_member_profiles" ADD COLUMN "social_links_instagram" varchar;
ALTER TABLE ${schema}."payload_member_profiles" ADD COLUMN "social_links_twitter" varchar;
ALTER TABLE ${schema}."payload_member_profiles" ADD COLUMN "social_links_linkedin" varchar;
ALTER TABLE ${schema}."payload_member_profiles" ADD COLUMN "social_links_facebook" varchar;
ALTER TABLE ${schema}."payload_member_profiles" ADD COLUMN "social_links_youtube" varchar;
ALTER TABLE ${schema}."payload_member_profiles" ADD CONSTRAINT "payload_member_profiles_cover_image_id_payload_media_id_fk" FOREIGN KEY ("cover_image_id") REFERENCES ${schema}."payload_media"("id") ON DELETE set null ON UPDATE no action;
CREATE INDEX "payload_member_profiles_cover_image_idx" ON ${schema}."payload_member_profiles" USING btree ("cover_image_id");
`))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  const schema = getPayloadMigrationSchemaSqlPrefix()
  await db.execute(sql.raw(`
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM ${schema}."payload_member_profiles"
    WHERE "cover_image_id" IS NOT NULL
       OR "website" IS NOT NULL
       OR "biography" IS NOT NULL
       OR "social_links_instagram" IS NOT NULL
       OR "social_links_twitter" IS NOT NULL
       OR "social_links_linkedin" IS NOT NULL
       OR "social_links_facebook" IS NOT NULL
       OR "social_links_youtube" IS NOT NULL
    LIMIT 1
  ) THEN
    RAISE EXCEPTION 'member_profile_parity_rollback_blocked_populated_columns';
  END IF;
END $$;
DROP INDEX IF EXISTS ${schema}."payload_member_profiles_cover_image_idx";
ALTER TABLE ${schema}."payload_member_profiles" DROP CONSTRAINT IF EXISTS "payload_member_profiles_cover_image_id_payload_media_id_fk";
ALTER TABLE ${schema}."payload_member_profiles" DROP COLUMN IF EXISTS "social_links_youtube";
ALTER TABLE ${schema}."payload_member_profiles" DROP COLUMN IF EXISTS "social_links_facebook";
ALTER TABLE ${schema}."payload_member_profiles" DROP COLUMN IF EXISTS "social_links_linkedin";
ALTER TABLE ${schema}."payload_member_profiles" DROP COLUMN IF EXISTS "social_links_twitter";
ALTER TABLE ${schema}."payload_member_profiles" DROP COLUMN IF EXISTS "social_links_instagram";
ALTER TABLE ${schema}."payload_member_profiles" DROP COLUMN IF EXISTS "biography";
ALTER TABLE ${schema}."payload_member_profiles" DROP COLUMN IF EXISTS "website";
ALTER TABLE ${schema}."payload_member_profiles" DROP COLUMN IF EXISTS "cover_image_id";
`))
}
