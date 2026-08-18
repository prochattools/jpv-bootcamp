import { createHash } from 'node:crypto'

import type {
  LegacyMediaImportManifest,
  LegacyMediaManifestRecord,
  LegacyMediaStorageClass,
} from './legacyMediaImportManifest'
import type { LegacyPayloadOperationPlan } from './legacyPayloadOperationPlan'

export type LegacyMediaExecutionDisposition =
  | 'ready_after_write_authorization'
  | 'requires_remote_source_acquisition'
  | 'schema_blocked'
  | 'reference_only'
  | 'archive_only'
  | 'source_missing_blocked'

export const LEGACY_MEDIA_EXECUTION_PHASES = [
  'source_validation',
  'media_document_create',
  'media_identity_verification',
  'dependent_relationship_apply',
  'rollback_ledger_checkpoint',
] as const

export type LegacyMediaExecutionPhase = (typeof LEGACY_MEDIA_EXECUTION_PHASES)[number]

export interface LegacyMediaRollbackLedgerTemplate {
  rollbackLedgerId: string
  executionIntentId: string
  sourceManifestId: string
  createdTargetCollection: string
  createdTargetDocumentId: null
  createdStorageKey: null
  dependentRelationshipTarget: {
    operationId: string | null
    targetField: string | null
    targetGlobal: string | null
    targetFields: string[]
  }
  preExistingTarget: false
  createdByMigrationPacket: true
  sha256: string | null
  executionTimestamp: null
  deletionEligibleOnlyIfCreatedByPacket: true
}

export interface LegacyMediaExecutionEntry {
  executionEntryId: string
  isUploadIntent: boolean
  sourceManifestId: string
  sourceSha256: string | null
  sourceBytes: number | null
  plannerOperationId: string | null
  idempotencyKey: string
  sourceLocatorClass: LegacyMediaManifestRecord['locatorClass']
  sourceLocator: string | null
  localRelativePath: string | null
  targetCollection: string | null
  targetField: string | null
  targetGlobal: string | null
  targetFields: string[]
  storageClass: LegacyMediaStorageClass
  dependencyOperationIds: string[]
  schemaPrerequisites: string[]
  binaryImportBlockers: string[]
  remoteSourceRequired: boolean
  phases: LegacyMediaExecutionPhase[]
  disposition: LegacyMediaExecutionDisposition
  provenanceReason: string
  rollbackLedger: LegacyMediaRollbackLedgerTemplate | null
}

export interface LegacyMediaDuplicateChecksumGroup {
  sha256: string
  executionEntryIds: string[]
  targetCollections: string[]
  storageClasses: LegacyMediaStorageClass[]
  automaticCoalescingAllowed: false
}

export interface LegacyMediaImportExecutionPlan {
  planVersion: '1.0'
  mutationMode: 'none'
  executionAuthorized: false
  networkAuthorized: false
  containsPii: false
  phases: readonly LegacyMediaExecutionPhase[]
  entries: LegacyMediaExecutionEntry[]
  duplicateChecksumGroups: LegacyMediaDuplicateChecksumGroup[]
  summary: {
    entries: number
    executionIntents: number
    readyAfterWriteAuthorization: number
    requiresRemoteSourceAcquisition: number
    schemaBlocked: number
    referenceOnly: number
    archiveOnly: number
    sourceMissingBlocked: number
    publicExecutionIntents: number
    privateExecutionIntents: number
    relationshipBearingIntents: number
    rollbackLedgerEntries: number
    duplicateChecksumGroups: number
  }
}

export interface BuildLegacyMediaImportExecutionPlanInput {
  manifest: LegacyMediaImportManifest
  operationPlan: LegacyPayloadOperationPlan
}

function stableId(prefix: string, value: string): string {
  return `${prefix}_${createHash('sha256').update(value).digest('hex').slice(0, 24)}`
}

function determineDisposition(record: LegacyMediaManifestRecord): LegacyMediaExecutionDisposition {
  if (record.recordKind === 'wxr_attachment_reference') return 'reference_only'
  if (record.recordKind === 'local_file_ledger') {
    return record.archiveDisposition === 'archive-only-unmatched' ? 'archive_only' : 'reference_only'
  }
  if (record.schemaBlockers.length > 0) return 'schema_blocked'
  if (record.locatorClass === 'missing_local_source') return 'source_missing_blocked'
  if (record.locatorClass === 'external_or_remote_source') return 'requires_remote_source_acquisition'
  return 'ready_after_write_authorization'
}

