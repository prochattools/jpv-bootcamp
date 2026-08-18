#!/usr/bin/env node

import { readFileSync } from 'node:fs'

import {
  buildLegacyDryRunNormalization,
  buildLegacySqlSnapshot,
  parsePhpSerializedRecord,
  type LegacyDryRunNormalization,
  type LegacySqlSnapshot,
  type StripeEvidenceFile,
} from './legacySourceDryRun'

export type EvidenceClassification = 'source_proven' | 'source_not_proven' | 'ambiguous'

type Structured = Record<string, unknown>

export interface RemainingParityAudit {
  mutationMode: 'none'
  containsPii: false
  reactions: {
    classification: EvidenceClassification
    totalReactionProgressRows: number
    communityReactionRows: number
    lessonCompletionProgressRows: number
    countsByObjectType: Record<string, number>
    countsByReactionType: Record<string, number>
    feedPostReactionRows: number
    commentReactionRows: number
    lessonSpecificSocialReactionRowsExcludingCompletion: number
    otherObjectTypeRows: number
    distinctReactionTypes: string[]
    matchedMigratedPostReactions: number
    matchedMigratedCommentReactions: number
    surveyVotesMatchedPostByObjectId: number
    surveyVotesMatchedPostByParentId: number
    orphanCommunityTargetObjectRows: number
    actorSourceUserResolvableRows: number
    actorSourceUserUnresolvedRows: number
    actorCanonicalMemberResolvableRows: number
    everyCommunityReactionHasMigratedTarget: boolean
    targetRuntimeCurrentlyExists: 'no'
    newSchemaRequiredIfImplemented: 'unknown'
    architectureDecisionNeeded: true
  }
  memberDirectoryPublicProfile: {
    classification: EvidenceClassification
    customizationMatchingKeyPaths: string[]
    fluentCommunityMatchingKeyPaths: string[]
    authMatchingKeyPaths: string[]
    matchingSettingKeyCount: number
    nonEmptyMatchingSettingKeyCount: number
    memberListLayoutKeyPresent: boolean
    directoryEnablementKeyPresent: boolean
    publicProfileKeyPresent: boolean
    profileAccessKeyPresent: boolean
    memberNavigationReferenceCount: number
    xprofileRows: number
    targetRuntimeCurrentlyExists: 'partial'
    targetAccountProfileEditorExists: true
    targetMemberDirectoryRouteExists: false
    targetPublicMemberProfileRouteExists: false
    existingRelationshipsSupportDerivedActivity: true
    newSchemaRequiredIfImplemented: 'no'
    architectureDecisionNeeded: true
  }
}

function increment(values: string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((result, value) => {
    const key = value || '(empty)'
    result[key] = (result[key] ?? 0) + 1
    return result
  }, {})
}

function parseStructured(raw: string | null): Structured {
  if (!raw?.trim()) return {}
  try {
    const parsed = JSON.parse(raw) as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Structured : {}
  } catch {
    try {
      return parsePhpSerializedRecord(raw) as Structured
    } catch {
      return {}
    }
  }
}

function flattenSettings(value: unknown, prefix = ''): Array<{ path: string; nonEmpty: boolean }> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return []
  const output: Array<{ path: string; nonEmpty: boolean }> = []
  for (const [key, child] of Object.entries(value as Structured)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (child && typeof child === 'object' && !Array.isArray(child)) {
      const nested = flattenSettings(child, path)
      output.push({ path, nonEmpty: nested.some((entry) => entry.nonEmpty) })
      output.push(...nested)
    } else {
      const nonEmpty = child !== null && child !== undefined && child !== '' && child !== false && child !== 0 && child !== '0'
      output.push({ path, nonEmpty })
    }
  }
  return output
}

const MEMBER_SETTING_PATTERN = /(member|profile|directory|people|user[_-]?list|member[_-]?list|privacy|visibility|access)/i
const MEMBER_LIST_LAYOUT_PATTERN = /(member[_-]?list.*layout|member.*layout|members.*layout)/i
const DIRECTORY_ENABLEMENT_PATTERN = /(member[_-]?list.*(?:enable|show|visible|active)|directory.*(?:enable|show|visible|active)|members.*(?:enable|show|visible|active))/i
const PUBLIC_PROFILE_PATTERN = /(public.*profile|profile.*public|member.*profile.*(?:enable|show|visible))/i
const PROFILE_ACCESS_PATTERN = /(profile.*(?:access|privacy|visibility)|member.*(?:access|privacy|visibility))/i

