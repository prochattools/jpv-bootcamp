import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'
import { getPayloadMigrationSchema } from '../lib/payloadMigrationSchema'

/**
 * Reconciliation migration:
 * 1. Rename visual_lock_state → lock_state on payload_lessons (if needed)
 * 2. Add 'vip' to enum_payload_courses_access_badge
 * 3. Add unique constraint on (member_id, lesson_id) in payload_lesson_progress
 *
 * VALIDATE ONLY — review before applying to staging DB.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  const schema = getPayloadMigrationSchema()
  await db.execute(sql.raw(`
DO $$
BEGIN
  -- 1. Reconcile visual_lock_state → lock_state
  -- If visual_lock_state column exists but lock_state does not, rename it.
  -- If both exist, drop visual_lock_state (Payload already created lock_state).
  -- If only lock_state exists, nothing to do.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = '${schema}' AND table_name = 'payload_lessons'
      AND column_name = 'visual_lock_state'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = '${schema}' AND table_name = 'payload_lessons'
      AND column_name = 'lock_state'
  ) THEN
    -- Rename the enum type to match the new column name
    IF EXISTS (
      SELECT 1 FROM pg_type t
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = '${schema}' AND t.typname = 'enum_payload_lessons_visual_lock_state'
    ) THEN
      ALTER TYPE ${schema}."enum_payload_lessons_visual_lock_state"
        RENAME TO "enum_payload_lessons_lock_state";
    END IF;
    ALTER TABLE ${schema}.payload_lessons
      RENAME COLUMN "visual_lock_state" TO "lock_state";
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = '${schema}' AND table_name = 'payload_lessons'
      AND column_name = 'visual_lock_state'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = '${schema}' AND table_name = 'payload_lessons'
      AND column_name = 'lock_state'
  ) THEN
    -- Both exist: Payload auto-created lock_state. Migrate data and drop old column.
    UPDATE ${schema}.payload_lessons
    SET lock_state = visual_lock_state::text::${schema}."enum_payload_lessons_lock_state"
    WHERE lock_state IS NULL AND visual_lock_state IS NOT NULL;
    ALTER TABLE ${schema}.payload_lessons DROP COLUMN "visual_lock_state";
    -- Drop the old enum type if it still exists
    DROP TYPE IF EXISTS ${schema}."enum_payload_lessons_visual_lock_state";
  END IF;

  -- 2. Add 'vip' to enum_payload_courses_access_badge if missing
  IF EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = '${schema}' AND t.typname = 'enum_payload_courses_access_badge'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = '${schema}'
      AND t.typname = 'enum_payload_courses_access_badge'
      AND e.enumlabel = 'vip'
  ) THEN
    ALTER TYPE ${schema}."enum_payload_courses_access_badge" ADD VALUE IF NOT EXISTS 'vip';
  END IF;

  -- 3. Add unique constraint on (member_id, lesson_id) in payload_lesson_progress
  IF to_regclass('${schema}.payload_lesson_progress') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      WHERE n.nspname = '${schema}'
        AND c.conrelid = '${schema}.payload_lesson_progress'::regclass
        AND c.contype = 'u'
        AND array_length(c.conkey, 1) = 2
    ) THEN
    -- Remove duplicates before adding constraint (keep the latest by updated_at)
    DELETE FROM ${schema}.payload_lesson_progress a
    USING ${schema}.payload_lesson_progress b
    WHERE a.member_id = b.member_id
      AND a.lesson_id = b.lesson_id
      AND a.id <> b.id
      AND a.updated_at < b.updated_at;

    ALTER TABLE ${schema}.payload_lesson_progress
      ADD CONSTRAINT payload_lesson_progress_member_lesson_unique
      UNIQUE (member_id, lesson_id);
  END IF;
END $$;
  `))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  const schema = getPayloadMigrationSchema()
  await db.execute(sql.raw(`
DO $$
BEGIN
  -- Reverse unique constraint
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payload_lesson_progress_member_lesson_unique'
  ) THEN
    ALTER TABLE ${schema}.payload_lesson_progress
      DROP CONSTRAINT payload_lesson_progress_member_lesson_unique;
  END IF;

  -- Note: enum value removal and column rename reversal are destructive and intentionally
  -- not automated. Restore from backup if a rollback is needed.
END $$;
  `))
}
