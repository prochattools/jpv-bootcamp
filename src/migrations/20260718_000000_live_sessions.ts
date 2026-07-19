import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'
import { getPayloadMigrationSchemaSqlPrefix } from '../lib/payloadMigrationSchema'

export async function up({ db }: MigrateUpArgs): Promise<void> {
	const schema = getPayloadMigrationSchemaSqlPrefix()

	await db.execute(sql.raw(`
    CREATE TYPE ${schema}."enum_live_sessions_status" AS ENUM('scheduled', 'live', 'completed', 'cancelled');

    CREATE TABLE ${schema}."live_sessions" (
      "id" serial PRIMARY KEY NOT NULL,
      "title" varchar NOT NULL,
      "status" ${schema}."enum_live_sessions_status" DEFAULT 'scheduled' NOT NULL,
      "course_id" integer NOT NULL,
      "module" varchar NOT NULL,
      "lesson" varchar NOT NULL,
      "room_name" varchar NOT NULL UNIQUE,
      "host_user_id" integer NOT NULL,
      "scheduled_at" timestamp(3) with time zone NOT NULL,
      "capacity" numeric DEFAULT 50,
      "description" jsonb,
      "recording_url" varchar,
      "audit" jsonb,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE INDEX "live_sessions_room_name_idx" on ${schema}."live_sessions" ("room_name");
    CREATE INDEX "live_sessions_course_id_idx" on ${schema}."live_sessions" ("course_id");
    CREATE INDEX "live_sessions_host_user_id_idx" on ${schema}."live_sessions" ("host_user_id");
    CREATE INDEX "live_sessions_status_idx" on ${schema}."live_sessions" ("status");
    CREATE INDEX "live_sessions_scheduled_at_idx" on ${schema}."live_sessions" ("scheduled_at");

    ALTER TABLE ${schema}."live_sessions"
      ADD CONSTRAINT "live_sessions_course_id_fk"
      FOREIGN KEY ("course_id") REFERENCES ${schema}."payload_courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

    ALTER TABLE ${schema}."live_sessions"
      ADD CONSTRAINT "live_sessions_host_user_id_fk"
      FOREIGN KEY ("host_user_id") REFERENCES ${schema}."payload_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  `))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
	const schema = getPayloadMigrationSchemaSqlPrefix()

	await db.execute(sql.raw(`
    ALTER TABLE ${schema}."live_sessions" DROP CONSTRAINT "live_sessions_host_user_id_fk";
    ALTER TABLE ${schema}."live_sessions" DROP CONSTRAINT "live_sessions_course_id_fk";
    DROP INDEX ${schema}."live_sessions_scheduled_at_idx";
    DROP INDEX ${schema}."live_sessions_status_idx";
    DROP INDEX ${schema}."live_sessions_host_user_id_idx";
    DROP INDEX ${schema}."live_sessions_course_id_idx";
    DROP INDEX ${schema}."live_sessions_room_name_idx";
    DROP TABLE ${schema}."live_sessions";
    DROP TYPE ${schema}."enum_live_sessions_status";
  `))
}
