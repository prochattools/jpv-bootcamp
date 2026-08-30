import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

import { getPayloadMigrationSchemaSqlPrefix } from '../lib/payloadMigrationSchema'

/**
 * Durable member-portal Room support. This migration is additive for existing
 * live_sessions and preserves all legacy course/space records.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  const schema = getPayloadMigrationSchemaSqlPrefix()

  await db.execute(sql.raw(`
DO $$ BEGIN
  ALTER TYPE ${schema}."enum_live_sessions_audience" ADD VALUE IF NOT EXISTS 'groups';
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE ${schema}."live_sessions"
  DROP CONSTRAINT IF EXISTS "live_sessions_course_or_space_required",
  ADD COLUMN IF NOT EXISTS "target_group_ids" jsonb,
  ADD COLUMN IF NOT EXISTS "archived" boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS "archived_at" timestamp(3) with time zone;
CREATE INDEX IF NOT EXISTS "live_sessions_archived_idx" ON ${schema}."live_sessions" ("archived");

UPDATE ${schema}."payload_portal_nav_items"
SET "label" = 'Rooms', "href" = '/portal/rooms'
WHERE "href" = '/portal/live-sessions';

DO $$ BEGIN
  CREATE TYPE ${schema}."enum_payload_room_categories_status" AS ENUM('active', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE TABLE IF NOT EXISTS ${schema}."payload_room_categories" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" varchar NOT NULL,
  "slug" varchar NOT NULL,
  "status" ${schema}."enum_payload_room_categories_status" DEFAULT 'active' NOT NULL,
  "sort_order" numeric DEFAULT 0,
  "description" varchar,
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "payload_room_categories_slug_unique_idx" ON ${schema}."payload_room_categories" ("slug");
CREATE INDEX IF NOT EXISTS "payload_room_categories_status_idx" ON ${schema}."payload_room_categories" ("status");
CREATE INDEX IF NOT EXISTS "payload_room_categories_sort_order_idx" ON ${schema}."payload_room_categories" ("sort_order");

CREATE TABLE IF NOT EXISTS ${schema}."live_sessions_rels" (
  "id" serial PRIMARY KEY NOT NULL,
  "order" integer,
  "parent_id" integer NOT NULL,
  "path" varchar NOT NULL,
  "payload_room_categories_id" integer
);
ALTER TABLE ${schema}."live_sessions_rels"
  ADD CONSTRAINT "live_sessions_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES ${schema}."live_sessions"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  ADD CONSTRAINT "live_sessions_rels_category_fk" FOREIGN KEY ("payload_room_categories_id") REFERENCES ${schema}."payload_room_categories"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
CREATE INDEX IF NOT EXISTS "live_sessions_rels_order_idx" ON ${schema}."live_sessions_rels" ("order");
CREATE INDEX IF NOT EXISTS "live_sessions_rels_parent_idx" ON ${schema}."live_sessions_rels" ("parent_id");
CREATE INDEX IF NOT EXISTS "live_sessions_rels_path_idx" ON ${schema}."live_sessions_rels" ("path");
CREATE INDEX IF NOT EXISTS "live_sessions_rels_category_idx" ON ${schema}."live_sessions_rels" ("payload_room_categories_id");

DO $$ BEGIN
  CREATE TYPE ${schema}."enum_payload_room_access_grant_source" AS ENUM('all_active', 'selected', 'member_group', 'enrolled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE ${schema}."enum_payload_room_access_status" AS ENUM('active', 'revoked');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE TABLE IF NOT EXISTS ${schema}."payload_room_access" (
  "id" serial PRIMARY KEY NOT NULL,
  "room_id" integer NOT NULL,
  "member_id" integer NOT NULL,
  "grant_source" ${schema}."enum_payload_room_access_grant_source" DEFAULT 'all_active' NOT NULL,
  "status" ${schema}."enum_payload_room_access_status" DEFAULT 'active' NOT NULL,
  "event_key" varchar NOT NULL,
  "granted_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "revoked_at" timestamp(3) with time zone,
  "metadata" jsonb,
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
ALTER TABLE ${schema}."payload_room_access"
  ADD CONSTRAINT "payload_room_access_room_fk" FOREIGN KEY ("room_id") REFERENCES ${schema}."live_sessions"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  ADD CONSTRAINT "payload_room_access_member_fk" FOREIGN KEY ("member_id") REFERENCES ${schema}."payload_members"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
CREATE UNIQUE INDEX IF NOT EXISTS "payload_room_access_room_member_unique_idx" ON ${schema}."payload_room_access" ("room_id", "member_id");
CREATE UNIQUE INDEX IF NOT EXISTS "payload_room_access_event_key_unique_idx" ON ${schema}."payload_room_access" ("event_key");
CREATE INDEX IF NOT EXISTS "payload_room_access_room_status_idx" ON ${schema}."payload_room_access" ("room_id", "status");
CREATE INDEX IF NOT EXISTS "payload_room_access_member_status_idx" ON ${schema}."payload_room_access" ("member_id", "status");

ALTER TABLE ${schema}."payload_member_notifications"
  ADD COLUMN IF NOT EXISTS "event_key" varchar;
CREATE UNIQUE INDEX IF NOT EXISTS "payload_member_notifications_event_key_unique_idx" ON ${schema}."payload_member_notifications" ("event_key") WHERE "event_key" IS NOT NULL;

ALTER TABLE ${schema}."payload_admin_notifications"
  ADD COLUMN IF NOT EXISTS "event_key" varchar;
CREATE UNIQUE INDEX IF NOT EXISTS "payload_admin_notifications_event_key_unique_idx" ON ${schema}."payload_admin_notifications" ("event_key") WHERE "event_key" IS NOT NULL;

ALTER TABLE ${schema}."payload_locked_documents_rels"
  ADD COLUMN IF NOT EXISTS "payload_room_categories_id" integer,
  ADD COLUMN IF NOT EXISTS "payload_room_access_id" integer;
ALTER TABLE ${schema}."payload_locked_documents_rels"
  ADD CONSTRAINT "payload_locked_documents_rels_room_categories_fk" FOREIGN KEY ("payload_room_categories_id") REFERENCES ${schema}."payload_room_categories"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  ADD CONSTRAINT "payload_locked_documents_rels_room_access_fk" FOREIGN KEY ("payload_room_access_id") REFERENCES ${schema}."payload_room_access"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_room_categories_id_idx" ON ${schema}."payload_locked_documents_rels" ("payload_room_categories_id");
CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_room_access_id_idx" ON ${schema}."payload_locked_documents_rels" ("payload_room_access_id");
`))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  const schema = getPayloadMigrationSchemaSqlPrefix()
  await db.execute(sql.raw(`
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM ${schema}."payload_room_access" LIMIT 1)
    OR EXISTS (SELECT 1 FROM ${schema}."payload_room_categories" LIMIT 1)
    OR EXISTS (SELECT 1 FROM ${schema}."live_sessions" WHERE "audience"::text = 'groups' OR "target_group_ids" IS NOT NULL OR "archived" = true)
    OR EXISTS (SELECT 1 FROM ${schema}."payload_member_notifications" WHERE "event_key" IS NOT NULL)
    OR EXISTS (SELECT 1 FROM ${schema}."payload_admin_notifications" WHERE "event_key" IS NOT NULL)
  THEN RAISE EXCEPTION 'member_portal_rooms_rollback_blocked_populated_data';
  END IF;
END $$;
UPDATE ${schema}."payload_portal_nav_items"
SET "label" = 'Live', "href" = '/portal/live-sessions'
WHERE "href" = '/portal/rooms';
DROP INDEX IF EXISTS ${schema}."payload_locked_documents_rels_room_categories_id_idx";
DROP INDEX IF EXISTS ${schema}."payload_locked_documents_rels_room_access_id_idx";
ALTER TABLE ${schema}."payload_locked_documents_rels"
  DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_room_categories_fk",
  DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_room_access_fk",
  DROP COLUMN IF EXISTS "payload_room_categories_id",
  DROP COLUMN IF EXISTS "payload_room_access_id";
DROP INDEX IF EXISTS ${schema}."payload_member_notifications_event_key_unique_idx";
DROP INDEX IF EXISTS ${schema}."payload_admin_notifications_event_key_unique_idx";
ALTER TABLE ${schema}."payload_member_notifications" DROP COLUMN IF EXISTS "event_key";
ALTER TABLE ${schema}."payload_admin_notifications" DROP COLUMN IF EXISTS "event_key";
DROP INDEX IF EXISTS ${schema}."payload_room_access_room_member_unique_idx";
DROP INDEX IF EXISTS ${schema}."payload_room_access_event_key_unique_idx";
DROP INDEX IF EXISTS ${schema}."payload_room_access_room_status_idx";
DROP INDEX IF EXISTS ${schema}."payload_room_access_member_status_idx";
ALTER TABLE ${schema}."payload_room_access"
  DROP CONSTRAINT IF EXISTS "payload_room_access_room_fk",
  DROP CONSTRAINT IF EXISTS "payload_room_access_member_fk";
DROP TABLE IF EXISTS ${schema}."payload_room_access";
DROP TYPE IF EXISTS ${schema}."enum_payload_room_access_grant_source";
DROP TYPE IF EXISTS ${schema}."enum_payload_room_access_status";
DROP INDEX IF EXISTS ${schema}."live_sessions_rels_order_idx";
DROP INDEX IF EXISTS ${schema}."live_sessions_rels_parent_idx";
DROP INDEX IF EXISTS ${schema}."live_sessions_rels_path_idx";
DROP INDEX IF EXISTS ${schema}."live_sessions_rels_category_idx";
DROP TABLE IF EXISTS ${schema}."live_sessions_rels";
DROP INDEX IF EXISTS ${schema}."payload_room_categories_slug_unique_idx";
DROP INDEX IF EXISTS ${schema}."payload_room_categories_status_idx";
DROP INDEX IF EXISTS ${schema}."payload_room_categories_sort_order_idx";
DROP TABLE IF EXISTS ${schema}."payload_room_categories";
DROP TYPE IF EXISTS ${schema}."enum_payload_room_categories_status";
ALTER TABLE ${schema}."live_sessions" DROP COLUMN IF EXISTS "target_group_ids", DROP COLUMN IF EXISTS "archived_at", DROP COLUMN IF EXISTS "archived";
DROP INDEX IF EXISTS ${schema}."live_sessions_archived_idx";
`))
}
