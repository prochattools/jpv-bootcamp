import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

import { getPayloadMigrationSchemaSqlPrefix } from '../lib/payloadMigrationSchema'

/**
 * Converts the legacy text module/lesson placeholders into real optional
 * relationships while preserving the old values in compatibility columns.
 * No automatic relationship backfill is attempted; unresolved legacy sessions
 * remain fail-closed until an operator reconciles them.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  const schema = getPayloadMigrationSchemaSqlPrefix()

  await db.execute(sql.raw(`
    ALTER TABLE ${schema}."live_sessions"
      RENAME COLUMN "module" TO "module_legacy";
    ALTER TABLE ${schema}."live_sessions"
      RENAME COLUMN "lesson" TO "lesson_legacy";

    ALTER TABLE ${schema}."live_sessions"
      ALTER COLUMN "module_legacy" DROP NOT NULL,
      ALTER COLUMN "lesson_legacy" DROP NOT NULL,
      ADD COLUMN "module_id" integer,
      ADD COLUMN "lesson_id" integer,
      ADD COLUMN "started_at" timestamp(3) with time zone,
      ADD COLUMN "completed_at" timestamp(3) with time zone,
      ADD COLUMN "cancelled_at" timestamp(3) with time zone;

    ALTER TABLE ${schema}."live_sessions"
      ADD CONSTRAINT "live_sessions_module_id_payload_course_modules_id_fk"
      FOREIGN KEY ("module_id") REFERENCES ${schema}."payload_course_modules"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION;

    ALTER TABLE ${schema}."live_sessions"
      ADD CONSTRAINT "live_sessions_lesson_id_payload_lessons_id_fk"
      FOREIGN KEY ("lesson_id") REFERENCES ${schema}."payload_lessons"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION;

    CREATE INDEX "live_sessions_module_id_idx"
      ON ${schema}."live_sessions" ("module_id");
    CREATE INDEX "live_sessions_lesson_id_idx"
      ON ${schema}."live_sessions" ("lesson_id");
  `))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  const schema = getPayloadMigrationSchemaSqlPrefix()

  await db.execute(sql.raw(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM ${schema}."live_sessions"
        WHERE "module_legacy" IS NULL OR "lesson_legacy" IS NULL
      ) THEN
        RAISE EXCEPTION 'live_session_relationships rollback requires no sessions created after migration';
      END IF;
    END $$;

    DROP INDEX IF EXISTS ${schema}."live_sessions_lesson_id_idx";
    DROP INDEX IF EXISTS ${schema}."live_sessions_module_id_idx";
    ALTER TABLE ${schema}."live_sessions"
      DROP CONSTRAINT IF EXISTS "live_sessions_lesson_id_payload_lessons_id_fk",
      DROP CONSTRAINT IF EXISTS "live_sessions_module_id_payload_course_modules_id_fk",
      DROP COLUMN IF EXISTS "cancelled_at",
      DROP COLUMN IF EXISTS "completed_at",
      DROP COLUMN IF EXISTS "started_at",
      DROP COLUMN IF EXISTS "lesson_id",
      DROP COLUMN IF EXISTS "module_id";

    ALTER TABLE ${schema}."live_sessions"
      RENAME COLUMN "module_legacy" TO "module";
    ALTER TABLE ${schema}."live_sessions"
      RENAME COLUMN "lesson_legacy" TO "lesson";
    ALTER TABLE ${schema}."live_sessions"
      ALTER COLUMN "module" SET NOT NULL,
      ALTER COLUMN "lesson" SET NOT NULL;
  `))
}
