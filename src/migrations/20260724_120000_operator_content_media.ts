import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

import { getPayloadMigrationSchemaSqlPrefix } from '../lib/payloadMigrationSchema'

/**
 * Adds the operator-managed media and publishing fields introduced for Pages,
 * Posts, and Lessons. Durable S3 media storage and hidden legacy admin controls
 * do not require database columns, so they are intentionally absent here.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  const schema = getPayloadMigrationSchemaSqlPrefix()

  await db.execute(sql.raw(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM ${schema}."payload_pages"
        WHERE "slug" IS NULL OR btrim("slug") = ''
      ) THEN
        RAISE EXCEPTION 'operator_content_media: payload_pages contains a missing slug';
      END IF;

      IF EXISTS (
        SELECT 1 FROM ${schema}."payload_posts"
        WHERE "slug" IS NULL OR btrim("slug") = ''
      ) THEN
        RAISE EXCEPTION 'operator_content_media: payload_posts contains a missing slug';
      END IF;

      IF EXISTS (
        SELECT 1 FROM ${schema}."payload_posts"
        WHERE "status" IS NULL
      ) THEN
        RAISE EXCEPTION 'operator_content_media: payload_posts contains a null status';
      END IF;
    END $$;

    DO $$
    BEGIN
      CREATE TYPE ${schema}."enum_payload_pages_status" AS ENUM('draft', 'published', 'archived');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;

    ALTER TYPE ${schema}."enum_payload_posts_status"
      ADD VALUE IF NOT EXISTS 'archived';

    ALTER TABLE ${schema}."payload_pages"
      ALTER COLUMN "slug" SET NOT NULL,
      ADD COLUMN "summary" varchar,
      ADD COLUMN "featured_image_id" integer,
      ADD COLUMN "featured_video_id" integer,
      ADD COLUMN "status" ${schema}."enum_payload_pages_status" DEFAULT 'draft' NOT NULL,
      ADD COLUMN "published_at" timestamp(3) with time zone,
      ADD COLUMN "sort_order" numeric DEFAULT 0;

    CREATE TABLE ${schema}."payload_pages_rels" (
      "id" serial PRIMARY KEY NOT NULL,
      "order" integer,
      "parent_id" integer NOT NULL,
      "path" varchar NOT NULL,
      "payload_media_id" integer
    );

    ALTER TABLE ${schema}."payload_pages"
      ADD CONSTRAINT "payload_pages_featured_image_id_payload_media_id_fk"
      FOREIGN KEY ("featured_image_id") REFERENCES ${schema}."payload_media"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION;

    ALTER TABLE ${schema}."payload_pages"
      ADD CONSTRAINT "payload_pages_featured_video_id_bunny_videos_id_fk"
      FOREIGN KEY ("featured_video_id") REFERENCES ${schema}."bunny_videos"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION;

    ALTER TABLE ${schema}."payload_pages_rels"
      ADD CONSTRAINT "payload_pages_rels_parent_fk"
      FOREIGN KEY ("parent_id") REFERENCES ${schema}."payload_pages"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION;

    ALTER TABLE ${schema}."payload_pages_rels"
      ADD CONSTRAINT "payload_pages_rels_payload_media_fk"
      FOREIGN KEY ("payload_media_id") REFERENCES ${schema}."payload_media"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION;

    CREATE INDEX "payload_pages_featured_image_idx"
      ON ${schema}."payload_pages" ("featured_image_id");
    CREATE INDEX "payload_pages_featured_video_idx"
      ON ${schema}."payload_pages" ("featured_video_id");
    CREATE INDEX "payload_pages_published_at_idx"
      ON ${schema}."payload_pages" ("published_at");
    CREATE INDEX "payload_pages_rels_order_idx"
      ON ${schema}."payload_pages_rels" ("order");
    CREATE INDEX "payload_pages_rels_parent_idx"
      ON ${schema}."payload_pages_rels" ("parent_id");
    CREATE INDEX "payload_pages_rels_path_idx"
      ON ${schema}."payload_pages_rels" ("path");
    CREATE INDEX "payload_pages_rels_payload_media_idx"
      ON ${schema}."payload_pages_rels" ("payload_media_id");

    ALTER TABLE ${schema}."payload_posts"
      ALTER COLUMN "slug" SET NOT NULL,
      ALTER COLUMN "status" SET DEFAULT 'draft',
      ALTER COLUMN "status" SET NOT NULL,
      ADD COLUMN "excerpt" varchar,
      ADD COLUMN "featured_image_id" integer,
      ADD COLUMN "featured_video_id" integer,
      ADD COLUMN "published_at" timestamp(3) with time zone;

    ALTER TABLE ${schema}."payload_posts_rels"
      ADD COLUMN "payload_media_id" integer;

    ALTER TABLE ${schema}."payload_posts"
      ADD CONSTRAINT "payload_posts_featured_image_id_payload_media_id_fk"
      FOREIGN KEY ("featured_image_id") REFERENCES ${schema}."payload_media"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION;

    ALTER TABLE ${schema}."payload_posts"
      ADD CONSTRAINT "payload_posts_featured_video_id_bunny_videos_id_fk"
      FOREIGN KEY ("featured_video_id") REFERENCES ${schema}."bunny_videos"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION;

    ALTER TABLE ${schema}."payload_posts_rels"
      ADD CONSTRAINT "payload_posts_rels_payload_media_fk"
      FOREIGN KEY ("payload_media_id") REFERENCES ${schema}."payload_media"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION;

    CREATE INDEX "payload_posts_featured_image_idx"
      ON ${schema}."payload_posts" ("featured_image_id");
    CREATE INDEX "payload_posts_featured_video_idx"
      ON ${schema}."payload_posts" ("featured_video_id");
    CREATE INDEX "payload_posts_published_at_idx"
      ON ${schema}."payload_posts" ("published_at");
    CREATE INDEX "payload_posts_rels_payload_media_idx"
      ON ${schema}."payload_posts_rels" ("payload_media_id");

    ALTER TABLE ${schema}."payload_lessons"
      ADD COLUMN "cover_image_id" integer,
      ADD COLUMN "bunny_video_id" integer;

    ALTER TABLE ${schema}."payload_lessons"
      ADD CONSTRAINT "payload_lessons_cover_image_id_payload_media_id_fk"
      FOREIGN KEY ("cover_image_id") REFERENCES ${schema}."payload_media"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION;

    ALTER TABLE ${schema}."payload_lessons"
      ADD CONSTRAINT "payload_lessons_bunny_video_id_bunny_videos_id_fk"
      FOREIGN KEY ("bunny_video_id") REFERENCES ${schema}."bunny_videos"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION;

    CREATE INDEX "payload_lessons_cover_image_idx"
      ON ${schema}."payload_lessons" ("cover_image_id");
    CREATE INDEX "payload_lessons_bunny_video_idx"
      ON ${schema}."payload_lessons" ("bunny_video_id");
  `))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  const schema = getPayloadMigrationSchemaSqlPrefix()

  await db.execute(sql.raw(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM ${schema}."payload_posts"
        WHERE "status"::text = 'archived'
      ) THEN
        RAISE EXCEPTION 'operator_content_media rollback requires zero archived posts';
      END IF;
    END $$;

    ALTER TABLE ${schema}."payload_lessons"
      DROP CONSTRAINT IF EXISTS "payload_lessons_bunny_video_id_bunny_videos_id_fk",
      DROP CONSTRAINT IF EXISTS "payload_lessons_cover_image_id_payload_media_id_fk";
    DROP INDEX IF EXISTS ${schema}."payload_lessons_bunny_video_idx";
    DROP INDEX IF EXISTS ${schema}."payload_lessons_cover_image_idx";
    ALTER TABLE ${schema}."payload_lessons"
      DROP COLUMN IF EXISTS "bunny_video_id",
      DROP COLUMN IF EXISTS "cover_image_id";

    ALTER TABLE ${schema}."payload_posts_rels"
      DROP CONSTRAINT IF EXISTS "payload_posts_rels_payload_media_fk";
    DROP INDEX IF EXISTS ${schema}."payload_posts_rels_payload_media_idx";
    ALTER TABLE ${schema}."payload_posts_rels"
      DROP COLUMN IF EXISTS "payload_media_id";

    ALTER TABLE ${schema}."payload_posts"
      DROP CONSTRAINT IF EXISTS "payload_posts_featured_video_id_bunny_videos_id_fk",
      DROP CONSTRAINT IF EXISTS "payload_posts_featured_image_id_payload_media_id_fk";
    DROP INDEX IF EXISTS ${schema}."payload_posts_published_at_idx";
    DROP INDEX IF EXISTS ${schema}."payload_posts_featured_video_idx";
    DROP INDEX IF EXISTS ${schema}."payload_posts_featured_image_idx";
    ALTER TABLE ${schema}."payload_posts"
      DROP COLUMN IF EXISTS "published_at",
      DROP COLUMN IF EXISTS "featured_video_id",
      DROP COLUMN IF EXISTS "featured_image_id",
      DROP COLUMN IF EXISTS "excerpt",
      ALTER COLUMN "slug" DROP NOT NULL,
      ALTER COLUMN "status" DROP DEFAULT;

    ALTER TABLE ${schema}."payload_posts"
      ALTER COLUMN "status" TYPE varchar USING "status"::text;
    DROP TYPE ${schema}."enum_payload_posts_status";
    CREATE TYPE ${schema}."enum_payload_posts_status" AS ENUM('draft', 'published');
    ALTER TABLE ${schema}."payload_posts"
      ALTER COLUMN "status" TYPE ${schema}."enum_payload_posts_status"
      USING "status"::${schema}."enum_payload_posts_status",
      ALTER COLUMN "status" SET DEFAULT 'draft',
      ALTER COLUMN "status" DROP NOT NULL;

    DROP TABLE IF EXISTS ${schema}."payload_pages_rels";

    ALTER TABLE ${schema}."payload_pages"
      DROP CONSTRAINT IF EXISTS "payload_pages_featured_video_id_bunny_videos_id_fk",
      DROP CONSTRAINT IF EXISTS "payload_pages_featured_image_id_payload_media_id_fk";
    DROP INDEX IF EXISTS ${schema}."payload_pages_published_at_idx";
    DROP INDEX IF EXISTS ${schema}."payload_pages_featured_video_idx";
    DROP INDEX IF EXISTS ${schema}."payload_pages_featured_image_idx";
    ALTER TABLE ${schema}."payload_pages"
      DROP COLUMN IF EXISTS "sort_order",
      DROP COLUMN IF EXISTS "published_at",
      DROP COLUMN IF EXISTS "status",
      DROP COLUMN IF EXISTS "featured_video_id",
      DROP COLUMN IF EXISTS "featured_image_id",
      DROP COLUMN IF EXISTS "summary",
      ALTER COLUMN "slug" DROP NOT NULL;
    DROP TYPE IF EXISTS ${schema}."enum_payload_pages_status";
  `))
}
