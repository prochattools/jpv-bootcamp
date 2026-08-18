import assert from 'node:assert/strict'

import {
  assertSnapshotExpectations,
  buildLegacyDryRunNormalization,
  type LegacySqlSnapshot,
  type StripeEvidenceFile,
  type WordPressUserSource,
} from './legacySourceDryRun'
import { buildLegacyPayloadOperationPlan } from './legacyPayloadOperationPlan'
import { POST_MIGRATION29_FORWARD_BLOCKERS } from './postMigration29ForwardSchemaPlan'

function buildUsers(): WordPressUserSource[] {
  const subscriberIds = ['74', '76', ...Array.from({ length: 46 }, (_, index) => String(100 + index))]
  const subscribers = subscriberIds.map((id, index): WordPressUserSource => ({
    id,
    email: id === '74'
      ? 'nidia-typo@invalid.example'
      : id === '76'
        ? 'nidia-correct@invalid.example'
        : `member-${index}@invalid.example`,
    displayName: id === '74' || id === '76' ? 'Nidia Test' : `Member ${id}`,
    role: 'subscriber',
  }))
  return [
    { id: '1', email: 'staff1@invalid.example', displayName: 'Staff One', role: 'administrator' },
    { id: '2', email: 'staff2@invalid.example', displayName: 'Staff Two', role: 'administrator' },
    { id: '3', email: 'staff3@invalid.example', displayName: 'Staff Three', role: 'administrator' },
    ...subscribers,
  ]
}

