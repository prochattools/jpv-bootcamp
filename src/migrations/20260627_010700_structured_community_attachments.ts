import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

import { getPayloadMigrationSchemaSqlPrefix } from '../lib/payloadMigrationSchema'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  const schema = getPayloadMigrationSchemaSqlPrefix()

  await db.execute(sql.raw(`
  CREATE TYPE ${schema}."enum_payload_space_files_attachment_type" AS ENUM('document', 'image', 'external_video', 'private_video');
  CREATE TYPE ${schema}."enum_payload_space_files_external_provider" AS ENUM('youtube', 'vimeo');
  ALTER TABLE ${schema}."payload_space_files" ALTER COLUMN "file_id" DROP NOT NULL;
  ALTER TABLE ${schema}."payload_space_files" ADD COLUMN "post_id" integer;
  ALTER TABLE ${schema}."payload_space_files" ADD COLUMN "comment_id" integer;
  ALTER TABLE ${schema}."payload_space_files" ADD COLUMN "attachment_type" ${schema}."enum_payload_space_files_attachment_type" DEFAULT 'document' NOT NULL;
  ALTER TABLE ${schema}."payload_space_files" ADD COLUMN "caption" varchar;
  ALTER TABLE ${schema}."payload_space_files" ADD COLUMN "alt_text" varchar;
  ALTER TABLE ${schema}."payload_space_files" ADD COLUMN "sort_order" numeric DEFAULT 0;
  ALTER TABLE ${schema}."payload_space_files" ADD COLUMN "external_provider" ${schema}."enum_payload_space_files_external_provider";
  ALTER TABLE ${schema}."payload_space_files" ADD COLUMN "external_media_id" varchar;
  ALTER TABLE ${schema}."payload_space_files" ADD COLUMN "bunny_video_id" varchar;
  ALTER TABLE ${schema}."payload_space_files" ADD COLUMN "bunny_library_id" varchar;
  ALTER TABLE ${schema}."payload_space_files" ADD COLUMN "protected_file_id" integer;
  ALTER TABLE ${schema}."payload_space_files" ADD CONSTRAINT "payload_space_files_post_id_payload_space_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES ${schema}."payload_space_posts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE ${schema}."payload_space_files" ADD CONSTRAINT "payload_space_files_comment_id_payload_space_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES ${schema}."payload_space_comments"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE ${schema}."payload_space_files" ADD CONSTRAINT "payload_space_files_protected_file_id_payload_private_media_id_fk" FOREIGN KEY ("protected_file_id") REFERENCES ${schema}."payload_private_media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "payload_space_files_post_idx" ON ${schema}."payload_space_files" USING btree ("post_id");
  CREATE INDEX "payload_space_files_comment_idx" ON ${schema}."payload_space_files" USING btree ("comment_id");
  CREATE INDEX "payload_space_files_protected_file_idx" ON ${schema}."payload_space_files" USING btree ("protected_file_id");
  `))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  const schema = getPayloadMigrationSchemaSqlPrefix()

  await db.execute(sql.raw(`
  ALTER TABLE ${schema}."payload_space_files" DROP CONSTRAINT "payload_space_files_post_id_payload_space_posts_id_fk";
  ALTER TABLE ${schema}."payload_space_files" DROP CONSTRAINT "payload_space_files_comment_id_payload_space_comments_id_fk";
  ALTER TABLE ${schema}."payload_space_files" DROP CONSTRAINT "payload_space_files_protected_file_id_payload_private_media_id_fk";
  DROP INDEX ${schema}."payload_space_files_post_idx";
  DROP INDEX ${schema}."payload_space_files_comment_idx";
  DROP INDEX ${schema}."payload_space_files_protected_file_idx";
  ALTER TABLE ${schema}."payload_space_files" ALTER COLUMN "file_id" SET NOT NULL;
  ALTER TABLE ${schema}."payload_space_files" DROP COLUMN "post_id";
  ALTER TABLE ${schema}."payload_space_files" DROP COLUMN "comment_id";
  ALTER TABLE ${schema}."payload_space_files" DROP COLUMN "attachment_type";
  ALTER TABLE ${schema}."payload_space_files" DROP COLUMN "caption";
  ALTER TABLE ${schema}."payload_space_files" DROP COLUMN "alt_text";
  ALTER TABLE ${schema}."payload_space_files" DROP COLUMN "sort_order";
  ALTER TABLE ${schema}."payload_space_files" DROP COLUMN "external_provider";
  ALTER TABLE ${schema}."payload_space_files" DROP COLUMN "external_media_id";
  ALTER TABLE ${schema}."payload_space_files" DROP COLUMN "bunny_video_id";
  ALTER TABLE ${schema}."payload_space_files" DROP COLUMN "bunny_library_id";
  ALTER TABLE ${schema}."payload_space_files" DROP COLUMN "protected_file_id";
  DROP TYPE ${schema}."enum_payload_space_files_attachment_type";
  DROP TYPE ${schema}."enum_payload_space_files_external_provider";
  `))
}