function rollbackTemplate(entry: Omit<LegacyMediaExecutionEntry, 'rollbackLedger'>): LegacyMediaRollbackLedgerTemplate | null {
  if (!entry.isUploadIntent || !entry.targetCollection) return null
  return {
    rollbackLedgerId: stableId('rollback', `${entry.executionEntryId}:${entry.targetCollection}`),
    executionIntentId: entry.executionEntryId,
    sourceManifestId: entry.sourceManifestId,
    createdTargetCollection: entry.targetCollection,
    createdTargetDocumentId: null,
    createdStorageKey: null,
    dependentRelationshipTarget: {
      operationId: entry.plannerOperationId,
      targetField: entry.targetField,
      targetGlobal: entry.targetGlobal,
      targetFields: [...entry.targetFields],
    },
    preExistingTarget: false,
    createdByMigrationPacket: true,
    sha256: entry.sourceSha256,
    executionTimestamp: null,
    deletionEligibleOnlyIfCreatedByPacket: true,
  }
}

function compileEntry(
  record: LegacyMediaManifestRecord,
  operationPlan: LegacyPayloadOperationPlan,
): LegacyMediaExecutionEntry {
  const isUploadIntent = record.recordKind === 'binary_import_intent'
  const plannerOperation = record.targetOperationId
    ? operationPlan.operations.find((operation) => operation.operationId === record.targetOperationId)
    : undefined
  if (record.targetOperationId && !plannerOperation) {
    throw new Error(`MEDIA_EXECUTION_PLAN_OPERATION_NOT_FOUND ${record.targetOperationId}`)
  }

  const disposition = determineDisposition(record)
  const sourceIdentity = record.sha256 ?? record.sourceLocator ?? record.localRelativePath ?? 'no-source-locator'
  const executionEntryId = stableId(
    isUploadIntent ? 'media_exec' : 'media_passive',
    `${record.manifestId}:${record.targetOperationId ?? 'none'}:${sourceIdentity}`,
  )
  const base: Omit<LegacyMediaExecutionEntry, 'rollbackLedger'> = {
    executionEntryId,
    isUploadIntent,
    sourceManifestId: record.manifestId,
    sourceSha256: record.sha256,
    sourceBytes: record.bytes,
    plannerOperationId: record.targetOperationId,
    idempotencyKey: isUploadIntent
      ? `media_execution:${record.idempotencyKey}:${record.sha256 ?? stableId('source', sourceIdentity)}`
      : `media_passive:${record.idempotencyKey}`,
    sourceLocatorClass: record.locatorClass,
    sourceLocator: record.sourceLocator,
    localRelativePath: record.localRelativePath,
    targetCollection: record.targetCollection,
    targetField: record.targetField,
    targetGlobal: record.targetGlobal,
    targetFields: [...record.targetFields],
    storageClass: record.storageClass,
    dependencyOperationIds: plannerOperation ? [...plannerOperation.dependsOn].sort() : [],
    schemaPrerequisites: [...record.schemaBlockers].sort(),
    binaryImportBlockers: record.binaryImportBlocker ? [record.binaryImportBlocker] : [],
    remoteSourceRequired: record.locatorClass === 'external_or_remote_source',
    phases: isUploadIntent ? [...LEGACY_MEDIA_EXECUTION_PHASES] : [],
    disposition,
    provenanceReason: record.provenanceReason,
  }
  return { ...base, rollbackLedger: rollbackTemplate(base) }
}

function duplicateGroups(entries: LegacyMediaExecutionEntry[]): LegacyMediaDuplicateChecksumGroup[] {
  const groups = new Map<string, LegacyMediaExecutionEntry[]>()
  for (const entry of entries) {
    if (!entry.isUploadIntent || !entry.sourceSha256) continue
    const bucket = groups.get(entry.sourceSha256) ?? []
    bucket.push(entry)
    groups.set(entry.sourceSha256, bucket)
  }
  return [...groups.entries()]
    .filter(([, items]) => items.length > 1)
    .map(([sha256, items]) => ({
      sha256,
      executionEntryIds: items.map((item) => item.executionEntryId).sort(),
      targetCollections: [...new Set(items.map((item) => item.targetCollection).filter((value): value is string => Boolean(value)))].sort(),
      storageClasses: [...new Set(items.map((item) => item.storageClass))].sort(),
      automaticCoalescingAllowed: false as const,
    }))
    .sort((a, b) => a.sha256.localeCompare(b.sha256))
}

