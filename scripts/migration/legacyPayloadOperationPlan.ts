import { createHash } from 'node:crypto'

import {
  normalizeBunnyInventoryVideos,
  parsePhpSerializedRecord,
  type BunnyInventoryFile,
  type CanonicalMemberDryRun,
  type CommunityPostSource,
  type CommunityProfileSource,
  type CommunityReactionSource,
  type CommunitySpaceMembershipSource,
  type CommunitySpaceSource,
  type FluentCrmContactSource,
  type LegacyDryRunNormalization,
  type LegacySqlSnapshot,
  type NormalizedBunnyInventoryVideo,
  type WordPressUserSource,
} from './legacySourceDryRun'
import {
  convertLegacyHTMLToLexical,
  type LegacyRichTextConversionOptions,
  type LegacyRichTextConversionResult,
} from './legacyRichText'
import {
  LEGACY_SPACE_MEDIA_TARGETS,
  POST_MIGRATION29_FORWARD_BLOCKERS,
} from './postMigration29ForwardSchemaPlan'
import { PAYLOAD_MIGRATION_NAMES } from '../../src/lib/payloadMigrationRegistry'

export type PayloadOperationCollection =
  | 'payload_members'
  | 'payload_member_profiles'
  | 'payload_contacts'
  | 'payload_courses'
  | 'payload_course_modules'
  | 'payload_lessons'
  | 'payload_course_enrollments'
  | 'payload_lesson_progress'
  | 'payload_lesson_resources'
  | 'payload_lesson_comments'
  | 'payload_private_media'
  | 'payload_spaces'
  | 'payload_space_memberships'
  | 'payload_space_posts'
  | 'payload_space_comments'
  | 'payload_space_reactions'
  | 'payload_space_files'
  | 'payload_media'
  | 'bunny_videos'
  | 'portalSettings'

export interface ProposedPayloadOperation {
  operationId: string
  idempotencyKey: string
  collection: PayloadOperationCollection
  targetType?: 'collection' | 'global'
  globalSlug?: 'portalSettings'
  action: 'proposed_create'
  data: Record<string, unknown>
  dependsOn: string[]
  source: {
    system: 'wordpress' | 'fluentcrm' | 'fluentcommunity' | 'migration_policy'
    entityType: string
    sourceIds: string[]
    raw?: Record<string, unknown>
  }
  blockers: string[]
}

export interface LegacyTargetSchemaCapabilities {
  bunnyGuidFirst: boolean
  lessonComments: boolean
  spaceOgImage: boolean
  spaceReactions: boolean
  memberProfileParity: boolean
  portalSettings: boolean
}

export interface BuildLegacyPayloadOperationPlanOptions {
  targetCapabilities?: LegacyTargetSchemaCapabilities
  resolveImage?: LegacyRichTextConversionOptions['resolveImage']
}

export const CANONICAL_LEGACY_TARGET_CAPABILITIES: LegacyTargetSchemaCapabilities = {
  bunnyGuidFirst: PAYLOAD_MIGRATION_NAMES.includes('20260817_193000_bunny_guid_first'),
  lessonComments: PAYLOAD_MIGRATION_NAMES.includes('20260817_193100_lesson_comments'),
  spaceOgImage: PAYLOAD_MIGRATION_NAMES.includes('20260817_193200_space_og_image'),
  spaceReactions: PAYLOAD_MIGRATION_NAMES.includes('20260817_193300_space_reactions'),
  memberProfileParity: PAYLOAD_MIGRATION_NAMES.includes('20260818_140000_member_profile_parity'),
  portalSettings: PAYLOAD_MIGRATION_NAMES.includes('20260818_140100_portal_settings'),
}

export interface LegacyPayloadOperationPlan {
  planVersion: '1.0'
  executionAuthorized: false
  executable: false
  snapshot: {
    sourceMemberAccounts: number
    canonicalSubscriberMembers: number
    activeSubscriberMembers: number
    blockedSubscriberMembers: number
    staffAuthorMirrors: number
  }
  operations: ProposedPayloadOperation[]
  unresolved: Array<{
    code: string
    sourceType: string
    sourceId: string
    detail: string
  }>
  summary: {
    operations: number
    blockedOperations: number
    byCollection: Record<string, number>
    activeCourseEnrollments: number
    blockedHistoricalCourseEnrollments: number
    activeSpaceMemberships: number
    blockedHistoricalSpaceMemberships: number
    lessonProgress: number
    communityComments: number
    deferredLessonComments: number
    deferredOtherSourceComments: number
    communityReactions: number
    plannedLessonComments: number
    communityFileReferences: number
    lessonResourceReferences: number
    protectedLessonResourceMedia: number
    spaceDocumentReferences: number
    memberAvatarMediaReferences: number
    memberCoverMediaReferences: number
    portalSettingsMediaReferences: number
    courseCoverMediaReferences: number
    spaceMediaSchemaReferences: number
    platformArchiveMediaReferences: number
    unresolvedMediaRecords: number
    platformMediaAssetsAwaitingTargetDecision: number
  }
}

const ref = (operationId: string): string => `$ref:${operationId}`

const JPV_PORTAL_MEDIA_TARGETS_BY_KEY: Record<string, { targetFields: string[]; sourceReferencePaths: string[] }> = {
  d5e197c8eb529ce2b72f477d7a62bdf1: {
    targetFields: ['logo', 'loginBanner.logo'],
    sourceReferencePaths: [
      'wp_options:fluent_community_settings#logo',
      'wp_fcom_meta:option:auth_settings#login.banner.logo',
      'wp_fcom_meta:option:auth_settings#signup.banner.logo',
    ],
  },
  e0584e3a8c875c92b0ebd756cfc93826: {
    targetFields: ['whiteLogo'],
    sourceReferencePaths: ['wp_options:fluent_community_settings#white_logo'],
  },
  '3badcaa804b908c416e64a1d477da4fa': {
    targetFields: ['featuredImage'],
    sourceReferencePaths: ['wp_options:fluent_community_settings#featured_image'],
  },
}

function safeKey(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9._:-]+/g, '-')
}

function stableOperationId(collection: string, idempotencyKey: string): string {
  const digest = createHash('sha256').update(`${collection}\0${idempotencyKey}`).digest('hex').slice(0, 16)
  return `legacy:${safeKey(collection)}:${digest}`
}

function operation(
  collection: PayloadOperationCollection,
  idempotencyKey: string,
  data: Record<string, unknown>,
  source: ProposedPayloadOperation['source'],
  dependsOn: string[] = [],
  blockers: string[] = [],
): ProposedPayloadOperation {
  return {
    operationId: stableOperationId(collection, idempotencyKey),
    idempotencyKey,
    collection,
    action: 'proposed_create',
    data,
    dependsOn: [...new Set(dependsOn)],
    source,
    blockers: [...new Set(blockers)],
  }
}

function globalOperation(
  slug: 'portalSettings',
  idempotencyKey: string,
  data: Record<string, unknown>,
  source: ProposedPayloadOperation['source'],
  dependsOn: string[] = [],
  blockers: string[] = [],
): ProposedPayloadOperation {
  return {
    ...operation(slug, idempotencyKey, data, source, dependsOn, blockers),
    targetType: 'global',
    globalSlug: slug,
  }
}

function asSettingRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function settingAt(record: Record<string, unknown>, path: string): unknown {
  let current: unknown = record
  for (const part of path.split('.')) {
    current = asSettingRecord(current)[part]
  }
  return current
}

function settingText(record: Record<string, unknown>, path: string): string | undefined {
  const value = settingAt(record, path)
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function plainTextToLexical(text: string): Record<string, unknown> {
  return {
    root: {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          version: 1,
          children: [{ type: 'text', text, version: 1 }],
        },
      ],
      direction: 'ltr',
      format: '',
      indent: 0,
      version: 1,
    },
  }
}

