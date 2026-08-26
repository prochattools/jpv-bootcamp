import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

import { getPayloadMigrationSchemaSqlPrefix } from '../lib/payloadMigrationSchema'

/**
 * Adds member-portal audience selection and content reactions.
 *
 * This is additive: existing reactions, sessions, and posts keep their data
 * and receive the defaults enrolled/all respectively.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  const schema = getPayloadMigrationSchemaSqlPrefix()

  await db.execute(sql.raw(`
ALTER TYPE ${schema}."enum_payload_engagement_reactions_target_kind" ADD VALUE IF NOT EXISTS 'content_post';
ALTER TYPE ${schema}."enum_payload_engagement_reactions_target_kind" ADD VALUE IF NOT EXISTS 'content_page';

ALTER TABLE ${schema}."payload_engagement_reactions"
  DROP CONSTRAINT IF EXISTS "payload_engagement_reactions_target_shape",
  ADD COLUMN IF NOT EXISTS "target_content_post_id" integer,
  ADD COLUMN IF NOT EXISTS "target_content_page_id" integer;

ALTER TABLE ${schema}."payload_engagement_reactions"
  ADD CONSTRAINT "payload_engagement_reactions_target_shape" CHECK (
    (target_kind::text = 'space_post' AND target_post_id IS NOT NULL AND target_space_comment_id IS NULL AND target_lesson_comment_id IS NULL AND target_content_post_id IS NULL AND target_content_page_id IS NULL) OR
    (target_kind::text = 'space_comment' AND target_post_id IS NULL AND target_space_comment_id IS NOT NULL AND target_lesson_comment_id IS NULL AND target_content_post_id IS NULL AND target_content_page_id IS NULL) OR
    (target_kind::text = 'lesson_comment' AND target_post_id IS NULL AND target_space_comment_id IS NULL AND target_lesson_comment_id IS NOT NULL AND target_content_post_id IS NULL AND target_content_page_id IS NULL) OR
    (target_kind::text = 'content_post' AND target_post_id IS NULL AND target_space_comment_id IS NULL AND target_lesson_comment_id IS NULL AND target_content_post_id IS NOT NULL AND target_content_page_id IS NULL) OR
    (target_kind::text = 'content_page' AND target_post_id IS NULL AND target_space_comment_id IS NULL AND target_lesson_comment_id IS NULL AND target_content_post_id IS NULL AND target_content_page_id IS NOT NULL)
  );

ALTER TABLE ${schema}."payload_engagement_reactions"
  ADD CONSTRAINT "payload_engagement_reactions_target_content_post_fk"
    FOREIGN KEY ("target_content_post_id") REFERENCES ${schema}."payload_posts"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  ADD CONSTRAINT "payload_engagement_reactions_target_content_page_fk"
    FOREIGN KEY ("target_content_page_id") REFERENCES ${schema}."payload_pages"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

CREATE UNIQUE INDEX IF NOT EXISTS "payload_engagement_reactions_member_target_content_post_unique_idx"
  ON ${schema}."payload_engagement_reactions" ("member_id", "target_content_post_id")
  WHERE "member_id" IS NOT NULL AND "target_content_post_id" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "payload_engagement_reactions_member_target_content_page_unique_idx"
  ON ${schema}."payload_engagement_reactions" ("member_id", "target_content_page_id")
  WHERE "member_id" IS NOT NULL AND "target_content_page_id" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "payload_engagement_reactions_target_content_post_idx"
  ON ${schema}."payload_engagement_reactions" USING btree ("target_content_post_id");
CREATE INDEX IF NOT EXISTS "payload_engagement_reactions_target_content_page_idx"
  ON ${schema}."payload_engagement_reactions" USING btree ("target_content_page_id");

DO $$ BEGIN
  CREATE TYPE ${schema}."enum_live_sessions_audience" AS ENUM('enrolled', 'all', 'selected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE ${schema}."enum_payload_posts_audience" AS ENUM('all', 'selected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE ${schema}."live_sessions"
  ADD COLUMN IF NOT EXISTS "audience" ${schema}."enum_live_sessions_audience" DEFAULT 'enrolled' NOT NULL,
  ADD COLUMN IF NOT EXISTS "target_member_ids" jsonb;
CREATE INDEX IF NOT EXISTS "live_sessions_audience_idx" ON ${schema}."live_sessions" ("audience");

ALTER TABLE ${schema}."payload_posts"
  ADD COLUMN IF NOT EXISTS "audience" ${schema}."enum_payload_posts_audience" DEFAULT 'all' NOT NULL,
  ADD COLUMN IF NOT EXISTS "target_member_ids" jsonb;
CREATE INDEX IF NOT EXISTS "payload_posts_audience_idx" ON ${schema}."payload_posts" ("audience");
`))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  const schema = getPayloadMigrationSchemaSqlPrefix()
  await db.execute(sql.raw(`
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM ${schema}."payload_engagement_reactions" WHERE "target_content_post_id" IS NOT NULL OR "target_content_page_id" IS NOT NULL) THEN
    RAISE EXCEPTION 'portal_engagement_distribution_rollback_blocked_populated_content_reactions';
  END IF;
  IF EXISTS (SELECT 1 FROM ${schema}."live_sessions" WHERE "audience" <> 'enrolled' OR "target_member_ids" IS NOT NULL) THEN
    RAISE EXCEPTION 'portal_engagement_distribution_rollback_blocked_targeted_sessions';
  END IF;
  IF EXISTS (SELECT 1 FROM ${schema}."payload_posts" WHERE "audience" <> 'all' OR "target_member_ids" IS NOT NULL) THEN
    RAISE EXCEPTION 'portal_engagement_distribution_rollback_blocked_targeted_posts';
  END IF;
END $$;
DROP INDEX IF EXISTS ${schema}."payload_engagement_reactions_member_target_content_post_unique_idx";
DROP INDEX IF EXISTS ${schema}."payload_engagement_reactions_member_target_content_page_unique_idx";
DROP INDEX IF EXISTS ${schema}."payload_engagement_reactions_target_content_post_idx";
DROP INDEX IF EXISTS ${schema}."payload_engagement_reactions_target_content_page_idx";
ALTER TABLE ${schema}."payload_engagement_reactions"
  DROP CONSTRAINT IF EXISTS "payload_engagement_reactions_target_content_post_fk",
  DROP CONSTRAINT IF EXISTS "payload_engagement_reactions_target_content_page_fk",
  DROP COLUMN IF EXISTS "target_content_post_id",
  DROP COLUMN IF EXISTS "target_content_page_id";
ALTER TABLE ${schema}."payload_engagement_reactions" DROP CONSTRAINT IF EXISTS "payload_engagement_reactions_target_shape";
ALTER TABLE ${schema}."payload_engagement_reactions" ADD CONSTRAINT "payload_engagement_reactions_target_shape" CHECK (
  (target_kind = 'space_post' AND target_post_id IS NOT NULL AND target_space_comment_id IS NULL AND target_lesson_comment_id IS NULL) OR
  (target_kind = 'space_comment' AND target_post_id IS NULL AND target_space_comment_id IS NOT NULL AND target_lesson_comment_id IS NULL) OR
  (target_kind = 'lesson_comment' AND target_post_id IS NULL AND target_space_comment_id IS NULL AND target_lesson_comment_id IS NOT NULL)
);
ALTER TABLE ${schema}."live_sessions" DROP COLUMN IF EXISTS "target_member_ids", DROP COLUMN IF EXISTS "audience";
ALTER TABLE ${schema}."payload_posts" DROP COLUMN IF EXISTS "target_member_ids", DROP COLUMN IF EXISTS "audience";
DROP INDEX IF EXISTS ${schema}."live_sessions_audience_idx";
DROP INDEX IF EXISTS ${schema}."payload_posts_audience_idx";
DROP TYPE IF EXISTS ${schema}."enum_live_sessions_audience";
DROP TYPE IF EXISTS ${schema}."enum_payload_posts_audience";
`))
}
