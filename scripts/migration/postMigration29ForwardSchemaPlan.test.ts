import assert from 'node:assert/strict'

import { PayloadBunnyVideo } from '../../src/collections/PayloadBunnyVideo'
import { PayloadCourses, PayloadLessonComments } from '../../src/collections/PayloadCoursePrototype'
import { PayloadSpaces } from '../../src/collections/community/Community'
import {
  LEGACY_SPACE_MEDIA_TARGETS,
  POST_MIGRATION29_FORWARD_BLOCKERS,
  POST_MIGRATION29_FORWARD_SCHEMA,
  POST_MIGRATION29_FORWARD_SEQUENCE,
} from './postMigration29ForwardSchemaPlan'

type FieldLike = {
  name?: string
  type?: string
  required?: boolean
  unique?: boolean
  index?: boolean
  relationTo?: string
}

function fieldMap(fields: unknown): Map<string, FieldLike> {
  const list = Array.isArray(fields) ? fields as FieldLike[] : []
  return new Map(list.filter((field) => field.name).map((field) => [String(field.name), field]))
}

async function run(): Promise<void> {
  assert.equal(POST_MIGRATION29_FORWARD_SCHEMA.status, 'preparation_only')
  assert.equal(POST_MIGRATION29_FORWARD_SCHEMA.mayRegisterDatedMigration, false)
  assert.equal(POST_MIGRATION29_FORWARD_SCHEMA.prerequisite, 'migration29 authorization/order lane explicitly resolved')
  assert.deepEqual(POST_MIGRATION29_FORWARD_SEQUENCE.map((step) => step.order), [1, 2, 3, 4])
  assert.deepEqual(POST_MIGRATION29_FORWARD_SEQUENCE.map((step) => step.id), [
    'forward-a-bunny-guid-first',
    'forward-b-lesson-comments',
    'forward-c-space-og-media',
    'forward-d-space-reactions',
  ])

  assert.equal(POST_MIGRATION29_FORWARD_BLOCKERS.bunnyGuidFirst, 'bunny_target_schema_guid_first_compatibility_required')
  assert.equal(POST_MIGRATION29_FORWARD_BLOCKERS.lessonComments, 'lesson_comment_schema_registration_required')
  assert.equal(POST_MIGRATION29_FORWARD_BLOCKERS.spaceMedia, 'space_media_schema_registration_required')
  assert.equal(POST_MIGRATION29_FORWARD_BLOCKERS.spaceReactions, 'community_reaction_schema_registration_required')
  assert.deepEqual(LEGACY_SPACE_MEDIA_TARGETS.courseCoverPhoto, {
    sourceKind: 'space_cover_photo',
    sourceSpaceType: 'course',
    targetCollection: 'payload_courses',
    targetField: 'coverImage',
    schemaStatus: 'existing',
  })
  assert.deepEqual(LEGACY_SPACE_MEDIA_TARGETS.communityOgImage, {
    sourceKind: 'space_og_image',
    sourceSpaceType: 'community',
    targetCollection: 'payload_spaces',
    targetField: 'ogImage',
    schemaStatus: 'post_migration29',
  })

  const bunnyFields = fieldMap(PayloadBunnyVideo.fields)
  assert.equal(bunnyFields.get('videoGuid')?.type, 'text')
  assert.equal(bunnyFields.get('videoGuid')?.unique, true)
  assert.notEqual(bunnyFields.get('videoId')?.required, true)
  assert.equal(bunnyFields.get('lesson')?.relationTo, 'payload_lessons')
  assert.equal(POST_MIGRATION29_FORWARD_SCHEMA.bunnyVideos.addColumns[0].name, 'video_guid')
  assert.equal(POST_MIGRATION29_FORWARD_SCHEMA.bunnyVideos.alterColumns.some((change) => change.name === 'video_id' && change.change === 'drop_not_null'), true)
  assert.equal(POST_MIGRATION29_FORWARD_SCHEMA.bunnyVideos.alterColumns.some((change) => change.name === 'lesson_id' && change.change === 'varchar_to_integer_relationship'), true)
  assert.equal(POST_MIGRATION29_FORWARD_SCHEMA.bunnyVideos.addForeignKeys[0].references, 'payload_lessons(id)')
  assert.match(POST_MIGRATION29_FORWARD_SCHEMA.bunnyVideos.rollbackGuard, /video_id IS NULL/)

  const lessonCommentFields = fieldMap(PayloadLessonComments.fields)
  for (const requiredField of ['displayName', 'lesson', 'author', 'body', 'moderationStatus']) {
    assert.equal(lessonCommentFields.get(requiredField)?.required, true, `${requiredField} remains required`)
  }
  assert.equal(lessonCommentFields.get('lesson')?.relationTo, 'payload_lessons')
  assert.equal(lessonCommentFields.get('author')?.relationTo, 'payload_members')
  assert.equal(lessonCommentFields.get('parent')?.relationTo, 'payload_lesson_comments')
  assert.equal(lessonCommentFields.get('legacyCommentId')?.unique, true)
  assert.equal(lessonCommentFields.get('legacyCommentId')?.index, true)
  assert.equal(POST_MIGRATION29_FORWARD_SCHEMA.lessonComments.lockedDocuments.column, 'payload_lesson_comments_id')
  assert.equal(POST_MIGRATION29_FORWARD_SCHEMA.lessonComments.indexes.some(([name]) => name === 'payload_lesson_comments_source_created_at_idx'), true)

  assert.deepEqual(POST_MIGRATION29_FORWARD_SCHEMA.spaceMedia.sourceRelationships.verifiedCounts, {
    courseCoverPhoto: 2,
    communityOgImage: 1,
  })
  assert.deepEqual(POST_MIGRATION29_FORWARD_SCHEMA.spaceMedia.sourceRelationships.verifiedClassifications, {
    'space_cover_photo:migratedCourseSpace': 2,
    'space_og_image:migratedCommunitySpace': 1,
  })
  assert.equal(POST_MIGRATION29_FORWARD_SCHEMA.spaceMedia.existingCourseTarget.payloadField, 'coverImage')
  assert.equal(POST_MIGRATION29_FORWARD_SCHEMA.spaceMedia.existingCourseTarget.schemaRegistrationRequired, false)
  assert.equal(POST_MIGRATION29_FORWARD_SCHEMA.spaceMedia.forwardCommunityTarget.payloadField, 'ogImage')
  assert.equal(POST_MIGRATION29_FORWARD_SCHEMA.spaceMedia.forwardCommunityTarget.schemaRegistrationRequired, true)

  const courseFields = fieldMap(PayloadCourses.fields)
  assert.equal(courseFields.get('coverImage')?.relationTo, 'payload_media')

  // Forward C is now runtime-registered; source semantics still require ogImage only, never coverImage.
  const spaceFields = fieldMap(PayloadSpaces.fields)
  assert.equal(spaceFields.has('coverImage'), false)
  assert.equal(spaceFields.get('ogImage')?.relationTo, 'payload_media')

  assert.equal(POST_MIGRATION29_FORWARD_SCHEMA.spaceReactions.table, 'payload_space_reactions')
  assert.equal(POST_MIGRATION29_FORWARD_SCHEMA.spaceReactions.enums[0].name, 'enum_payload_space_reactions_reaction_type')
  assert.deepEqual(POST_MIGRATION29_FORWARD_SCHEMA.spaceReactions.enums[0].values, ['like', 'bookmark', 'survey_vote'])
  assert.equal(POST_MIGRATION29_FORWARD_SCHEMA.spaceReactions.enums[1].name, 'enum_payload_space_reactions_target_kind')
  assert.deepEqual(POST_MIGRATION29_FORWARD_SCHEMA.spaceReactions.enums[1].values, ['post', 'comment', 'survey_option'])
  assert.ok(POST_MIGRATION29_FORWARD_SCHEMA.spaceReactions.columns.some(([name]) => name === 'actor_member_id'))
  assert.ok(POST_MIGRATION29_FORWARD_SCHEMA.spaceReactions.columns.some(([name]) => name === 'survey_option_key'))
  assert.ok(POST_MIGRATION29_FORWARD_SCHEMA.spaceReactions.columns.some(([name]) => name === 'legacy_reaction_id'))
  assert.ok(POST_MIGRATION29_FORWARD_SCHEMA.spaceReactions.columns.some(([name]) => name === 'legacy_actor_user_id'))
  assert.ok(POST_MIGRATION29_FORWARD_SCHEMA.spaceReactions.columns.some(([name]) => name === 'source_created_at'))
  const targetShape = POST_MIGRATION29_FORWARD_SCHEMA.spaceReactions.checkConstraints.find((c) => c.name === 'payload_space_reactions_target_shape')
  assert.ok(targetShape)
  assert.match(targetShape.expression, /target_kind = 'survey_option'/)
  assert.match(targetShape.expression, /survey_option_key IS NOT NULL/)
  const surveyCoupling = POST_MIGRATION29_FORWARD_SCHEMA.spaceReactions.checkConstraints.find((c) => c.name === 'payload_space_reactions_survey_vote_coupling')
  assert.ok(surveyCoupling)
  assert.match(surveyCoupling.expression, /reaction_type = 'survey_vote'/)
  assert.ok(POST_MIGRATION29_FORWARD_SCHEMA.spaceReactions.partialUniques.some((u) => u.name === 'payload_space_reactions_actor_type_post_unique_idx'))
  assert.ok(POST_MIGRATION29_FORWARD_SCHEMA.spaceReactions.partialUniques.some((u) => u.name === 'payload_space_reactions_actor_type_comment_unique_idx'))
  assert.equal(POST_MIGRATION29_FORWARD_SCHEMA.spaceReactions.lockedDocuments.column, 'payload_space_reactions_id')
  assert.match(POST_MIGRATION29_FORWARD_SCHEMA.spaceReactions.rollbackGuard, /fail closed/)

  process.stdout.write('postMigration29ForwardSchemaPlan.test.ts: all assertions passed\n')
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