function stripMarkup(value: string | null | undefined): string {
  return (value ?? '')
    .replace(/<!--\s*\/?wp:[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#x20;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

function deriveTitle(post: CommunityPostSource, fallbackPrefix: string): string {
  const explicit = post.title?.trim()
  if (explicit) return explicit
  const text = stripMarkup(post.messageRendered ?? post.message)
  if (text) return text.slice(0, 120)
  return `${fallbackPrefix} ${post.id}`
}

function deriveSummary(post: CommunityPostSource, max = 300): string | undefined {
  const text = stripMarkup(post.messageRendered ?? post.message)
  return text ? text.slice(0, max) : undefined
}

function targetSpaceSlug(space: CommunitySpaceSource): string {
  if (space.title.trim().toLowerCase() === 'only vip discussion') return 'member-discussion'
  return space.slug || space.targetTitle.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function mapPublishedStatus(status: string): 'published' | 'draft' | 'archived' {
  const normalized = status.trim().toLowerCase()
  if (normalized === 'published' || normalized === 'active') return 'published'
  if (normalized === 'archived' || normalized === 'deleted' || normalized === 'trash') return 'archived'
  return 'draft'
}

function mapModerationStatus(status: string): 'visible' | 'pending_review' | 'hidden' | 'deleted' {
  const normalized = status.trim().toLowerCase()
  if (normalized === 'published' || normalized === 'active' || normalized === 'visible') return 'visible'
  if (normalized === 'pending' || normalized === 'pending_review') return 'pending_review'
  if (normalized === 'deleted' || normalized === 'trash') return 'deleted'
  return 'hidden'
}

function isAnnouncementSpace(space: CommunitySpaceSource): boolean {
  if (space.title.trim().toLowerCase() === 'info forum') return true
  return Boolean(space.settings?.includes('restricted_post_only";s:3:"yes"'))
}

function canonicalMemberOperationKey(member: CanonicalMemberDryRun): string {
  return `wp_member:${member.canonicalWpUserId}`
}

function staffMemberOperationKey(user: WordPressUserSource): string {
  return `wp_staff_author:${user.id}`
}

function findCanonicalMemberForSourceId(
  members: CanonicalMemberDryRun[],
  sourceWpUserId: string | null | undefined,
): CanonicalMemberDryRun | undefined {
  if (!sourceWpUserId) return undefined
  return members.find((member) => member.sourceWpUserIds.includes(sourceWpUserId))
}

function chooseContact(
  member: CanonicalMemberDryRun,
  contacts: FluentCrmContactSource[],
): FluentCrmContactSource | undefined {
  const candidates = contacts.filter((contact) => contact.userId && member.sourceWpUserIds.includes(contact.userId))
  return candidates.find((contact) => contact.userId === member.canonicalWpUserId) ?? candidates[0]
}

function orderedProfilesForMember(
  member: CanonicalMemberDryRun,
  profiles: CommunityProfileSource[],
): CommunityProfileSource[] {
  const sourceOrder = new Map(member.sourceWpUserIds.map((sourceId, index) => [sourceId, index]))
  return profiles
    .filter((profile) => member.sourceWpUserIds.includes(profile.userId))
    .sort((left, right) => {
      if (left.userId === member.canonicalWpUserId && right.userId !== member.canonicalWpUserId) return -1
      if (right.userId === member.canonicalWpUserId && left.userId !== member.canonicalWpUserId) return 1
      return (sourceOrder.get(left.userId) ?? Number.MAX_SAFE_INTEGER) - (sourceOrder.get(right.userId) ?? Number.MAX_SAFE_INTEGER)
    })
}

function firstProfileText(
  profiles: CommunityProfileSource[],
  select: (profile: CommunityProfileSource) => string | null | undefined,
): { value: string | null; profileId: string | null } {
  for (const profile of profiles) {
    const value = select(profile)?.trim()
    if (value) return { value, profileId: profile.id }
  }
  return { value: null, profileId: null }
}

function mapCrmEmailStatus(status: string | undefined): 'subscribed' | 'transactional_only' | 'unsubscribed' | 'bounced' | 'complained' {
  switch ((status ?? '').trim().toLowerCase()) {
    case 'subscribed': return 'subscribed'
    case 'unsubscribed': return 'unsubscribed'
    case 'bounced': return 'bounced'
    case 'complained': return 'complained'
    default: return 'transactional_only'
  }
}

function mapSourceRole(rows: CommunitySpaceMembershipSource[]): 'member' | 'moderator' | 'admin' {
  if (rows.some((row) => row.role === 'admin')) return 'admin'
  if (rows.some((row) => row.role === 'moderator')) return 'moderator'
  return 'member'
}

function reactionsForPost(reactions: CommunityReactionSource[], postId: string): Array<Record<string, unknown>> {
  return reactions
    .filter((reaction) => reaction.objectType === 'feed' && reaction.objectId === postId)
    .map((reaction) => ({
      idempotencyKey: `fc_reaction:${reaction.userId ?? 'unknown'}:feed:${postId}:${reaction.type}`,
      sourceUserId: reaction.userId,
      reactionType: reaction.type,
      createdAt: reaction.createdAt,
    }))
}

function reactionsForComment(reactions: CommunityReactionSource[], commentId: string): Array<Record<string, unknown>> {
  return reactions
    .filter((reaction) => reaction.objectType === 'comment' && reaction.objectId === commentId)
    .map((reaction) => ({
      idempotencyKey: `fc_reaction:${reaction.userId ?? 'unknown'}:comment:${commentId}:${reaction.type}`,
      sourceUserId: reaction.userId,
      reactionType: reaction.type,
      createdAt: reaction.createdAt,
    }))
}

function richTextConversionBlockers(result: LegacyRichTextConversionResult): string[] {
  const blockers: string[] = []
  for (const fragment of result.fallbackFragments) {
    if (fragment.reason === 'image_media_resolution_required' || fragment.reason === 'image_missing_src') {
      blockers.push('richtext_unresolved_image_media_resolution_required')
      continue
    }
    if (
      fragment.reason === 'unsupported_iframe' ||
      fragment.reason === 'unsupported_html_tag:video' ||
      fragment.reason === 'unsupported_html_tag:audio' ||
      fragment.reason === 'unsupported_html_tag:embed' ||
      fragment.reason === 'unsupported_html_tag:object'
    ) {
      blockers.push('richtext_embed_target_implementation_required')
      continue
    }
    if (
      fragment.reason === 'unsupported_html_tag:script' ||
      fragment.reason === 'unsupported_html_tag:style' ||
      fragment.reason === 'unsupported_html_tag:form'
    ) {
      blockers.push('richtext_legacy_code_review_required')
    }
  }
  return [...new Set(blockers)]
}

async function convertRichTextSource(
  source: string | null | undefined,
  sourceLabel: string,
  resolveImage?: LegacyRichTextConversionOptions['resolveImage'],
) {
  const html = source?.trim() ?? ''
  if (!html) {
    return {
      lexical: undefined as Record<string, unknown> | undefined,
      blockers: [] as string[],
      conversion: null as LegacyRichTextConversionResult | null,
    }
  }

  try {
    const conversion = await convertLegacyHTMLToLexical({
      html,
      sourceLabel,
      resolveImage,
    })
    return {
      lexical: conversion.lexical as unknown as Record<string, unknown>,
      blockers: richTextConversionBlockers(conversion),
      conversion,
    }
  } catch (error) {
    return {
      lexical: undefined as Record<string, unknown> | undefined,
      blockers: ['richtext_wordpress_or_html_conversion_required'],
      conversion: null as LegacyRichTextConversionResult | null,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

function bunnyGuidsForPost(normalization: LegacyDryRunNormalization, postId: string): string[] {
  return [...new Set(normalization.bunnyReferences
    .filter((reference) => reference.sourcePostId === postId)
    .map((reference) => reference.videoGuid))]
}

function bunnyInventoryByGuid(inventory?: BunnyInventoryFile): Map<string, NormalizedBunnyInventoryVideo> {
  return new Map(normalizeBunnyInventoryVideos(inventory).map((video) => [video.video_guid.toLowerCase(), video]))
}

function targetBunnyStatus(status: string | undefined): 'processing' | 'ready' | 'failed' {
  if (status === 'failed') return 'failed'
  if (status === 'resolution_finished') return 'ready'
  return 'processing'
}

export async function buildLegacyPayloadOperationPlan(
  snapshot: LegacySqlSnapshot,
  normalization: LegacyDryRunNormalization,
  bunnyInventory?: BunnyInventoryFile,
  options: BuildLegacyPayloadOperationPlanOptions = {},
): Promise<LegacyPayloadOperationPlan> {
  const targetCapabilities = options.targetCapabilities ?? CANONICAL_LEGACY_TARGET_CAPABILITIES
  const resolveImage = options.resolveImage
  const operations: ProposedPayloadOperation[] = []
  const unresolved: LegacyPayloadOperationPlan['unresolved'] = []
  const bunnyByGuid = bunnyInventoryByGuid(bunnyInventory)
  const sourcePostById = new Map(snapshot.posts.map((post) => [post.id, post]))
  const sourceUserById = new Map(snapshot.wordpressUsers.map((user) => [user.id, user]))
  const canonicalMemberBySourceWpId = new Map<string, CanonicalMemberDryRun>()
  for (const member of normalization.identity.members) {
    for (const sourceId of member.sourceWpUserIds) canonicalMemberBySourceWpId.set(sourceId, member)
  }
  const memberOperationBySourceWpId = new Map<string, ProposedPayloadOperation>()
  const profileOperationBySourceWpId = new Map<string, ProposedPayloadOperation>()
  const subscriberMemberOperationByCanonicalId = new Map<string, ProposedPayloadOperation>()

  // Consumer/member population: 48 source subscriber accounts -> 47 canonical members.
  for (const member of normalization.identity.members) {
    const memberOp = operation(
      'payload_members',
      canonicalMemberOperationKey(member),
      {
        email: member.canonicalEmail,
        accountStatus: member.accountStatus,
        source: 'migration',
        ...(member.accountStatus === 'blocked'
          ? { billingHoldReason: member.classificationReason === 'stripe_past_due_fail_closed' ? 'legacy_stripe_past_due' : 'legacy_migration_deactivated' }
          : {}),
        notes: `Legacy migration source WordPress user IDs: ${member.sourceWpUserIds.join(', ')}.`,
      },
      {
        system: 'wordpress',
        entityType: 'canonical_member',
        sourceIds: member.sourceWpUserIds,
        raw: {
          sourceEmails: member.sourceEmails,
          stripeCustomerIds: member.stripeCustomerIds,
          stripeSubscriptionIds: member.stripeSubscriptionIds,
          conflicts: member.conflicts,
        },
      },
    )
    operations.push(memberOp)
    subscriberMemberOperationByCanonicalId.set(member.canonicalWpUserId, memberOp)
    for (const sourceId of member.sourceWpUserIds) memberOperationBySourceWpId.set(sourceId, memberOp)

    const profileCandidates = orderedProfilesForMember(member, snapshot.communityProfiles)
    const website = firstProfileText(profileCandidates, (profile) => profile.website)
    const biography = firstProfileText(
      profileCandidates,
      (profile) => profile.shortDescriptionRendered ?? profile.shortDescription,
    )
    const socialInstagram = firstProfileText(profileCandidates, (profile) => profile.socialLinks.instagram)
    const socialTwitter = firstProfileText(profileCandidates, (profile) => profile.socialLinks.twitter)
    const socialLinkedin = firstProfileText(profileCandidates, (profile) => profile.socialLinks.linkedin)
    const socialFacebook = firstProfileText(profileCandidates, (profile) => profile.socialLinks.facebook)
    const socialYoutube = firstProfileText(profileCandidates, (profile) => profile.socialLinks.youtube)
    const biographyRichText = await convertRichTextSource(
      biography.value,
      `fluentcommunity:xprofile:${biography.profileId ?? member.canonicalWpUserId}:biography`,
      resolveImage,
    )

    const profileOp = operation(
      'payload_member_profiles',
      `wp_member_profile:${member.canonicalWpUserId}`,
      {
        member: ref(memberOp.operationId),
        displayName: member.displayName || member.canonicalEmail,
        website: website.value ?? undefined,
        biography: biographyRichText.lexical,
        socialLinks: {
          instagram: socialInstagram.value ?? undefined,
          twitter: socialTwitter.value ?? undefined,
          linkedin: socialLinkedin.value ?? undefined,
          facebook: socialFacebook.value ?? undefined,
          youtube: socialYoutube.value ?? undefined,
        },
        marketingConsent: false,
        transactionalEmailConsent: true,
      },
      {
        system: profileCandidates.length > 0 ? 'fluentcommunity' : 'wordpress',
        entityType: 'member_profile',
        sourceIds: profileCandidates.length > 0 ? profileCandidates.map((profile) => profile.id) : member.sourceWpUserIds,
        raw: {
          sourceWpUserIds: member.sourceWpUserIds,
          communityProfiles: profileCandidates.map((profile) => ({
            id: profile.id,
            userId: profile.userId,
            displayName: profile.displayName,
            avatar: profile.avatar,
            shortDescription: profile.shortDescription,
            shortDescriptionRendered: profile.shortDescriptionRendered,
            website: profile.website,
            headline: profile.headline,
            coverPhoto: profile.coverPhoto,
            socialLinks: profile.socialLinks,
            status: profile.status,
            metaRaw: profile.metaRaw,
          })),
          selectedProfileIds: {
            website: website.profileId,
            biography: biography.profileId,
            instagram: socialInstagram.profileId,
            twitter: socialTwitter.profileId,
            linkedin: socialLinkedin.profileId,
            facebook: socialFacebook.profileId,
            youtube: socialYoutube.profileId,
          },
          biographyRichTextConversion: biographyRichText.conversion
            ? {
                bunnyGuids: biographyRichText.conversion.bunnyGuids,
                resolvedImages: biographyRichText.conversion.resolvedImages,
                fallbackFragments: biographyRichText.conversion.fallbackFragments,
              }
            : null,
        },
      },
      [memberOp.operationId],
      biographyRichText.blockers,
    )
    operations.push(profileOp)
    for (const sourceId of member.sourceWpUserIds) profileOperationBySourceWpId.set(sourceId, profileOp)

    const crm = chooseContact(member, snapshot.fluentCrmContacts)
    operations.push(operation(
      'payload_contacts',
      `legacy_contact:${member.canonicalWpUserId}`,
      {
        email: member.canonicalEmail,
        member: ref(memberOp.operationId),
        firstName: crm?.firstName ?? undefined,
        lastName: crm?.lastName ?? undefined,
        lifecycleStage: member.accountStatus === 'active' ? 'student' : 'lead',
        emailStatus: mapCrmEmailStatus(crm?.status),
        source: crm ? 'legacy_fluentcrm' : 'legacy_wordpress_member',
        metadata: {
          sourceWordPressUserIds: member.sourceWpUserIds,
          sourceFluentCrmContactIds: member.fluentCrmContactIds,
          legacyTierTagsAreNonEntitlementMetadata: true,
        },
      },
      {
        system: crm ? 'fluentcrm' : 'wordpress',
        entityType: 'contact',
        sourceIds: crm ? [crm.id] : member.sourceWpUserIds,
      },
      [memberOp.operationId],
    ))
  }

  // Staff/admin identities are blocked author-only mirrors. They preserve authorship but grant no member access.
  const staffUsers = snapshot.wordpressUsers.filter((user) => user.role === 'administrator')
  for (const user of staffUsers) {
    const staffOp = operation(
      'payload_members',
      staffMemberOperationKey(user),
      {
        email: user.email,
        accountStatus: 'blocked',
        source: 'migration',
        billingHoldReason: 'legacy_staff_author_only',
        notes: 'Legacy staff/admin author identity. Member login/access must remain disabled; operational admin access is separate.',
      },
      { system: 'wordpress', entityType: 'staff_author_identity', sourceIds: [user.id] },
    )
    operations.push(staffOp)
    memberOperationBySourceWpId.set(user.id, staffOp)
    const staffProfileOp = operation(
      'payload_member_profiles',
      `wp_staff_author_profile:${user.id}`,
      {
        member: ref(staffOp.operationId),
        displayName: user.displayName || user.email,
        marketingConsent: false,
        transactionalEmailConsent: true,
      },
      { system: 'wordpress', entityType: 'staff_author_profile', sourceIds: [user.id] },
      [staffOp.operationId],
    )
    operations.push(staffProfileOp)
    profileOperationBySourceWpId.set(user.id, staffProfileOp)
  }

  const courseOperationBySourceId = new Map<string, ProposedPayloadOperation>()
  for (const course of normalization.courses) {
    const courseOp = operation(
      'payload_courses',
      `fc_course:${course.id}`,
      {
        title: course.targetTitle,
        slug: course.slug || `legacy-course-${course.id}`,
        shortDescription: course.description ?? undefined,
        description: course.description ? plainTextToLexical(course.description) : undefined,
        status: mapPublishedStatus(course.status),
        visibility: 'members',
        accessBadge: 'manual',
        sortOrder: course.serial,
        featured: false,
      },
      {
        system: 'fluentcommunity',
        entityType: 'course',
        sourceIds: [course.id],
        raw: { originalPrivacy: course.privacy, parentId: course.parentId, settings: course.settings },
      },
    )
    operations.push(courseOp)
    courseOperationBySourceId.set(course.id, courseOp)
  }

  const moduleOperationBySourceId = new Map<string, ProposedPayloadOperation>()
  for (const section of normalization.courseSections) {
    const courseOp = section.spaceId ? courseOperationBySourceId.get(section.spaceId) : undefined
    const blockers = courseOp ? [] : ['unresolved_parent_course']
    if (!courseOp) unresolved.push({ code: 'unresolved_parent_course', sourceType: 'course_section', sourceId: section.id, detail: `space_id=${section.spaceId ?? 'null'}` })
    const moduleOp = operation(
      'payload_course_modules',
      `fc_course_section:${section.id}`,
      {
        course: courseOp ? ref(courseOp.operationId) : null,
        title: deriveTitle(section, 'Legacy section'),
        description: deriveSummary(section),
        sortOrder: section.priority,
        publishedPreview: false,
      },
      { system: 'fluentcommunity', entityType: 'course_section', sourceIds: [section.id] },
      courseOp ? [courseOp.operationId] : [],
      blockers,
    )
    operations.push(moduleOp)
    moduleOperationBySourceId.set(section.id, moduleOp)
  }

  const lessonOperationBySourceId = new Map<string, ProposedPayloadOperation>()
  for (const lesson of normalization.courseLessons) {
    const moduleOp = lesson.parentId ? moduleOperationBySourceId.get(lesson.parentId) : undefined
    const bunnyGuids = bunnyGuidsForPost(normalization, lesson.id)
    const bunnyResolutionBlockers: string[] = []

    for (const guid of bunnyGuids) {
      const inventoryVideo = bunnyByGuid.get(guid.toLowerCase())
      if (!inventoryVideo) {
        bunnyResolutionBlockers.push(`bunny_inventory_guid_missing:${guid}`)
        unresolved.push({
          code: 'bunny_inventory_guid_missing',
          sourceType: 'course_lesson',
          sourceId: lesson.id,
          detail: `library=581531 guid=${guid}`,
        })
      } else if (inventoryVideo.status === 'failed') {
        bunnyResolutionBlockers.push(`bunny_inventory_video_failed:${guid}`)
        unresolved.push({
          code: 'bunny_inventory_video_failed',
          sourceType: 'course_lesson',
          sourceId: lesson.id,
          detail: `library=${inventoryVideo.library_id ?? bunnyInventory?.library?.id ?? 581531} guid=${guid}`,
        })
      }
    }

    const lessonRichText = await convertRichTextSource(
      lesson.messageRendered ?? lesson.message,
      `course_lesson:${lesson.id}`,
      resolveImage,
    )
    const blockers = [
      ...(moduleOp ? [] : ['unresolved_parent_module']),
      ...lessonRichText.blockers,
      ...bunnyResolutionBlockers,
    ]
    if (!moduleOp) unresolved.push({ code: 'unresolved_parent_module', sourceType: 'course_lesson', sourceId: lesson.id, detail: `parent_id=${lesson.parentId ?? 'null'}` })
    const lessonOp = operation(
      'payload_lessons',
      `fc_course_lesson:${lesson.id}`,
      {
        module: moduleOp ? ref(moduleOp.operationId) : null,
        title: deriveTitle(lesson, 'Legacy lesson'),
        slug: lesson.slug || `legacy-lesson-${lesson.id}`,
        summary: deriveSummary(lesson),
        content: lessonRichText.lexical,
        sortOrder: lesson.priority,
        previewLesson: false,
        lockState: 'available',
      },
      {
        system: 'fluentcommunity',
        entityType: 'course_lesson',
        sourceIds: [lesson.id],
        raw: {
          message: lesson.message,
          messageRendered: lesson.messageRendered,
          meta: lesson.meta,
          bunnyGuids,
          richTextConversion: lessonRichText.conversion
            ? {
                bunnyGuids: lessonRichText.conversion.bunnyGuids,
                resolvedImages: lessonRichText.conversion.resolvedImages,
                fallbackFragments: lessonRichText.conversion.fallbackFragments,
              }
            : null,
        },
      },
      moduleOp ? [moduleOp.operationId] : [],
      blockers,
    )
    operations.push(lessonOp)
    lessonOperationBySourceId.set(lesson.id, lessonOp)

    for (const [sourceOrder, guid] of bunnyGuids.entries()) {
      const inventoryVideo = bunnyByGuid.get(guid.toLowerCase())
      if (!inventoryVideo || inventoryVideo.status === 'failed') continue
      const libraryId = inventoryVideo.library_id ?? bunnyInventory?.library?.id ?? 581531
      unresolved.push({
        code: POST_MIGRATION29_FORWARD_BLOCKERS.bunnyGuidFirst,
        sourceType: 'course_lesson',
        sourceId: lesson.id,
        detail: `source video is verified by library=${libraryId} guid=${guid}; GUID-first forward schema registration is still pending`,
      })
      const bunnyVideoOp = operation(
        'bunny_videos',
        `legacy_bunny_video:${lesson.id}:${guid}`,
        {
          title: inventoryVideo.title || lesson.title || `Legacy lesson video ${lesson.id}`,
          libraryId,
          videoGuid: guid,
          ...(bunnyGuids.length === 1 ? { lesson: ref(lessonOp.operationId) } : {}),
          status: targetBunnyStatus(inventoryVideo.status),
          duration: inventoryVideo.duration_seconds ?? undefined,
          frameRate: inventoryVideo.framerate ?? undefined,
          width: inventoryVideo.width ?? undefined,
          height: inventoryVideo.height ?? undefined,
          thumbnailUrl: inventoryVideo.thumbnail_url ?? undefined,
        },
        {
          system: 'fluentcommunity',
          entityType: 'legacy_bunny_video_reference',
          sourceIds: [lesson.id, guid],
          raw: { sourceStatus: inventoryVideo.status, canonicalSourceIdentifier: 'videoGuid', sourceOrder },
        },
        [lessonOp.operationId],
        [POST_MIGRATION29_FORWARD_BLOCKERS.bunnyGuidFirst],
      )
      operations.push(bunnyVideoOp)

    }
  }

  const spaceOperationBySourceId = new Map<string, ProposedPayloadOperation>()
  for (const space of normalization.communitySpaces) {
    const spaceOp = operation(
      'payload_spaces',
      `fc_space_id:${space.id}`,
      {
        name: space.targetTitle,
        slug: targetSpaceSlug(space),
        status: mapPublishedStatus(space.status),
        spaceType: isAnnouncementSpace(space) ? 'announcement' : 'discussion',
        visibility: 'members',
        description: space.description ?? undefined,
        sortOrder: space.serial,
        metadata: {
          fcSpaceId: space.id,
          fcSourceWave: 'fluent-community',
          originalPrivacy: space.privacy,
          originalParentId: space.parentId,
          originalTitle: space.title,
          tierAccessRemoved: space.title !== space.targetTitle,
        },
      },
      { system: 'fluentcommunity', entityType: 'space', sourceIds: [space.id], raw: { settings: space.settings } },
    )
    operations.push(spaceOp)
    spaceOperationBySourceId.set(space.id, spaceOp)
  }

  // Unified course access: every active paid migrated member receives every migrated course.
  let activeCourseEnrollments = 0
  let blockedHistoricalCourseEnrollments = 0
  const enrollmentKeys = new Set<string>()
  for (const member of normalization.identity.members.filter((item) => item.accountStatus === 'active')) {
    const memberOp = subscriberMemberOperationByCanonicalId.get(member.canonicalWpUserId)!
    for (const [courseSourceId, courseOp] of courseOperationBySourceId) {
      const key = `${member.canonicalWpUserId}:${courseSourceId}`
      enrollmentKeys.add(key)
      activeCourseEnrollments += 1
      const completed = normalization.courseCompletedActivities.some((activity) =>
        member.sourceWpUserIds.includes(activity.userId ?? '') && (activity.feedId === courseSourceId || activity.spaceId === courseSourceId),
      )
      operations.push(operation(
        'payload_course_enrollments',
        `legacy_unified_course_enrollment:${key}`,
        {
          displayName: `${member.canonicalEmail} / ${courseOp.idempotencyKey}`,
          member: ref(memberOp.operationId),
          course: ref(courseOp.operationId),
          status: 'active',
          source: 'migration',
          metadata: {
            unifiedMembershipMigration: true,
            sourceCourseCompleted: completed,
            legacyTierGatingRemoved: true,
          },
        },
        { system: 'migration_policy', entityType: 'unified_course_access', sourceIds: member.sourceWpUserIds },
        [memberOp.operationId, courseOp.operationId],
      ))
    }
  }

  // Preserve blocked users' historical course relationship without granting current course access.
  for (const sourceMembership of normalization.spaceMemberships) {
    const member = findCanonicalMemberForSourceId(normalization.identity.members, sourceMembership.userId)
    if (!member || member.accountStatus !== 'blocked' || !sourceMembership.spaceId) continue
    const courseOp = courseOperationBySourceId.get(sourceMembership.spaceId)
    const memberOp = member ? subscriberMemberOperationByCanonicalId.get(member.canonicalWpUserId) : undefined
    if (!courseOp || !memberOp) continue
    const key = `${member.canonicalWpUserId}:${sourceMembership.spaceId}`
    if (enrollmentKeys.has(key)) continue
    enrollmentKeys.add(key)
    blockedHistoricalCourseEnrollments += 1
    const completed = normalization.courseCompletedActivities.some((activity) =>
      member.sourceWpUserIds.includes(activity.userId ?? '') && (activity.feedId === sourceMembership.spaceId || activity.spaceId === sourceMembership.spaceId),
    )
    operations.push(operation(
      'payload_course_enrollments',
      `legacy_historical_course_enrollment:${key}`,
      {
        displayName: `${member.canonicalEmail} / ${courseOp.idempotencyKey}`,
        member: ref(memberOp.operationId),
        course: ref(courseOp.operationId),
        status: 'revoked',
        source: 'migration',
        revokedReason: 'legacy_migration_member_deactivated',
        metadata: { sourceMembershipId: sourceMembership.id, sourceCourseCompleted: completed },
      },
      { system: 'fluentcommunity', entityType: 'historical_course_membership', sourceIds: [sourceMembership.id] },
      [memberOp.operationId, courseOp.operationId],
    ))
  }

  // Preserve lesson completion for active and blocked members. Account/enrollment state controls access, not progress history.
  let lessonProgress = 0
  for (const progress of normalization.lessonCompletedReactions) {
    const member = findCanonicalMemberForSourceId(normalization.identity.members, progress.userId)
    const lessonOp = progress.objectId ? lessonOperationBySourceId.get(progress.objectId) : undefined
    const memberOp = member ? subscriberMemberOperationByCanonicalId.get(member.canonicalWpUserId) : undefined
    if (!member || !memberOp || !lessonOp) {
      unresolved.push({
        code: 'unresolved_lesson_progress_relationship',
        sourceType: 'lesson_completed',
        sourceId: progress.id,
        detail: `user_id=${progress.userId ?? 'null'} lesson_id=${progress.objectId ?? 'null'}`,
      })
      continue
    }
    lessonProgress += 1
    operations.push(operation(
      'payload_lesson_progress',
      `fc_lesson_completed:${member.canonicalWpUserId}:${progress.objectId}`,
      {
        displayName: `${member.canonicalEmail} / lesson ${progress.objectId}`,
        member: ref(memberOp.operationId),
        lesson: ref(lessonOp.operationId),
        status: 'completed',
        completedAt: progress.createdAt,
        percentComplete: 100,
        metadata: {
          sourceReactionId: progress.id,
          sourceUserIds: member.sourceWpUserIds,
          legacyCourseSpaceId: progress.parentId,
        },
      },
      { system: 'fluentcommunity', entityType: 'lesson_completed', sourceIds: [progress.id] },
      [memberOp.operationId, lessonOp.operationId],
    ))
  }

  // Unified community access: every active paid migrated member receives every migrated community space.
  const sourceMembershipsByPersonSpace = new Map<string, CommunitySpaceMembershipSource[]>()
  for (const row of normalization.spaceMemberships) {
    const member = findCanonicalMemberForSourceId(normalization.identity.members, row.userId)
    if (!member || !row.spaceId) continue
    const key = `${member.canonicalWpUserId}:${row.spaceId}`
    const list = sourceMembershipsByPersonSpace.get(key) ?? []
    list.push(row)
    sourceMembershipsByPersonSpace.set(key, list)
  }

  let activeSpaceMemberships = 0
  let blockedHistoricalSpaceMemberships = 0
  const targetMembershipKeys = new Set<string>()
  for (const member of normalization.identity.members.filter((item) => item.accountStatus === 'active')) {
    const memberOp = subscriberMemberOperationByCanonicalId.get(member.canonicalWpUserId)!
    for (const [spaceSourceId, spaceOp] of spaceOperationBySourceId) {
      const key = `${member.canonicalWpUserId}:${spaceSourceId}`
      const sourceRows = sourceMembershipsByPersonSpace.get(key) ?? []
      targetMembershipKeys.add(key)
      activeSpaceMemberships += 1
      operations.push(operation(
        'payload_space_memberships',
        `fc_unified_membership:${key}`,
        {
          displayName: `${member.canonicalEmail} / ${spaceOp.idempotencyKey}`,
          member: ref(memberOp.operationId),
          space: ref(spaceOp.operationId),
          role: mapSourceRole(sourceRows),
          status: 'active',
          metadata: {
            sourceMembershipIds: sourceRows.map((row) => row.id),
            unifiedMembershipMigration: true,
            legacyTierGatingRemoved: true,
          },
        },
        { system: 'migration_policy', entityType: 'unified_space_access', sourceIds: member.sourceWpUserIds },
        [memberOp.operationId, spaceOp.operationId],
      ))
    }
  }

  for (const [key, sourceRows] of sourceMembershipsByPersonSpace) {
    if (targetMembershipKeys.has(key)) continue
    const [canonicalWpUserId, spaceSourceId] = key.split(':')
    const member = normalization.identity.members.find((item) => item.canonicalWpUserId === canonicalWpUserId)
    const memberOp = member ? subscriberMemberOperationByCanonicalId.get(member.canonicalWpUserId) : undefined
    const spaceOp = spaceOperationBySourceId.get(spaceSourceId)
    if (!member || member.accountStatus !== 'blocked' || !memberOp || !spaceOp) continue
    targetMembershipKeys.add(key)
    blockedHistoricalSpaceMemberships += 1
    operations.push(operation(
      'payload_space_memberships',
      `fc_historical_blocked_membership:${key}`,
      {
        displayName: `${member.canonicalEmail} / ${spaceOp.idempotencyKey}`,
        member: ref(memberOp.operationId),
        space: ref(spaceOp.operationId),
        role: mapSourceRole(sourceRows),
        status: 'blocked',
        metadata: { sourceMembershipIds: sourceRows.map((row) => row.id), sourceStatus: sourceRows.map((row) => row.status) },
      },
      { system: 'fluentcommunity', entityType: 'historical_space_membership', sourceIds: sourceRows.map((row) => row.id) },
      [memberOp.operationId, spaceOp.operationId],
    ))
  }

  const postOperationBySourceId = new Map<string, ProposedPayloadOperation>()
  for (const post of normalization.feedPosts) {
    const spaceOp = post.spaceId ? spaceOperationBySourceId.get(post.spaceId) : undefined
    const authorOp = post.userId ? memberOperationBySourceWpId.get(post.userId) : undefined
    const postRichText = await convertRichTextSource(
      post.messageRendered ?? post.message,
      `feed_post:${post.id}`,
      resolveImage,
    )
    const blockers = [
      ...(spaceOp ? [] : ['unresolved_post_space']),
      ...(authorOp ? [] : ['unresolved_post_author']),
      ...postRichText.blockers,
    ]
    if (!spaceOp) unresolved.push({ code: 'unresolved_post_space', sourceType: 'feed_post', sourceId: post.id, detail: `space_id=${post.spaceId ?? 'null'}` })
    if (!authorOp) unresolved.push({ code: 'unresolved_post_author', sourceType: 'feed_post', sourceId: post.id, detail: `user_id=${post.userId ?? 'null'}` })
    const postOp = operation(
      'payload_space_posts',
      `fc_post_id:${post.id}`,
      {
        title: deriveTitle(post, 'Legacy post'),
        space: spaceOp ? ref(spaceOp.operationId) : null,
        author: authorOp ? ref(authorOp.operationId) : null,
        postType: spaceOp && normalization.communitySpaces.some((space) => space.id === post.spaceId && isAnnouncementSpace(space)) ? 'announcement' : 'discussion',
        body: postRichText.lexical,
        moderationStatus: mapModerationStatus(post.status),
        pinned: post.isSticky,
        locked: false,
        metadata: {
          fcPostId: post.id,
          fcSourceWave: 'fluent-community',
          originalParentId: post.parentId,
          originalPrivacy: post.privacy,
          sourceCreatedAt: post.createdAt,
          reactions: reactionsForPost(normalization.communityReactions, post.id),
        },
      },
      {
        system: 'fluentcommunity',
        entityType: 'feed_post',
        sourceIds: [post.id],
        raw: {
          message: post.message,
          messageRendered: post.messageRendered,
          meta: post.meta,
          richTextConversion: postRichText.conversion
            ? {
                bunnyGuids: postRichText.conversion.bunnyGuids,
                resolvedImages: postRichText.conversion.resolvedImages,
                fallbackFragments: postRichText.conversion.fallbackFragments,
              }
            : null,
        },
      },
      [...(spaceOp ? [spaceOp.operationId] : []), ...(authorOp ? [authorOp.operationId] : [])],
      blockers,
    )
    operations.push(postOp)
    postOperationBySourceId.set(post.id, postOp)
  }

  let communityComments = 0
  let deferredLessonComments = 0
  let deferredOtherSourceComments = 0
  let communityReactions = 0
  let plannedLessonComments = 0
  const lessonCommentOperationBySourceId = new Map<string, ProposedPayloadOperation>()
  const commentOperationBySourceId = new Map<string, ProposedPayloadOperation>()

  for (const comment of normalization.comments) {
    const sourceParentPost = comment.postId ? sourcePostById.get(comment.postId) : undefined
    const postOp = comment.postId ? postOperationBySourceId.get(comment.postId) : undefined
    const authorOp = comment.userId ? memberOperationBySourceWpId.get(comment.userId) : undefined

    if (!postOp && sourceParentPost) {
      const isLessonComment = sourceParentPost.type === 'course_lesson'
      if (isLessonComment) {
        deferredLessonComments += 1
        const lessonOp = lessonOperationBySourceId.get(sourceParentPost.id)
        const lessonCommentRichText = await convertRichTextSource(
          comment.messageRendered ?? comment.message,
          `lesson_comment:${comment.id}`,
          resolveImage,
        )
        const canonicalAuthor = comment.userId ? canonicalMemberBySourceWpId.get(comment.userId) : undefined
        const sourceAuthor = comment.userId ? sourceUserById.get(comment.userId) : undefined
        const lessonCommentDisplayName = canonicalAuthor?.displayName
          || sourceAuthor?.displayName
          || sourceAuthor?.email
          || `Legacy member ${comment.userId ?? 'unknown'}`
        const blockers = [
          POST_MIGRATION29_FORWARD_BLOCKERS.lessonComments,
          ...(lessonOp ? [] : ['unresolved_comment_lesson']),
          ...(authorOp ? [] : ['unresolved_comment_author']),
          ...lessonCommentRichText.blockers,
        ]
        if (!lessonOp) unresolved.push({ code: 'unresolved_comment_lesson', sourceType: 'comment', sourceId: comment.id, detail: `lesson_post_id=${sourceParentPost.id}` })
        if (!authorOp) unresolved.push({ code: 'unresolved_comment_author', sourceType: 'comment', sourceId: comment.id, detail: `user_id=${comment.userId ?? 'null'}` })
        unresolved.push({
          code: POST_MIGRATION29_FORWARD_BLOCKERS.lessonComments,
          sourceType: 'comment',
          sourceId: comment.id,
          detail: `lesson_post_id=${sourceParentPost.id} target=payload_lesson_comments`,
        })
        const lessonCommentOp = operation(
          'payload_lesson_comments',
          `fc_lesson_comment_id:${comment.id}`,
          {
            displayName: lessonCommentDisplayName,
            lesson: lessonOp ? ref(lessonOp.operationId) : null,
            author: authorOp ? ref(authorOp.operationId) : null,
            body: lessonCommentRichText.lexical,
            legacyBodyHtml: comment.messageRendered ?? comment.message ?? '',
            moderationStatus: mapModerationStatus(comment.status),
            legacyCommentId: comment.id,
            sourceCreatedAt: comment.createdAt,
            metadata: {
              fcCommentId: comment.id,
              fcSourceWave: 'fluent-community',
              originalParentCommentId: comment.parentId,
              sourcePostId: sourceParentPost.id,
            },
          },
          {
            system: 'fluentcommunity',
            entityType: 'lesson_comment',
            sourceIds: [comment.id, sourceParentPost.id],
            raw: {
              message: comment.message,
              messageRendered: comment.messageRendered,
              meta: comment.meta,
              richTextConversion: lessonCommentRichText.conversion
                ? {
                    bunnyGuids: lessonCommentRichText.conversion.bunnyGuids,
                    resolvedImages: lessonCommentRichText.conversion.resolvedImages,
                    fallbackFragments: lessonCommentRichText.conversion.fallbackFragments,
                  }
                : null,
            },
          },
          [...(lessonOp ? [lessonOp.operationId] : []), ...(authorOp ? [authorOp.operationId] : [])],
          blockers,
        )
        operations.push(lessonCommentOp)
        lessonCommentOperationBySourceId.set(comment.id, lessonCommentOp)
        plannedLessonComments += 1
      } else {
        deferredOtherSourceComments += 1
        unresolved.push({
          code: 'comment_parent_target_model_required',
          sourceType: 'comment',
          sourceId: comment.id,
          detail: `post_id=${comment.postId ?? 'null'} source_post_type=${sourceParentPost.type}`,
        })
        if (!authorOp) unresolved.push({ code: 'unresolved_comment_author', sourceType: 'comment', sourceId: comment.id, detail: `user_id=${comment.userId ?? 'null'}` })
      }
      continue
    }

    const communityCommentRichText = await convertRichTextSource(
      comment.messageRendered ?? comment.message,
      `community_comment:${comment.id}`,
      resolveImage,
    )
    const blockers = [
      ...(postOp ? [] : ['unresolved_comment_post']),
      ...(authorOp ? [] : ['unresolved_comment_author']),
      ...communityCommentRichText.blockers,
    ]
    if (!postOp) unresolved.push({ code: 'unresolved_comment_post', sourceType: 'comment', sourceId: comment.id, detail: `post_id=${comment.postId ?? 'null'}` })
    if (!authorOp) unresolved.push({ code: 'unresolved_comment_author', sourceType: 'comment', sourceId: comment.id, detail: `user_id=${comment.userId ?? 'null'}` })
    if (postOp) communityComments += 1
    const spaceCommentOp = operation(
      'payload_space_comments',
      `fc_comment_id:${comment.id}`,
      {
        displayName: deriveTitle({ ...comment, title: null, slug: null, spaceId: null, privacy: '', featuredImage: null, priority: 0 } as CommunityPostSource, 'Legacy comment'),
        post: postOp ? ref(postOp.operationId) : null,
        author: authorOp ? ref(authorOp.operationId) : null,
        body: communityCommentRichText.lexical,
        moderationStatus: mapModerationStatus(comment.status),
        metadata: {
          fcCommentId: comment.id,
          fcSourceWave: 'fluent-community',
          originalParentCommentId: comment.parentId,
          sourceCreatedAt: comment.createdAt,
          reactions: reactionsForComment(normalization.communityReactions, comment.id),
        },
      },
      {
        system: 'fluentcommunity',
        entityType: 'comment',
        sourceIds: [comment.id],
        raw: {
          message: comment.message,
          messageRendered: comment.messageRendered,
          meta: comment.meta,
          richTextConversion: communityCommentRichText.conversion
            ? {
                bunnyGuids: communityCommentRichText.conversion.bunnyGuids,
                resolvedImages: communityCommentRichText.conversion.resolvedImages,
                fallbackFragments: communityCommentRichText.conversion.fallbackFragments,
              }
            : null,
        },
      },
      [...(postOp ? [postOp.operationId] : []), ...(authorOp ? [authorOp.operationId] : [])],
      blockers,
    )
    operations.push(spaceCommentOp)
    commentOperationBySourceId.set(comment.id, spaceCommentOp)
  }

  for (const comment of normalization.comments) {
    if (!comment.parentId) continue
    const lessonCommentOp = lessonCommentOperationBySourceId.get(comment.id)
    if (!lessonCommentOp) continue
    const parentOp = lessonCommentOperationBySourceId.get(comment.parentId)
    if (parentOp) {
      lessonCommentOp.data.parent = ref(parentOp.operationId)
      if (!lessonCommentOp.dependsOn.includes(parentOp.operationId)) lessonCommentOp.dependsOn.push(parentOp.operationId)
    } else {
      lessonCommentOp.blockers.push('lesson_comment_parent_resolution_required')
      unresolved.push({
        code: 'lesson_comment_parent_resolution_required',
        sourceType: 'comment',
        sourceId: comment.id,
        detail: `parent_comment_id=${comment.parentId}`,
      })
    }
  }

  // Community reactions: one payload_space_reactions operation per community reaction.
  // lesson_completed rows are NOT community reactions (they are in lessonCompletedReactions / payload_lesson_progress).
  for (const reaction of normalization.communityReactions) {
    const isSurveyVote = reaction.objectType === 'opt_1' || reaction.objectType === 'opt_2'
    const targetKind = isSurveyVote ? 'survey_option' : reaction.objectType === 'comment' ? 'comment' : 'post'
    const actorOp = reaction.userId ? memberOperationBySourceWpId.get(reaction.userId) : undefined

    let targetOp: ProposedPayloadOperation | undefined
    let surveyOptionKey: string | undefined

    if (targetKind === 'post' || targetKind === 'survey_option') {
      targetOp = reaction.objectId ? postOperationBySourceId.get(reaction.objectId) : undefined
      if (isSurveyVote) surveyOptionKey = reaction.objectType
    } else {
      targetOp = reaction.objectId ? commentOperationBySourceId.get(reaction.objectId) : undefined
    }

    const reactionBlockers: string[] = [POST_MIGRATION29_FORWARD_BLOCKERS.spaceReactions]
    const reactionDependsOn: string[] = []
    if (actorOp) reactionDependsOn.push(actorOp.operationId)
    if (targetOp) reactionDependsOn.push(targetOp.operationId)
    if (!targetOp) {
      const code = targetKind === 'comment' ? 'unresolved_reaction_target_comment' : 'unresolved_reaction_target_post'
      reactionBlockers.push(code)
      unresolved.push({
        code,
        sourceType: 'community_reaction',
        sourceId: reaction.id,
        detail: `object_type=${reaction.objectType} object_id=${reaction.objectId ?? 'null'} parent_id=${reaction.parentId ?? 'null'}`,
      })
    }

    const reactionOp = operation(
      'payload_space_reactions',
      `fc_reaction:${reaction.id}`,
      {
        actorMember: actorOp ? ref(actorOp.operationId) : null,
        reactionType: isSurveyVote ? 'survey_vote' : reaction.type,
        targetKind,
        targetPost: (targetKind === 'post' || targetKind === 'survey_option') && targetOp ? ref(targetOp.operationId) : null,
        targetComment: targetKind === 'comment' && targetOp ? ref(targetOp.operationId) : null,
        ...(surveyOptionKey ? { surveyOptionKey } : {}),
        legacyReactionId: reaction.id,
        legacyActorUserId: reaction.userId ?? undefined,
        legacyActorSourceSystem: 'fluentcommunity',
        sourceCreatedAt: reaction.createdAt,
        metadata: {
          fcReactionId: reaction.id,
          fcObjectType: reaction.objectType,
          fcObjectId: reaction.objectId,
          fcParentId: reaction.parentId,
        },
      },
      {
        system: 'fluentcommunity',
        entityType: 'community_reaction',
        sourceIds: [reaction.id, ...(reaction.userId ? [reaction.userId] : [])],
        raw: {
          objectType: reaction.objectType,
          reactionType: reaction.type,
          userId: reaction.userId,
          objectId: reaction.objectId,
          parentId: reaction.parentId,
          isSurveyVote,
        },
      },
      reactionDependsOn,
      reactionBlockers,
    )
    operations.push(reactionOp)
    communityReactions += 1
  }

  let communityFileReferences = 0
  let lessonResourceReferences = 0
  let protectedLessonResourceMedia = 0
  let spaceDocumentReferences = 0
  let memberAvatarMediaReferences = 0
  let memberCoverMediaReferences = 0
  let portalSettingsMediaReferences = 0
  const portalSettingsMediaOperationByField = new Map<string, ProposedPayloadOperation>()
  let courseCoverMediaReferences = 0
  let spaceMediaSchemaReferences = 0
  let platformArchiveMediaReferences = 0
  let unresolvedMediaRecords = 0
  let platformMediaAssetsAwaitingTargetDecision = 0

  // Reference-only media routing. Never force a course/profile/space asset into a community file record.
  for (const media of normalization.communityMedia) {
    const objectSource = media.objectSource.trim().toLowerCase()

    if (objectSource === 'user_avatar') {
      const profileOp = media.userId ? profileOperationBySourceWpId.get(media.userId) : undefined
      const title = media.mediaPath?.split('/').pop() || `Legacy member avatar ${media.id}`
      const avatarMediaOp = operation(
        'payload_media',
        `fc_member_avatar_media:${media.id}`,
        { alt: title },
        {
          system: 'fluentcommunity',
          entityType: 'member_avatar_media_import',
          sourceIds: [media.id, ...(media.userId ? [media.userId] : [])],
          raw: {
            fcSourceUrl: media.mediaUrl,
            fcSourcePath: media.mediaPath,
            fcDriver: media.driver,
            objectSource: media.objectSource,
            mediaKey: media.mediaKey,
            mediaType: media.mediaType,
            binaryImportRequired: true,
          },
        },
        [],
        ['member_avatar_media_import_required'],
      )
      operations.push(avatarMediaOp)
      memberAvatarMediaReferences += 1

      if (profileOp) {
        profileOp.data.avatar = ref(avatarMediaOp.operationId)
        if (!profileOp.dependsOn.includes(avatarMediaOp.operationId)) profileOp.dependsOn.push(avatarMediaOp.operationId)
      } else {
        unresolved.push({
          code: 'unresolved_member_avatar_profile',
          sourceType: 'community_media',
          sourceId: media.id,
          detail: `user_id=${media.userId ?? 'null'}`,
        })
      }
      continue
    }

    if (objectSource === 'user_cover_photo') {
      const profileOp = media.userId ? profileOperationBySourceWpId.get(media.userId) : undefined
      const title = media.mediaPath?.split('/').pop() || `Legacy member cover photo ${media.id}`
      const coverMediaOp = operation(
        'payload_media',
        `fc_member_cover_media:${media.id}`,
        { alt: title },
        {
          system: 'fluentcommunity',
          entityType: 'member_cover_media_import',
          sourceIds: [media.id, ...(media.userId ? [media.userId] : [])],
          raw: {
            fcSourceUrl: media.mediaUrl,
            fcSourcePath: media.mediaPath,
            fcDriver: media.driver,
            objectSource: media.objectSource,
            mediaKey: media.mediaKey,
            mediaType: media.mediaType,
            binaryImportRequired: true,
          },
        },
        [],
        ['member_cover_media_import_required'],
      )
      operations.push(coverMediaOp)
      memberCoverMediaReferences += 1

      if (profileOp) {
        profileOp.data.coverImage = ref(coverMediaOp.operationId)
        if (!profileOp.dependsOn.includes(coverMediaOp.operationId)) profileOp.dependsOn.push(coverMediaOp.operationId)
      } else {
        unresolved.push({
          code: 'unresolved_member_cover_profile',
          sourceType: 'community_media',
          sourceId: media.id,
          detail: `user_id=${media.userId ?? 'null'}`,
        })
      }
      continue
    }

    if (objectSource === LEGACY_SPACE_MEDIA_TARGETS.courseCoverPhoto.sourceKind) {
      const sourceSpaceId = media.subObjectId
      const courseOp = sourceSpaceId ? courseOperationBySourceId.get(sourceSpaceId) : undefined
      if (courseOp) {
        const title = media.mediaPath?.split('/').pop() || `Legacy course cover ${media.id}`
        const courseCoverMediaOp = operation(
          'payload_media',
          `fc_course_coverImage_media:${media.id}`,
          { alt: title },
          {
            system: 'fluentcommunity',
            entityType: 'course_cover_media_import',
            sourceIds: [media.id, sourceSpaceId!],
            raw: {
              fcSourceUrl: media.mediaUrl,
              fcSourcePath: media.mediaPath,
              fcDriver: media.driver,
              objectSource: media.objectSource,
              mediaKey: media.mediaKey,
              mediaType: media.mediaType,
              binaryImportRequired: true,
              targetCollection: LEGACY_SPACE_MEDIA_TARGETS.courseCoverPhoto.targetCollection,
              targetField: LEGACY_SPACE_MEDIA_TARGETS.courseCoverPhoto.targetField,
              sourceSpaceId,
              sourceSpaceType: LEGACY_SPACE_MEDIA_TARGETS.courseCoverPhoto.sourceSpaceType,
              sourceRelationship: 'wp_fcom_media_archive.sub_object_id -> wp_fcom_spaces.id',
              sourceProven: true,
              schemaRegistrationRequired: false,
            },
          },
          [],
          ['space_media_import_required'],
        )
        operations.push(courseCoverMediaOp)
        courseOp.data.coverImage = ref(courseCoverMediaOp.operationId)
        if (!courseOp.dependsOn.includes(courseCoverMediaOp.operationId)) courseOp.dependsOn.push(courseCoverMediaOp.operationId)
        courseCoverMediaReferences += 1
        continue
      }
    }

    if (objectSource === LEGACY_SPACE_MEDIA_TARGETS.communityOgImage.sourceKind) {
      const sourceSpaceId = media.subObjectId
      const spaceOp = sourceSpaceId ? spaceOperationBySourceId.get(sourceSpaceId) : undefined
      const title = media.mediaPath?.split('/').pop() || `Legacy community OG image ${media.id}`
      const blocker = spaceOp
        ? POST_MIGRATION29_FORWARD_BLOCKERS.spaceMedia
        : POST_MIGRATION29_FORWARD_BLOCKERS.spaceMediaTargetSpace
      const spaceOgMediaOp = operation(
        'payload_media',
        `fc_space_ogImage_media:${media.id}`,
        { alt: title },
        {
          system: 'fluentcommunity',
          entityType: 'space_og_media_import',
          sourceIds: [media.id, ...(sourceSpaceId ? [sourceSpaceId] : [])],
          raw: {
            fcSourceUrl: media.mediaUrl,
            fcSourcePath: media.mediaPath,
            fcDriver: media.driver,
            objectSource: media.objectSource,
            mediaKey: media.mediaKey,
            mediaType: media.mediaType,
            binaryImportRequired: true,
            targetCollection: LEGACY_SPACE_MEDIA_TARGETS.communityOgImage.targetCollection,
            targetField: LEGACY_SPACE_MEDIA_TARGETS.communityOgImage.targetField,
            sourceSpaceId,
            sourceSpaceType: LEGACY_SPACE_MEDIA_TARGETS.communityOgImage.sourceSpaceType,
            sourceRelationship: 'wp_fcom_media_archive.sub_object_id -> wp_fcom_spaces.id',
            sourceProven: true,
            schemaRegistrationRequired: true,
          },
        },
        [],
        [blocker, 'space_media_import_required'],
      )
      operations.push(spaceOgMediaOp)

      if (spaceOp) {
        spaceOp.data.ogImage = ref(spaceOgMediaOp.operationId)
        if (!spaceOp.dependsOn.includes(spaceOgMediaOp.operationId)) spaceOp.dependsOn.push(spaceOgMediaOp.operationId)
        if (!spaceOp.blockers.includes(POST_MIGRATION29_FORWARD_BLOCKERS.spaceMedia)) {
          spaceOp.blockers.push(POST_MIGRATION29_FORWARD_BLOCKERS.spaceMedia)
        }
        spaceMediaSchemaReferences += 1
      }

      unresolved.push({
        code: blocker,
        sourceType: 'community_media',
        sourceId: media.id,
        detail: spaceOp
          ? `source_space_id=${sourceSpaceId} target_field=ogImage`
          : `source_space_id=${sourceSpaceId ?? 'null'} target_field=ogImage target community space was not selected for migration`,
      })
      continue
    }

    if (/^(onboarding|general)$/.test(objectSource)) {
      const title = media.mediaPath?.split('/').pop() || `Legacy platform ${objectSource} asset ${media.id}`
      const portalTarget = JPV_PORTAL_MEDIA_TARGETS_BY_KEY[media.mediaKey]
      if (portalTarget) {
        const portalMediaOp = operation(
          'payload_media',
          `fc_portal_settings_media:${media.id}`,
          { alt: title },
          {
            system: 'fluentcommunity',
            entityType: 'portal_settings_media_import',
            sourceIds: [media.id],
            raw: {
              fcSourceUrl: media.mediaUrl,
              fcSourcePath: media.mediaPath,
              fcDriver: media.driver,
              objectSource: media.objectSource,
              mediaKey: media.mediaKey,
              mediaType: media.mediaType,
              binaryImportRequired: true,
              targetGlobal: 'portalSettings',
              targetFields: portalTarget.targetFields,
              sourceReferencePaths: portalTarget.sourceReferencePaths,
              sourceProven: true,
            },
          },
          [],
          ['portal_settings_media_import_required'],
        )
        operations.push(portalMediaOp)
        for (const targetField of portalTarget.targetFields) portalSettingsMediaOperationByField.set(targetField, portalMediaOp)
        portalSettingsMediaReferences += 1
        continue
      }

      operations.push(operation(
        'payload_media',
        `fc_platform_unresolved_media:${media.id}`,
        { alt: title },
        {
          system: 'fluentcommunity',
          entityType: 'platform_media_unresolved',
          sourceIds: [media.id],
          raw: {
            fcSourceUrl: media.mediaUrl,
            fcSourcePath: media.mediaPath,
            fcDriver: media.driver,
            objectSource: media.objectSource,
            mediaKey: media.mediaKey,
            mediaType: media.mediaType,
            binaryImportRequired: true,
          },
        },
        [],
        ['media_asset_requires_target_decision'],
      ))
      platformMediaAssetsAwaitingTargetDecision += 1
      unresolved.push({
        code: 'media_asset_requires_target_decision',
        sourceType: 'community_media',
        sourceId: media.id,
        detail: `object_source=${media.objectSource} media_key=${media.mediaKey}`,
      })
      continue
    }

    const candidateIds = [...new Set([media.feedId, media.subObjectId].filter((value): value is string => Boolean(value)))]
    const lessonMatches = normalization.courseLessons.filter((lesson) => candidateIds.includes(lesson.id))
    const postMatches = normalization.feedPosts.filter((post) => candidateIds.includes(post.id))
    const commentMatches = normalization.comments.filter((comment) => candidateIds.includes(comment.id))

    const lessonHint = /lesson|course/.test(objectSource)
    const commentHint = /comment|reply/.test(objectSource)
    const spaceDocumentHint = objectSource === 'space_document'
    const postHint = /feed|post/.test(objectSource)
    const profileOrSpaceAssetHint = /avatar|profile|cover|logo/.test(objectSource) || (objectSource.includes('space') && !spaceDocumentHint)
    const platformMediaAssetHint = /^(onboarding|general)$/.test(objectSource)

    const inferredKinds = [
      ...(lessonMatches.length === 1 ? ['lesson'] : []),
      ...(postMatches.length === 1 ? ['post'] : []),
      ...(commentMatches.length === 1 ? ['comment'] : []),
    ]

    const routeKind: 'lesson' | 'post' | 'comment' | 'unresolved' =
      lessonHint && lessonMatches.length === 1
        ? 'lesson'
        : commentHint && commentMatches.length === 1
          ? 'comment'
          : spaceDocumentHint && postMatches.length === 1
            ? 'post'
            : postHint && postMatches.length === 1
              ? 'post'
              : !profileOrSpaceAssetHint && !platformMediaAssetHint && inferredKinds.length === 1
                ? inferredKinds[0] as 'lesson' | 'post' | 'comment'
                : 'unresolved'

    if (routeKind === 'lesson') {
      const lesson = lessonMatches[0]
      const lessonOp = lessonOperationBySourceId.get(lesson.id)
      const title = media.mediaPath?.split('/').pop() || `Legacy lesson resource ${media.id}`
      if (!lessonOp) unresolved.push({
        code: 'unresolved_media_lesson',
        sourceType: 'community_media',
        sourceId: media.id,
        detail: `lesson_id=${lesson.id}`,
      })

      const privateMediaOp = operation(
        'payload_private_media',
        `fc_lesson_resource_private_media:${media.id}`,
        {
          alt: title,
        },
        {
          system: 'fluentcommunity',
          entityType: 'lesson_private_media_import',
          sourceIds: [media.id, lesson.id],
          raw: {
            fcSourceUrl: media.mediaUrl,
            fcSourcePath: media.mediaPath,
            fcDriver: media.driver,
            objectSource: media.objectSource,
            mediaKey: media.mediaKey,
            mediaType: media.mediaType,
            binaryImportRequired: true,
          },
        },
        [],
        ['lesson_resource_private_media_import_required'],
      )
      operations.push(privateMediaOp)
      protectedLessonResourceMedia += 1

      lessonResourceReferences += 1
      operations.push(operation(
        'payload_lesson_resources',
        `fc_lesson_resource_ref:${media.id}`,
        {
          title,
          lesson: lessonOp ? ref(lessonOp.operationId) : null,
          protectedFile: ref(privateMediaOp.operationId),
          status: 'draft',
          downloadRequiresAccess: true,
          sortOrder: 0,
          description: 'Legacy paid lesson resource. Import the source binary into protected course media before publishing.',
        },
        {
          system: 'fluentcommunity',
          entityType: 'lesson_media_reference',
          sourceIds: [media.id, lesson.id],
          raw: {
            fcSourceUrl: media.mediaUrl,
            fcSourcePath: media.mediaPath,
            fcDriver: media.driver,
            objectSource: media.objectSource,
            mediaKey: media.mediaKey,
            mediaType: media.mediaType,
            targetStorage: 'payload_private_media',
            referenceOnly: true,
          },
        },
        [...(lessonOp ? [lessonOp.operationId] : []), privateMediaOp.operationId],
        lessonOp ? [] : ['unresolved_media_lesson'],
      ))
      continue
    }

    let relatedPost = routeKind === 'post' ? postMatches[0] : undefined
    let sourceCommentId: string | null = null
    if (routeKind === 'comment') {
      const comment = commentMatches[0]
      sourceCommentId = comment.id
      relatedPost = comment.postId ? normalization.feedPosts.find((post) => post.id === comment.postId) : undefined
    }

    if ((routeKind === 'post' || routeKind === 'comment') && relatedPost) {
      const spaceOp = relatedPost.spaceId ? spaceOperationBySourceId.get(relatedPost.spaceId) : undefined
      const authorOp = media.userId ? memberOperationBySourceWpId.get(media.userId) : undefined
      const postOp = postOperationBySourceId.get(relatedPost.id)
      const blockers = [
        ...(spaceOp ? [] : ['unresolved_media_space']),
        ...(authorOp ? [] : ['unresolved_media_uploader']),
        ...(postOp ? [] : ['unresolved_media_post']),
      ]
      if (!spaceOp) unresolved.push({ code: 'unresolved_media_space', sourceType: 'community_media', sourceId: media.id, detail: `post_id=${relatedPost.id} space_id=${relatedPost.spaceId ?? 'null'}` })
      if (!authorOp) unresolved.push({ code: 'unresolved_media_uploader', sourceType: 'community_media', sourceId: media.id, detail: `user_id=${media.userId ?? 'null'}` })
      if (!postOp) unresolved.push({ code: 'unresolved_media_post', sourceType: 'community_media', sourceId: media.id, detail: `post_id=${relatedPost.id}` })
      communityFileReferences += 1
      if (spaceDocumentHint) spaceDocumentReferences += 1
      operations.push(operation(
        'payload_space_files',
        `fc_attachment_id:${media.id}`,
        {
          title: media.mediaPath?.split('/').pop() || `Legacy media ${media.id}`,
          space: spaceOp ? ref(spaceOp.operationId) : null,
          uploadedBy: authorOp ? ref(authorOp.operationId) : null,
          post: postOp ? ref(postOp.operationId) : undefined,
          attachmentType: media.mediaType?.startsWith('image/') ? 'image' : 'document',
          moderationStatus: 'visible',
          metadata: {
            fcAttachmentId: media.id,
            fcSourceWave: 'fluent-community',
            fcSourceUrl: media.mediaUrl,
            fcSourcePath: media.mediaPath,
            fcDriver: media.driver,
            objectSource: media.objectSource,
            mediaKey: media.mediaKey,
            sourceCommentId,
            referenceOnly: true,
          },
        },
        { system: 'fluentcommunity', entityType: sourceCommentId ? 'comment_media_reference' : 'post_media_reference', sourceIds: [media.id] },
        [...(spaceOp ? [spaceOp.operationId] : []), ...(authorOp ? [authorOp.operationId] : []), ...(postOp ? [postOp.operationId] : [])],
        blockers,
      ))
      continue
    }

    unresolvedMediaRecords += 1
    if (platformMediaAssetHint) platformMediaAssetsAwaitingTargetDecision += 1
    unresolved.push({
      code: platformMediaAssetHint
        ? 'platform_media_asset_requires_target_decision'
        : profileOrSpaceAssetHint
          ? 'media_asset_requires_target_decision'
          : 'unresolved_media_context',
      sourceType: 'community_media',
      sourceId: media.id,
      detail: `object_source=${media.objectSource} feed_id=${media.feedId ?? 'null'} sub_object_id=${media.subObjectId ?? 'null'} media_type=${media.mediaType ?? 'null'}`,
    })
  }

  const portalSource = snapshot.portalSettingsSource ?? {
    fluentCommunitySettingsRaw: null,
    authSettingsRaw: null,
    customizationSettingsRaw: null,
    welcomeBannerSettingsRaw: null,
    snippetsSettingsRaw: null,
  }
  const fluentCommunitySettings = asSettingRecord(parsePhpSerializedRecord(portalSource.fluentCommunitySettingsRaw))
  const authSettings = asSettingRecord(parsePhpSerializedRecord(portalSource.authSettingsRaw))
  const customizationSettings = asSettingRecord(parsePhpSerializedRecord(portalSource.customizationSettingsRaw))
  const welcomeBannerSettings = asSettingRecord(parsePhpSerializedRecord(portalSource.welcomeBannerSettingsRaw))
  const snippetsSettings = asSettingRecord(parsePhpSerializedRecord(portalSource.snippetsSettingsRaw))
  const customCss = settingText(snippetsSettings, 'custom_css')
  const customJs = settingText(snippetsSettings, 'custom_js')

  const portalLogoOp = portalSettingsMediaOperationByField.get('logo')
  const portalWhiteLogoOp = portalSettingsMediaOperationByField.get('whiteLogo')
  const portalFeaturedImageOp = portalSettingsMediaOperationByField.get('featuredImage')
  const portalLoginLogoOp = portalSettingsMediaOperationByField.get('loginBanner.logo')
  const portalSettingsDependencies = [
    portalLogoOp?.operationId,
    portalWhiteLogoOp?.operationId,
    portalFeaturedImageOp?.operationId,
    portalLoginLogoOp?.operationId,
  ].filter((value): value is string => Boolean(value))

  const portalSettingsBlockers = [
    ...(customCss || customJs ? ['portal_legacy_code_execution_review_required'] : []),
  ]
  if (customCss || customJs) {
    unresolved.push({
      code: 'portal_legacy_code_execution_review_required',
      sourceType: 'portal_settings',
      sourceId: 'snippets_settings',
      detail: 'Legacy custom CSS/JS is non-empty and must never be auto-executed.',
    })
  }

  operations.push(globalOperation(
    'portalSettings',
    'fluentcommunity_portal_settings',
    {
      siteTitle: settingText(fluentCommunitySettings, 'site_title'),
      logo: portalLogoOp ? ref(portalLogoOp.operationId) : undefined,
      whiteLogo: portalWhiteLogoOp ? ref(portalWhiteLogoOp.operationId) : undefined,
      featuredImage: portalFeaturedImageOp ? ref(portalFeaturedImageOp.operationId) : undefined,
      loginBanner: {
        title: settingText(authSettings, 'login.banner.title'),
        description: settingText(authSettings, 'login.banner.description'),
        logo: portalLoginLogoOp ? ref(portalLoginLogoOp.operationId) : undefined,
        backgroundColor: settingText(authSettings, 'login.banner.background_color'),
        titleColor: settingText(authSettings, 'login.banner.title_color'),
        textColor: settingText(authSettings, 'login.banner.text_color'),
      },
      loginForm: {
        title: settingText(authSettings, 'login.form.title'),
        description: settingText(authSettings, 'login.form.description'),
        backgroundColor: settingText(authSettings, 'login.form.background_color'),
        titleColor: settingText(authSettings, 'login.form.title_color'),
        textColor: settingText(authSettings, 'login.form.text_color'),
        buttonColor: settingText(authSettings, 'login.form.button_color'),
        buttonLabel: settingText(authSettings, 'login.form.button_label'),
        buttonLabelColor: settingText(authSettings, 'login.form.button_label_color'),
      },
      legacySettings: {
        sourceSystem: 'fluentcommunity',
        fluentCommunitySettings,
        authSettings,
        customizationSettings,
        welcomeBannerSettings,
        snippetsSettings,
        rawSerialized: {
          fluentCommunitySettings: portalSource.fluentCommunitySettingsRaw,
          authSettings: portalSource.authSettingsRaw,
          customizationSettings: portalSource.customizationSettingsRaw,
          welcomeBannerSettings: portalSource.welcomeBannerSettingsRaw,
          snippetsSettings: portalSource.snippetsSettingsRaw,
        },
        activeTargetMapping: {
          sourceProvenLoginBranding: true,
          sourceProvenPortalMedia: true,
          customizationPreservedWithoutLegacyLayoutExecution: true,
          welcomeBannerPreservedWithoutInventedTargetRuntime: true,
          customCssEmpty: !customCss,
          customJsEmpty: !customJs,
        },
      },
    },
    {
      system: 'fluentcommunity',
      entityType: 'portal_settings_global',
      sourceIds: [
        'wp_options:fluent_community_settings',
        'wp_fcom_meta:option:auth_settings',
        'wp_fcom_meta:option:customization_settings',
        'wp_fcom_meta:option:welcome_banner_settings',
        'wp_fcom_meta:option:snippets_settings',
      ],
      raw: {
        activeSourcePaths: [
          'fluent_community_settings.site_title',
          'fluent_community_settings.logo',
          'fluent_community_settings.white_logo',
          'fluent_community_settings.featured_image',
          'auth_settings.login.banner',
          'auth_settings.login.form',
        ],
        preservedOnlySourcePaths: [
          'auth_settings.signup',
          'customization_settings',
          'welcome_banner_settings',
          'snippets_settings',
        ],
      },
    },
    portalSettingsDependencies,
    portalSettingsBlockers,
  ))

  const collectDataRefs = (value: unknown, refs: Set<string>): void => {
    if (typeof value === 'string' && value.startsWith('$ref:')) {
      refs.add(value.slice('$ref:'.length))
      return
    }
    if (Array.isArray(value)) {
      for (const item of value) collectDataRefs(item, refs)
      return
    }
    if (value && typeof value === 'object') {
      for (const nested of Object.values(value as Record<string, unknown>)) collectDataRefs(nested, refs)
    }
  }

  for (const operation of operations) {
    const refs = new Set<string>()
    collectDataRefs(operation.data, refs)
    operation.dependsOn = [...new Set([...operation.dependsOn, ...refs])]
  }

  const resolvedSchemaBlockers = new Set<string>()
  if (targetCapabilities.bunnyGuidFirst) resolvedSchemaBlockers.add(POST_MIGRATION29_FORWARD_BLOCKERS.bunnyGuidFirst)
  if (targetCapabilities.lessonComments) resolvedSchemaBlockers.add(POST_MIGRATION29_FORWARD_BLOCKERS.lessonComments)
  if (targetCapabilities.spaceOgImage) resolvedSchemaBlockers.add(POST_MIGRATION29_FORWARD_BLOCKERS.spaceMedia)
  if (targetCapabilities.spaceReactions) resolvedSchemaBlockers.add(POST_MIGRATION29_FORWARD_BLOCKERS.spaceReactions)

  for (const operation of operations) {
    operation.blockers = operation.blockers.filter((blocker) => !resolvedSchemaBlockers.has(blocker))
    if (
      targetCapabilities.spaceOgImage &&
      operation.source.raw &&
      operation.source.raw.schemaRegistrationRequired === true &&
      operation.source.raw.targetCollection === LEGACY_SPACE_MEDIA_TARGETS.communityOgImage.targetCollection &&
      operation.source.raw.targetField === LEGACY_SPACE_MEDIA_TARGETS.communityOgImage.targetField
    ) {
      operation.source.raw.schemaRegistrationRequired = false
    }
  }

  const resolvedUnresolvedCodes = new Set<string>()
  if (targetCapabilities.bunnyGuidFirst) resolvedUnresolvedCodes.add(POST_MIGRATION29_FORWARD_BLOCKERS.bunnyGuidFirst)
  if (targetCapabilities.lessonComments) resolvedUnresolvedCodes.add(POST_MIGRATION29_FORWARD_BLOCKERS.lessonComments)
  if (targetCapabilities.spaceOgImage) resolvedUnresolvedCodes.add(POST_MIGRATION29_FORWARD_BLOCKERS.spaceMedia)
  const unresolvedAfterTargetCapabilities = unresolved.filter((item) => !resolvedUnresolvedCodes.has(item.code))

  const byCollection: Record<string, number> = {}
  for (const item of operations) byCollection[item.collection] = (byCollection[item.collection] ?? 0) + 1
  const blockedOperations = operations.filter((item) => item.blockers.length > 0).length

  return {
    planVersion: '1.0',
    executionAuthorized: false,
    executable: false,
    snapshot: {
      sourceMemberAccounts: normalization.identity.sourceMemberAccountCount,
      canonicalSubscriberMembers: normalization.identity.canonicalMemberCount,
      activeSubscriberMembers: normalization.identity.activeCount,
      blockedSubscriberMembers: normalization.identity.blockedCount,
      staffAuthorMirrors: staffUsers.length,
    },
    operations,
    unresolved: unresolvedAfterTargetCapabilities,
    summary: {
      operations: operations.length,
      blockedOperations,
      byCollection,
      activeCourseEnrollments,
      blockedHistoricalCourseEnrollments,
      activeSpaceMemberships,
      blockedHistoricalSpaceMemberships,
      lessonProgress,
      communityComments,
      deferredLessonComments,
      deferredOtherSourceComments,
      communityReactions,
      plannedLessonComments,
      communityFileReferences,
      lessonResourceReferences,
      protectedLessonResourceMedia,
      spaceDocumentReferences,
      memberAvatarMediaReferences,
      memberCoverMediaReferences,
      portalSettingsMediaReferences,
      courseCoverMediaReferences,
      spaceMediaSchemaReferences,
      platformArchiveMediaReferences,
      unresolvedMediaRecords,
      platformMediaAssetsAwaitingTargetDecision,
    },
  }
}
