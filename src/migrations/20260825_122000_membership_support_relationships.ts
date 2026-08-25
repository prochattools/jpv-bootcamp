import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

import { getPayloadMigrationSchemaSqlPrefix } from '../lib/payloadMigrationSchema'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  const schema = getPayloadMigrationSchemaSqlPrefix()
  await db.execute(sql.raw(`
    CREATE TABLE ${schema}."payload_membership_support_records_rels" (
      "id" serial PRIMARY KEY NOT NULL,
      "order" integer,
      "parent_id" integer NOT NULL,
      "path" varchar NOT NULL,
      "payload_membership_support_records_id" integer,
      "payload_membership_review_queue_items_id" integer,
      "payload_operator_notes_id" integer,
      "payload_membership_audit_history_id" integer,
      "payload_stripe_shadow_projections_id" integer,
      "payload_membership_funding_sources_id" integer
    );

    ALTER TABLE ${schema}."payload_membership_support_records_rels"
      ADD CONSTRAINT "payload_membership_support_records_rels_parent_fk"
      FOREIGN KEY ("parent_id") REFERENCES ${schema}."payload_membership_support_records"("id") ON DELETE cascade;
    ALTER TABLE ${schema}."payload_membership_support_records_rels"
      ADD CONSTRAINT "payload_membership_support_records_rels_support_fk"
      FOREIGN KEY ("payload_membership_support_records_id") REFERENCES ${schema}."payload_membership_support_records"("id") ON DELETE cascade;
    ALTER TABLE ${schema}."payload_membership_support_records_rels"
      ADD CONSTRAINT "payload_membership_support_records_rels_review_fk"
      FOREIGN KEY ("payload_membership_review_queue_items_id") REFERENCES ${schema}."payload_membership_review_queue_items"("id") ON DELETE cascade;
    ALTER TABLE ${schema}."payload_membership_support_records_rels"
      ADD CONSTRAINT "payload_membership_support_records_rels_notes_fk"
      FOREIGN KEY ("payload_operator_notes_id") REFERENCES ${schema}."payload_operator_notes"("id") ON DELETE cascade;
    ALTER TABLE ${schema}."payload_membership_support_records_rels"
      ADD CONSTRAINT "payload_membership_support_records_rels_audit_fk"
      FOREIGN KEY ("payload_membership_audit_history_id") REFERENCES ${schema}."payload_membership_audit_history"("id") ON DELETE cascade;
    ALTER TABLE ${schema}."payload_membership_support_records_rels"
      ADD CONSTRAINT "payload_membership_support_records_rels_shadow_fk"
      FOREIGN KEY ("payload_stripe_shadow_projections_id") REFERENCES ${schema}."payload_stripe_shadow_projections"("id") ON DELETE cascade;
    ALTER TABLE ${schema}."payload_membership_support_records_rels"
      ADD CONSTRAINT "payload_membership_support_records_rels_funding_fk"
      FOREIGN KEY ("payload_membership_funding_sources_id") REFERENCES ${schema}."payload_membership_funding_sources"("id") ON DELETE cascade;

    CREATE INDEX "payload_membership_support_records_rels_order_idx" ON ${schema}."payload_membership_support_records_rels" ("order");
    CREATE INDEX "payload_membership_support_records_rels_parent_idx" ON ${schema}."payload_membership_support_records_rels" ("parent_id");
    CREATE INDEX "payload_membership_support_records_rels_path_idx" ON ${schema}."payload_membership_support_records_rels" ("path");
    CREATE INDEX "payload_membership_support_records_rels_support_idx" ON ${schema}."payload_membership_support_records_rels" ("payload_membership_support_records_id");
    CREATE INDEX "payload_membership_support_records_rels_review_idx" ON ${schema}."payload_membership_support_records_rels" ("payload_membership_review_queue_items_id");
    CREATE INDEX "payload_membership_support_records_rels_notes_idx" ON ${schema}."payload_membership_support_records_rels" ("payload_operator_notes_id");
    CREATE INDEX "payload_membership_support_records_rels_audit_idx" ON ${schema}."payload_membership_support_records_rels" ("payload_membership_audit_history_id");
    CREATE INDEX "payload_membership_support_records_rels_shadow_idx" ON ${schema}."payload_membership_support_records_rels" ("payload_stripe_shadow_projections_id");
    CREATE INDEX "payload_membership_support_records_rels_funding_idx" ON ${schema}."payload_membership_support_records_rels" ("payload_membership_funding_sources_id");
  `))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  const schema = getPayloadMigrationSchemaSqlPrefix()
  await db.execute(sql.raw(`DROP TABLE IF EXISTS ${schema}."payload_membership_support_records_rels" CASCADE;`))
}