export function buildLegacyMediaImportExecutionPlan(
  input: BuildLegacyMediaImportExecutionPlanInput,
): LegacyMediaImportExecutionPlan {
  const entries = input.manifest.records
    .map((record) => compileEntry(record, input.operationPlan))
    .sort((a, b) => a.executionEntryId.localeCompare(b.executionEntryId))
  const executionIntents = entries.filter((entry) => entry.isUploadIntent)
  const duplicateChecksumGroups = duplicateGroups(executionIntents)

  const plan: LegacyMediaImportExecutionPlan = {
    planVersion: '1.0',
    mutationMode: 'none',
    executionAuthorized: false,
    networkAuthorized: false,
    containsPii: false,
    phases: LEGACY_MEDIA_EXECUTION_PHASES,
    entries,
    duplicateChecksumGroups,
    summary: {
      entries: entries.length,
      executionIntents: executionIntents.length,
      readyAfterWriteAuthorization: executionIntents.filter((entry) => entry.disposition === 'ready_after_write_authorization').length,
      requiresRemoteSourceAcquisition: executionIntents.filter((entry) => entry.disposition === 'requires_remote_source_acquisition').length,
      schemaBlocked: executionIntents.filter((entry) => entry.disposition === 'schema_blocked').length,
      referenceOnly: entries.filter((entry) => entry.disposition === 'reference_only').length,
      archiveOnly: entries.filter((entry) => entry.disposition === 'archive_only').length,
      sourceMissingBlocked: executionIntents.filter((entry) => entry.disposition === 'source_missing_blocked').length,
      publicExecutionIntents: executionIntents.filter((entry) => entry.storageClass === 'public').length,
      privateExecutionIntents: executionIntents.filter((entry) => entry.storageClass === 'private').length,
      relationshipBearingIntents: executionIntents.filter((entry) => Boolean(entry.targetField || entry.targetGlobal || entry.targetFields.length)).length,
      rollbackLedgerEntries: executionIntents.filter((entry) => Boolean(entry.rollbackLedger)).length,
      duplicateChecksumGroups: duplicateChecksumGroups.length,
    },
  }
  assertLegacyMediaImportExecutionPlan(plan, input.manifest)
  return plan
}

export function assertLegacyMediaImportExecutionPlan(
  plan: LegacyMediaImportExecutionPlan,
  manifest: LegacyMediaImportManifest,
): void {
  if (plan.mutationMode !== 'none' || plan.executionAuthorized || plan.networkAuthorized || plan.containsPii) {
    throw new Error('MEDIA_EXECUTION_PLAN_SAFETY_MODE_INVALID')
  }
  if (plan.summary.entries !== manifest.records.length) throw new Error('MEDIA_EXECUTION_PLAN_MANIFEST_COVERAGE_MISMATCH')
  if (plan.summary.executionIntents !== manifest.summary.binaryImportIntents) throw new Error('MEDIA_EXECUTION_PLAN_BINARY_COVERAGE_MISMATCH')
  if (plan.entries.some((entry) => entry.storageClass === 'private' && entry.targetCollection !== 'payload_private_media')) {
    throw new Error('MEDIA_EXECUTION_PLAN_PRIVATE_STORAGE_DOWNGRADE')
  }
  if (plan.entries.some((entry) => !entry.isUploadIntent && entry.rollbackLedger !== null)) {
    throw new Error('MEDIA_EXECUTION_PLAN_PASSIVE_ROLLBACK_LEDGER_FORBIDDEN')
  }
  if (plan.entries.some((entry) => entry.isUploadIntent && entry.rollbackLedger === null)) {
    throw new Error('MEDIA_EXECUTION_PLAN_ROLLBACK_LEDGER_MISSING')
  }
  if (plan.entries.some((entry) => entry.rollbackLedger !== null && (entry.rollbackLedger.preExistingTarget !== false || entry.rollbackLedger.createdByMigrationPacket !== true))) {
    throw new Error('MEDIA_EXECUTION_PLAN_PREEXISTING_DELETE_RISK')
  }
  const uploadManifestIds = plan.entries.filter((entry) => entry.isUploadIntent).map((entry) => entry.sourceManifestId)
  if (new Set(uploadManifestIds).size !== uploadManifestIds.length) throw new Error('MEDIA_EXECUTION_PLAN_DUPLICATE_BINARY_DISPOSITION')
  if (plan.entries.some((entry) => entry.disposition === 'schema_blocked' && entry.schemaPrerequisites.length === 0)) {
    throw new Error('MEDIA_EXECUTION_PLAN_SCHEMA_BLOCKER_MISSING')
  }
}
