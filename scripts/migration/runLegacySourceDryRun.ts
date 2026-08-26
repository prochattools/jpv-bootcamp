#!/usr/bin/env node

import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import {
  assertPiiOutputOutsideRepo,
  assertRealSourceContentExpectations,
  assertSnapshotExpectations,
  buildLegacyDryRunNormalization,
  buildLegacySqlSnapshot,
  buildLocalMediaManifest,
  parseWordPressWxr,
  reconcileBunnyReferences,
  reconcileWordPressAttachments,
  type BunnyInventoryFile,
  type StripeEvidenceFile,
} from './legacySourceDryRun'
import { buildLegacyPayloadOperationPlan } from './legacyPayloadOperationPlan'
import { loadAndVerifyLegacySourceManifest } from './legacySourceManifest'

interface CliArgs {
  sql: string
  wxr: string
  stripe: string
  bunny: string
  uploads: string
  out: string
  manifest?: string
}

function parseArgs(argv: string[]): CliArgs {
  if (argv.includes('--jpv-private-tmp')) {
    return {
      sql: '/private/tmp/127_0_0_1.sql',
      wxr: '/private/tmp/jpvbootcamp.WordPress.2026-08-12.xml',
      stripe: '/private/tmp/jpv-stripe-live-subscriptions.json',
      bunny: '/private/tmp/jpv-bunny-migration-inventory.json',
      uploads: 'src/assets/uploads',
      out: '/private/tmp/jpv-legacy-source-dry-run-2026-08-15.json',
      manifest: undefined,
    }
  }

  const values = new Map<string, string>()
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (!arg.startsWith('--')) continue
    const eq = arg.indexOf('=')
    if (eq >= 0) {
      values.set(arg.slice(2, eq), arg.slice(eq + 1))
      continue
    }
    const key = arg.slice(2)
    const value = argv[i + 1]
    if (!value || value.startsWith('--')) throw new Error(`MISSING_VALUE --${key}`)
    values.set(key, value)
    i += 1
  }

  const required = ['sql', 'wxr', 'stripe', 'bunny', 'uploads', 'out'] as const
  for (const key of required) {
    if (!values.get(key)) throw new Error(`MISSING_REQUIRED_ARGUMENT --${key}`)
  }

  return {
    ...Object.fromEntries(required.map((key) => [key, values.get(key)!])),
    manifest: values.get('manifest'),
  } as unknown as CliArgs
}

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, 'utf8')) as T
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  const outputPath = assertPiiOutputOutsideRepo(args.out)

  const sql = readFileSync(args.sql, 'utf8')
  const wxr = readFileSync(args.wxr, 'utf8')
  const stripe = readJson<StripeEvidenceFile>(args.stripe)
  const bunny = readJson<BunnyInventoryFile>(args.bunny)
  const manifest = args.manifest
    ? loadAndVerifyLegacySourceManifest({
        manifestPath: args.manifest,
        sqlPath: args.sql,
        wxrPath: args.wxr,
      })
    : null

  const snapshot = buildLegacySqlSnapshot(sql)
  const normalization = buildLegacyDryRunNormalization(snapshot, stripe)
  assertSnapshotExpectations(normalization.identity, manifest?.identity)

  const wxrItems = parseWordPressWxr(wxr)
  const mediaManifest = buildLocalMediaManifest(args.uploads)
  assertRealSourceContentExpectations(snapshot, normalization, wxrItems, mediaManifest, manifest?.content)
  const attachmentReconciliation = reconcileWordPressAttachments(wxrItems, mediaManifest)
  const bunnyReconciliation = reconcileBunnyReferences(normalization.bunnyReferences, bunny)
  const operationPlan = await buildLegacyPayloadOperationPlan(snapshot, normalization, bunny)

  const report = {
    reportVersion: '1.1',
    generatedAt: new Date().toISOString(),
    mutationMode: 'none',
    sourceManifest: manifest
      ? { manifestVersion: manifest.manifestVersion, snapshotDate: manifest.snapshotDate }
      : { manifestVersion: 'legacy-default', snapshotDate: '2026-08-15' },
    source: {
      wordpressMemberAccounts: normalization.identity.sourceMemberAccountCount,
      canonicalMembers: normalization.identity.canonicalMemberCount,
      activeMembers: normalization.identity.activeCount,
      blockedMembers: normalization.identity.blockedCount,
      wxrItems: wxrItems.length,
      localMediaFiles: mediaManifest.length,
    },
    identityCrosswalk: normalization.identity,
    courses: {
      courses: normalization.courses,
      sections: normalization.courseSections,
      lessons: normalization.courseLessons,
      lessonCompletedReactions: normalization.lessonCompletedReactions,
      courseCompletedActivities: normalization.courseCompletedActivities,
    },
    community: {
      spaces: normalization.communitySpaces,
      navigationOnlySpaces: normalization.navigationOnlySpaces,
      excludedFunctionalSpaces: normalization.excludedFunctionalSpaces,
      spaceMemberships: normalization.spaceMemberships,
      feedPosts: normalization.feedPosts,
      comments: normalization.comments,
      reactions: normalization.communityReactions,
      media: normalization.communityMedia,
    },
    media: {
      wordpress: attachmentReconciliation,
      localManifest: mediaManifest,
      bunny: bunnyReconciliation,
    },
    proposedPayloadOperations: operationPlan,
  }

  mkdirSync(path.dirname(outputPath), { recursive: true })
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
  chmodSync(outputPath, 0o600)

  const unresolvedByCode = operationPlan.unresolved.reduce<Record<string, number>>((counts, item) => {
    counts[item.code] = (counts[item.code] ?? 0) + 1
    return counts
  }, {})

  const memberProfilesWithLegacyProfileData = operationPlan.operations.filter((item) =>
    item.collection === 'payload_member_profiles'
    && Array.isArray(item.source.raw?.communityProfiles)
    && item.source.raw.communityProfiles.length > 0
  ).length
  const portalSettingsGlobalOperations = operationPlan.operations.filter((item) =>
    item.targetType === 'global' && item.globalSlug === 'portalSettings'
  ).length
  const reactionOperations = operationPlan.operations.filter((item) => item.collection === 'payload_space_reactions')
  const reactionTargetKindCounts = reactionOperations.reduce<Record<string, number>>((counts, item) => {
    const targetKind = typeof item.data.targetKind === 'string' ? item.data.targetKind : '(missing)'
    counts[targetKind] = (counts[targetKind] ?? 0) + 1
    return counts
  }, {})
  const surveyReactionOperationsWithTargetAndOption = reactionOperations.filter((item) =>
    item.data.targetKind === 'survey_option'
    && item.data.targetPost
    && typeof item.data.surveyOptionKey === 'string'
    && item.data.surveyOptionKey.length > 0
  ).length
  const reactionOperationsWithSchemaBlocker = reactionOperations.filter((item) =>
    item.blockers.includes('community_reaction_schema_registration_required')
  ).length
  const lessonCompletedReactionOperations = reactionOperations.filter((item) => item.source.raw?.objectType === 'lesson_completed').length

  const migratedCourseSpaceIds = new Set(normalization.courses.map((space) => space.id))
  const migratedCommunitySpaceIds = new Set(normalization.communitySpaces.map((space) => space.id))
  const navigationOnlySpaceIds = new Set(normalization.navigationOnlySpaces.map((space) => space.id))
  const excludedFunctionalSpaceIds = new Set(normalization.excludedFunctionalSpaces.map((space) => space.id))
  const classifiedSpaceMedia = snapshot.communityMedia
    .filter((media) => media.objectSource === 'space_cover_photo' || media.objectSource === 'space_og_image')
    .map((media) => {
      const sourceSpaceId = media.subObjectId
      const classification = sourceSpaceId && migratedCourseSpaceIds.has(sourceSpaceId)
        ? 'migratedCourseSpace'
        : sourceSpaceId && migratedCommunitySpaceIds.has(sourceSpaceId)
          ? 'migratedCommunitySpace'
          : sourceSpaceId && navigationOnlySpaceIds.has(sourceSpaceId)
            ? 'navigationOnlySpace'
            : sourceSpaceId && excludedFunctionalSpaceIds.has(sourceSpaceId)
              ? 'excludedFunctionalSpace'
              : 'unknownSpace'
      return { sourceKind: media.objectSource, classification }
    })
  const spaceMediaSourceClassifications = classifiedSpaceMedia.reduce<Record<string, number>>((counts, item) => {
    counts[item.classification] = (counts[item.classification] ?? 0) + 1
    return counts
  }, {})
  const spaceMediaSourceKindByClassification = classifiedSpaceMedia.reduce<Record<string, number>>((counts, item) => {
    const key = `${item.sourceKind}:${item.classification}`
    counts[key] = (counts[key] ?? 0) + 1
    return counts
  }, {})

  const summary = {
    sourceMemberAccounts: normalization.identity.sourceMemberAccountCount,
    canonicalMembers: normalization.identity.canonicalMemberCount,
    active: normalization.identity.activeCount,
    blocked: normalization.identity.blockedCount,
    courses: normalization.courses.length,
    sections: normalization.courseSections.length,
    lessons: normalization.courseLessons.length,
    communitySpaces: normalization.communitySpaces.length,
    navigationOnlySpaces: normalization.navigationOnlySpaces.length,
    excludedFunctionalSpaces: normalization.excludedFunctionalSpaces.length,
    sourceSpaceMemberships: normalization.spaceMemberships.length,
    feedPosts: normalization.feedPosts.length,
    comments: normalization.comments.length,
    communityReactions: normalization.communityReactions.length,
    lessonCompletions: normalization.lessonCompletedReactions.length,
    courseCompletions: normalization.courseCompletedActivities.length,
    mappedWordPressAttachments: attachmentReconciliation.mappedCount,
    missingWordPressAttachments: attachmentReconciliation.missingCount,
    referencedBunnyGuids: bunnyReconciliation.uniqueReferencedGuids,
    missingBunnyGuids: bunnyReconciliation.missingGuids.length,
    orphanStripeRecords: normalization.identity.orphanStripeRecords.length,
    memberProfilesWithLegacyProfileData,
    portalSettingsGlobalOperations,
    reactionOperations: reactionOperations.length,
    reactionTargetKindCounts,
    surveyReactionOperationsWithTargetAndOption,
    reactionOperationsWithSchemaBlocker,
    lessonCompletedReactionOperations,
    proposedOperations: operationPlan.summary.operations,
    blockedProposedOperations: operationPlan.summary.blockedOperations,
    routedCommunityComments: operationPlan.summary.communityComments,
    deferredLessonComments: operationPlan.summary.deferredLessonComments,
    deferredOtherSourceComments: operationPlan.summary.deferredOtherSourceComments,
    plannedLessonComments: operationPlan.summary.plannedLessonComments,
    memberCoverMediaReferences: operationPlan.summary.memberCoverMediaReferences,
    portalSettingsMediaReferences: operationPlan.summary.portalSettingsMediaReferences,
    courseCoverMediaReferences: operationPlan.summary.courseCoverMediaReferences,
    spaceMediaSchemaReferences: operationPlan.summary.spaceMediaSchemaReferences,
    spaceMediaSourceClassifications,
    spaceMediaSourceKindByClassification,
    platformArchiveMediaReferences: operationPlan.summary.platformArchiveMediaReferences,
    unresolvedMediaRecords: operationPlan.summary.unresolvedMediaRecords,
    platformMediaAssetsAwaitingTargetDecision: operationPlan.summary.platformMediaAssetsAwaitingTargetDecision,
    unresolvedOperationRelationships: operationPlan.unresolved.length,
    unresolvedByCode,
    output: path.basename(outputPath),
  }

  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`LEGACY_SOURCE_DRY_RUN_FAILED ${message}\n`)
  process.exitCode = 1
})
