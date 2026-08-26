import assert from 'node:assert/strict'

import { buildLegacyMediaImportManifest, assertLegacyMediaImportManifest } from './legacyMediaImportManifest'
import type { LegacyPayloadOperationPlan, ProposedPayloadOperation } from './legacyPayloadOperationPlan'
import type { MediaManifestEntry, WordPressAttachmentReconciliation } from './legacySourceDryRun'

function op(
  operationId: string,
  idempotencyKey: string,
  collection: ProposedPayloadOperation['collection'],
  entityType: string,
  raw: Record<string, unknown>,
  blockers: string[],
): ProposedPayloadOperation {
  return {
    operationId,
    idempotencyKey,
    collection,
    action: 'proposed_create',
    data: {},
    dependsOn: [],
    source: {
      system: 'fluentcommunity',
      entityType,
      sourceIds: [operationId],
      raw,
    },
    blockers,
  }
}

function plan(operations: ProposedPayloadOperation[]): LegacyPayloadOperationPlan {
  return {
    planVersion: '1.0',
    executionAuthorized: false,
    executable: false,
    snapshot: {
      sourceMemberAccounts: 48,
      canonicalSubscriberMembers: 47,
      activeSubscriberMembers: 11,
      blockedSubscriberMembers: 36,
      staffAuthorMirrors: 1,
    },
    operations,
    unresolved: [],
    summary: {
      operations: operations.length,
      blockedOperations: operations.filter((item) => item.blockers.length > 0).length,
      byCollection: {},
      activeCourseEnrollments: 0,
      blockedHistoricalCourseEnrollments: 0,
      activeSpaceMemberships: 0,
      blockedHistoricalSpaceMemberships: 0,
      lessonProgress: 0,
      communityComments: 0,
      deferredLessonComments: 0,
      deferredOtherSourceComments: 0,
      plannedLessonComments: 0,
      communityFileReferences: 0,
      lessonResourceReferences: 0,
      protectedLessonResourceMedia: 0,
      spaceDocumentReferences: 0,
      memberAvatarMediaReferences: 0,
      memberCoverMediaReferences: 0,
      portalSettingsMediaReferences: 0,
      courseCoverMediaReferences: 0,
      spaceMediaSchemaReferences: 0,
      platformArchiveMediaReferences: 0,
      unresolvedMediaRecords: 0,
      platformMediaAssetsAwaitingTargetDecision: 0,
    },
  }
}

function localMedia(): MediaManifestEntry[] {
  return [
    { relativePath: '2026/08/avatar.jpg', bytes: 12, extension: '.jpg', sha256: 'a'.repeat(64), importable: true },
    { relativePath: '2026/08/private.pdf', bytes: 24, extension: '.pdf', sha256: 'b'.repeat(64), importable: true },
    { relativePath: '2026/08/wxr-only.png', bytes: 36, extension: '.png', sha256: 'c'.repeat(64), importable: true },
    { relativePath: '2026/08/unmatched.webp', bytes: 48, extension: '.webp', sha256: 'd'.repeat(64), importable: true },
    { relativePath: '.htaccess', bytes: 10, extension: '', sha256: null, importable: false, exclusionReason: 'executable_or_control_file' },
  ]
}

const attachments: WordPressAttachmentReconciliation = {
  sourceAttachmentCount: 1,
  mappedCount: 1,
  missingCount: 0,
  mappings: [
    {
      postId: '1001',
      sourceRelativePath: '2026/08/wxr-only.png',
      localRelativePath: '2026/08/wxr-only.png',
      status: 'mapped',
    },
  ],
}

