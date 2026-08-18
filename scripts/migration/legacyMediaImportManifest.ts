import { createHash } from 'node:crypto'
import path from 'node:path'

import type { LegacyPayloadOperationPlan, ProposedPayloadOperation } from './legacyPayloadOperationPlan'
import type { MediaManifestEntry, WordPressAttachmentReconciliation } from './legacySourceDryRun'

export type LegacyMediaLocatorClass =
  | 'local_upload_file'
  | 'local_wxr_attachment'
  | 'fluentcommunity_local_path'
  | 'external_or_remote_source'
  | 'reference_only'
  | 'archive_only_unmatched'
  | 'missing_local_source'

export type LegacyMediaStorageClass = 'public' | 'private' | 'reference_only' | 'archive_only'
export type LegacyMediaArchiveDisposition = 'migration-targeted' | 'source-reference-only' | 'archive-only-unmatched'

export interface LegacyMediaManifestRecord {
  manifestId: string
  idempotencyKey: string
  recordKind: 'binary_import_intent' | 'wxr_attachment_reference' | 'local_file_ledger'
  sourceSystem: string
  sourceType: string
  sourceIds: string[]
  locatorClass: LegacyMediaLocatorClass
  localRelativePath: string | null
  sourceLocator: string | null
  targetOperationId: string | null
  targetCollection: string | null
  targetField: string | null
  targetGlobal: string | null
  targetFields: string[]
  storageClass: LegacyMediaStorageClass
  expectedMime: string | null
  localFileExists: boolean
  bytes: number | null
  sha256: string | null
  plannerBlockers: string[]
  schemaBlockers: string[]
  binaryImportBlocker: string | null
  archiveDisposition: LegacyMediaArchiveDisposition
  provenanceReason: string
}

export interface LegacyMediaImportManifest {
  manifestVersion: '1.0'
  mutationMode: 'none'
  containsPii: false
  records: LegacyMediaManifestRecord[]
  summary: {
    records: number
    binaryImportIntents: number
    localResolvableBinaries: number
    externalOrRemoteSourceBinaries: number
    missingLocalSourceBinaries: number
    referenceOnlyRecords: number
    archiveOnlyUnmatchedLocalFiles: number
    localFiles: number
    importableLocalFiles: number
    excludedLocalFiles: number
    publicBinaryImports: number
    privateBinaryImports: number
    wxrSourceAttachments: number
    wxrMappedAttachments: number
    wxrMissingAttachments: number
    wxrManifestRecords: number
    plannerBinaryOperationCoverage: number
    plannerBinaryOperations: number
  }
}

export interface BuildLegacyMediaImportManifestInput {
  operationPlan: LegacyPayloadOperationPlan
  localMedia: MediaManifestEntry[]
  attachments: WordPressAttachmentReconciliation
}

const schemaBlockerPattern = /schema|compatibility_required|registration_required/
const binaryImportBlockerPattern = /(?:media|import)_.*required|media_import_required|private_media_import_required/

function stableId(prefix: string, value: string): string {
  return `${prefix}_${createHash('sha256').update(value).digest('hex').slice(0, 24)}`
}

function normalizeRelative(value: string): string {
  const normalized = value.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '')
  const parts = normalized.split('/').filter(Boolean)
  if (parts.some((part) => part === '..')) throw new Error(`MEDIA_PATH_ESCAPE ${value}`)
  return parts.join('/')
}

function sanitizedRemoteLocator(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  const trimmed = value.trim()
  try {
    const url = new URL(trimmed)
    return `${url.protocol}//${url.host}${url.pathname}`
  } catch {
    return normalizeRelative(trimmed)
  }
}

function filenameFromLocator(value: unknown): string | null {
  const locator = sanitizedRemoteLocator(value)
  if (!locator) return null
  try {
    return path.posix.basename(new URL(locator).pathname) || null
  } catch {
    return path.posix.basename(locator) || null
  }
}

function candidateUploadPath(value: unknown): string | null {
  const locator = sanitizedRemoteLocator(value)
  if (!locator) return null
  const marker = '/wp-content/uploads/'
  const lower = locator.toLowerCase()
  const markerIndex = lower.indexOf(marker)
  if (markerIndex >= 0) return normalizeRelative(locator.slice(markerIndex + marker.length))
  return null
}

