import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'
import { getPayloadMigrationSchemaSqlPrefix } from '../lib/payloadMigrationSchema'

export async function up({ db }: MigrateUpArgs): Promise<void> {
	const schema = getPayloadMigrationSchemaSqlPrefix()

	await db.execute(sql.raw(`
    CREATE TYPE ${schema}."enum_bunny_videos_status" AS ENUM('processing', 'ready', 'failed');

    CREATE TABLE ${schema}."bunny_videos" (
      "id" serial PRIMARY KEY NOT NULL,
      "title" varchar NOT NULL,
      "library_id" numeric NOT NULL,
      "video_id" numeric NOT NULL,
      "lesson_id" varchar,
      "status" ${schema}."enum_bunny_videos_status" DEFAULT 'processing' NOT NULL,
      "duration" numeric,
      "frame_rate" numeric,
      "width" numeric,
      "height" numeric,
      "video_codec" varchar,
      "audio_codec" varchar,
      "bitrate" numeric,
      "thumbnail_url" varchar,
      "playback_url" varchar,
      "error_message" varchar,
      "webhook_events" jsonb,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE INDEX ${schema}."bunny_videos_library_video_idx" on ${schema}."bunny_videos" ("library_id", "video_id");
    CREATE INDEX ${schema}."bunny_videos_status_idx" on ${schema}."bunny_videos" ("status");
    CREATE INDEX ${schema}."bunny_videos_lesson_id_idx" on ${schema}."bunny_videos" ("lesson_id");

    CREATE UNIQUE INDEX ${schema}."bunny_videos_library_video_unique_idx" on ${schema}."bunny_videos" ("library_id", "video_id");
  `))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
	const schema = getPayloadMigrationSchemaSqlPrefix()

	await db.execute(sql.raw(`
    DROP INDEX IF EXISTS ${schema}."bunny_videos_library_video_unique_idx";
    DROP INDEX IF EXISTS ${schema}."bunny_videos_lesson_id_idx";
    DROP INDEX IF EXISTS ${schema}."bunny_videos_status_idx";
    DROP INDEX IF EXISTS ${schema}."bunny_videos_library_video_idx";
    DROP TABLE ${schema}."bunny_videos";
    DROP TYPE ${schema}."enum_bunny_videos_status";
  `))
}
