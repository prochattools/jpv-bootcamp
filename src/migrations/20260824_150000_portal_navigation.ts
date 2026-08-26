import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'
import { getPayloadMigrationSchemaSqlPrefix } from '../lib/payloadMigrationSchema'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  const schema = getPayloadMigrationSchemaSqlPrefix()
  await db.execute(sql.raw(`
CREATE TABLE ${schema}."payload_portal_nav_items" (
  "id" serial PRIMARY KEY NOT NULL,
  "label" varchar NOT NULL,
  "href" varchar NOT NULL,
  "icon_name" varchar,
  "nav_group" varchar NOT NULL,
  "group_sort_order" numeric DEFAULT 0,
  "item_sort_order" numeric DEFAULT 0,
  "highlighted" boolean DEFAULT false,
  "linked_page_id" integer,
  "status" varchar DEFAULT 'active' NOT NULL,
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
ALTER TABLE ${schema}."payload_portal_nav_items" ADD CONSTRAINT "payload_portal_nav_items_linked_page_id_payload_pages_id_fk" FOREIGN KEY ("linked_page_id") REFERENCES ${schema}."payload_pages"("id") ON DELETE set null ON UPDATE no action;
CREATE INDEX "payload_portal_nav_items_linked_page_idx" ON ${schema}."payload_portal_nav_items" USING btree ("linked_page_id");
CREATE INDEX "payload_portal_nav_items_updated_at_idx" ON ${schema}."payload_portal_nav_items" USING btree ("updated_at");
CREATE INDEX "payload_portal_nav_items_created_at_idx" ON ${schema}."payload_portal_nav_items" USING btree ("created_at");
ALTER TABLE ${schema}."payload_pages" ADD COLUMN "portal_route" varchar;
ALTER TABLE ${schema}."payload_locked_documents_rels" ADD COLUMN "payload_portal_nav_items_id" integer;
ALTER TABLE ${schema}."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_portal_nav_items_fk" FOREIGN KEY ("payload_portal_nav_items_id") REFERENCES ${schema}."payload_portal_nav_items"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
CREATE INDEX "payload_locked_documents_rels_portal_nav_items_id_idx" ON ${schema}."payload_locked_documents_rels" USING btree ("payload_portal_nav_items_id");
`))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  const schema = getPayloadMigrationSchemaSqlPrefix()
  await db.execute(sql.raw(`
ALTER TABLE ${schema}."payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_portal_nav_items_fk";
ALTER TABLE ${schema}."payload_locked_documents_rels" DROP COLUMN IF EXISTS "payload_portal_nav_items_id";
ALTER TABLE ${schema}."payload_pages" DROP COLUMN IF EXISTS "portal_route";
DROP TABLE IF EXISTS ${schema}."payload_portal_nav_items";
`))
}