async function run(): Promise<void> {
  const operations: ProposedPayloadOperation[] = [
    op(
      'op-avatar',
      'fc_member_avatar_media:1',
      'payload_media',
      'member_avatar_media_import',
      {
        binaryImportRequired: true,
        fcDriver: 'local',
        fcSourcePath: '/wp-content/uploads/2026/08/avatar.jpg',
        fcSourceUrl: 'https://legacy.invalid/wp-content/uploads/2026/08/avatar.jpg?cache=nope',
        mediaType: 'image/jpeg',
      },
      ['member_avatar_media_import_required'],
    ),
    op(
      'op-private',
      'fc_lesson_resource_private_media:2',
      'payload_private_media',
      'lesson_private_media_import',
      {
        binaryImportRequired: true,
        fcDriver: 'local',
        fcSourcePath: '2026/08/private.pdf',
        mediaType: 'application/pdf',
      },
      ['lesson_resource_private_media_import_required'],
    ),
    op(
      'op-og',
      'fc_space_ogImage_media:3',
      'payload_media',
      'space_og_media_import',
      {
        binaryImportRequired: true,
        fcDriver: 's3',
        fcSourceUrl: 'https://remote.invalid/community-og.jpg?cache=removed',
        targetCollection: 'payload_spaces',
        targetField: 'ogImage',
        mediaType: 'image/jpeg',
      },
      ['space_media_schema_registration_required', 'space_media_import_required'],
    ),
    op(
      'op-reference',
      'fc_attachment_id:4',
      'payload_space_files',
      'post_media_reference',
      { referenceOnly: true },
      [],
    ),
  ]

  const first = buildLegacyMediaImportManifest({
    operationPlan: plan(operations),
    localMedia: localMedia(),
    attachments,
  })
  const second = buildLegacyMediaImportManifest({
    operationPlan: plan(operations),
    localMedia: localMedia(),
    attachments,
  })

  assertLegacyMediaImportManifest(first)
  assert.deepEqual(first, second)
  assert.equal(first.mutationMode, 'none')
  assert.equal(first.containsPii, false)
  assert.equal(first.summary.binaryImportIntents, 3)
  assert.equal(first.summary.localResolvableBinaries, 2)
  assert.equal(first.summary.externalOrRemoteSourceBinaries, 1)
  assert.equal(first.summary.missingLocalSourceBinaries, 0)
  assert.equal(first.summary.publicBinaryImports, 2)
  assert.equal(first.summary.privateBinaryImports, 1)
  assert.equal(first.summary.wxrSourceAttachments, 1)
  assert.equal(first.summary.wxrMappedAttachments, 1)
  assert.equal(first.summary.wxrManifestRecords, 1)
  assert.equal(first.summary.localFiles, 5)
  assert.equal(first.summary.archiveOnlyUnmatchedLocalFiles, 2)
  assert.equal(first.summary.plannerBinaryOperations, 3)
  assert.equal(first.summary.plannerBinaryOperationCoverage, 3)

  const avatar = first.records.find((record) => record.targetOperationId === 'op-avatar')
  assert.ok(avatar)
  assert.equal(avatar.locatorClass, 'fluentcommunity_local_path')
  assert.equal(avatar.localRelativePath, '2026/08/avatar.jpg')
  assert.equal(avatar.sha256, 'a'.repeat(64))
  assert.equal(avatar.storageClass, 'public')
  assert.doesNotMatch(avatar.sourceLocator ?? '', /\?/) // query strings never leak

  const privateMedia = first.records.find((record) => record.targetOperationId === 'op-private')
  assert.ok(privateMedia)
  assert.equal(privateMedia.storageClass, 'private')
  assert.equal(privateMedia.targetCollection, 'payload_private_media')
  assert.equal(privateMedia.localRelativePath, '2026/08/private.pdf')

  const og = first.records.find((record) => record.targetOperationId === 'op-og')
  assert.ok(og)
  assert.equal(og.locatorClass, 'external_or_remote_source')
  assert.equal(og.targetCollection, 'payload_spaces')
  assert.equal(og.targetField, 'ogImage')
  assert.deepEqual(og.schemaBlockers, ['space_media_schema_registration_required'])
  assert.equal(og.binaryImportBlocker, 'space_media_import_required')
  assert.equal(og.sourceLocator, 'https://remote.invalid/community-og.jpg')

  const wxr = first.records.find((record) => record.recordKind === 'wxr_attachment_reference')
  assert.ok(wxr)
  assert.equal(wxr.locatorClass, 'local_wxr_attachment')
  assert.equal(wxr.archiveDisposition, 'source-reference-only')
  assert.equal(wxr.targetCollection, null)

  const localLedger = first.records.filter((record) => record.recordKind === 'local_file_ledger')
  assert.equal(localLedger.length, 5)
  assert.equal(localLedger.find((record) => record.localRelativePath === '2026/08/avatar.jpg')?.archiveDisposition, 'migration-targeted')
  assert.equal(localLedger.find((record) => record.localRelativePath === '2026/08/wxr-only.png')?.archiveDisposition, 'source-reference-only')
  assert.equal(localLedger.find((record) => record.localRelativePath === '2026/08/unmatched.webp')?.archiveDisposition, 'archive-only-unmatched')
  assert.equal(localLedger.find((record) => record.localRelativePath === '.htaccess')?.archiveDisposition, 'archive-only-unmatched')

  assert.throws(() => buildLegacyMediaImportManifest({
    operationPlan: plan([]),
    localMedia: [{ relativePath: '../escape.jpg', bytes: 1, extension: '.jpg', sha256: 'e'.repeat(64), importable: true }],
    attachments: { sourceAttachmentCount: 0, mappedCount: 0, missingCount: 0, mappings: [] },
  }), /MEDIA_PATH_ESCAPE/)

  process.stdout.write('legacyMediaImportManifest.test.ts: all assertions passed\n')
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
