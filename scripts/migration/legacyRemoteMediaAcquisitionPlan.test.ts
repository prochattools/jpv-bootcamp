import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { buildLegacyRemoteMediaAcquisitionPlan } from './legacyRemoteMediaAcquisitionPlan'
import type { LegacyMediaImportExecutionPlan, LegacyMediaExecutionEntry } from './legacyMediaImportExecutionPlan'
import type { LegacyMediaImportManifest, LegacyMediaManifestRecord } from './legacyMediaImportManifest'
import type { LegacyPayloadOperationPlan, ProposedPayloadOperation } from './legacyPayloadOperationPlan'

function executionEntry(overrides: Partial<LegacyMediaExecutionEntry> = {}): LegacyMediaExecutionEntry {
  return {
    executionEntryId: 'media_exec_1',
    isUploadIntent: true,
    sourceManifestId: 'manifest_1',
    sourceSha256: null,
    sourceBytes: null,
    plannerOperationId: 'op_1',
    idempotencyKey: 'media_execution:1',
    sourceLocatorClass: 'external_or_remote_source',
    sourceLocator: 'https://bucket.s3.amazonaws.com/private/file.pdf',
    localRelativePath: null,
    targetCollection: 'payload_private_media',
    targetField: null,
    targetGlobal: null,
    targetFields: [],
    storageClass: 'private',
    dependencyOperationIds: ['dep_2', 'dep_1'],
    schemaPrerequisites: [],
    binaryImportBlockers: ['lesson_resource_private_media_import_required'],
    remoteSourceRequired: true,
    phases: ['source_validation', 'media_document_create', 'media_identity_verification', 'dependent_relationship_apply', 'rollback_ledger_checkpoint'],
    disposition: 'requires_remote_source_acquisition',
    provenanceReason: 'test',
    rollbackLedger: {
      rollbackLedgerId: 'rollback_1',
      executionIntentId: 'media_exec_1',
      sourceManifestId: 'manifest_1',
      createdTargetCollection: 'payload_private_media',
      createdTargetDocumentId: null,
      createdStorageKey: null,
      dependentRelationshipTarget: { operationId: 'op_1', targetField: null, targetGlobal: null, targetFields: [] },
      preExistingTarget: false,
      createdByMigrationPacket: true,
      sha256: null,
      executionTimestamp: null,
      deletionEligibleOnlyIfCreatedByPacket: true,
    },
    ...overrides,
  }
}

function manifestRecord(overrides: Partial<LegacyMediaManifestRecord> = {}): LegacyMediaManifestRecord {
  return {
    manifestId: 'manifest_1',
    idempotencyKey: 'source_1',
    recordKind: 'binary_import_intent',
    sourceSystem: 'fluentcommunity',
    sourceType: 'lesson_private_media_import',
    sourceIds: ['1'],
    locatorClass: 'external_or_remote_source',
    localRelativePath: null,
    sourceLocator: 'https://bucket.s3.amazonaws.com/private/file.pdf',
    targetOperationId: 'op_1',
    targetCollection: 'payload_private_media',
    targetField: null,
    targetGlobal: null,
    targetFields: [],
    storageClass: 'private',
    expectedMime: 'application/pdf',
    localFileExists: false,
    bytes: null,
    sha256: null,
    plannerBlockers: ['lesson_resource_private_media_import_required'],
    schemaBlockers: [],
    binaryImportBlocker: 'lesson_resource_private_media_import_required',
    archiveDisposition: 'migration-targeted',
    provenanceReason: 'test',
    ...overrides,
  }
}

function operation(operationId: string, driver: string | undefined): ProposedPayloadOperation {
  return {
    operationId,
    idempotencyKey: `planner:${operationId}`,
    collection: 'payload_private_media',
    action: 'proposed_create',
    data: {},
    dependsOn: [],
    source: {
      system: 'fluentcommunity',
      entityType: 'media',
      sourceIds: [operationId],
      raw: driver ? { fcDriver: driver } : {},
    },
    blockers: [],
  }
}

