export const POST_MIGRATION29_FORWARD_BLOCKERS = {
  bunnyGuidFirst: 'bunny_target_schema_guid_first_compatibility_required',
  lessonComments: 'lesson_comment_schema_registration_required',
  spaceMedia: 'space_media_schema_registration_required',
  spaceMediaTargetSpace: 'space_media_target_space_resolution_required',
  spaceReactions: 'community_reaction_schema_registration_required',
} as const

export const LEGACY_SPACE_MEDIA_TARGETS = {
  courseCoverPhoto: {
    sourceKind: 'space_cover_photo',
    sourceSpaceType: 'course',
    targetCollection: 'payload_courses',
    targetField: 'coverImage',
    schemaStatus: 'existing',
  },
  communityOgImage: {
    sourceKind: 'space_og_image',
    sourceSpaceType: 'community',
    targetCollection: 'payload_spaces',
    targetField: 'ogImage',
    schemaStatus: 'post_migration29',
  },
} as const

export const POST_MIGRATION29_FORWARD_SEQUENCE = [
  {
    order: 1,
    id: 'forward-a-bunny-guid-first',
    target: 'bunny_videos',
    blocker: POST_MIGRATION29_FORWARD_BLOCKERS.bunnyGuidFirst,
    registrationGate: 'migration29_resolved',
    summary: 'Make Bunny persistence GUID-first while retaining numeric-ID compatibility and normalizing lesson relationships.',
  },
  {
    order: 2,
    id: 'forward-b-lesson-comments',
    target: 'payload_lesson_comments',
    blocker: POST_MIGRATION29_FORWARD_BLOCKERS.lessonComments,
    registrationGate: 'migration29_resolved',
    summary: 'Create the physical lesson-comment table, moderation enum, relationships, indexes, and locked-document relation.',
  },
  {
    order: 3,
    id: 'forward-c-space-og-media',
    target: 'payload_spaces.ogImage',
    blocker: POST_MIGRATION29_FORWARD_BLOCKERS.spaceMedia,
    registrationGate: 'migration29_resolved',
    summary: 'Add the one source-proven community-space ogImage relationship; course cover photos already target existing payload_courses.coverImage.',
  },
  {
    order: 4,
    id: 'forward-d-space-reactions',
    target: 'payload_space_reactions',
    blocker: POST_MIGRATION29_FORWARD_BLOCKERS.spaceReactions,
    registrationGate: 'migration29_resolved',
    summary: 'Create payload_space_reactions: reaction types, nullable actor FK, post/comment target FKs, surveyOptionKey, legacyReactionId unique, internal legacy actor/source fields, sourceCreatedAt, partial uniqueness constraints, indexes, and locked-document relation.',
  },
] as const