function localLookup(localMedia: MediaManifestEntry[]): {
  byPath: Map<string, MediaManifestEntry>
  uniqueByBasename: Map<string, MediaManifestEntry>
} {
  const byPath = new Map<string, MediaManifestEntry>()
  const basenameBuckets = new Map<string, MediaManifestEntry[]>()
  for (const entry of localMedia) {
    const relative = normalizeRelative(entry.relativePath)
    byPath.set(relative.toLowerCase(), entry)
    const basename = path.posix.basename(relative).toLowerCase()
    const bucket = basenameBuckets.get(basename) ?? []
    bucket.push(entry)
    basenameBuckets.set(basename, bucket)
  }
  const uniqueByBasename = new Map<string, MediaManifestEntry>()
  for (const [basename, entries] of basenameBuckets) {
    if (entries.length === 1) uniqueByBasename.set(basename, entries[0])
  }
  return { byPath, uniqueByBasename }
}

function resolveLocalEntry(
  raw: Record<string, unknown>,
  lookup: ReturnType<typeof localLookup>,
): MediaManifestEntry | null {
  const directCandidates = [raw.fcSourcePath, raw.fcSourceUrl]
    .map(candidateUploadPath)
    .filter((value): value is string => Boolean(value))
  for (const candidate of directCandidates) {
    const match = lookup.byPath.get(candidate.toLowerCase())
    if (match) return match
  }

  for (const value of [raw.fcSourcePath, raw.fcSourceUrl]) {
    const filename = filenameFromLocator(value)
    if (!filename) continue
    const match = lookup.uniqueByBasename.get(filename.toLowerCase())
    if (match) return match
  }
  return null
}

function operationTargetField(operation: ProposedPayloadOperation): string | null {
  const raw = operation.source.raw ?? {}
  if (typeof raw.targetField === 'string' && raw.targetField) return raw.targetField
  if (operation.collection === 'payload_private_media' || operation.collection === 'payload_media') return null
  return null
}

function operationStorageClass(operation: ProposedPayloadOperation): LegacyMediaStorageClass {
  return operation.collection === 'payload_private_media' ? 'private' : 'public'
}

function isBinaryImportOperation(operation: ProposedPayloadOperation): boolean {
  return operation.source.raw?.binaryImportRequired === true
}

function binaryImportBlocker(operation: ProposedPayloadOperation): string | null {
  return operation.blockers.find((blocker) => binaryImportBlockerPattern.test(blocker) && !schemaBlockerPattern.test(blocker)) ?? null
}

function schemaBlockers(operation: ProposedPayloadOperation): string[] {
  return operation.blockers.filter((blocker) => schemaBlockerPattern.test(blocker))
}

function binaryRecord(
  operation: ProposedPayloadOperation,
  lookup: ReturnType<typeof localLookup>,
): LegacyMediaManifestRecord {
  const raw = operation.source.raw ?? {}
  const localEntry = resolveLocalEntry(raw, lookup)
  const driver = typeof raw.fcDriver === 'string' ? raw.fcDriver.toLowerCase() : ''
  const remoteLocator = sanitizedRemoteLocator(raw.fcSourceUrl) ?? sanitizedRemoteLocator(raw.fcSourcePath)
  const localExpected = driver === 'local' || driver === 'wordpress' || Boolean(candidateUploadPath(raw.fcSourcePath))
  const locatorClass: LegacyMediaLocatorClass = localEntry
    ? 'fluentcommunity_local_path'
    : localExpected
      ? 'missing_local_source'
      : 'external_or_remote_source'
  const targetFields = Array.isArray(raw.targetFields)
    ? raw.targetFields.filter((value): value is string => typeof value === 'string')
    : []

  return {
    manifestId: stableId('media', `${operation.operationId}:${localEntry?.sha256 ?? remoteLocator ?? 'missing'}`),
    idempotencyKey: operation.idempotencyKey,
    recordKind: 'binary_import_intent',
    sourceSystem: operation.source.system,
    sourceType: operation.source.entityType,
    sourceIds: [...operation.source.sourceIds],
    locatorClass,
    localRelativePath: localEntry ? normalizeRelative(localEntry.relativePath) : null,
    sourceLocator: remoteLocator,
    targetOperationId: operation.operationId,
    targetCollection: typeof raw.targetCollection === 'string' ? raw.targetCollection : operation.collection,
    targetField: operationTargetField(operation),
    targetGlobal: typeof raw.targetGlobal === 'string' ? raw.targetGlobal : null,
    targetFields,
    storageClass: operationStorageClass(operation),
    expectedMime: typeof raw.mediaType === 'string' ? raw.mediaType : null,
    localFileExists: Boolean(localEntry),
    bytes: localEntry?.bytes ?? null,
    sha256: localEntry?.sha256 ?? null,
    plannerBlockers: [...operation.blockers],
    schemaBlockers: schemaBlockers(operation),
    binaryImportBlocker: binaryImportBlocker(operation),
    archiveDisposition: 'migration-targeted',
    provenanceReason: localEntry
      ? 'Planner requires a binary import and the source resolves to a unique local uploads file.'
      : locatorClass === 'missing_local_source'
        ? 'Planner requires a binary import from a local-class source but no unique local uploads file resolves.'
        : 'Planner requires a binary import from a remote/external FluentCommunity source; no network fetch is performed.',
  }
}