function executionPlan(entries: LegacyMediaExecutionEntry[]): LegacyMediaImportExecutionPlan {
  return {
    planVersion: '1.0',
    mutationMode: 'none',
    executionAuthorized: false,
    networkAuthorized: false,
    containsPii: false,
    phases: ['source_validation', 'media_document_create', 'media_identity_verification', 'dependent_relationship_apply', 'rollback_ledger_checkpoint'],
    entries,
    duplicateChecksumGroups: [],
    summary: {
      entries: entries.length,
      executionIntents: entries.length,
      readyAfterWriteAuthorization: 0,
      requiresRemoteSourceAcquisition: entries.length,
      schemaBlocked: 0,
      referenceOnly: 0,
      archiveOnly: 0,
      sourceMissingBlocked: 0,
      publicExecutionIntents: entries.filter((entry) => entry.storageClass === 'public').length,
      privateExecutionIntents: entries.filter((entry) => entry.storageClass === 'private').length,
      relationshipBearingIntents: 0,
      rollbackLedgerEntries: entries.length,
      duplicateChecksumGroups: 0,
    },
  }
}

function manifest(records: LegacyMediaManifestRecord[]): LegacyMediaImportManifest {
  return {
    manifestVersion: '1.0',
    mutationMode: 'none',
    containsPii: false,
    records,
    summary: {
      records: records.length,
      binaryImportIntents: records.length,
      localResolvableBinaries: 0,
      externalOrRemoteSourceBinaries: records.length,
      missingLocalSourceBinaries: 0,
      referenceOnlyRecords: 0,
      archiveOnlyUnmatchedLocalFiles: 0,
      localFiles: 0,
      importableLocalFiles: 0,
      excludedLocalFiles: 0,
      publicBinaryImports: records.filter((record) => record.storageClass === 'public').length,
      privateBinaryImports: records.filter((record) => record.storageClass === 'private').length,
      wxrSourceAttachments: 0,
      wxrMappedAttachments: 0,
      wxrMissingAttachments: 0,
      wxrManifestRecords: 0,
      plannerBinaryOperationCoverage: records.length,
      plannerBinaryOperations: records.length,
    },
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

async function run(): Promise<void> {
  const s3Entry = executionEntry()
  const publicEntry = executionEntry({
    executionEntryId: 'media_exec_2',
    sourceManifestId: 'manifest_2',
    plannerOperationId: 'op_2',
    idempotencyKey: 'media_execution:2',
    sourceLocator: 'https://legacy.example/wp-content/uploads/image.jpg',
    targetCollection: 'payload_media',
    storageClass: 'public',
    sourceSha256: 'a'.repeat(64),
    sourceBytes: 123,
  })
  const unknownEntry = executionEntry({
    executionEntryId: 'media_exec_3',
    sourceManifestId: 'manifest_3',
    plannerOperationId: 'op_3',
    idempotencyKey: 'media_execution:3',
    sourceLocator: 'https://cdn.example/file.jpg',
    targetCollection: 'payload_media',
    storageClass: 'public',
  })

  const sourceManifest = manifest([
    manifestRecord(),
    manifestRecord({
      manifestId: 'manifest_2',
      idempotencyKey: 'source_2',
      sourceIds: ['2'],
      sourceLocator: 'https://legacy.example/wp-content/uploads/image.jpg',
      targetOperationId: 'op_2',
      targetCollection: 'payload_media',
      storageClass: 'public',
      expectedMime: 'image/jpeg',
      bytes: 123,
      sha256: 'a'.repeat(64),
    }),
    manifestRecord({
      manifestId: 'manifest_3',
      idempotencyKey: 'source_3',
      sourceIds: ['3'],
      sourceLocator: 'https://cdn.example/file.jpg',
      targetOperationId: 'op_3',
      targetCollection: 'payload_media',
      storageClass: 'public',
      expectedMime: 'image/jpeg',
    }),
  ])

  const planner = operationPlan([
    operation('op_1', 's3'),
    { ...operation('op_2', 'public_url'), collection: 'payload_media' },
    { ...operation('op_3', undefined), collection: 'payload_media' },
  ])

  const first = buildLegacyRemoteMediaAcquisitionPlan({
    executionPlan: executionPlan([s3Entry, publicEntry, unknownEntry]),
    manifest: sourceManifest,
    operationPlan: planner,
  })
  const second = buildLegacyRemoteMediaAcquisitionPlan({
    executionPlan: executionPlan([s3Entry, publicEntry, unknownEntry]),
    manifest: sourceManifest,
    operationPlan: planner,
  })

  assert.deepEqual(first, second)
  assert.equal(first.mutationMode, 'none')
  assert.equal(first.networkAuthorized, false)
  assert.equal(first.containsPii, false)
  assert.equal(first.summary.remoteIntents, 3)
  assert.equal(first.summary.authenticatedRemoteIntents, 1)
  assert.equal(first.summary.unauthenticatedSourceProvenRemoteIntents, 1)
  assert.equal(first.summary.authenticationUnknownRemoteIntents, 1)
  assert.equal(first.summary.knownChecksumRemoteIntents, 1)
  assert.equal(first.summary.knownBytesRemoteIntents, 1)
  assert.equal(first.summary.acquisitionDefinitionReady, 2)
  assert.equal(first.summary.failClosedAdditionalEvidenceRequired, 1)

  const s3 = first.definitions.find((item) => item.executionIntentId === 'media_exec_1')
  assert.ok(s3)
  assert.equal(s3.authenticationRequirement, 'provider_credentials_required')
  assert.equal(s3.acquisitionMethod, 'authenticated_object_storage_download')
  assert.equal(s3.status, 'acquisition_definition_ready')
  assert.equal(s3.storageClass, 'private')
  assert.equal(s3.targetCollection, 'payload_private_media')
  assert.match(s3.verificationRequirements.join('\n'), /pin_computed_sha256_before_import/)
  assert.match(s3.verificationRequirements.join('\n'), /record_acquired_bytes_before_import/)

  const publicDef = first.definitions.find((item) => item.executionIntentId === 'media_exec_2')
  assert.ok(publicDef)
  assert.equal(publicDef.authenticationRequirement, 'no_authentication_source_proven')
  assert.equal(publicDef.acquisitionMethod, 'unauthenticated_https_download')
  assert.equal(publicDef.expectedSha256, 'a'.repeat(64))
  assert.equal(publicDef.expectedBytes, 123)
  assert.match(publicDef.verificationRequirements.join('\n'), /verify_sha256_equals/)
  assert.match(publicDef.verificationRequirements.join('\n'), /verify_bytes_equals:123/)

  const unknown = first.definitions.find((item) => item.executionIntentId === 'media_exec_3')
  assert.ok(unknown)
  assert.equal(unknown.authenticationRequirement, 'authentication_unknown')
  assert.equal(unknown.acquisitionMethod, 'blocked_unknown_acquisition_method')
  assert.equal(unknown.status, 'fail_closed_additional_evidence_required')
  assert.ok(unknown.failureReasons.includes('authentication_requirement_not_source_proven'))

  const sourcePath = fileURLToPath(new URL('./legacyRemoteMediaAcquisitionPlan.ts', import.meta.url))
  const source = await readFile(sourcePath, 'utf8')
  assert.doesNotMatch(source, /\bfetch\s*\(|axios|got\(|undici/)
  const forbiddenProcessImport = ['child', 'process'].join('_')
  assert.equal(source.includes(forbiddenProcessImport), false)
  assert.doesNotMatch(source, /from ['"]payload['"]|from ['"]@payloadcms\//)
  assert.doesNotMatch(source, /@payloadcms\/db-postgres|\bpg\b/)
  assert.doesNotMatch(source, /payload\.create|payload\.update|payload\.delete|db\.execute|db\.query/)

  const insecure = buildLegacyRemoteMediaAcquisitionPlan({
    executionPlan: executionPlan([executionEntry({ sourceLocator: 'ftp://legacy.example/file.jpg' })]),
    manifest: manifest([manifestRecord({ sourceLocator: 'ftp://legacy.example/file.jpg' })]),
    operationPlan: operationPlan([operation('op_1', 'public_url')]),
  })
  assert.equal(insecure.summary.acquisitionDefinitionReady, 0)
  assert.equal(insecure.summary.failClosedAdditionalEvidenceRequired, 1)
  assert.equal(insecure.definitions[0]?.locatorProtocol, 'unsupported')
  assert.equal(insecure.definitions[0]?.status, 'fail_closed_additional_evidence_required')
  assert.ok(insecure.definitions[0]?.failureReasons.includes('unsupported_or_insecure_protocol:unsupported'))

  process.stdout.write('legacyRemoteMediaAcquisitionPlan.test.ts: all assertions passed\n')
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
