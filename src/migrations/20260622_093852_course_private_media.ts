import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'
import { getPayloadMigrationSchemaSqlPrefix } from '../lib/payloadMigrationSchema'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  const schema = getPayloadMigrationSchemaSqlPrefix()
  await db.execute(sql.raw(`
   CREATE TABLE ${schema}."payload_private_media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"alt" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric
  );
  
  ALTER TABLE ${schema}."payload_lesson_resources" ALTER COLUMN "file_id" DROP NOT NULL;
  ALTER TABLE ${schema}."payload_lesson_resources" ADD COLUMN "protected_file_id" integer;
  ALTER TABLE ${schema}."payload_locked_documents_rels" ADD COLUMN "payload_private_media_id" integer;
  CREATE INDEX "payload_private_media_updated_at_idx" ON ${schema}."payload_private_media" USING btree ("updated_at");
  CREATE INDEX "payload_private_media_created_at_idx" ON ${schema}."payload_private_media" USING btree ("created_at");
  CREATE UNIQUE INDEX "payload_private_media_filename_idx" ON ${schema}."payload_private_media" USING btree ("filename");
  ALTER TABLE ${schema}."payload_lesson_resources" ADD CONSTRAINT "payload_lesson_resources_protected_file_id_payload_private_media_id_fk" FOREIGN KEY ("protected_file_id") REFERENCES ${schema}."payload_private_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE ${schema}."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payload_private_media_fk" FOREIGN KEY ("payload_private_media_id") REFERENCES ${schema}."payload_private_media"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_lesson_resources_protected_file_idx" ON ${schema}."payload_lesson_resources" USING btree ("protected_file_id");
  CREATE INDEX "payload_locked_documents_rels_payload_private_media_id_idx" ON ${schema}."payload_locked_documents_rels" USING btree ("payload_private_media_id");`))
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  const schema = getPayloadMigrationSchemaSqlPrefix()
  await db.execute(sql.raw(`
  ALTER TABLE ${schema}."payload_lesson_resources" DROP CONSTRAINT "payload_lesson_resources_protected_file_id_payload_private_media_id_fk";
  
  ALTER TABLE ${schema}."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_payload_private_media_fk";
  
  DROP INDEX ${schema}."payload_lesson_resources_protected_file_idx";
  DROP INDEX ${schema}."payload_locked_documents_rels_payload_private_media_id_idx";
  ALTER TABLE ${schema}."payload_lesson_resources" ALTER COLUMN "file_id" SET NOT NULL;
  ALTER TABLE ${schema}."payload_lesson_resources" DROP COLUMN "protected_file_id";
  ALTER TABLE ${schema}."payload_locked_documents_rels" DROP COLUMN "payload_private_media_id";
  ALTER TABLE ${schema}."payload_private_media" DISABLE ROW LEVEL SECURITY;
  DROP TABLE ${schema}."payload_private_media" CASCADE;`))
}
