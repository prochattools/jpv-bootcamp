import { POST_MIGRATION29_FORWARD_SEQUENCE } from './postMigration29ForwardSchemaPlan'

/**
 * Preparation-only SQL text for the post-migration29 forward schema.
 *
 * `{{schema}}` is an inert placeholder matching the repository's schema-aware
 * migration convention. This module intentionally exports strings/data only:
 * it does not import a database adapter, connect to PostgreSQL, or execute SQL.
 */
export const POST_MIGRATION29_FORWARD_SQL_DRAFT = {
  status: 'preparation_only',
  mayExecuteSql: false,
  mayRegisterDatedMigration: false,
  datedMigrationIdentity: null as null,
  schemaPlaceholder: '{{schema}}',
  sequence: POST_MIGRATION29_FORWARD_SEQUENCE.map((step) => step.id),
  forwardA: {
    id: 'forward-a-bunny-guid-first',
    preflight: {
      lessonIdCompatibility: `WITH bunny_lesson_values AS (
  SELECT
    b."id" AS bunny_video_row_id,
    b."lesson_id" AS raw_lesson_id,
    btrim(b."lesson_id") AS normalized_lesson_id,
    CASE
      WHEN b."lesson_id" IS NULL OR btrim(b."lesson_id") = '' THEN 'empty'
      WHEN btrim(b."lesson_id") ~ '^[0-9]+$' THEN 'numeric'
      ELSE 'non_numeric'
    END AS classification
  FROM {{schema}}."bunny_videos" b
), invalid_format AS (
  SELECT bunny_video_row_id, raw_lesson_id, 'non_numeric_lesson_id'::text AS reason
  FROM bunny_lesson_values
  WHERE classification = 'non_numeric'
), numeric_without_target AS (
  SELECT v.bunny_video_row_id, v.raw_lesson_id, 'missing_payload_lesson'::text AS reason
  FROM bunny_lesson_values v
  LEFT JOIN {{schema}}."payload_lessons" l
    ON l."id"::text = v.normalized_lesson_id
  WHERE v.classification = 'numeric'
    AND l."id" IS NULL
)
SELECT * FROM invalid_format
UNION ALL
SELECT * FROM numeric_without_target
ORDER BY bunny_video_row_id;`,
      gate: 'Forward A lesson_id DDL may proceed only when lessonIdCompatibility returns zero rows.',
    },
    intendedUp: [
      `ALTER TABLE {{schema}}."bunny_videos"
  ADD COLUMN IF NOT EXISTS "video_guid" varchar;`,
      `ALTER TABLE {{schema}}."bunny_videos"
  ALTER COLUMN "video_id" DROP NOT NULL;`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "bunny_videos_video_guid_unique_idx"
  ON {{schema}}."bunny_videos" USING btree ("video_guid")
  WHERE "video_guid" IS NOT NULL;`,
      `ALTER TABLE {{schema}}."bunny_videos"
  ALTER COLUMN "lesson_id" TYPE integer
  USING CASE
    WHEN "lesson_id" IS NULL OR btrim("lesson_id") = '' THEN NULL
    ELSE btrim("lesson_id")::integer
  END;`,
      `ALTER TABLE {{schema}}."bunny_videos"
  ADD CONSTRAINT "bunny_videos_lesson_id_payload_lessons_id_fk"
  FOREIGN KEY ("lesson_id") REFERENCES {{schema}}."payload_lessons"("id")
  ON DELETE set null ON UPDATE no action;`,
    ],
    rollbackPreflight: {
      numericIdRequirement: `SELECT "id", "video_guid"
FROM {{schema}}."bunny_videos"
WHERE "video_id" IS NULL
ORDER BY "id";`,
      lessonRelationshipSafety: `SELECT b."id", b."lesson_id"
FROM {{schema}}."bunny_videos" b
LEFT JOIN {{schema}}."payload_lessons" l ON l."id" = b."lesson_id"
WHERE b."lesson_id" IS NOT NULL
  AND l."id" IS NULL
ORDER BY b."id";`,
      gate: 'Rollback must stop if either rollback preflight returns rows; never restore video_id NOT NULL or remove GUID compatibility while GUID-only rows exist.',
    },
    intendedDownAfterCleanRollbackPreflight: [
      `ALTER TABLE {{schema}}."bunny_videos"
  DROP CONSTRAINT IF EXISTS "bunny_videos_lesson_id_payload_lessons_id_fk";`,
      `ALTER TABLE {{schema}}."bunny_videos"
  ALTER COLUMN "lesson_id" TYPE varchar
  USING "lesson_id"::varchar;`,
      `DROP INDEX IF EXISTS {{schema}}."bunny_videos_video_guid_unique_idx";`,
      `ALTER TABLE {{schema}}."bunny_videos"
  ALTER COLUMN "video_id" SET NOT NULL;`,
      `ALTER TABLE {{schema}}."bunny_videos"
  DROP COLUMN IF EXISTS "video_guid";`,
    ],
  },
  forwardB: {
    id: 'forward-b-lesson-comments',
    intendedUp: [
      `CREATE TYPE {{schema}}."enum_payload_lesson_comments_moderation_status"
  AS ENUM('visible', 'pending_review', 'hidden', 'deleted');`,
      `CREATE TABLE {{schema}}."payload_lesson_comments" (
  "id" serial PRIMARY KEY NOT NULL,
  "display_name" varchar NOT NULL,
  "lesson_id" integer NOT NULL,
  "author_id" integer NOT NULL,
  "parent_id" integer,
  "body" jsonb NOT NULL,
  "legacy_body_html" varchar,
  "moderation_status" {{schema}}."enum_payload_lesson_comments_moderation_status" DEFAULT 'visible' NOT NULL,
  "legacy_comment_id" varchar,
  "source_created_at" timestamp(3) with time zone,
  "metadata" jsonb,
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);`,
      `ALTER TABLE {{schema}}."payload_lesson_comments"
  ADD CONSTRAINT "payload_lesson_comments_lesson_id_payload_lessons_id_fk"
  FOREIGN KEY ("lesson_id") REFERENCES {{schema}}."payload_lessons"("id")
  ON DELETE set null ON UPDATE no action;`,
      `ALTER TABLE {{schema}}."payload_lesson_comments"
  ADD CONSTRAINT "payload_lesson_comments_author_id_payload_members_id_fk"
  FOREIGN KEY ("author_id") REFERENCES {{schema}}."payload_members"("id")
  ON DELETE set null ON UPDATE no action;`,
      `ALTER TABLE {{schema}}."payload_lesson_comments"
  ADD CONSTRAINT "payload_lesson_comments_parent_id_payload_lesson_comments_id_fk"
  FOREIGN KEY ("parent_id") REFERENCES {{schema}}."payload_lesson_comments"("id")
  ON DELETE set null ON UPDATE no action;`,
      `CREATE INDEX "payload_lesson_comments_lesson_idx"
  ON {{schema}}."payload_lesson_comments" USING btree ("lesson_id");`,
      `CREATE INDEX "payload_lesson_comments_author_idx"
  ON {{schema}}."payload_lesson_comments" USING btree ("author_id");`,
      `CREATE INDEX "payload_lesson_comments_parent_idx"
  ON {{schema}}."payload_lesson_comments" USING btree ("parent_id");`,
      `CREATE UNIQUE INDEX "payload_lesson_comments_legacy_comment_id_idx"
  ON {{schema}}."payload_lesson_comments" USING btree ("legacy_comment_id");`,
      `CREATE INDEX "payload_lesson_comments_source_created_at_idx"
  ON {{schema}}."payload_lesson_comments" USING btree ("source_created_at");`,
      `CREATE INDEX "payload_lesson_comments_updated_at_idx"
  ON {{schema}}."payload_lesson_comments" USING btree ("updated_at");`,
      `CREATE INDEX "payload_lesson_comments_created_at_idx"
  ON {{schema}}."payload_lesson_comments" USING btree ("created_at");`,
      `ALTER TABLE {{schema}}."payload_locked_documents_rels"
  ADD COLUMN IF NOT EXISTS "payload_lesson_comments_id" integer;`,
      `ALTER TABLE {{schema}}."payload_locked_documents_rels"
  ADD CONSTRAINT "payload_locked_documents_rels_payload_lesson_comments_fk"
  FOREIGN KEY ("payload_lesson_comments_id") REFERENCES {{schema}}."payload_lesson_comments"("id")
  ON DELETE cascade ON UPDATE no action;`,
      `CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_payload_lesson_comments_id_idx"
  ON {{schema}}."payload_locked_documents_rels" USING btree ("payload_lesson_comments_id");`,
    ],
    rollbackPreflight: {
      populatedTable: `SELECT count(*)::bigint AS lesson_comment_rows
FROM {{schema}}."payload_lesson_comments";`,
      gate: 'Do not drop payload_lesson_comments when lesson_comment_rows is greater than zero without explicit archive/delete approval.',
    },
    intendedDownAfterExplicitDestructiveApprovalOrEmptyTable: [
      `DROP INDEX IF EXISTS {{schema}}."payload_locked_documents_rels_payload_lesson_comments_id_idx";`,
      `ALTER TABLE {{schema}}."payload_locked_documents_rels"
  DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_payload_lesson_comments_fk";`,
      `ALTER TABLE {{schema}}."payload_locked_documents_rels"
  DROP COLUMN IF EXISTS "payload_lesson_comments_id";`,
      `DROP TABLE IF EXISTS {{schema}}."payload_lesson_comments";`,
      `DROP TYPE IF EXISTS {{schema}}."enum_payload_lesson_comments_moderation_status";`,
    ],
  },
  forwardC: {
    id: 'forward-c-space-og-media',
    intendedUp: [
      `ALTER TABLE {{schema}}."payload_spaces"
  ADD COLUMN IF NOT EXISTS "og_image_id" integer;`,
      `ALTER TABLE {{schema}}."payload_spaces"
  ADD CONSTRAINT "payload_spaces_og_image_id_payload_media_id_fk"
  FOREIGN KEY ("og_image_id") REFERENCES {{schema}}."payload_media"("id")
  ON DELETE set null ON UPDATE no action;`,
      `CREATE INDEX IF NOT EXISTS "payload_spaces_og_image_idx"
  ON {{schema}}."payload_spaces" USING btree ("og_image_id");`,
    ],
    rollbackPreflight: {
      populatedReferences: `SELECT "id", "og_image_id"
FROM {{schema}}."payload_spaces"
WHERE "og_image_id" IS NOT NULL
ORDER BY "id";`,
      gate: 'Preserve/export populated ogImage relationships before any approved rollback removes the column.',
    },
    intendedDownAfterPreservation: [
      `DROP INDEX IF EXISTS {{schema}}."payload_spaces_og_image_idx";`,
      `ALTER TABLE {{schema}}."payload_spaces"
  DROP CONSTRAINT IF EXISTS "payload_spaces_og_image_id_payload_media_id_fk";`,
      `ALTER TABLE {{schema}}."payload_spaces"
  DROP COLUMN IF EXISTS "og_image_id";`,
    ],
  },
  forwardD: {
    id: 'forward-d-space-reactions',
    intendedUp: [
      `CREATE TYPE {{schema}}."enum_payload_space_reactions_reaction_type"
  AS ENUM('like', 'bookmark', 'survey_vote');`,
      `CREATE TYPE {{schema}}."enum_payload_space_reactions_target_kind"
  AS ENUM('post', 'comment', 'survey_option');`,
      `CREATE TABLE {{schema}}."payload_space_reactions" (
  "id" serial PRIMARY KEY NOT NULL,
  "actor_member_id" integer,
  "reaction_type" {{schema}}."enum_payload_space_reactions_reaction_type" NOT NULL,
  "target_kind" {{schema}}."enum_payload_space_reactions_target_kind" NOT NULL,
  "target_post_id" integer,
  "target_comment_id" integer,
  "survey_option_key" varchar,
  "legacy_reaction_id" varchar,
  "legacy_actor_user_id" varchar,
  "legacy_actor_source_system" varchar,
  "source_created_at" timestamp(3) with time zone,
  "metadata" jsonb,
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "payload_space_reactions_target_shape"
    CHECK (
      (target_kind = 'post' AND target_post_id IS NOT NULL AND target_comment_id IS NULL AND survey_option_key IS NULL) OR
      (target_kind = 'comment' AND target_post_id IS NULL AND target_comment_id IS NOT NULL AND survey_option_key IS NULL) OR
      (target_kind = 'survey_option' AND target_post_id IS NOT NULL AND target_comment_id IS NULL AND survey_option_key IS NOT NULL)
    ),
  CONSTRAINT "payload_space_reactions_survey_vote_coupling"
    CHECK (
      (target_kind = 'survey_option' AND reaction_type = 'survey_vote') OR
      (target_kind <> 'survey_option' AND reaction_type <> 'survey_vote')
    )
);`,
      `ALTER TABLE {{schema}}."payload_space_reactions"
  ADD CONSTRAINT "payload_space_reactions_actor_member_id_payload_members_id_fk"
  FOREIGN KEY ("actor_member_id") REFERENCES {{schema}}."payload_members"("id")
  ON DELETE set null ON UPDATE no action;`,
      `ALTER TABLE {{schema}}."payload_space_reactions"
  ADD CONSTRAINT "payload_space_reactions_target_post_id_payload_space_posts_id_fk"
  FOREIGN KEY ("target_post_id") REFERENCES {{schema}}."payload_space_posts"("id")
  ON DELETE cascade ON UPDATE no action;`,
      `ALTER TABLE {{schema}}."payload_space_reactions"
  ADD CONSTRAINT "payload_space_reactions_target_comment_id_payload_space_comments_id_fk"
  FOREIGN KEY ("target_comment_id") REFERENCES {{schema}}."payload_space_comments"("id")
  ON DELETE cascade ON UPDATE no action;`,
      `CREATE UNIQUE INDEX "payload_space_reactions_actor_type_post_unique_idx"
  ON {{schema}}."payload_space_reactions" ("actor_member_id", "reaction_type", "target_post_id")
  WHERE "actor_member_id" IS NOT NULL AND "target_post_id" IS NOT NULL;`,
      `CREATE UNIQUE INDEX "payload_space_reactions_actor_type_comment_unique_idx"
  ON {{schema}}."payload_space_reactions" ("actor_member_id", "reaction_type", "target_comment_id")
  WHERE "actor_member_id" IS NOT NULL AND "target_comment_id" IS NOT NULL;`,
      `CREATE UNIQUE INDEX "payload_space_reactions_legacy_reaction_id_idx"
  ON {{schema}}."payload_space_reactions" USING btree ("legacy_reaction_id")
  WHERE "legacy_reaction_id" IS NOT NULL;`,
      `CREATE INDEX "payload_space_reactions_actor_member_idx"
  ON {{schema}}."payload_space_reactions" USING btree ("actor_member_id");`,
      `CREATE INDEX "payload_space_reactions_target_post_idx"
  ON {{schema}}."payload_space_reactions" USING btree ("target_post_id");`,
      `CREATE INDEX "payload_space_reactions_target_comment_idx"
  ON {{schema}}."payload_space_reactions" USING btree ("target_comment_id");`,
      `CREATE INDEX "payload_space_reactions_reaction_type_idx"
  ON {{schema}}."payload_space_reactions" USING btree ("reaction_type");`,
      `CREATE INDEX "payload_space_reactions_created_at_idx"
  ON {{schema}}."payload_space_reactions" USING btree ("created_at");`,
      `ALTER TABLE {{schema}}."payload_locked_documents_rels"
  ADD COLUMN IF NOT EXISTS "payload_space_reactions_id" integer;`,
      `ALTER TABLE {{schema}}."payload_locked_documents_rels"
  ADD CONSTRAINT "payload_locked_documents_rels_payload_space_reactions_fk"
  FOREIGN KEY ("payload_space_reactions_id") REFERENCES {{schema}}."payload_space_reactions"("id")
  ON DELETE cascade ON UPDATE no action;`,
      `CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_payload_space_reactions_id_idx"
  ON {{schema}}."payload_locked_documents_rels" USING btree ("payload_space_reactions_id");`,
    ],
    rollbackPreflight: {
      populatedTable: `SELECT count(*)::bigint AS space_reaction_rows
FROM {{schema}}."payload_space_reactions";`,
      gate: 'Fail closed: do not execute any down step when space_reaction_rows is greater than zero.',
    },
    intendedDownAfterExplicitDestructiveApprovalOrEmptyTable: [
      `DROP INDEX IF EXISTS {{schema}}."payload_locked_documents_rels_payload_space_reactions_id_idx";`,
      `ALTER TABLE {{schema}}."payload_locked_documents_rels"
  DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_payload_space_reactions_fk";`,
      `ALTER TABLE {{schema}}."payload_locked_documents_rels"
  DROP COLUMN IF EXISTS "payload_space_reactions_id";`,
      `DROP TABLE IF EXISTS {{schema}}."payload_space_reactions";`,
      `DROP TYPE IF EXISTS {{schema}}."enum_payload_space_reactions_target_kind";`,
      `DROP TYPE IF EXISTS {{schema}}."enum_payload_space_reactions_reaction_type";`,
    ],
  },
} as const

export type PostMigration29ForwardSqlDraft = typeof POST_MIGRATION29_FORWARD_SQL_DRAFT