function matchingPaths(raw: string | null): Array<{ path: string; nonEmpty: boolean }> {
  return flattenSettings(parseStructured(raw)).filter((entry) => MEMBER_SETTING_PATTERN.test(entry.path))
}

function auditReactions(snapshot: LegacySqlSnapshot, normalization: LegacyDryRunNormalization): RemainingParityAudit['reactions'] {
  const community = normalization.communityReactions
  const completed = normalization.lessonCompletedReactions
  const migratedPostIds = new Set(normalization.feedPosts.map((post) => post.id))
  const migratedCommentIds = new Set(normalization.comments.map((comment) => comment.id))
  const wpUserIds = new Set(snapshot.wordpressUsers.map((user) => user.id))
  const canonicalSourceWpIds = new Set(normalization.identity.members.flatMap((member) => member.sourceWpUserIds))

  let matchedPost = 0
  let matchedComment = 0
  let surveyVotesMatchedPostByObjectId = 0
  let surveyVotesMatchedPostByParentId = 0
  let orphanCommunityTarget = 0
  let feedPostRows = 0
  let commentRows = 0
  let lessonSpecificSocial = 0
  let otherRows = 0

  for (const reaction of community) {
    const type = reaction.objectType.toLowerCase()
    const objectId = reaction.objectId ?? ''
    const isPostReaction = type === 'feed' || type === 'post' || type === 'feed_post'
    const isCommentReaction = type === 'comment' || type === 'post_comment'
    const isLessonReaction = type.includes('lesson')
    const directPostMatch = migratedPostIds.has(objectId)
    const directCommentMatch = migratedCommentIds.has(objectId)
    const parentPostMatch = Boolean(reaction.parentId && migratedPostIds.has(reaction.parentId))
    const parentCommentMatch = Boolean(reaction.parentId && migratedCommentIds.has(reaction.parentId))
    const postMatch = isPostReaction
      ? directPostMatch
      : !isCommentReaction && !isLessonReaction && (directPostMatch || parentPostMatch)
    const commentMatch = isCommentReaction
      ? directCommentMatch
      : !isPostReaction && !isLessonReaction && (directCommentMatch || parentCommentMatch)
    if (isPostReaction) feedPostRows += 1
    else if (isCommentReaction) commentRows += 1
    else if (isLessonReaction) lessonSpecificSocial += 1
    else otherRows += 1

    if (postMatch) matchedPost += 1
    if (commentMatch) matchedComment += 1
    if (reaction.type === 'survey_vote') {
      if (directPostMatch) surveyVotesMatchedPostByObjectId += 1
      if (parentPostMatch) surveyVotesMatchedPostByParentId += 1
    }
    if (!postMatch && !commentMatch) orphanCommunityTarget += 1
  }

  const actorResolvable = snapshot.reactions.filter((reaction) => Boolean(reaction.userId && wpUserIds.has(reaction.userId))).length
  const actorCanonical = snapshot.reactions.filter((reaction) => Boolean(reaction.userId && canonicalSourceWpIds.has(reaction.userId))).length

  return {
    classification: community.length > 0 ? 'source_proven' : 'source_not_proven',
    totalReactionProgressRows: snapshot.reactions.length,
    communityReactionRows: community.length,
    lessonCompletionProgressRows: completed.length,
    countsByObjectType: increment(snapshot.reactions.map((reaction) => reaction.objectType)),
    countsByReactionType: increment(snapshot.reactions.map((reaction) => reaction.type)),
    feedPostReactionRows: feedPostRows,
    commentReactionRows: commentRows,
    lessonSpecificSocialReactionRowsExcludingCompletion: lessonSpecificSocial,
    otherObjectTypeRows: otherRows,
    distinctReactionTypes: [...new Set(snapshot.reactions.map((reaction) => reaction.type || '(empty)'))].sort(),
    matchedMigratedPostReactions: matchedPost,
    matchedMigratedCommentReactions: matchedComment,
    surveyVotesMatchedPostByObjectId,
    surveyVotesMatchedPostByParentId,
    orphanCommunityTargetObjectRows: orphanCommunityTarget,
    actorSourceUserResolvableRows: actorResolvable,
    actorSourceUserUnresolvedRows: snapshot.reactions.length - actorResolvable,
    actorCanonicalMemberResolvableRows: actorCanonical,
    everyCommunityReactionHasMigratedTarget: community.length > 0 && orphanCommunityTarget === 0,
    targetRuntimeCurrentlyExists: 'no',
    newSchemaRequiredIfImplemented: 'unknown',
    architectureDecisionNeeded: true,
  }
}

