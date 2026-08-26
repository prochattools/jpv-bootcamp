import assert from 'node:assert/strict'
import test from 'node:test'
import path from 'node:path'

import {
  deterministicMediaStorageKey,
  guardMediaStagingIdentity,
  resolveMediaSourcePath,
  runJpvLegacyMediaImport,
} from './jpvLegacyMediaImportExecutor'
import type { LegacyMediaExecutionEntry, LegacyMediaImportExecutionPlan } from './legacyMediaImportExecutionPlan'

function entry(overrides: Partial<LegacyMediaExecutionEntry> = {}): LegacyMediaExecutionEntry {
  return {
    executionEntryId: 'media:1',
    targetType: 'public_media',
    targetCollection: 'payload_media',
    targetField: 'avatar',
    targetSourceId: 'member:1',
    sourceType: 'local',
    sourceLocator: 'avatar.jpg',
    localRelativePath: 'avatar.jpg',
    storageClass: 'public',
    sourceSha256: null,
    sourceBytes: null,
    expectedMime: 'image/jpeg',
    plannerOperationId: 'op:media:1',
    isUploadIntent: true,
    disposition: 'ready_after_write_authorization',
    blockers: [],
    ...overrides,
  }
}

function plan(entries: LegacyMediaExecutionEntry[]): LegacyMediaImportExecutionPlan {
  return {
    version: '1.0',
    generatedAt: new Date(0).toISOString(),
    sourceManifestSha256: 'fixture',
    entries,
    summary: {
      totalEntries: entries.length,
      uploadIntents: entries.filter((item) => item.isUploadIntent).length,
      readyAfterWriteAuthorization: entries.filter((item) => item.disposition === 'ready_after_write_authorization').length,
      requiresRemoteSourceAcquisition: entries.filter((item) => item.disposition === 'requires_remote_source_acquisition').length,
      blockedBySchema: entries.filter((item) => item.disposition === 'blocked_by_schema').length,
      blockedByMissingSource: entries.filter((item) => item.disposition === 'blocked_by_missing_source').length,
      unknownAcquisition: entries.filter((item) => item.disposition === 'unknown_acquisition').length,
      byTargetCollection: {},
    },
  }
}

test('staging guard accepts only reviewed host/database/schema identities', () => {
  const identity = guardMediaStagingIdentity('postgresql://u:p@10.0.2.4:5433/jpvbootcamp?schema=jpvbootcamp_staging')
  assert.deepEqual(identity, { hostname: '10.0.2.4', database: 'jpvbootcamp', schema: 'jpvbootcamp_staging' })
  assert.throws(() => guardMediaStagingIdentity('postgresql://u:p@localhost:5432/jpvbootcamp?schema=jpvbootcamp_staging'), /host_rejected/)
  assert.throws(() => guardMediaStagingIdentity('postgresql://u:p@10.0.2.4:5433/prod?schema=jpvbootcamp_staging'), /database_rejected/)
  assert.throws(() => guardMediaStagingIdentity('postgresql://u:p@10.0.2.4:5433/jpvbootcamp?schema=public'), /schema_rejected/)
})

test('deterministic storage key is stable and sanitized', () => {
  const fixture = entry({ sourceLocator: '../unsafe avatar.jpg' })
  const first = deterministicMediaStorageKey(fixture, 'abcdef0123456789abcdef0123456789', '/tmp/source.jpg')
  const second = deterministicMediaStorageKey(fixture, 'abcdef0123456789abcdef0123456789', '/tmp/source.jpg')
  assert.equal(first, second)
  assert.equal(first, 'legacy-abcdef0123456789-unsafe-avatar.jpg')
})

test('local source paths stay inside the configured uploads root', () => {
  const root = '/tmp/uploads'
  assert.equal(resolveMediaSourcePath(entry({ localRelativePath: 'nested/file.jpg' }), root), path.resolve(root, 'nested/file.jpg'))
  assert.throws(() => resolveMediaSourcePath(entry({ localRelativePath: '../../escape.jpg' }), root), /media_source_path_escape/)
})

test('remote intent requires an acquired local source mapping', () => {
  const remote = entry({
    executionEntryId: 'media:remote',
    sourceType: 'remote',
    localRelativePath: null,
    disposition: 'requires_remote_source_acquisition',
  })
  assert.throws(() => resolveMediaSourcePath(remote, '/tmp/uploads', {}), /remote_source_not_acquired/)
  assert.equal(resolveMediaSourcePath(remote, '/tmp/uploads', { 'media:remote': '/private/tmp/acquired.bin' }), '/private/tmp/acquired.bin')
})

test('dry-run performs no DB or file writes and reports acquisition classes', async () => {
  const result = await runJpvLegacyMediaImport({
    mode: 'dry-run',
    databaseUrl: 'postgresql://u:p@10.0.2.4:5433/jpvbootcamp?schema=jpvbootcamp_staging',
    runId: 'dry-run-fixture',
    executionPlan: plan([
      entry(),
      entry({ executionEntryId: 'media:remote', sourceType: 'remote', localRelativePath: null, disposition: 'requires_remote_source_acquisition' }),
    ]),
    sourceUploadsRoot: '/tmp/uploads',
  })
  assert.equal(result.ok, true)
  assert.equal(result.executionIntents, 2)
  assert.equal(result.localReady, 1)
  assert.equal(result.remoteAcquisitionRequired, 1)
  assert.equal(result.applied, 0)
  assert.equal(result.alreadyApplied, 0)
})

test('blocked or unknown acquisition intents fail closed in dry-run readiness', async () => {
  const result = await runJpvLegacyMediaImport({
    mode: 'dry-run',
    databaseUrl: 'postgresql://u:p@10.0.2.4:5433/jpvbootcamp?schema=jpvbootcamp_staging',
    runId: 'dry-run-blocked',
    executionPlan: plan([entry({ disposition: 'blocked_by_schema' })]),
    sourceUploadsRoot: '/tmp/uploads',
  })
  assert.equal(result.ok, false)
  assert.equal(result.blocked, 1)
})
