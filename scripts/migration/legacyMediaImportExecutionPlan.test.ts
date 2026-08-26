import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import {
  buildLegacyMediaImportExecutionPlan,
  LEGACY_MEDIA_EXECUTION_PHASES,
} from './legacyMediaImportExecutionPlan'
import type { LegacyMediaImportManifest, LegacyMediaManifestRecord } from './legacyMediaImportManifest'
import type { LegacyPayloadOperationPlan, ProposedPayloadOperation } from './legacyPayloadOperationPlan'

function binaryRecord(overrides: Partial<LegacyMediaManifestRecord> = {}): LegacyMediaManifestRecord {
  return {
    manifestId: 'media_local',
    idempotencyKey: 'source-local',
    recordKind: 'binary_import_intent',
    sourceSystem: 'fluentcommunity',
    sourceType: 'member_avatar_media_import',
    sourceIds: ['1'],
    locatorClass: 'fluentcommunity_local_path',
    localRelativePath: '2026/08/avatar.jpg',
    sourceLocator: 'https://legacy.invalid/wp-content/uploads/2026/08/avatar.jpg',
    targetOperationId: 'op-local',
    targetCollection: 'payload_media',
    targetField: null,
    targetGlobal: null,
    targetFields: [],
    storageClass: 'public',
    expectedMime: 'image/jpeg',
    localFileExists: true,
    bytes: 10,
    sha256: 'a'.repeat(64),
    plannerBlockers: ['member_avatar_media_import_required'],
    schemaBlockers: [],
    binaryImportBlocker: 'member_avatar_media_import_required',
    archiveDisposition: 'migration-targeted',
    provenanceReason: 'test binary',
    ...overrides,
  }
}

function operation(
  operationId: string,
  collection: ProposedPayloadOperation['collection'] = 'payload_media',
  dependsOn: string[] = [],
): ProposedPayloadOperation {
  return {
    operationId,
    idempotencyKey: `planner:${operationId}`,
    collection,
    action: 'proposed_create',
    data: {},
    dependsOn,
    source: { system: 'fluentcommunity', entityType: 'media', sourceIds: [operationId] },
    blockers: [],
  }
}

