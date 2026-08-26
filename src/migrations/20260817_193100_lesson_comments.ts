import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'
import { getPayloadMigrationSchemaSqlPrefix } from '../lib/payloadMigrationSchema'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  const schema = getPayloadMigrationSchemaSqlPrefix()
  await db.execute(sql.raw(`
CREATE TYPE ${schema}."enum_payload_lesson_comments_moderation_status" AS ENUM('visible', 'pending_review', 'hidden', 'deleted');
CREATE TABLE ${schema}."payload_lesson_comments" (
  "id" serial PRIMARY KEY NOT NULL,
  "display_name" varchar NOT NULL,
  "lesson_id" integer NOT NULL,
  "author_id" integer NOT NULL,
  "parent_id" integer,
  "body" jsonb NOT NULL,
  "legacy_body_html" varchar,
  "moderation_status" ${schema}."enum_payload_lesson_comments_moderation_status" DEFAULT 'visible' NOT NULL,
  "legacy_comment_id" varchar,
  "source_created_at" timestamp(3) with time zone,
  "metadata" jsonb,
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
ALTER TABLE ${schema}."payload_lesson_comments" ADD CONSTRAINT "payload_lesson_comments_lesson_id_payload_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES ${schema}."payload_lessons"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE ${schema}."payload_lesson_comments" ADD CONSTRAINT "payload_lesson_comments_author_id_payload_members_id_fk" FOREIGN KEY ("author_id") REFERENCES ${schema}."payload_members"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE ${schema}."payload_lesson_comments" ADD CONSTRAINT "payload_lesson_comments_parent_id_payload_lesson_comments_id_fk" FOREIGN KEY ("parent_id") REFERENCES ${schema}."payload_lesson_comments"("id") ON DELETE set null ON UPDATE no action;
CREATE INDEX "payload_lesson_comments_lesson_idx" ON ${schema}."payload_lesson_comments" USING btree ("lesson_id");
CREATE INDEX "payload_lesson_comments_author_idx" ON ${schema}."payload_lesson_comments" USING btree ("author_id");
CREATE INDEX "payload_lesson_comments_parent_idx" ON ${schema}."payload_lesson_comments" USING btree ("parent_id");
CREATE UNIQUE INDEX "payload_lesson_comments_legacy_comment_id_idx" ON ${schema}."payload_lesson_comments" USING btree ("legacy_comment_id");
CREATE INDEX "payload_lesson_comments_source_created_at_idx" ON ${schema}."payload_lesson_comments" USING btree ("source_created_at");
CREATE INDEX "payload_lesson_comments_updated_at_idx" ON ${schema}."payload_lesson_comments" USING btree ("updated_at");
CREATE INDEX "payload_lesson_comments_created_at_idx" ON ${schema}."payload_lesson_comments" USING btree ("created_at");
ALTER TABLE ${schema}."payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "payload_lesson_comments_id" integer;
ALTER TABLE ${schema}."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payload_lesson_comments_fk" FOREIGN KEY ("payload_lesson_comments_id") REFERENCES ${schema}."payload_lesson_comments"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_payload_lesson_comments_id_idx" ON ${schema}."payload_locked_documents_rels" USING btree ("payload_lesson_comments_id");
`))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  const schema = getPayloadMigrationSchemaSqlPrefix()
  await db.execute(sql.raw(`
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM ${schema}."payload_lesson_comments" LIMIT 1) THEN
    RAISE EXCEPTION 'lesson_comments_rollback_blocked_populated_table';
  END IF;
END $$;
DROP INDEX IF EXISTS ${schema}."payload_locked_documents_rels_payload_lesson_comments_id_idx";
ALTER TABLE ${schema}."payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_payload_lesson_comments_fk";
ALTER TABLE ${schema}."payload_locked_documents_rels" DROP COLUMN IF EXISTS "payload_lesson_comments_id";
DROP TABLE IF EXISTS ${schema}."payload_lesson_comments";
DROP TYPE IF EXISTS ${schema}."enum_payload_lesson_comments_moderation_status";
`))
}
