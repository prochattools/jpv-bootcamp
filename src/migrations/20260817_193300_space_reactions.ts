import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'
import { getPayloadMigrationSchemaSqlPrefix } from '../lib/payloadMigrationSchema'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  const schema = getPayloadMigrationSchemaSqlPrefix()
  await db.execute(sql.raw(`
CREATE TYPE ${schema}."enum_payload_space_reactions_reaction_type" AS ENUM('like', 'bookmark', 'survey_vote');
CREATE TYPE ${schema}."enum_payload_space_reactions_target_kind" AS ENUM('post', 'comment', 'survey_option');
CREATE TABLE ${schema}."payload_space_reactions" (
  "id" serial PRIMARY KEY NOT NULL,
  "actor_member_id" integer,
  "reaction_type" ${schema}."enum_payload_space_reactions_reaction_type" NOT NULL,
  "target_kind" ${schema}."enum_payload_space_reactions_target_kind" NOT NULL,
  "target_post_id" integer,
  "target_comment_id" integer,
  "survey_option_key" varchar,
  "legacy_reaction_id" varchar,
  "legacy_actor_user_id" varchar,
  "legacy_actor_source_system" varchar,
  "source_created_at" timestamp(3) with time zone,
  "metadata" jsonb,
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "payload_space_reactions_target_shape" CHECK (
    (target_kind = 'post' AND target_post_id IS NOT NULL AND target_comment_id IS NULL AND survey_option_key IS NULL) OR
    (target_kind = 'comment' AND target_post_id IS NULL AND target_comment_id IS NOT NULL AND survey_option_key IS NULL) OR
    (target_kind = 'survey_option' AND target_post_id IS NOT NULL AND target_comment_id IS NULL AND survey_option_key IS NOT NULL)
  ),
  CONSTRAINT "payload_space_reactions_survey_vote_coupling" CHECK (
    (target_kind = 'survey_option' AND reaction_type = 'survey_vote') OR
    (target_kind <> 'survey_option' AND reaction_type <> 'survey_vote')
  )
);
ALTER TABLE ${schema}."payload_space_reactions" ADD CONSTRAINT "payload_space_reactions_actor_member_id_payload_members_id_fk" FOREIGN KEY ("actor_member_id") REFERENCES ${schema}."payload_members"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE ${schema}."payload_space_reactions" ADD CONSTRAINT "payload_space_reactions_target_post_id_payload_space_posts_id_fk" FOREIGN KEY ("target_post_id") REFERENCES ${schema}."payload_space_posts"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE ${schema}."payload_space_reactions" ADD CONSTRAINT "payload_space_reactions_target_comment_id_payload_space_comments_id_fk" FOREIGN KEY ("target_comment_id") REFERENCES ${schema}."payload_space_comments"("id") ON DELETE cascade ON UPDATE no action;
CREATE UNIQUE INDEX "payload_space_reactions_actor_type_post_unique_idx" ON ${schema}."payload_space_reactions" ("actor_member_id", "reaction_type", "target_post_id") WHERE "actor_member_id" IS NOT NULL AND "target_post_id" IS NOT NULL;
CREATE UNIQUE INDEX "payload_space_reactions_actor_type_comment_unique_idx" ON ${schema}."payload_space_reactions" ("actor_member_id", "reaction_type", "target_comment_id") WHERE "actor_member_id" IS NOT NULL AND "target_comment_id" IS NOT NULL;
CREATE UNIQUE INDEX "payload_space_reactions_legacy_reaction_id_idx" ON ${schema}."payload_space_reactions" USING btree ("legacy_reaction_id") WHERE "legacy_reaction_id" IS NOT NULL;
CREATE INDEX "payload_space_reactions_actor_member_idx" ON ${schema}."payload_space_reactions" USING btree ("actor_member_id");
CREATE INDEX "payload_space_reactions_target_post_idx" ON ${schema}."payload_space_reactions" USING btree ("target_post_id");
CREATE INDEX "payload_space_reactions_target_comment_idx" ON ${schema}."payload_space_reactions" USING btree ("target_comment_id");
CREATE INDEX "payload_space_reactions_reaction_type_idx" ON ${schema}."payload_space_reactions" USING btree ("reaction_type");
CREATE INDEX "payload_space_reactions_created_at_idx" ON ${schema}."payload_space_reactions" USING btree ("created_at");
ALTER TABLE ${schema}."payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "payload_space_reactions_id" integer;
ALTER TABLE ${schema}."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payload_space_reactions_fk" FOREIGN KEY ("payload_space_reactions_id") REFERENCES ${schema}."payload_space_reactions"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_payload_space_reactions_id_idx" ON ${schema}."payload_locked_documents_rels" USING btree ("payload_space_reactions_id");
`))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  const schema = getPayloadMigrationSchemaSqlPrefix()
  await db.execute(sql.raw(`
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM ${schema}."payload_space_reactions" LIMIT 1) THEN
    RAISE EXCEPTION 'space_reactions_rollback_blocked_populated_table';
  END IF;
END $$;
DROP INDEX IF EXISTS ${schema}."payload_locked_documents_rels_payload_space_reactions_id_idx";
ALTER TABLE ${schema}."payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_payload_space_reactions_fk";
ALTER TABLE ${schema}."payload_locked_documents_rels" DROP COLUMN IF EXISTS "payload_space_reactions_id";
DROP TABLE IF EXISTS ${schema}."payload_space_reactions";
DROP TYPE IF EXISTS ${schema}."enum_payload_space_reactions_target_kind";
DROP TYPE IF EXISTS ${schema}."enum_payload_space_reactions_reaction_type";
`))
}