export const POST_MIGRATION29_FORWARD_SCHEMA = {
  status: 'preparation_only',
  mayRegisterDatedMigration: false,
  prerequisite: 'migration29 authorization/order lane explicitly resolved',
  sequence: POST_MIGRATION29_FORWARD_SEQUENCE,
  bunnyVideos: {
    table: 'bunny_videos',
    addColumns: [{ name: 'video_guid', sqlType: 'varchar', nullable: true }],
    alterColumns: [
      { name: 'video_id', change: 'drop_not_null' },
      {
        name: 'lesson_id',
        change: 'varchar_to_integer_relationship',
        preflight: 'every non-null/non-empty lesson_id must be numeric and reference payload_lessons.id',
      },
    ],
    addForeignKeys: [
      {
        column: 'lesson_id',
        references: 'payload_lessons(id)',
        onDelete: 'set null',
      },
    ],
    addIndexes: [
      {
        name: 'bunny_videos_video_guid_unique_idx',
        columns: ['video_guid'],
        unique: true,
        predicate: 'video_guid IS NOT NULL',
      },
    ],
    preserveIndexes: [
      'bunny_videos_library_video_idx',
      'bunny_videos_library_video_unique_idx',
      'bunny_videos_status_idx',
      'bunny_videos_lesson_id_idx',
    ],
    rollbackGuard: 'fail if any row has video_id IS NULL before restoring video_id NOT NULL or dropping video_guid',
  },
  lessonComments: {
    table: 'payload_lesson_comments',
    enum: {
      name: 'enum_payload_lesson_comments_moderation_status',
      values: ['visible', 'pending_review', 'hidden', 'deleted'],
    },
    columns: [
      ['id', 'serial primary key not null'],
      ['display_name', 'varchar not null'],
      ['lesson_id', 'integer not null'],
      ['author_id', 'integer not null'],
      ['parent_id', 'integer null'],
      ['body', 'jsonb not null'],
      ['legacy_body_html', 'varchar null'],
      ['moderation_status', "enum default 'visible' not null"],
      ['legacy_comment_id', 'varchar null'],
      ['source_created_at', 'timestamp(3) with time zone null'],
      ['metadata', 'jsonb null'],
      ['updated_at', 'timestamp(3) with time zone default now() not null'],
      ['created_at', 'timestamp(3) with time zone default now() not null'],
    ],
    foreignKeys: [
      ['lesson_id', 'payload_lessons(id)', 'set null'],
      ['author_id', 'payload_members(id)', 'set null'],
      ['parent_id', 'payload_lesson_comments(id)', 'set null'],
    ],
    indexes: [
      ['payload_lesson_comments_lesson_idx', ['lesson_id'], false],
      ['payload_lesson_comments_author_idx', ['author_id'], false],
      ['payload_lesson_comments_parent_idx', ['parent_id'], false],
      ['payload_lesson_comments_legacy_comment_id_idx', ['legacy_comment_id'], true],
      ['payload_lesson_comments_source_created_at_idx', ['source_created_at'], false],
      ['payload_lesson_comments_updated_at_idx', ['updated_at'], false],
      ['payload_lesson_comments_created_at_idx', ['created_at'], false],
    ],
    lockedDocuments: {
      table: 'payload_locked_documents_rels',
      column: 'payload_lesson_comments_id',
      references: 'payload_lesson_comments(id)',
      onDelete: 'cascade',
      index: 'payload_locked_documents_rels_payload_lesson_comments_id_idx',
    },
  },
  spaceMedia: {
    sourceRelationships: {
      sourceJoinColumn: 'wp_fcom_media_archive.sub_object_id',
      targetSourceId: 'wp_fcom_spaces.id',
      verifiedCounts: {
        courseCoverPhoto: 2,
        communityOgImage: 1,
      },
      verifiedClassifications: {
        'space_cover_photo:migratedCourseSpace': 2,
        'space_og_image:migratedCommunitySpace': 1,
      },
    },
    existingCourseTarget: {
      table: 'payload_courses',
      payloadField: 'coverImage',
      dbColumn: 'cover_image_id',
      sourceKind: 'space_cover_photo',
      relationTo: 'payload_media',
      schemaRegistrationRequired: false,
      runtimeIntent: 'already rendered on the member-facing course detail page',
    },
    forwardCommunityTarget: {
      table: 'payload_spaces',
      payloadField: 'ogImage',
      dbColumn: 'og_image_id',
      sourceKind: 'space_og_image',
      relationTo: 'payload_media',
      schemaRegistrationRequired: true,
      runtimeIntent: 'preserve source share/SEO media provenance; no current member-portal rendering dependency',
      foreignKey: ['og_image_id', 'payload_media(id)', 'set null'],
      index: ['payload_spaces_og_image_idx', ['og_image_id'], false],
    },
    intentionallyNotPlanned: {
      payloadSpacesCoverImage: 'No current JPV community-space cover-photo source exists; do not add an unused field solely because FluentCommunity supports it.',
    },
  },
  spaceReactions: {
    table: 'payload_space_reactions',
    enums: [
      { name: 'enum_payload_space_reactions_reaction_type', values: ['like', 'bookmark', 'survey_vote'] },
      { name: 'enum_payload_space_reactions_target_kind', values: ['post', 'comment', 'survey_option'] },
    ],
    columns: [
      ['id', 'serial primary key not null'],
      ['actor_member_id', 'integer null'],
      ['reaction_type', 'enum not null'],
      ['target_kind', 'enum not null'],
      ['target_post_id', 'integer null'],
      ['target_comment_id', 'integer null'],
      ['survey_option_key', 'varchar null'],
      ['legacy_reaction_id', 'varchar null'],
      ['legacy_actor_user_id', 'varchar null'],
      ['legacy_actor_source_system', 'varchar null'],
      ['source_created_at', 'timestamp(3) with time zone null'],
      ['metadata', 'jsonb null'],
      ['updated_at', 'timestamp(3) with time zone default now() not null'],
      ['created_at', 'timestamp(3) with time zone default now() not null'],
    ],
    checkConstraints: [
      {
        name: 'payload_space_reactions_target_shape',
        expression: "(target_kind = 'post' AND target_post_id IS NOT NULL AND target_comment_id IS NULL AND survey_option_key IS NULL) OR (target_kind = 'comment' AND target_post_id IS NULL AND target_comment_id IS NOT NULL AND survey_option_key IS NULL) OR (target_kind = 'survey_option' AND target_post_id IS NOT NULL AND target_comment_id IS NULL AND survey_option_key IS NOT NULL)",
      },
      {
        name: 'payload_space_reactions_survey_vote_coupling',
        expression: "(target_kind = 'survey_option' AND reaction_type = 'survey_vote') OR (target_kind <> 'survey_option' AND reaction_type <> 'survey_vote')",
      },
    ],
    foreignKeys: [
      ['actor_member_id', 'payload_members(id)', 'set null'],
      ['target_post_id', 'payload_space_posts(id)', 'cascade'],
      ['target_comment_id', 'payload_space_comments(id)', 'cascade'],
    ],
    partialUniques: [
      {
        name: 'payload_space_reactions_actor_type_post_unique_idx',
        columns: ['actor_member_id', 'reaction_type', 'target_post_id'],
        predicate: 'actor_member_id IS NOT NULL AND target_post_id IS NOT NULL',
      },
      {
        name: 'payload_space_reactions_actor_type_comment_unique_idx',
        columns: ['actor_member_id', 'reaction_type', 'target_comment_id'],
        predicate: 'actor_member_id IS NOT NULL AND target_comment_id IS NOT NULL',
      },
    ],
    indexes: [
      ['payload_space_reactions_legacy_reaction_id_idx', ['legacy_reaction_id'], true, 'legacy_reaction_id IS NOT NULL'],
      ['payload_space_reactions_actor_member_idx', ['actor_member_id'], false],
      ['payload_space_reactions_target_post_idx', ['target_post_id'], false],
      ['payload_space_reactions_target_comment_idx', ['target_comment_id'], false],
      ['payload_space_reactions_reaction_type_idx', ['reaction_type'], false],
      ['payload_space_reactions_created_at_idx', ['created_at'], false],
    ],
    lockedDocuments: {
      table: 'payload_locked_documents_rels',
      column: 'payload_space_reactions_id',
      references: 'payload_space_reactions(id)',
      onDelete: 'cascade',
      index: 'payload_locked_documents_rels_payload_space_reactions_id_idx',
    },
    rollbackGuard: 'fail closed: do not execute any down step when payload_space_reactions contains rows',
  },
} as const