function auditMemberDirectory(snapshot: LegacySqlSnapshot): RemainingParityAudit['memberDirectoryPublicProfile'] {
  const customization = matchingPaths(snapshot.portalSettingsSource.customizationSettingsRaw)
  const community = matchingPaths(snapshot.portalSettingsSource.fluentCommunitySettingsRaw)
  const auth = matchingPaths(snapshot.portalSettingsSource.authSettingsRaw)
  const all = [...customization, ...community, ...auth]
  const paths = all.map((entry) => entry.path)

  const memberNavigationReferenceCount = snapshot.spaces.filter((space) => {
    const haystack = `${space.type} ${space.slug} ${space.title}`.toLowerCase()
    return /member|profile|people|directory/.test(haystack)
  }).length

  const memberListLayoutKeyPresent = paths.some((path) => MEMBER_LIST_LAYOUT_PATTERN.test(path))
  const directoryEnablementKeyPresent = paths.some((path) => DIRECTORY_ENABLEMENT_PATTERN.test(path))
  const publicProfileKeyPresent = paths.some((path) => PUBLIC_PROFILE_PATTERN.test(path))
  const profileAccessKeyPresent = paths.some((path) => PROFILE_ACCESS_PATTERN.test(path))
  const explicitUsageProof = directoryEnablementKeyPresent || publicProfileKeyPresent || profileAccessKeyPresent || memberNavigationReferenceCount > 0
  const layoutOnlyEvidence = memberListLayoutKeyPresent && !explicitUsageProof

  return {
    classification: explicitUsageProof ? 'source_proven' : layoutOnlyEvidence || all.length > 0 ? 'ambiguous' : 'source_not_proven',
    customizationMatchingKeyPaths: customization.map((entry) => entry.path).sort(),
    fluentCommunityMatchingKeyPaths: community.map((entry) => entry.path).sort(),
    authMatchingKeyPaths: auth.map((entry) => entry.path).sort(),
    matchingSettingKeyCount: all.length,
    nonEmptyMatchingSettingKeyCount: all.filter((entry) => entry.nonEmpty).length,
    memberListLayoutKeyPresent,
    directoryEnablementKeyPresent,
    publicProfileKeyPresent,
    profileAccessKeyPresent,
    memberNavigationReferenceCount,
    xprofileRows: snapshot.communityProfiles.length,
    targetRuntimeCurrentlyExists: 'partial',
    targetAccountProfileEditorExists: true,
    targetMemberDirectoryRouteExists: false,
    targetPublicMemberProfileRouteExists: false,
    existingRelationshipsSupportDerivedActivity: true,
    newSchemaRequiredIfImplemented: 'no',
    architectureDecisionNeeded: true,
  }
}

export function auditJPVRemainingParity(snapshot: LegacySqlSnapshot, normalization: LegacyDryRunNormalization): RemainingParityAudit {
  return {
    mutationMode: 'none',
    containsPii: false,
    reactions: auditReactions(snapshot, normalization),
    memberDirectoryPublicProfile: auditMemberDirectory(snapshot),
  }
}

async function main(): Promise<void> {
  const sqlPath = process.argv.find((arg) => arg.startsWith('--sql='))?.slice('--sql='.length) ?? '/private/tmp/127_0_0_1.sql'
  const stripePath = process.argv.find((arg) => arg.startsWith('--stripe='))?.slice('--stripe='.length) ?? '/private/tmp/jpv-stripe-live-subscriptions.json'
  const snapshot = buildLegacySqlSnapshot(readFileSync(sqlPath, 'utf8'))
  const stripe = JSON.parse(readFileSync(stripePath, 'utf8')) as StripeEvidenceFile
  const normalization = buildLegacyDryRunNormalization(snapshot, stripe)
  const report = auditJPVRemainingParity(snapshot, normalization)
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
}

if (process.argv[1]?.endsWith('auditJPVRemainingParity.ts')) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