export function buildLegacyMediaImportManifest(input: BuildLegacyMediaImportManifestInput): LegacyMediaImportManifest {
  const lookup = localLookup(input.localMedia)
  const records: LegacyMediaManifestRecord[] = []
  const targetedLocalPaths = new Set<string>()
  const referencedLocalPaths = new Set<string>()

  const binaryOperations = input.operationPlan.operations.filter(isBinaryImportOperation)
  for (const operation of binaryOperations) {
    const record = binaryRecord(operation, lookup)
    records.push(record)
    if (record.localRelativePath) targetedLocalPaths.add(record.localRelativePath.toLowerCase())
  }

  for (const mapping of input.attachments.mappings) {
    const localRelativePath = mapping.localRelativePath ? normalizeRelative(mapping.localRelativePath) : null
    const localEntry = localRelativePath ? lookup.byPath.get(localRelativePath.toLowerCase()) ?? null : null
    if (localRelativePath) referencedLocalPaths.add(localRelativePath.toLowerCase())
    records.push({
      manifestId: stableId('wxr', `${mapping.postId}:${mapping.sourceRelativePath}:${localRelativePath ?? 'missing'}`),
      idempotencyKey: `wxr_attachment:${mapping.postId}`,
      recordKind: 'wxr_attachment_reference',
      sourceSystem: 'wordpress',
      sourceType: 'wxr_attachment',
      sourceIds: [mapping.postId],
      locatorClass: localEntry ? 'local_wxr_attachment' : 'missing_local_source',
      localRelativePath,
      sourceLocator: mapping.sourceRelativePath ? normalizeRelative(mapping.sourceRelativePath) : null,
      targetOperationId: null,
      targetCollection: null,
      targetField: null,
      targetGlobal: null,
      targetFields: [],
      storageClass: 'reference_only',
      expectedMime: null,
      localFileExists: Boolean(localEntry),
      bytes: localEntry?.bytes ?? null,
      sha256: localEntry?.sha256 ?? null,
      plannerBlockers: [],
      schemaBlockers: [],
      binaryImportBlocker: null,
      archiveDisposition: 'source-reference-only',
      provenanceReason: localEntry
        ? 'WordPress WXR attachment is mapped to the local uploads archive; no standalone Payload media semantics are invented here.'
        : 'WordPress WXR attachment has no mapped local uploads file.',
    })
  }

  for (const entry of input.localMedia) {
    const relativePath = normalizeRelative(entry.relativePath)
    const key = relativePath.toLowerCase()
    const archiveDisposition: LegacyMediaArchiveDisposition = targetedLocalPaths.has(key)
      ? 'migration-targeted'
      : referencedLocalPaths.has(key)
        ? 'source-reference-only'
        : 'archive-only-unmatched'
    const locatorClass: LegacyMediaLocatorClass = archiveDisposition === 'archive-only-unmatched'
      ? 'archive_only_unmatched'
      : 'local_upload_file'
    records.push({
      manifestId: stableId('local', `${relativePath}:${entry.sha256 ?? entry.exclusionReason ?? entry.bytes}`),
      idempotencyKey: `local_upload:${relativePath}`,
      recordKind: 'local_file_ledger',
      sourceSystem: 'wordpress_media_archive',
      sourceType: entry.importable ? 'local_upload_file' : 'local_upload_excluded_file',
      sourceIds: [],
      locatorClass,
      localRelativePath: relativePath,
      sourceLocator: null,
      targetOperationId: null,
      targetCollection: null,
      targetField: null,
      targetGlobal: null,
      targetFields: [],
      storageClass: archiveDisposition === 'archive-only-unmatched' ? 'archive_only' : 'reference_only',
      expectedMime: null,
      localFileExists: true,
      bytes: entry.bytes,
      sha256: entry.sha256,
      plannerBlockers: entry.importable ? [] : [entry.exclusionReason ?? 'not_importable'],
      schemaBlockers: [],
      binaryImportBlocker: null,
      archiveDisposition,
      provenanceReason: archiveDisposition === 'migration-targeted'
        ? 'Local uploads file is referenced by at least one binary-import intent.'
        : archiveDisposition === 'source-reference-only'
          ? 'Local uploads file is represented by WordPress source evidence but has no standalone binary-import target.'
          : 'Valid local archive entry is retained explicitly so unmatched legacy media is not silently lost.',
    })
  }

  records.sort((a, b) => a.manifestId.localeCompare(b.manifestId))

  const binaryRecords = records.filter((record) => record.recordKind === 'binary_import_intent')
  const wxrRecords = records.filter((record) => record.recordKind === 'wxr_attachment_reference')
  const localLedger = records.filter((record) => record.recordKind === 'local_file_ledger')

  return {
    manifestVersion: '1.0',
    mutationMode: 'none',
    containsPii: false,
    records,
    summary: {
      records: records.length,
      binaryImportIntents: binaryRecords.length,
      localResolvableBinaries: binaryRecords.filter((record) => record.localFileExists).length,
      externalOrRemoteSourceBinaries: binaryRecords.filter((record) => record.locatorClass === 'external_or_remote_source').length,
      missingLocalSourceBinaries: binaryRecords.filter((record) => record.locatorClass === 'missing_local_source').length,
      referenceOnlyRecords: wxrRecords.length,
      archiveOnlyUnmatchedLocalFiles: localLedger.filter((record) => record.archiveDisposition === 'archive-only-unmatched').length,
      localFiles: localLedger.length,
      importableLocalFiles: input.localMedia.filter((entry) => entry.importable).length,
      excludedLocalFiles: input.localMedia.filter((entry) => !entry.importable).length,
      publicBinaryImports: binaryRecords.filter((record) => record.storageClass === 'public').length,
      privateBinaryImports: binaryRecords.filter((record) => record.storageClass === 'private').length,
      wxrSourceAttachments: input.attachments.sourceAttachmentCount,
      wxrMappedAttachments: input.attachments.mappedCount,
      wxrMissingAttachments: input.attachments.missingCount,
      wxrManifestRecords: wxrRecords.length,
      plannerBinaryOperationCoverage: binaryRecords.filter((record) => Boolean(record.targetOperationId)).length,
      plannerBinaryOperations: binaryOperations.length,
    },
  }
}

