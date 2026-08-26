import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

import { getPayloadMigrationSchemaSqlPrefix } from '../lib/payloadMigrationSchema'

/**
 * Adds community space support to live_sessions.
 *
 * Changes:
 *   - Adds optional space_id FK column pointing to payload_spaces
 *   - Makes course_id nullable (sessions may now be space-only)
 *   - Adds CHECK constraint: course_id IS NOT NULL OR space_id IS NOT NULL
 *
 * Existing course-based sessions are unaffected; course_id remains populated.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  const schema = getPayloadMigrationSchemaSqlPrefix()

  await db.execute(sql.raw(`
    ALTER TABLE ${schema}."live_sessions"
      ALTER COLUMN "course_id" DROP NOT NULL,
      ADD COLUMN "space_id" integer;

    ALTER TABLE ${schema}."live_sessions"
      ADD CONSTRAINT "live_sessions_space_id_payload_spaces_id_fk"
      FOREIGN KEY ("space_id") REFERENCES ${schema}."payload_spaces"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION;

    CREATE INDEX "live_sessions_space_id_idx"
      ON ${schema}."live_sessions" ("space_id");

    ALTER TABLE ${schema}."live_sessions"
      ADD CONSTRAINT "live_sessions_course_or_space_required"
      CHECK (
        "course_id" IS NOT NULL OR "space_id" IS NOT NULL
      );
  `))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  const schema = getPayloadMigrationSchemaSqlPrefix()

  await db.execute(sql.raw(`
    ALTER TABLE ${schema}."live_sessions"
      DROP CONSTRAINT IF EXISTS "live_sessions_course_or_space_required";

    DROP INDEX IF EXISTS ${schema}."live_sessions_space_id_idx";

    ALTER TABLE ${schema}."live_sessions"
      DROP CONSTRAINT IF EXISTS "live_sessions_space_id_payload_spaces_id_fk",
      DROP COLUMN IF EXISTS "space_id";

    ALTER TABLE ${schema}."live_sessions"
      ALTER COLUMN "course_id" SET NOT NULL;
  `))
}
