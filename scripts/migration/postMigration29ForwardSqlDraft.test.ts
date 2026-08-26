import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { POST_MIGRATION29_FORWARD_SQL_DRAFT } from './postMigration29ForwardSqlDraft'

async function run(): Promise<void> {
  const draft = POST_MIGRATION29_FORWARD_SQL_DRAFT
  const sourcePath = fileURLToPath(new URL('./postMigration29ForwardSqlDraft.ts', import.meta.url))
  const source = await readFile(sourcePath, 'utf8')

  assert.equal(draft.status, 'preparation_only')
  assert.equal(draft.mayExecuteSql, false)
  assert.equal(draft.mayRegisterDatedMigration, false)
  assert.equal(draft.datedMigrationIdentity, null)
  assert.equal(draft.schemaPlaceholder, '{{schema}}')
  assert.deepEqual(draft.sequence, [
    'forward-a-bunny-guid-first',
    'forward-b-lesson-comments',
    'forward-c-space-og-media',
    'forward-d-space-reactions',
  ])

  // Static safety: the draft is data only and has no database/process execution surface.
  assert.doesNotMatch(source, /@payloadcms\/db-postgres/)
  assert.doesNotMatch(source, /child_process|node:child_process/)
  assert.doesNotMatch(source, /\bdb\.execute\b|\bdb\.query\b|\bpool\.query\b/)
  assert.doesNotMatch(source, /export\s+(?:async\s+)?function\s+(?:execute|apply|up|down)\b/)
  assert.doesNotMatch(source, /src\/migrations/)

  const bunnyPreflight = draft.forwardA.preflight.lessonIdCompatibility
  assert.match(bunnyPreflight, /classification = 'non_numeric'/)
  assert.match(bunnyPreflight, /LEFT JOIN \{\{schema\}\}\."payload_lessons"/)
  assert.match(bunnyPreflight, /l\."id"::text = v\.normalized_lesson_id/)
  assert.doesNotMatch(bunnyPreflight, /::integer/)
  assert.match(draft.forwardA.preflight.gate, /zero rows/)

  const bunnyUp = draft.forwardA.intendedUp.join('\n')
  assert.match(bunnyUp, /ADD COLUMN IF NOT EXISTS "video_guid" varchar/)
  assert.match(bunnyUp, /ALTER COLUMN "video_id" DROP NOT NULL/)
  assert.match(bunnyUp, /bunny_videos_video_guid_unique_idx/)
  assert.match(bunnyUp, /WHERE "video_guid" IS NOT NULL/)
  assert.match(bunnyUp, /ALTER COLUMN "lesson_id" TYPE integer/)
  assert.match(bunnyUp, /bunny_videos_lesson_id_payload_lessons_id_fk/)
  assert.match(bunnyUp, /REFERENCES \{\{schema\}\}\."payload_lessons"\("id"\)/)
  assert.match(bunnyUp, /ON DELETE set null/)

  assert.match(draft.forwardA.rollbackPreflight.numericIdRequirement, /"video_id" IS NULL/)
  assert.match(draft.forwardA.rollbackPreflight.lessonRelationshipSafety, /payload_lessons/)
  assert.match(draft.forwardA.rollbackPreflight.gate, /Rollback must stop/)

  const lessonUp = draft.forwardB.intendedUp.join('\n')
  assert.match(lessonUp, /enum_payload_lesson_comments_moderation_status/)
  assert.match(lessonUp, /AS ENUM\('visible', 'pending_review', 'hidden', 'deleted'\)/)
  assert.match(lessonUp, /CREATE TABLE \{\{schema\}\}\."payload_lesson_comments"/)
  for (const column of [
    'display_name',
    'lesson_id',
    'author_id',
    'parent_id',
    'body',
    'legacy_body_html',
    'moderation_status',
    'legacy_comment_id',
    'source_created_at',
    'metadata',
    'updated_at',
    'created_at',
  ]) {
    assert.match(lessonUp, new RegExp(`"${column}"`))
  }
  assert.match(lessonUp, /payload_lesson_comments_lesson_id_payload_lessons_id_fk/)
  assert.match(lessonUp, /payload_lesson_comments_author_id_payload_members_id_fk/)
  assert.match(lessonUp, /payload_lesson_comments_parent_id_payload_lesson_comments_id_fk/)
  assert.match(lessonUp, /CREATE UNIQUE INDEX "payload_lesson_comments_legacy_comment_id_idx"/)
  assert.match(lessonUp, /payload_lesson_comments_source_created_at_idx/)
  assert.match(lessonUp, /ADD COLUMN IF NOT EXISTS "payload_lesson_comments_id" integer/)
  assert.match(lessonUp, /payload_locked_documents_rels_payload_lesson_comments_fk/)
  assert.match(lessonUp, /payload_locked_documents_rels_payload_lesson_comments_id_idx/)
  assert.match(draft.forwardB.rollbackPreflight.populatedTable, /count\(\*\)::bigint/)
  assert.match(draft.forwardB.rollbackPreflight.gate, /Do not drop payload_lesson_comments/)

  const spaceOgUp = draft.forwardC.intendedUp.join('\n')
  assert.match(spaceOgUp, /ADD COLUMN IF NOT EXISTS "og_image_id" integer/)
  assert.match(spaceOgUp, /payload_spaces_og_image_id_payload_media_id_fk/)
  assert.match(spaceOgUp, /REFERENCES \{\{schema\}\}\."payload_media"\("id"\)/)
  assert.match(spaceOgUp, /payload_spaces_og_image_idx/)
  assert.doesNotMatch(spaceOgUp, /cover_image_id|coverImage/)
  assert.match(draft.forwardC.rollbackPreflight.populatedReferences, /"og_image_id" IS NOT NULL/)
  assert.match(draft.forwardC.rollbackPreflight.gate, /Preserve\/export populated ogImage relationships/)

  const spaceReactionsUp = draft.forwardD.intendedUp.join('\n')
  assert.match(spaceReactionsUp, /enum_payload_space_reactions_reaction_type/)
  assert.match(spaceReactionsUp, /AS ENUM\('like', 'bookmark', 'survey_vote'\)/)
  assert.match(spaceReactionsUp, /enum_payload_space_reactions_target_kind/)
  assert.match(spaceReactionsUp, /AS ENUM\('post', 'comment', 'survey_option'\)/)
  assert.match(spaceReactionsUp, /CREATE TABLE \{\{schema\}\}\."payload_space_reactions"/)
  assert.match(spaceReactionsUp, /"actor_member_id" integer/)
  assert.match(spaceReactionsUp, /"survey_option_key" varchar/)
  assert.match(spaceReactionsUp, /"legacy_reaction_id" varchar/)
  assert.match(spaceReactionsUp, /"legacy_actor_user_id" varchar/)
  assert.match(spaceReactionsUp, /"source_created_at"/)
  assert.match(spaceReactionsUp, /payload_space_reactions_target_shape/)
  assert.match(spaceReactionsUp, /target_kind = 'survey_option'/)
  assert.match(spaceReactionsUp, /survey_option_key IS NOT NULL/)
  assert.match(spaceReactionsUp, /payload_space_reactions_survey_vote_coupling/)
  assert.match(spaceReactionsUp, /reaction_type = 'survey_vote'/)
  assert.doesNotMatch(spaceReactionsUp, /payload_space_reactions_target_xor/)
  assert.match(spaceReactionsUp, /payload_space_reactions_actor_member_id_payload_members_id_fk/)
  assert.match(spaceReactionsUp, /REFERENCES \{\{schema\}\}\."payload_members"\("id"\)/)
  assert.match(spaceReactionsUp, /ON DELETE set null/)
  assert.match(spaceReactionsUp, /payload_space_reactions_target_post_id_payload_space_posts_id_fk/)
  assert.match(spaceReactionsUp, /ON DELETE cascade/)
  assert.match(spaceReactionsUp, /payload_space_reactions_actor_type_post_unique_idx/)
  assert.match(spaceReactionsUp, /WHERE "actor_member_id" IS NOT NULL AND "target_post_id" IS NOT NULL/)
  assert.match(spaceReactionsUp, /payload_space_reactions_actor_type_comment_unique_idx/)
  assert.match(spaceReactionsUp, /WHERE "actor_member_id" IS NOT NULL AND "target_comment_id" IS NOT NULL/)
  assert.match(spaceReactionsUp, /payload_space_reactions_legacy_reaction_id_idx/)
  assert.match(spaceReactionsUp, /WHERE "legacy_reaction_id" IS NOT NULL/)
  assert.match(spaceReactionsUp, /payload_space_reactions_actor_member_idx/)
  assert.match(spaceReactionsUp, /ADD COLUMN IF NOT EXISTS "payload_space_reactions_id" integer/)
  assert.match(spaceReactionsUp, /payload_locked_documents_rels_payload_space_reactions_fk/)
  assert.match(spaceReactionsUp, /payload_locked_documents_rels_payload_space_reactions_id_idx/)
  assert.match(draft.forwardD.rollbackPreflight.populatedTable, /count\(\*\)::bigint/)
  assert.match(draft.forwardD.rollbackPreflight.gate, /Fail closed/)

  process.stdout.write('postMigration29ForwardSqlDraft.test.ts: all assertions passed\n')
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
