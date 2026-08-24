import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

import { getPayloadMigrationSchemaSqlPrefix } from '../lib/payloadMigrationSchema'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  const schema = getPayloadMigrationSchemaSqlPrefix()

  await db.execute(sql.raw(`
CREATE TYPE ${schema}."enum_payload_engagement_reactions_reaction_type" AS ENUM('helpful', 'insightful', 'celebrate');
CREATE TYPE ${schema}."enum_payload_engagement_reactions_target_kind" AS ENUM('space_post', 'space_comment', 'lesson_comment');
CREATE TABLE ${schema}."payload_engagement_reactions" (
  "id" serial PRIMARY KEY NOT NULL,
  "member_id" integer NOT NULL,
  "reaction_type" ${schema}."enum_payload_engagement_reactions_reaction_type" NOT NULL,
  "target_kind" ${schema}."enum_payload_engagement_reactions_target_kind" NOT NULL,
  "target_post_id" integer,
  "target_space_comment_id" integer,
  "target_lesson_comment_id" integer,
  "metadata" jsonb,
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "payload_engagement_reactions_target_shape" CHECK (
    (target_kind = 'space_post' AND target_post_id IS NOT NULL AND target_space_comment_id IS NULL AND target_lesson_comment_id IS NULL) OR
    (target_kind = 'space_comment' AND target_post_id IS NULL AND target_space_comment_id IS NOT NULL AND target_lesson_comment_id IS NULL) OR
    (target_kind = 'lesson_comment' AND target_post_id IS NULL AND target_space_comment_id IS NULL AND target_lesson_comment_id IS NOT NULL)
  )
);
ALTER TABLE ${schema}."payload_engagement_reactions" ADD CONSTRAINT "payload_engagement_reactions_member_id_payload_members_id_fk" FOREIGN KEY ("member_id") REFERENCES ${schema}."payload_members"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE ${schema}."payload_engagement_reactions" ADD CONSTRAINT "payload_engagement_reactions_target_post_id_payload_space_posts_id_fk" FOREIGN KEY ("target_post_id") REFERENCES ${schema}."payload_space_posts"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE ${schema}."payload_engagement_reactions" ADD CONSTRAINT "payload_engagement_reactions_target_space_comment_id_payload_space_comments_id_fk" FOREIGN KEY ("target_space_comment_id") REFERENCES ${schema}."payload_space_comments"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE ${schema}."payload_engagement_reactions" ADD CONSTRAINT "payload_engagement_reactions_target_lesson_comment_id_payload_lesson_comments_id_fk" FOREIGN KEY ("target_lesson_comment_id") REFERENCES ${schema}."payload_lesson_comments"("id") ON DELETE cascade ON UPDATE no action;
CREATE UNIQUE INDEX "payload_engagement_reactions_member_target_post_unique_idx" ON ${schema}."payload_engagement_reactions" ("member_id", "target_post_id") WHERE "member_id" IS NOT NULL AND "target_post_id" IS NOT NULL;
CREATE UNIQUE INDEX "payload_engagement_reactions_member_target_space_comment_unique_idx" ON ${schema}."payload_engagement_reactions" ("member_id", "target_space_comment_id") WHERE "member_id" IS NOT NULL AND "target_space_comment_id" IS NOT NULL;
CREATE UNIQUE INDEX "payload_engagement_reactions_member_target_lesson_comment_unique_idx" ON ${schema}."payload_engagement_reactions" ("member_id", "target_lesson_comment_id") WHERE "member_id" IS NOT NULL AND "target_lesson_comment_id" IS NOT NULL;
CREATE INDEX "payload_engagement_reactions_member_idx" ON ${schema}."payload_engagement_reactions" USING btree ("member_id");
CREATE INDEX "payload_engagement_reactions_target_kind_idx" ON ${schema}."payload_engagement_reactions" USING btree ("target_kind");
CREATE INDEX "payload_engagement_reactions_target_post_idx" ON ${schema}."payload_engagement_reactions" USING btree ("target_post_id");
CREATE INDEX "payload_engagement_reactions_target_space_comment_idx" ON ${schema}."payload_engagement_reactions" USING btree ("target_space_comment_id");
CREATE INDEX "payload_engagement_reactions_target_lesson_comment_idx" ON ${schema}."payload_engagement_reactions" USING btree ("target_lesson_comment_id");
CREATE INDEX "payload_engagement_reactions_created_at_idx" ON ${schema}."payload_engagement_reactions" USING btree ("created_at");
ALTER TABLE ${schema}."payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "payload_engagement_reactions_id" integer;
ALTER TABLE ${schema}."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payload_engagement_reactions_fk" FOREIGN KEY ("payload_engagement_reactions_id") REFERENCES ${schema}."payload_engagement_reactions"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_payload_engagement_reactions_id_idx" ON ${schema}."payload_locked_documents_rels" USING btree ("payload_engagement_reactions_id");
`))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  const schema = getPayloadMigrationSchemaSqlPrefix()

  await db.execute(sql.raw(`
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM ${schema}."payload_engagement_reactions" LIMIT 1) THEN
    RAISE EXCEPTION 'engagement_reactions_rollback_blocked_populated_table';
  END IF;
END $$;
DROP INDEX IF EXISTS ${schema}."payload_locked_documents_rels_payload_engagement_reactions_id_idx";
ALTER TABLE ${schema}."payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_payload_engagement_reactions_fk";
ALTER TABLE ${schema}."payload_locked_documents_rels" DROP COLUMN IF EXISTS "payload_engagement_reactions_id";
DROP TABLE IF EXISTS ${schema}."payload_engagement_reactions";
DROP TYPE IF EXISTS ${schema}."enum_payload_engagement_reactions_target_kind";
DROP TYPE IF EXISTS ${schema}."enum_payload_engagement_reactions_reaction_type";
`))
}