function operationPlan(operations: ProposedPayloadOperation[]): LegacyPayloadOperationPlan {
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
      blockedOperations: 0,
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

function manifest(records: LegacyMediaManifestRecord[]): LegacyMediaImportManifest {
  const binary = records.filter((record) => record.recordKind === 'binary_import_intent')
  return {
    manifestVersion: '1.0',
    mutationMode: 'none',
    containsPii: false,
    records,
    summary: {
      records: records.length,
      binaryImportIntents: binary.length,
      localResolvableBinaries: binary.filter((record) => record.localFileExists).length,
      externalOrRemoteSourceBinaries: binary.filter((record) => record.locatorClass === 'external_or_remote_source').length,
      missingLocalSourceBinaries: binary.filter((record) => record.locatorClass === 'missing_local_source').length,
      referenceOnlyRecords: records.filter((record) => record.recordKind === 'wxr_attachment_reference').length,
      archiveOnlyUnmatchedLocalFiles: records.filter((record) => record.archiveDisposition === 'archive-only-unmatched').length,
      localFiles: records.filter((record) => record.recordKind === 'local_file_ledger').length,
      importableLocalFiles: 0,
      excludedLocalFiles: 0,
      publicBinaryImports: binary.filter((record) => record.storageClass === 'public').length,
      privateBinaryImports: binary.filter((record) => record.storageClass === 'private').length,
      wxrSourceAttachments: records.filter((record) => record.recordKind === 'wxr_attachment_reference').length,
      wxrMappedAttachments: records.filter((record) => record.recordKind === 'wxr_attachment_reference').length,
      wxrMissingAttachments: 0,
      wxrManifestRecords: records.filter((record) => record.recordKind === 'wxr_attachment_reference').length,
      plannerBinaryOperationCoverage: binary.length,
      plannerBinaryOperations: binary.length,
    },
  }
}

async function run(): Promise<void> {
  const remoteSchema = binaryRecord({
    manifestId: 'media-og',
    idempotencyKey: 'source-og',
    sourceType: 'space_og_media_import',
    sourceIds: ['2'],
    locatorClass: 'external_or_remote_source',
    localRelativePath: null,
    sourceLocator: 'https://remote.invalid/og.jpg',
    targetOperationId: 'op-og',
    targetCollection: 'payload_spaces',
    targetField: 'ogImage',
    localFileExists: false,
    bytes: null,
    sha256: null,
    plannerBlockers: ['space_media_schema_registration_required', 'space_media_import_required'],
    schemaBlockers: ['space_media_schema_registration_required'],
    binaryImportBlocker: 'space_media_import_required',
  })
  const courseCover = binaryRecord({
    manifestId: 'media-course-cover',
    idempotencyKey: 'source-course-cover',
    sourceType: 'course_cover_media_import',
    sourceIds: ['3'],
    targetOperationId: 'op-course-cover',
    targetCollection: 'payload_courses',
    targetField: 'coverImage',
    sha256: 'a'.repeat(64),
    schemaBlockers: [],
  })
  const privateRemote = binaryRecord({
    manifestId: 'media-private',
    idempotencyKey: 'source-private',
    sourceType: 'lesson_private_media_import',
    sourceIds: ['4'],
    locatorClass: 'external_or_remote_source',
    localRelativePath: null,
    sourceLocator: 'https://remote.invalid/private.pdf',
    targetOperationId: 'op-private',
    targetCollection: 'payload_private_media',
    storageClass: 'private',
    localFileExists: false,
    bytes: null,
    sha256: null,
    binaryImportBlocker: 'lesson_resource_private_media_import_required',
  })
  const missing = binaryRecord({
    manifestId: 'media-missing',
    idempotencyKey: 'source-missing',
    sourceIds: ['5'],
    locatorClass: 'missing_local_source',
    localRelativePath: null,
    sourceLocator: null,
    targetOperationId: 'op-missing',
    localFileExists: false,
    bytes: null,
    sha256: null,
  })
  const wxr: LegacyMediaManifestRecord = {
    ...binaryRecord(),
    manifestId: 'wxr-reference',
    idempotencyKey: 'wxr:1',
    recordKind: 'wxr_attachment_reference',
    sourceSystem: 'wordpress',
    sourceType: 'wxr_attachment',
    locatorClass: 'local_wxr_attachment',
    targetOperationId: null,
    targetCollection: null,
    targetField: null,
    storageClass: 'reference_only',
    plannerBlockers: [],
    schemaBlockers: [],
    binaryImportBlocker: null,
    archiveDisposition: 'source-reference-only',
  }
  const archive: LegacyMediaManifestRecord = {
    ...wxr,
    manifestId: 'archive-only',
    idempotencyKey: 'local:archive',
    recordKind: 'local_file_ledger',
    sourceSystem: 'wordpress_media_archive',
    sourceType: 'local_upload_file',
    locatorClass: 'archive_only_unmatched',
    localRelativePath: '2026/08/unmatched.jpg',
    sourceLocator: null,
    storageClass: 'archive_only',
    archiveDisposition: 'archive-only-unmatched',
  }

  const sourceManifest = manifest([binaryRecord(), remoteSchema, courseCover, privateRemote, missing, wxr, archive])
  const planner = operationPlan([
    operation('op-local', 'payload_media', ['dependency-z', 'dependency-a']),
    operation('op-og'),
    operation('op-course-cover'),
    operation('op-private', 'payload_private_media'),
    operation('op-missing'),
  ])
  const first = buildLegacyMediaImportExecutionPlan({ manifest: sourceManifest, operationPlan: planner })
  const second = buildLegacyMediaImportExecutionPlan({ manifest: sourceManifest, operationPlan: planner })

  assert.deepEqual(first, second)
  assert.equal(first.mutationMode, 'none')
  assert.equal(first.executionAuthorized, false)
  assert.equal(first.networkAuthorized, false)
  assert.equal(first.containsPii, false)
  assert.deepEqual(first.phases, LEGACY_MEDIA_EXECUTION_PHASES)
  assert.equal(first.summary.entries, 7)
  assert.equal(first.summary.executionIntents, 5)
  assert.equal(first.summary.readyAfterWriteAuthorization, 2)
  assert.equal(first.summary.requiresRemoteSourceAcquisition, 1)
  assert.equal(first.summary.schemaBlocked, 1)
  assert.equal(first.summary.sourceMissingBlocked, 1)
  assert.equal(first.summary.referenceOnly, 1)
  assert.equal(first.summary.archiveOnly, 1)
  assert.equal(first.summary.publicExecutionIntents, 4)
  assert.equal(first.summary.privateExecutionIntents, 1)
  assert.equal(first.summary.rollbackLedgerEntries, 5)
  assert.equal(first.summary.duplicateChecksumGroups, 1)

  const local = first.entries.find((entry) => entry.plannerOperationId === 'op-local')
  assert.ok(local)
  assert.equal(local.disposition, 'ready_after_write_authorization')
  assert.deepEqual(local.dependencyOperationIds, ['dependency-a', 'dependency-z'])
  assert.deepEqual(local.phases, LEGACY_MEDIA_EXECUTION_PHASES)
  assert.ok(local.rollbackLedger)
  assert.equal(local.rollbackLedger.preExistingTarget, false)
  assert.equal(local.rollbackLedger.createdByMigrationPacket, true)
  assert.equal(local.rollbackLedger.deletionEligibleOnlyIfCreatedByPacket, true)

  const og = first.entries.find((entry) => entry.plannerOperationId === 'op-og')
  assert.ok(og)
  assert.equal(og.disposition, 'schema_blocked')
  assert.equal(og.remoteSourceRequired, true)
  assert.deepEqual(og.schemaPrerequisites, ['space_media_schema_registration_required'])
  assert.equal(og.targetCollection, 'payload_spaces')
  assert.equal(og.targetField, 'ogImage')

  const cover = first.entries.find((entry) => entry.plannerOperationId === 'op-course-cover')
  assert.ok(cover)
  assert.equal(cover.disposition, 'ready_after_write_authorization')
  assert.deepEqual(cover.schemaPrerequisites, [])
  assert.equal(cover.targetCollection, 'payload_courses')
  assert.equal(cover.targetField, 'coverImage')

  const privateEntry = first.entries.find((entry) => entry.plannerOperationId === 'op-private')
  assert.ok(privateEntry)
  assert.equal(privateEntry.disposition, 'requires_remote_source_acquisition')
  assert.equal(privateEntry.storageClass, 'private')
  assert.equal(privateEntry.targetCollection, 'payload_private_media')

  assert.equal(first.entries.find((entry) => entry.sourceManifestId === 'media-missing')?.disposition, 'source_missing_blocked')
  assert.equal(first.entries.find((entry) => entry.sourceManifestId === 'wxr-reference')?.isUploadIntent, false)
  assert.equal(first.entries.find((entry) => entry.sourceManifestId === 'wxr-reference')?.disposition, 'reference_only')
  assert.equal(first.entries.find((entry) => entry.sourceManifestId === 'wxr-reference')?.rollbackLedger, null)
  assert.equal(first.entries.find((entry) => entry.sourceManifestId === 'archive-only')?.isUploadIntent, false)
  assert.equal(first.entries.find((entry) => entry.sourceManifestId === 'archive-only')?.disposition, 'archive_only')

  assert.equal(first.duplicateChecksumGroups[0]?.automaticCoalescingAllowed, false)
  assert.equal(first.duplicateChecksumGroups[0]?.executionEntryIds.length, 2)

  const sourcePath = fileURLToPath(new URL('./legacyMediaImportExecutionPlan.ts', import.meta.url))
  const source = await readFile(sourcePath, 'utf8')
  assert.doesNotMatch(source, /from ['"]payload['"]|from ['"]@payloadcms\//)
  assert.doesNotMatch(source, /@payloadcms\/db-postgres|\bpg\b/)
  assert.equal(source.includes(['child', 'process'].join('_')), false)
  assert.doesNotMatch(source, /\bfetch\s*\(|axios|got\(/)
  assert.doesNotMatch(source, /payload\.create|payload\.delete|payload\.update|db\.execute|db\.query/)

  assert.throws(() => buildLegacyMediaImportExecutionPlan({
    manifest: manifest([binaryRecord({ targetOperationId: 'missing-operation' })]),
    operationPlan: operationPlan([]),
  }), /MEDIA_EXECUTION_PLAN_OPERATION_NOT_FOUND/)

  process.stdout.write('legacyMediaImportExecutionPlan.test.ts: all assertions passed\n')
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
