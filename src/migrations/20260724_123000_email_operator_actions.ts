import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

import { getPayloadMigrationSchemaSqlPrefix } from '../lib/payloadMigrationSchema'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  const schema = getPayloadMigrationSchemaSqlPrefix()

  await db.execute(sql.raw(`
    CREATE TYPE ${schema}."enum_payload_email_actions_action_type"
      AS ENUM('retry_delivery');
    CREATE TYPE ${schema}."enum_payload_email_actions_status"
      AS ENUM('pending', 'completed', 'failed', 'skipped');

    ALTER TABLE ${schema}."payload_email_events"
      ADD COLUMN "retry_count" numeric DEFAULT 0 NOT NULL,
      ADD COLUMN "last_retry_requested_at" timestamp(3) with time zone,
      ADD COLUMN "last_retry_requested_by_id" integer;

    ALTER TABLE ${schema}."payload_email_events"
      ADD CONSTRAINT "payload_email_events_last_retry_requested_by_id_payload_users_id_fk"
      FOREIGN KEY ("last_retry_requested_by_id") REFERENCES ${schema}."payload_users"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION;

    CREATE INDEX "payload_email_events_last_retry_requested_by_idx"
      ON ${schema}."payload_email_events" ("last_retry_requested_by_id");

    CREATE TABLE ${schema}."payload_email_actions" (
      "id" serial PRIMARY KEY NOT NULL,
      "display_name" varchar NOT NULL,
      "email_event_id" integer NOT NULL,
      "action_type" ${schema}."enum_payload_email_actions_action_type" DEFAULT 'retry_delivery' NOT NULL,
      "requested_by_id" integer,
      "status" ${schema}."enum_payload_email_actions_status" DEFAULT 'pending' NOT NULL,
      "note" varchar,
      "completed_at" timestamp(3) with time zone,
      "result" jsonb,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    ALTER TABLE ${schema}."payload_email_actions"
      ADD CONSTRAINT "payload_email_actions_email_event_id_payload_email_events_id_fk"
      FOREIGN KEY ("email_event_id") REFERENCES ${schema}."payload_email_events"("id")
      ON DELETE RESTRICT ON UPDATE NO ACTION;

    ALTER TABLE ${schema}."payload_email_actions"
      ADD CONSTRAINT "payload_email_actions_requested_by_id_payload_users_id_fk"
      FOREIGN KEY ("requested_by_id") REFERENCES ${schema}."payload_users"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION;

    CREATE INDEX "payload_email_actions_email_event_idx"
      ON ${schema}."payload_email_actions" ("email_event_id");
    CREATE INDEX "payload_email_actions_requested_by_idx"
      ON ${schema}."payload_email_actions" ("requested_by_id");
    CREATE INDEX "payload_email_actions_updated_at_idx"
      ON ${schema}."payload_email_actions" ("updated_at");
    CREATE INDEX "payload_email_actions_created_at_idx"
      ON ${schema}."payload_email_actions" ("created_at");

    ALTER TABLE ${schema}."payload_locked_documents_rels"
      ADD COLUMN "payload_email_actions_id" integer;
    ALTER TABLE ${schema}."payload_locked_documents_rels"
      ADD CONSTRAINT "payload_locked_documents_rels_payload_email_actions_fk"
      FOREIGN KEY ("payload_email_actions_id") REFERENCES ${schema}."payload_email_actions"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION;
    CREATE INDEX "payload_locked_documents_rels_payload_email_actions_idx"
      ON ${schema}."payload_locked_documents_rels" ("payload_email_actions_id");
  `))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  const schema = getPayloadMigrationSchemaSqlPrefix()

  await db.execute(sql.raw(`
    DROP INDEX IF EXISTS ${schema}."payload_locked_documents_rels_payload_email_actions_idx";
    ALTER TABLE ${schema}."payload_locked_documents_rels"
      DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_payload_email_actions_fk",
      DROP COLUMN IF EXISTS "payload_email_actions_id";

    DROP INDEX IF EXISTS ${schema}."payload_email_actions_created_at_idx";
    DROP INDEX IF EXISTS ${schema}."payload_email_actions_updated_at_idx";
    DROP INDEX IF EXISTS ${schema}."payload_email_actions_requested_by_idx";
    DROP INDEX IF EXISTS ${schema}."payload_email_actions_email_event_idx";
    ALTER TABLE ${schema}."payload_email_actions"
      DROP CONSTRAINT IF EXISTS "payload_email_actions_requested_by_id_payload_users_id_fk",
      DROP CONSTRAINT IF EXISTS "payload_email_actions_email_event_id_payload_email_events_id_fk";
    DROP TABLE IF EXISTS ${schema}."payload_email_actions";
    DROP TYPE IF EXISTS ${schema}."enum_payload_email_actions_status";
    DROP TYPE IF EXISTS ${schema}."enum_payload_email_actions_action_type";

    DROP INDEX IF EXISTS ${schema}."payload_email_events_last_retry_requested_by_idx";
    ALTER TABLE ${schema}."payload_email_events"
      DROP CONSTRAINT IF EXISTS "payload_email_events_last_retry_requested_by_id_payload_users_id_fk",
      DROP COLUMN IF EXISTS "last_retry_requested_by_id",
      DROP COLUMN IF EXISTS "last_retry_requested_at",
      DROP COLUMN IF EXISTS "retry_count";
  `))
}
