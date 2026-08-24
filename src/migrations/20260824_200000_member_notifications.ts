import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'
import { getPayloadMigrationSchemaSqlPrefix } from '../lib/payloadMigrationSchema'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  const schema = getPayloadMigrationSchemaSqlPrefix()
  await db.execute(sql.raw(`
CREATE TABLE ${schema}."payload_member_notifications" (
  "id" serial PRIMARY KEY NOT NULL,
  "member_id" integer NOT NULL,
  "type" varchar NOT NULL,
  "actor_name" varchar,
  "title" varchar,
  "href" varchar,
  "read" boolean DEFAULT false NOT NULL,
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
ALTER TABLE ${schema}."payload_member_notifications" ADD CONSTRAINT "payload_member_notifications_member_id_payload_members_id_fk" FOREIGN KEY ("member_id") REFERENCES ${schema}."payload_members"("id") ON DELETE CASCADE ON UPDATE no action;
CREATE INDEX "payload_member_notifications_member_idx" ON ${schema}."payload_member_notifications" USING btree ("member_id");
CREATE INDEX "payload_member_notifications_member_read_idx" ON ${schema}."payload_member_notifications" USING btree ("member_id", "read");
CREATE INDEX "payload_member_notifications_updated_at_idx" ON ${schema}."payload_member_notifications" USING btree ("updated_at");
CREATE INDEX "payload_member_notifications_created_at_idx" ON ${schema}."payload_member_notifications" USING btree ("created_at");
ALTER TABLE ${schema}."payload_locked_documents_rels" ADD COLUMN "payload_member_notifications_id" integer;
ALTER TABLE ${schema}."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_member_notifications_fk" FOREIGN KEY ("payload_member_notifications_id") REFERENCES ${schema}."payload_member_notifications"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
CREATE INDEX "payload_locked_documents_rels_member_notifications_id_idx" ON ${schema}."payload_locked_documents_rels" USING btree ("payload_member_notifications_id");
`))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  const schema = getPayloadMigrationSchemaSqlPrefix()
  await db.execute(sql.raw(`
ALTER TABLE ${schema}."payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_member_notifications_fk";
ALTER TABLE ${schema}."payload_locked_documents_rels" DROP COLUMN IF EXISTS "payload_member_notifications_id";
DROP TABLE IF EXISTS ${schema}."payload_member_notifications";
`))
}