function buildSnapshot(): LegacySqlSnapshot {
  const wordpressUsers = buildUsers()
  const subscriberUsers = wordpressUsers.filter((user) => user.role === 'subscriber')
  return {
    wordpressUsers,
    fluentCrmContacts: subscriberUsers.map((user, index) => ({
      id: String(index + 1),
      userId: user.id,
      email: user.email,
      firstName: `First${user.id}`,
      lastName: `Last${user.id}`,
      status: 'subscribed',
    })),
    communityProfiles: [
      {
        id: 'xp-74',
        userId: '74',
        displayName: 'Duplicate Source Profile',
        avatar: null,
        shortDescription: 'Fallback biography',
        shortDescriptionRendered: '<p>Fallback biography</p>',
        website: 'https://fallback.example.test',
        headline: null,
        coverPhoto: 'legacy-cover-74',
        socialLinks: {
          instagram: 'https://instagram.com/fallback',
          twitter: null,
          linkedin: null,
          facebook: 'https://facebook.com/fallback',
          youtube: null,
        },
        status: 'active',
        metaRaw: 'fallback-raw-meta',
      },
      {
        id: 'xp-76',
        userId: '76',
        displayName: 'Canonical Source Profile',
        avatar: null,
        shortDescription: 'Canonical biography source',
        shortDescriptionRendered: '<p>Canonical <strong>biography</strong> source</p>',
        website: 'https://canonical.example.test',
        headline: null,
        coverPhoto: 'legacy-cover-76',
        socialLinks: {
          instagram: null,
          twitter: 'https://x.com/canonical',
          linkedin: 'https://linkedin.com/in/canonical',
          facebook: null,
          youtube: 'https://youtube.com/@canonical',
        },
        status: 'active',
        metaRaw: 'canonical-raw-meta',
      },
    ],
    portalSettingsSource: {
      fluentCommunitySettingsRaw: 'a:1:{s:10:"site_title";s:8:"JPV Test";}',
      authSettingsRaw: 'a:1:{s:5:"login";a:2:{s:6:"banner";a:1:{s:5:"title";s:12:"Member Login";}s:4:"form";a:1:{s:12:"button_label";s:7:"Sign in";}}}',
      customizationSettingsRaw: 'a:1:{s:9:"dark_mode";s:1:"1";}',
      welcomeBannerSettingsRaw: 'a:1:{s:7:"enabled";s:1:"1";}',
      snippetsSettingsRaw: 'a:2:{s:10:"custom_css";s:0:"";s:9:"custom_js";s:0:"";}',
    },
    spaces: [
      { id: '7', createdBy: '2', parentId: '4', title: 'Course', targetTitle: 'Course', slug: 'course', description: 'Course description', type: 'course', privacy: 'private', status: 'published', serial: 1, settings: null, migrate: true },
      { id: '23', createdBy: '2', parentId: '1', title: 'Forum', targetTitle: 'Forum', slug: 'forum', description: 'Forum', type: 'community', privacy: 'private', status: 'published', serial: 1, settings: null, migrate: true },
      { id: '27', createdBy: '2', parentId: '26', title: 'Only VIP Discussion', targetTitle: 'Member Discussion', slug: 'only-vip-discussion', description: 'Legacy VIP group', type: 'community', privacy: 'private', status: 'published', serial: 2, settings: null, migrate: true },
      { id: '26', createdBy: '1', parentId: null, title: 'Only VIP', targetTitle: 'Members', slug: 'only-vip', description: null, type: 'space_group', privacy: 'public', status: 'active', serial: 1, settings: null, migrate: true },
      { id: '12', createdBy: '1', parentId: null, title: 'Upgrade to VIP', targetTitle: 'Upgrade to VIP', slug: 'upgrade-vip', description: null, type: 'sidebar_link', privacy: 'logged_in', status: 'published', serial: 1, settings: null, migrate: false, exclusionReason: 'legacy_upgrade_functionality' },
    ],
    posts: [
      { id: '10', userId: '2', parentId: null, spaceId: '7', title: 'Module', slug: 'module', message: 'Module description', messageRendered: '<p>Module description</p>', type: 'course_section', contentType: 'text', privacy: 'public', status: 'published', featuredImage: null, meta: null, isSticky: false, priority: 1, createdAt: '2026-01-01 00:00:00' },
      { id: '11', userId: '2', parentId: '10', spaceId: '7', title: 'Lesson', slug: 'lesson', message: '<!-- wp:paragraph --><p>Lesson body</p><!-- /wp:paragraph -->', messageRendered: '<p>Lesson body</p><iframe src="https://iframe.mediadelivery.net/embed/581531/56266f09-d651-4bc5-a5b0-ac9185018018" title="Lesson video"></iframe>', type: 'course_lesson', contentType: 'text', privacy: 'public', status: 'published', featuredImage: null, meta: 'player.mediadelivery.net/embed/581531/56266f09-d651-4bc5-a5b0-ac9185018018', isSticky: false, priority: 1, createdAt: '2026-01-02 00:00:00' },
      { id: '90', userId: '2', parentId: null, spaceId: '23', title: null, slug: 'staff-post', message: 'Staff historical post', messageRendered: '<p>Staff historical post</p>', type: 'text', contentType: 'text', privacy: 'private', status: 'published', featuredImage: null, meta: null, isSticky: true, priority: 0, createdAt: '2026-01-03 00:00:00' },
      { id: '91', userId: '74', parentId: null, spaceId: '27', title: null, slug: 'vip-post', message: 'Historical VIP wording stays unchanged', messageRendered: '<p>Historical VIP wording stays unchanged</p>', type: 'text', contentType: 'text', privacy: 'private', status: 'published', featuredImage: null, meta: null, isSticky: false, priority: 0, createdAt: '2026-01-04 00:00:00' },
    ],
    comments: [
      { id: '1', userId: '76', postId: '90', parentId: null, message: 'Community comment', messageRendered: '<p>Community comment</p>', meta: null, type: 'comment', contentType: 'text', status: 'published', isSticky: false, createdAt: '2026-01-05 00:00:00' },
      { id: '2', userId: '76', postId: '11', parentId: null, message: 'Lesson discussion', messageRendered: '<p>Lesson discussion</p>', meta: null, type: 'comment', contentType: 'text', status: 'published', isSticky: false, createdAt: '2026-01-05 00:01:00' },
      { id: '3', userId: '76', postId: '999', parentId: null, message: 'Missing parent comment', messageRendered: '<p>Missing parent comment</p>', meta: null, type: 'comment', contentType: 'text', status: 'published', isSticky: false, createdAt: '2026-01-05 00:02:00' },
    ],
    reactions: [
      { id: '1', userId: '74', objectId: '11', parentId: '7', objectType: 'lesson_completed', type: 'completed', createdAt: '2026-01-06 00:00:00' },
      { id: '2', userId: '100', objectId: '90', parentId: null, objectType: 'feed', type: 'like', createdAt: '2026-01-06 00:00:00' },
      { id: '3', userId: '101', objectId: '1', parentId: '90', objectType: 'comment', type: 'bookmark', createdAt: '2026-01-06 00:00:00' },
      { id: '4', userId: '100', objectId: '90', parentId: '999', objectType: 'opt_1', type: 'survey_vote', createdAt: '2026-01-06 00:00:00' },
    ],
    spaceMemberships: [
      { id: '1', spaceId: '7', userId: '113', status: 'active', role: 'student' },
      { id: '2', spaceId: '23', userId: '113', status: 'active', role: 'member' },
      { id: '3', spaceId: '23', userId: '100', status: 'active', role: 'moderator' },
    ],
    communityMedia: [
      { id: '1', objectSource: 'feed', mediaKey: 'media-1', userId: '2', feedId: '90', subObjectId: null, mediaType: 'image/webp', driver: 's3', mediaPath: 'r2://bucket/image.webp', mediaUrl: 'https://media.invalid/image.webp' },
      { id: '2', objectSource: 'course_lesson', mediaKey: 'media-2', userId: '2', feedId: '11', subObjectId: null, mediaType: 'application/pdf', driver: 's3', mediaPath: 'r2://bucket/lesson.pdf', mediaUrl: 'https://media.invalid/lesson.pdf' },
      { id: '3', objectSource: 'user_avatar', mediaKey: 'media-3', userId: '100', feedId: null, subObjectId: null, mediaType: 'image/jpeg', driver: 's3', mediaPath: 'r2://bucket/avatar.jpg', mediaUrl: 'https://media.invalid/avatar.jpg' },
      { id: '4', objectSource: 'onboarding', mediaKey: 'd5e197c8eb529ce2b72f477d7a62bdf1', userId: '2', feedId: null, subObjectId: null, mediaType: 'image/webp', driver: 'local', mediaPath: '/legacy/portal-logo.webp', mediaUrl: 'https://media.invalid/portal-logo.webp' },
      { id: '5', objectSource: 'general', mediaKey: 'e0584e3a8c875c92b0ebd756cfc93826', userId: '2', feedId: null, subObjectId: null, mediaType: 'image/jpeg', driver: 'local', mediaPath: '/legacy/white-logo.jpg', mediaUrl: 'https://media.invalid/white-logo.jpg' },
      { id: '9', objectSource: 'general', mediaKey: '3badcaa804b908c416e64a1d477da4fa', userId: '2', feedId: null, subObjectId: null, mediaType: 'image/webp', driver: 'local', mediaPath: '/legacy/featured-image.webp', mediaUrl: 'https://media.invalid/featured-image.webp' },
      { id: '6', objectSource: 'mystery', mediaKey: 'media-6', userId: '2', feedId: null, subObjectId: null, mediaType: 'application/octet-stream', driver: 's3', mediaPath: 'r2://bucket/mystery.bin', mediaUrl: 'https://media.invalid/mystery.bin' },
      { id: '7', objectSource: 'space_document', mediaKey: 'media-7', userId: '2', feedId: '90', subObjectId: null, mediaType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', driver: 's3', mediaPath: 'r2://bucket/community-resource.docx', mediaUrl: 'https://media.invalid/community-resource.docx' },
      { id: '8', objectSource: 'user_cover_photo', mediaKey: 'media-8', userId: '100', feedId: null, subObjectId: null, mediaType: 'image/jpeg', driver: 's3', mediaPath: 'r2://bucket/cover.jpg', mediaUrl: 'https://media.invalid/cover.jpg' },
      { id: '10', objectSource: 'space_cover_photo', mediaKey: 'media-10', userId: '2', feedId: null, subObjectId: '7', mediaType: 'image/jpeg', driver: 'local', mediaPath: '/legacy/course-cover.jpg', mediaUrl: 'https://media.invalid/course-cover.jpg' },
      { id: '12', objectSource: 'space_og_image', mediaKey: 'media-12', userId: '2', feedId: null, subObjectId: '23', mediaType: 'image/jpeg', driver: 'local', mediaPath: '/legacy/forum-og.jpg', mediaUrl: 'https://media.invalid/forum-og.jpg' },
    ],
    activities: [
      { id: '1', userId: '74', feedId: '7', spaceId: null, relatedId: null, actionName: 'course_completed', createdAt: '2026-01-07 00:00:00' },
    ],
  }
}

function buildStripe(): StripeEvidenceFile {
  const activeEmails = [
    'nidia-typo@invalid.example',
    ...Array.from({ length: 10 }, (_, index) => `member-${index + 2}@invalid.example`),
  ]
  return {
    qualifying_records: [
      ...activeEmails.map((email, index) => ({
        subscription_id: `sub_active_${index}`,
        customer_id: `cus_active_${index}`,
        customer_email: email,
        subscription_status: 'active',
        legacy_product_id: 'prod_legacy',
        legacy_price_id: 'price_legacy',
      })),
      {
        subscription_id: 'sub_past_due',
        customer_id: 'cus_past_due',
        customer_email: 'member-13@invalid.example',
        subscription_status: 'past_due',
        legacy_product_id: 'prod_legacy',
        legacy_price_id: 'price_legacy',
      },
    ],
  }
}

async function run(): Promise<void> {
  const snapshot = buildSnapshot()
  const normalization = buildLegacyDryRunNormalization(snapshot, buildStripe())
  assertSnapshotExpectations(normalization.identity)
  const bunnyInventory = {
    library: { id: 581531 },
    videos: [
      {
        video_guid: '56266f09-d651-4bc5-a5b0-ac9185018018',
        title: 'Legacy lesson video',
        status: 'resolution_finished',
        library_id: 581531,
        duration_seconds: 42,
        thumbnail_url: 'https://cdn.invalid/thumb.jpg',
      },
    ],
  }
  const plan = await buildLegacyPayloadOperationPlan(snapshot, normalization, bunnyInventory)

  assert.equal(plan.executionAuthorized, false)
  assert.equal(plan.executable, false)
  assert.deepEqual(plan.snapshot, {
    sourceMemberAccounts: 48,
    canonicalSubscriberMembers: 47,
    activeSubscriberMembers: 11,
    blockedSubscriberMembers: 36,
    staffAuthorMirrors: 3,
  })

  assert.equal(plan.summary.byCollection.payload_members, 50, '47 subscriber members + 3 blocked staff author mirrors')
  assert.equal(plan.summary.byCollection.payload_member_profiles, 50)
  assert.equal(plan.summary.byCollection.payload_contacts, 47)
  assert.equal(plan.summary.byCollection.payload_courses, 1)
  assert.equal(plan.summary.byCollection.payload_course_modules, 1)
  assert.equal(plan.summary.byCollection.payload_lessons, 1)
  assert.equal(plan.summary.activeCourseEnrollments, 11)
  assert.equal(plan.summary.blockedHistoricalCourseEnrollments, 1)
  assert.equal(plan.summary.activeSpaceMemberships, 22, '11 active members x 2 migrated community spaces')
  assert.equal(plan.summary.blockedHistoricalSpaceMemberships, 1)
  assert.equal(plan.summary.lessonProgress, 1)
  assert.equal(plan.summary.communityComments, 1)
  assert.equal(plan.summary.deferredLessonComments, 1)
  assert.equal(plan.summary.deferredOtherSourceComments, 0)
  assert.equal(plan.summary.communityReactions, 3, '3 community reactions (feed like + comment bookmark + survey vote); lesson_completed excluded')
  assert.equal(plan.summary.byCollection.payload_space_reactions, 3)
  assert.equal(plan.summary.plannedLessonComments, 1)
  assert.equal(plan.summary.communityFileReferences, 2)
  assert.equal(plan.summary.lessonResourceReferences, 1)
  assert.equal(plan.summary.protectedLessonResourceMedia, 1)
  assert.equal(plan.summary.spaceDocumentReferences, 1)
  assert.equal(plan.summary.memberAvatarMediaReferences, 1)
  assert.equal(plan.summary.memberCoverMediaReferences, 1)
  assert.equal(plan.summary.portalSettingsMediaReferences, 3)
  assert.equal(plan.summary.courseCoverMediaReferences, 1)
  assert.equal(plan.summary.spaceMediaSchemaReferences, 1)
  assert.equal(plan.summary.platformArchiveMediaReferences, 0)
  assert.equal(plan.summary.unresolvedMediaRecords, 1)
  assert.equal(plan.summary.platformMediaAssetsAwaitingTargetDecision, 0)
  assert.equal(plan.summary.byCollection.payload_space_comments, 2, 'one resolved community comment plus one true-orphan placeholder; lesson comment is deferred')
  assert.equal(plan.summary.byCollection.payload_lesson_comments, 1)
  assert.equal(plan.summary.byCollection.payload_space_files, 2)
  assert.equal(plan.summary.byCollection.payload_media, 7)
  assert.equal(plan.summary.byCollection.payload_private_media, 1)
  assert.equal(plan.summary.byCollection.payload_lesson_resources, 1)

  const nidiaMember = plan.operations.find((item) => item.collection === 'payload_members' && item.idempotencyKey === 'wp_member:76')
  assert.ok(nidiaMember)
  assert.equal(nidiaMember.data.email, 'nidia-correct@invalid.example')
  assert.equal(nidiaMember.data.accountStatus, 'active')

  const nidiaProfile = plan.operations.find((item) => item.collection === 'payload_member_profiles' && item.idempotencyKey === 'wp_member_profile:76')
  assert.ok(nidiaProfile)
  assert.equal(nidiaProfile.data.website, 'https://canonical.example.test')
  assert.ok(nidiaProfile.data.biography && typeof nidiaProfile.data.biography === 'object')
  assert.deepEqual(nidiaProfile.data.socialLinks, {
    instagram: 'https://instagram.com/fallback',
    twitter: 'https://x.com/canonical',
    linkedin: 'https://linkedin.com/in/canonical',
    facebook: 'https://facebook.com/fallback',
    youtube: 'https://youtube.com/@canonical',
  })
  assert.equal(nidiaProfile.blockers.includes('richtext_wordpress_or_html_conversion_required'), false)
  assert.deepEqual(nidiaProfile.source.sourceIds, ['xp-76', 'xp-74'])
  const rawProfiles = nidiaProfile.source.raw?.communityProfiles as Array<Record<string, unknown>>
  assert.equal(rawProfiles[0]?.metaRaw, 'canonical-raw-meta')
  assert.equal(rawProfiles[1]?.metaRaw, 'fallback-raw-meta')
  assert.deepEqual(nidiaProfile.source.raw?.selectedProfileIds, {
    website: 'xp-76',
    biography: 'xp-76',
    instagram: 'xp-74',
    twitter: 'xp-76',
    linkedin: 'xp-76',
    facebook: 'xp-74',
    youtube: 'xp-76',
  })
  assert.ok(nidiaProfile.source.raw?.biographyRichTextConversion)
  assert.equal(Object.prototype.hasOwnProperty.call(nidiaProfile.data, 'headline'), false)

  const staffMember = plan.operations.find((item) => item.collection === 'payload_members' && item.idempotencyKey === 'wp_staff_author:2')
  assert.ok(staffMember)
  assert.equal(staffMember.data.accountStatus, 'blocked')
  assert.equal(staffMember.data.billingHoldReason, 'legacy_staff_author_only')

  const memberDiscussion = plan.operations.find((item) => item.collection === 'payload_spaces' && item.data.name === 'Member Discussion')
  assert.ok(memberDiscussion)
  assert.equal(memberDiscussion.data.slug, 'member-discussion')
  assert.equal(memberDiscussion.data.visibility, 'members')
  assert.equal(plan.operations.some((item) => JSON.stringify(item.data).includes('Upgrade to VIP')), false)

  const activeEnrollments = plan.operations.filter((item) => item.collection === 'payload_course_enrollments' && item.data.status === 'active')
  const revokedEnrollments = plan.operations.filter((item) => item.collection === 'payload_course_enrollments' && item.data.status === 'revoked')
  assert.equal(activeEnrollments.length, 11)
  assert.equal(revokedEnrollments.length, 1)

  const activeMemberships = plan.operations.filter((item) => item.collection === 'payload_space_memberships' && item.data.status === 'active')
  const blockedMemberships = plan.operations.filter((item) => item.collection === 'payload_space_memberships' && item.data.status === 'blocked')
  assert.equal(activeMemberships.length, 22)
  assert.equal(blockedMemberships.length, 1)

  const privateLessonMedia = plan.operations.find((item) => item.collection === 'payload_private_media')
  assert.ok(privateLessonMedia)
  assert.equal(privateLessonMedia.data.alt, 'lesson.pdf')
  assert.ok(privateLessonMedia.blockers.includes('lesson_resource_private_media_import_required'))

  const lessonResource = plan.operations.find((item) => item.collection === 'payload_lesson_resources')
  assert.ok(lessonResource)
  assert.equal(lessonResource.data.status, 'draft')
  assert.equal(lessonResource.data.downloadRequiresAccess, true)
  assert.equal(lessonResource.data.protectedFile, `$ref:${privateLessonMedia.operationId}`)
  assert.equal(lessonResource.blockers.includes('lesson_resource_file_resolution_required'), false)
  assert.ok(lessonResource.dependsOn.includes(privateLessonMedia.operationId))

  const avatarMedia = plan.operations.find((item) => item.collection === 'payload_media' && item.idempotencyKey === 'fc_member_avatar_media:3')
  assert.ok(avatarMedia)
  assert.ok(avatarMedia.blockers.includes('member_avatar_media_import_required'))
  const memberProfile = plan.operations.find((item) => item.collection === 'payload_member_profiles' && item.idempotencyKey === 'wp_member_profile:100')
  assert.ok(memberProfile)
  assert.equal(memberProfile.data.avatar, `$ref:${avatarMedia.operationId}`)
  assert.ok(memberProfile.dependsOn.includes(avatarMedia.operationId))
  assert.equal(plan.unresolved.some((item) => item.sourceType === 'community_media' && item.sourceId === '3'), false)

  const coverMedia = plan.operations.find((item) => item.collection === 'payload_media' && item.idempotencyKey === 'fc_member_cover_media:8')
  assert.ok(coverMedia)
  assert.ok(coverMedia.blockers.includes('member_cover_media_import_required'))
  assert.equal(coverMedia.source.raw?.binaryImportRequired, true)
  assert.equal(memberProfile.data.coverImage, `$ref:${coverMedia.operationId}`)
  assert.ok(memberProfile.dependsOn.includes(coverMedia.operationId))
  assert.equal(plan.unresolved.some((item) => item.sourceType === 'community_media' && item.sourceId === '8'), false)

  const portalLogoMedia = plan.operations.find((item) => item.collection === 'payload_media' && item.idempotencyKey === 'fc_portal_settings_media:4')
  const whiteLogoMedia = plan.operations.find((item) => item.collection === 'payload_media' && item.idempotencyKey === 'fc_portal_settings_media:5')
  const featuredImageMedia = plan.operations.find((item) => item.collection === 'payload_media' && item.idempotencyKey === 'fc_portal_settings_media:9')
  assert.ok(portalLogoMedia)
  assert.ok(whiteLogoMedia)
  assert.ok(featuredImageMedia)
  assert.ok(portalLogoMedia.blockers.includes('portal_settings_media_import_required'))
  assert.ok(whiteLogoMedia.blockers.includes('portal_settings_media_import_required'))
  assert.ok(featuredImageMedia.blockers.includes('portal_settings_media_import_required'))
  assert.deepEqual(portalLogoMedia.source.raw?.targetFields, ['logo', 'loginBanner.logo'])
  assert.deepEqual(whiteLogoMedia.source.raw?.targetFields, ['whiteLogo'])
  assert.deepEqual(featuredImageMedia.source.raw?.targetFields, ['featuredImage'])
  assert.deepEqual(portalLogoMedia.source.raw?.sourceReferencePaths, [
    'wp_options:fluent_community_settings#logo',
    'wp_fcom_meta:option:auth_settings#login.banner.logo',
    'wp_fcom_meta:option:auth_settings#signup.banner.logo',
  ])
  assert.equal(portalLogoMedia.source.raw?.targetGlobal, 'portalSettings')
  assert.equal(whiteLogoMedia.source.raw?.targetGlobal, 'portalSettings')
  assert.equal(featuredImageMedia.source.raw?.targetGlobal, 'portalSettings')
  assert.equal(plan.unresolved.some((item) => item.sourceType === 'community_media' && (item.sourceId === '4' || item.sourceId === '5' || item.sourceId === '9')), false)

  const courseCoverMedia = plan.operations.find((item) => item.collection === 'payload_media' && item.idempotencyKey === 'fc_course_coverImage_media:10')
  const forumOgMedia = plan.operations.find((item) => item.collection === 'payload_media' && item.idempotencyKey === 'fc_space_ogImage_media:12')
  assert.ok(courseCoverMedia)
  assert.ok(forumOgMedia)

  assert.ok(courseCoverMedia.blockers.includes('space_media_import_required'))
  assert.equal(courseCoverMedia.blockers.includes(POST_MIGRATION29_FORWARD_BLOCKERS.spaceMedia), false)
  assert.equal(courseCoverMedia.source.raw?.targetCollection, 'payload_courses')
  assert.equal(courseCoverMedia.source.raw?.targetField, 'coverImage')
  assert.equal(courseCoverMedia.source.raw?.sourceSpaceType, 'course')
  assert.equal(courseCoverMedia.source.raw?.schemaRegistrationRequired, false)
  assert.equal(courseCoverMedia.source.raw?.sourceRelationship, 'wp_fcom_media_archive.sub_object_id -> wp_fcom_spaces.id')
  assert.equal(courseCoverMedia.source.raw?.sourceProven, true)

  assert.equal(forumOgMedia.blockers.includes(POST_MIGRATION29_FORWARD_BLOCKERS.spaceMedia), false)
  assert.ok(forumOgMedia.blockers.includes('space_media_import_required'))
  assert.equal(forumOgMedia.source.raw?.targetCollection, 'payload_spaces')
  assert.equal(forumOgMedia.source.raw?.targetField, 'ogImage')
  assert.equal(forumOgMedia.source.raw?.sourceSpaceType, 'community')
  assert.equal(forumOgMedia.source.raw?.schemaRegistrationRequired, false)
  assert.equal(forumOgMedia.source.raw?.sourceRelationship, 'wp_fcom_media_archive.sub_object_id -> wp_fcom_spaces.id')
  assert.equal(forumOgMedia.source.raw?.sourceProven, true)

  const course = plan.operations.find((item) => item.collection === 'payload_courses' && item.idempotencyKey === 'fc_course:7')
  const forumSpace = plan.operations.find((item) => item.collection === 'payload_spaces' && item.idempotencyKey === 'fc_space_id:23')
  assert.ok(course)
  assert.ok(forumSpace)
  assert.equal(course.data.coverImage, `$ref:${courseCoverMedia.operationId}`)
  assert.ok(course.dependsOn.includes(courseCoverMedia.operationId))
  assert.equal(course.blockers.includes(POST_MIGRATION29_FORWARD_BLOCKERS.spaceMedia), false)
  assert.equal(forumSpace.data.ogImage, `$ref:${forumOgMedia.operationId}`)
  assert.ok(forumSpace.dependsOn.includes(forumOgMedia.operationId))
  assert.equal(forumSpace.blockers.includes(POST_MIGRATION29_FORWARD_BLOCKERS.spaceMedia), false)
  assert.equal(plan.unresolved.some((item) => item.sourceType === 'community_media' && item.sourceId === '10'), false)
  assert.equal(plan.unresolved.some((item) => item.sourceType === 'community_media' && item.sourceId === '12' && item.code === POST_MIGRATION29_FORWARD_BLOCKERS.spaceMedia), false)
  assert.equal(plan.unresolved.some((item) => item.sourceType === 'community_media' && ['10', '12'].includes(item.sourceId) && item.code === 'media_asset_requires_target_decision'), false)

  const portalSettingsGlobal = plan.operations.find((item) => item.targetType === 'global' && item.globalSlug === 'portalSettings')
  assert.ok(portalSettingsGlobal)
  assert.equal(portalSettingsGlobal.collection, 'portalSettings')
  assert.equal(portalSettingsGlobal.data.siteTitle, 'JPV Test')
  assert.equal((portalSettingsGlobal.data.loginBanner as Record<string, unknown>).title, 'Member Login')
  assert.equal((portalSettingsGlobal.data.loginForm as Record<string, unknown>).buttonLabel, 'Sign in')
  assert.equal(portalSettingsGlobal.data.logo, `$ref:${portalLogoMedia.operationId}`)
  assert.equal(portalSettingsGlobal.data.whiteLogo, `$ref:${whiteLogoMedia.operationId}`)
  assert.equal(portalSettingsGlobal.data.featuredImage, `$ref:${featuredImageMedia.operationId}`)
  assert.ok(portalSettingsGlobal.dependsOn.includes(portalLogoMedia.operationId))
  assert.ok(portalSettingsGlobal.dependsOn.includes(whiteLogoMedia.operationId))
  assert.ok(portalSettingsGlobal.dependsOn.includes(featuredImageMedia.operationId))
  assert.equal(portalSettingsGlobal.blockers.includes('portal_legacy_code_execution_review_required'), false)
  const legacySettings = portalSettingsGlobal.data.legacySettings as Record<string, unknown>
  assert.equal((legacySettings.activeTargetMapping as Record<string, unknown>).customCssEmpty, true)
  assert.equal((legacySettings.activeTargetMapping as Record<string, unknown>).customJsEmpty, true)
  assert.equal((legacySettings.activeTargetMapping as Record<string, unknown>).welcomeBannerPreservedWithoutInventedTargetRuntime, true)
  assert.equal((legacySettings.rawSerialized as Record<string, unknown>).customizationSettings, 'a:1:{s:9:"dark_mode";s:1:"1";}')
  assert.ok((portalSettingsGlobal.source.raw?.preservedOnlySourcePaths as string[]).includes('welcome_banner_settings'))

  assert.ok(plan.unresolved.some((item) => item.code === 'unresolved_media_context' && item.sourceId === '6'))
  const spaceDocument = plan.operations.find((item) => item.collection === 'payload_space_files' && item.idempotencyKey === 'fc_attachment_id:7')
  assert.ok(spaceDocument)
  assert.equal(spaceDocument.data.attachmentType, 'document')
  assert.equal(spaceDocument.source.entityType, 'post_media_reference')
  assert.equal(plan.unresolved.some((item) => item.sourceId === '7' && item.code === 'media_asset_requires_target_decision'), false)

  const lessonComment = plan.operations.find((item) => item.collection === 'payload_lesson_comments' && item.idempotencyKey === 'fc_lesson_comment_id:2')
  assert.ok(lessonComment)
  assert.equal(lessonComment.data.legacyCommentId, '2')
  assert.equal(lessonComment.data.displayName, 'Nidia Test')
  assert.equal(lessonComment.data.legacyBodyHtml, '<p>Lesson discussion</p>')
  assert.ok(lessonComment.data.body && typeof lessonComment.data.body === 'object')
  assert.equal(lessonComment.blockers.includes('lesson_comment_schema_registration_required'), false)
  assert.equal(lessonComment.blockers.includes('richtext_wordpress_or_html_conversion_required'), false)
  assert.equal(lessonComment.source.raw?.messageRendered, '<p>Lesson discussion</p>')
  assert.equal(plan.unresolved.some((item) => item.code === 'lesson_comment_schema_registration_required' && item.sourceId === '2'), false)
  assert.equal(plan.unresolved.some((item) => item.code === 'unresolved_comment_post' && item.sourceId === '2'), false)
  assert.equal(plan.operations.some((item) => item.collection === 'payload_space_comments' && item.idempotencyKey === 'fc_comment_id:2'), false, 'lesson comments must not be forced into space comments')
  const missingParentComment = plan.operations.find((item) => item.collection === 'payload_space_comments' && item.idempotencyKey === 'fc_comment_id:3')
  assert.ok(missingParentComment)
  assert.ok(missingParentComment.blockers.includes('unresolved_comment_post'))
  assert.ok(plan.unresolved.some((item) => item.code === 'unresolved_comment_post' && item.sourceId === '3'))

  const lesson = plan.operations.find((item) => item.collection === 'payload_lessons')
  assert.ok(lesson)
  assert.equal(lesson.blockers.includes('richtext_wordpress_or_html_conversion_required'), false)
  assert.equal(lesson.blockers.some((blocker) => blocker.startsWith('bunny_inventory_guid_missing:')), false)
  assert.ok(lesson.data.content && typeof lesson.data.content === 'object')
  assert.match(JSON.stringify(lesson.data.content), /56266f09-d651-4bc5-a5b0-ac9185018018/)
  assert.match(JSON.stringify(lesson.data.content), /"blockType":"bunnyVideo"/)
  assert.equal(lesson.source.raw?.messageRendered, '<p>Lesson body</p><iframe src="https://iframe.mediadelivery.net/embed/581531/56266f09-d651-4bc5-a5b0-ac9185018018" title="Lesson video"></iframe>')

  const bunnyVideo = plan.operations.find((item) => item.collection === 'bunny_videos')
  assert.ok(bunnyVideo)
  assert.equal(bunnyVideo.data.libraryId, 581531)
  assert.equal(Object.prototype.hasOwnProperty.call(bunnyVideo.data, 'videoId'), false)
  assert.equal(bunnyVideo.data.videoGuid, '56266f09-d651-4bc5-a5b0-ac9185018018')
  assert.equal(bunnyVideo.data.lesson, `$ref:${lesson.operationId}`)
  assert.equal(bunnyVideo.data.status, 'ready')
  assert.equal(bunnyVideo.blockers.includes('bunny_target_schema_guid_first_compatibility_required'), false)
  assert.equal(plan.unresolved.some((item) => item.code === 'bunny_target_schema_guid_first_compatibility_required' && item.sourceId === '11'), false)

  const secondGuid = 'cda4b492-91af-430d-9bba-4268ccaf8cc2'
  const multiVideoSnapshot: LegacySqlSnapshot = {
    ...snapshot,
    posts: snapshot.posts.map((post) => post.id === '11'
      ? {
          ...post,
          messageRendered: [
            '<p>Before testimony.</p>',
            '<iframe src="https://iframe.mediadelivery.net/embed/581531/56266f09-d651-4bc5-a5b0-ac9185018018" title="First testimony"></iframe>',
            '<p>Between testimonies.</p>',
            `<iframe src="https://iframe.mediadelivery.net/embed/581531/${secondGuid}" title="Second testimony"></iframe>`,
            '<p>After testimony.</p>',
          ].join(''),
          meta: `${post.meta ?? ''} player.mediadelivery.net/embed/581531/${secondGuid}`,
        }
      : post),
  }
  const multiVideoNormalization = buildLegacyDryRunNormalization(multiVideoSnapshot, buildStripe())
  const multiVideoPlan = await buildLegacyPayloadOperationPlan(multiVideoSnapshot, multiVideoNormalization, {
    ...bunnyInventory,
    videos: [
      ...bunnyInventory.videos,
      {
        video_guid: secondGuid,
        title: 'Second testimony video',
        status: 'resolution_finished',
        library_id: 581531,
        duration_seconds: 29,
        thumbnail_url: 'https://cdn.invalid/second-thumb.jpg',
      },
    ],
  })
  assert.equal(multiVideoPlan.summary.byCollection.bunny_videos, 2)
  assert.equal(multiVideoPlan.summary.byCollection.payload_lesson_videos ?? 0, 0)
  const multiLesson = multiVideoPlan.operations.find((item) => item.collection === 'payload_lessons')
  assert.ok(multiLesson)
  assert.equal(multiLesson.blockers.includes('multiple_bunny_videos_per_lesson_requires_target_decision'), false)
  const multiBunnyVideos = multiVideoPlan.operations.filter((item) => item.collection === 'bunny_videos')
  assert.equal(multiBunnyVideos.length, 2)
  assert.equal(multiBunnyVideos.every((item) => Object.prototype.hasOwnProperty.call(item.data, 'lesson') === false), true)
  const multiContent = JSON.stringify(multiLesson.data.content)
  const firstGuidIndex = multiContent.indexOf('56266f09-d651-4bc5-a5b0-ac9185018018')
  const secondGuidIndex = multiContent.indexOf(secondGuid)
  assert.ok(firstGuidIndex >= 0)
  assert.ok(secondGuidIndex > firstGuidIndex)
  assert.equal((multiContent.match(/"blockType":"bunnyVideo"/g) ?? []).length, 2)
  assert.equal(multiVideoPlan.operations.some((item) => item.collection === 'payload_lesson_videos'), false)
  assert.equal(multiVideoPlan.unresolved.some((item) => item.code === 'multiple_bunny_videos_per_lesson'), false)
  assert.equal(multiVideoPlan.unresolved.some((item) => item.code === 'lesson_video_join_schema_registration_required'), false)

  const unresolvedImageSnapshot: LegacySqlSnapshot = {
    ...snapshot,
    posts: snapshot.posts.map((post) => post.id === '90'
      ? {
          ...post,
          messageRendered: '<p>Before image.</p><img src="https://legacy.invalid/uploads/unresolved.jpg" alt="Unresolved"><p>After image.</p>',
        }
      : post),
  }
  const unresolvedImageNormalization = buildLegacyDryRunNormalization(unresolvedImageSnapshot, buildStripe())
  const unresolvedImagePlan = await buildLegacyPayloadOperationPlan(unresolvedImageSnapshot, unresolvedImageNormalization, bunnyInventory)
  const unresolvedImagePost = unresolvedImagePlan.operations.find((item) => item.collection === 'payload_space_posts' && item.idempotencyKey === 'fc_post_id:90')
  assert.ok(unresolvedImagePost)
  assert.ok(unresolvedImagePost.blockers.includes('richtext_unresolved_image_media_resolution_required'))
  assert.match(JSON.stringify(unresolvedImagePost.data.body), /"blockType":"legacyHTML"/)
  assert.match(JSON.stringify(unresolvedImagePost.data.body), /unresolved\.jpg/)
  assert.equal(unresolvedImagePost.source.raw?.messageRendered, '<p>Before image.</p><img src="https://legacy.invalid/uploads/unresolved.jpg" alt="Unresolved"><p>After image.</p>')

  const missingInventoryPlan = await buildLegacyPayloadOperationPlan(snapshot, normalization)
  const missingInventoryLesson = missingInventoryPlan.operations.find((item) => item.collection === 'payload_lessons')
  assert.ok(missingInventoryLesson)
  assert.ok(missingInventoryLesson.blockers.some((blocker) => blocker.startsWith('bunny_inventory_guid_missing:')))
  assert.equal(missingInventoryPlan.operations.some((item) => item.collection === 'bunny_videos'), false)

  const staffPost = plan.operations.find((item) => item.collection === 'payload_space_posts' && item.idempotencyKey === 'fc_post_id:90')
  assert.ok(staffPost)
  assert.equal(staffPost.blockers.includes('unresolved_post_author'), false, 'staff author must resolve to blocked author mirror')
  assert.equal(staffPost.blockers.includes('richtext_wordpress_or_html_conversion_required'), false)
  assert.ok(staffPost.data.body && typeof staffPost.data.body === 'object')
  assert.equal(staffPost.source.raw?.messageRendered, '<p>Staff historical post</p>')
  assert.equal((staffPost.data.metadata as Record<string, unknown>).reactions instanceof Array, true)

  const communityComment = plan.operations.find((item) => item.collection === 'payload_space_comments' && item.idempotencyKey === 'fc_comment_id:1')
  assert.ok(communityComment)
  assert.ok(communityComment.data.body && typeof communityComment.data.body === 'object')
  assert.equal(communityComment.blockers.includes('richtext_wordpress_or_html_conversion_required'), false)
  assert.equal(communityComment.source.raw?.messageRendered, '<p>Community comment</p>')

  const progress = plan.operations.find((item) => item.collection === 'payload_lesson_progress')
  assert.ok(progress)
  assert.equal(progress.data.status, 'completed')
  assert.equal(progress.data.percentComplete, 100)
  assert.equal(progress.data.member, `$ref:${nidiaMember.operationId}`, 'WP74 progress must resolve to canonical WP76 target member')

  const feedLikeReaction = plan.operations.find((item) => item.collection === 'payload_space_reactions' && item.idempotencyKey === 'fc_reaction:2')
  assert.ok(feedLikeReaction)
  assert.equal(feedLikeReaction.data.reactionType, 'like')
  assert.equal(feedLikeReaction.data.targetKind, 'post')
  assert.ok(feedLikeReaction.data.targetPost)
  assert.equal(feedLikeReaction.data.targetComment, null)
  assert.equal(feedLikeReaction.data.legacyReactionId, '2')
  assert.equal(feedLikeReaction.data.legacyActorUserId, '100')
  assert.equal(feedLikeReaction.data.legacyActorSourceSystem, 'fluentcommunity')
  assert.equal(feedLikeReaction.blockers.includes('community_reaction_schema_registration_required'), false)
  assert.equal(feedLikeReaction.blockers.includes('unresolved_reaction_target_post'), false)

  const commentBookmarkReaction = plan.operations.find((item) => item.collection === 'payload_space_reactions' && item.idempotencyKey === 'fc_reaction:3')
  assert.ok(commentBookmarkReaction)
  assert.equal(commentBookmarkReaction.data.reactionType, 'bookmark')
  assert.equal(commentBookmarkReaction.data.targetKind, 'comment')
  assert.equal(commentBookmarkReaction.data.targetPost, null)
  assert.ok(commentBookmarkReaction.data.targetComment)
  assert.equal(commentBookmarkReaction.data.legacyReactionId, '3')
  assert.equal(commentBookmarkReaction.data.legacyActorUserId, '101')
  assert.equal(commentBookmarkReaction.blockers.includes('community_reaction_schema_registration_required'), false)
  assert.equal(commentBookmarkReaction.blockers.includes('unresolved_reaction_target_comment'), false)

  const surveyVoteReaction = plan.operations.find((item) => item.collection === 'payload_space_reactions' && item.idempotencyKey === 'fc_reaction:4')
  assert.ok(surveyVoteReaction)
  assert.equal(surveyVoteReaction.data.reactionType, 'survey_vote')
  assert.equal(surveyVoteReaction.data.targetKind, 'survey_option')
  assert.ok(surveyVoteReaction.data.targetPost, 'survey vote must resolve target post from objectId')
  assert.equal(surveyVoteReaction.data.targetComment, null)
  assert.equal(surveyVoteReaction.data.surveyOptionKey, 'opt_1')
  assert.equal(surveyVoteReaction.data.legacyReactionId, '4')
  assert.equal(surveyVoteReaction.data.legacyActorUserId, '100')
  assert.equal(surveyVoteReaction.blockers.includes('community_reaction_schema_registration_required'), false)
  assert.equal(surveyVoteReaction.blockers.includes('unresolved_reaction_target_post'), false)

  assert.equal(plan.operations.some((item) => item.collection === 'payload_space_reactions' && item.idempotencyKey === 'fc_reaction:1'), false, 'lesson_completed must not produce a space reaction operation')

  for (const course of plan.operations.filter((item) => item.collection === 'payload_courses')) {
    assert.equal(course.data.visibility, 'members')
    assert.equal(course.data.accessBadge, 'manual')
  }
  for (const space of plan.operations.filter((item) => item.collection === 'payload_spaces')) {
    assert.equal(space.data.visibility, 'members')
    assert.equal(Object.prototype.hasOwnProperty.call(space.data, 'requiredAccessGroups'), false)
  }

  const collectOperationRefs = (value: unknown, refs: Set<string>): void => {
    if (typeof value === 'string' && value.startsWith('$ref:')) {
      refs.add(value.slice('$ref:'.length))
      return
    }
    if (Array.isArray(value)) {
      for (const item of value) collectOperationRefs(item, refs)
      return
    }
    if (value && typeof value === 'object') {
      for (const nested of Object.values(value as Record<string, unknown>)) collectOperationRefs(nested, refs)
    }
  }
  for (const operation of plan.operations) {
    const refs = new Set<string>()
    collectOperationRefs(operation.data, refs)
    for (const referencedOperationId of refs) {
      assert.ok(
        operation.dependsOn.includes(referencedOperationId),
        `${operation.operationId} missing dependsOn for data ref ${referencedOperationId}`,
      )
      assert.equal(
        plan.operations.filter((candidate) => candidate.operationId === referencedOperationId).length,
        1,
        `${operation.operationId} data ref ${referencedOperationId} must resolve to exactly one operation`,
      )
    }
  }

  console.log('Legacy Payload operation-plan contract: PASS')
}

void run().catch((error) => {
  console.error('Legacy Payload operation-plan contract: FAIL')
  console.error(error)
  process.exitCode = 1
})
