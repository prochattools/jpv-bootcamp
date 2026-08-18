import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'
import { getPayloadMigrationSchemaSqlPrefix } from '../lib/payloadMigrationSchema'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  const schema = getPayloadMigrationSchemaSqlPrefix()
  await db.execute(sql.raw(`
DO $$
BEGIN
  IF EXISTS (
    WITH values AS (
      SELECT id, lesson_id, btrim(lesson_id) AS normalized
      FROM ${schema}."bunny_videos"
      WHERE lesson_id IS NOT NULL AND btrim(lesson_id) <> ''
    )
    SELECT 1 FROM values v
    LEFT JOIN ${schema}."payload_lessons" l ON l.id::text = v.normalized
    WHERE v.normalized !~ '^[0-9]+$' OR l.id IS NULL
  ) THEN
    RAISE EXCEPTION 'bunny_guid_first_preflight_failed';
  END IF;
END $$;

ALTER TABLE ${schema}."bunny_videos" ADD COLUMN IF NOT EXISTS "video_guid" varchar;
ALTER TABLE ${schema}."bunny_videos" ALTER COLUMN "video_id" DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "bunny_videos_video_guid_unique_idx"
  ON ${schema}."bunny_videos" USING btree ("video_guid") WHERE "video_guid" IS NOT NULL;
ALTER TABLE ${schema}."bunny_videos"
  ALTER COLUMN "lesson_id" TYPE integer
  USING CASE WHEN "lesson_id" IS NULL OR btrim("lesson_id") = '' THEN NULL ELSE btrim("lesson_id")::integer END;
ALTER TABLE ${schema}."bunny_videos"
  ADD CONSTRAINT "bunny_videos_lesson_id_payload_lessons_id_fk"
  FOREIGN KEY ("lesson_id") REFERENCES ${schema}."payload_lessons"("id") ON DELETE set null ON UPDATE no action;
`))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  const schema = getPayloadMigrationSchemaSqlPrefix()
  await db.execute(sql.raw(`
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM ${schema}."bunny_videos" WHERE "video_id" IS NULL) THEN
    RAISE EXCEPTION 'bunny_guid_first_rollback_blocked_guid_only_rows';
  END IF;
  IF EXISTS (
    SELECT 1 FROM ${schema}."bunny_videos" b
    LEFT JOIN ${schema}."payload_lessons" l ON l.id = b.lesson_id
    WHERE b.lesson_id IS NOT NULL AND l.id IS NULL
  ) THEN
    RAISE EXCEPTION 'bunny_guid_first_rollback_blocked_dangling_lessons';
  END IF;
END $$;

ALTER TABLE ${schema}."bunny_videos" DROP CONSTRAINT IF EXISTS "bunny_videos_lesson_id_payload_lessons_id_fk";
ALTER TABLE ${schema}."bunny_videos" ALTER COLUMN "lesson_id" TYPE varchar USING "lesson_id"::varchar;
DROP INDEX IF EXISTS ${schema}."bunny_videos_video_guid_unique_idx";
ALTER TABLE ${schema}."bunny_videos" ALTER COLUMN "video_id" SET NOT NULL;
ALTER TABLE ${schema}."bunny_videos" DROP COLUMN IF EXISTS "video_guid";
`))
}