export function assertLegacyMediaImportManifest(manifest: LegacyMediaImportManifest): void {
  if (manifest.mutationMode !== 'none' || manifest.containsPii !== false) throw new Error('MEDIA_MANIFEST_SAFETY_MODE_INVALID')
  if (manifest.summary.plannerBinaryOperationCoverage !== manifest.summary.plannerBinaryOperations) {
    throw new Error('MEDIA_MANIFEST_BINARY_OPERATION_COVERAGE_MISMATCH')
  }
  if (manifest.summary.wxrManifestRecords !== manifest.summary.wxrSourceAttachments) {
    throw new Error('MEDIA_MANIFEST_WXR_RECORD_COVERAGE_MISMATCH')
  }
  if (manifest.summary.wxrMissingAttachments !== 0) throw new Error('MEDIA_MANIFEST_WXR_ATTACHMENT_MISSING')
  if (manifest.summary.localFiles !== manifest.records.filter((record) => record.recordKind === 'local_file_ledger').length) {
    throw new Error('MEDIA_MANIFEST_LOCAL_LEDGER_COVERAGE_MISMATCH')
  }
  const localLedgerPaths = manifest.records
    .filter((record) => record.recordKind === 'local_file_ledger')
    .map((record) => record.localRelativePath)
  if (new Set(localLedgerPaths).size !== localLedgerPaths.length) throw new Error('MEDIA_MANIFEST_DUPLICATE_LOCAL_LEDGER_PATH')
  if (manifest.records.some((record) => record.localRelativePath?.startsWith('/') || record.localRelativePath?.split('/').includes('..'))) {
    throw new Error('MEDIA_MANIFEST_UNSAFE_LOCAL_PATH')
  }
  if (manifest.records.some((record) => record.storageClass === 'private' && record.targetCollection !== 'payload_private_media')) {
    throw new Error('MEDIA_MANIFEST_PRIVATE_STORAGE_DOWNGRADE')
  }
}
