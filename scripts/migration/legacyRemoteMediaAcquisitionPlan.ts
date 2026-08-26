import { createHash } from 'node:crypto'

import type { LegacyMediaImportExecutionPlan } from './legacyMediaImportExecutionPlan'
import type { LegacyMediaImportManifest } from './legacyMediaImportManifest'
import type { LegacyPayloadOperationPlan } from './legacyPayloadOperationPlan'

export type LegacyRemoteMediaAuthRequirement =
  | 'provider_credentials_required'
  | 'no_authentication_source_proven'
  | 'authentication_unknown'

export type LegacyRemoteMediaAcquisitionMethod =
  | 'authenticated_object_storage_download'
  | 'unauthenticated_https_download'
  | 'blocked_unknown_acquisition_method'

export type LegacyRemoteMediaAcquisitionStatus =
  | 'acquisition_definition_ready'
  | 'fail_closed_additional_evidence_required'

export interface LegacyRemoteMediaAcquisitionDefinition {
  acquisitionId: string
  executionIntentId: string
  sourceManifestId: string
  plannerOperationId: string
  locatorClass: 'external_or_remote_source'
  locatorProtocol: 'https' | 'http' | 'unsupported'
  locatorHostClass: 'legacy_origin' | 'object_storage_origin' | 'other_remote_origin'
  sanitizedSourceLocator: string
  sourceDriverClass: string
  targetCollection: string
  targetField: string | null
  targetGlobal: string | null
  targetFields: string[]
  storageClass: 'public' | 'private'
  expectedMime: string | null
  expectedSha256: string | null
  expectedBytes: number | null
  authenticationRequirement: LegacyRemoteMediaAuthRequirement
  acquisitionMethod: LegacyRemoteMediaAcquisitionMethod
  verificationRequirements: string[]
  schemaPrerequisites: string[]
  relationshipPrerequisites: string[]
  idempotencyKey: string
  status: LegacyRemoteMediaAcquisitionStatus
  failureReasons: string[]
  provenance: string
}

export interface LegacyRemoteMediaAcquisitionPlan {
  planVersion: '1.0'
  mutationMode: 'none'
  networkAuthorized: false
  containsPii: false
  definitions: LegacyRemoteMediaAcquisitionDefinition[]
  summary: {
    remoteIntents: number
    publicRemoteIntents: number
    privateRemoteIntents: number
    authenticatedRemoteIntents: number
    unauthenticatedSourceProvenRemoteIntents: number
    authenticationUnknownRemoteIntents: number
    knownChecksumRemoteIntents: number
    knownBytesRemoteIntents: number
    acquisitionDefinitionReady: number
    failClosedAdditionalEvidenceRequired: number
    httpsLocators: number
    httpLocators: number
    unsupportedLocators: number
    authenticatedObjectStorageDownloads: number
    unauthenticatedHttpsDownloads: number
    blockedUnknownAcquisitionMethods: number
    sourceDriverClasses: Record<string, number>
    locatorHostClasses: Record<string, number>
  }
}

export interface BuildLegacyRemoteMediaAcquisitionPlanInput {
  executionPlan: LegacyMediaImportExecutionPlan
  manifest: LegacyMediaImportManifest
  operationPlan: LegacyPayloadOperationPlan
}

function stableId(prefix: string, value: string): string {
  return `${prefix}_${createHash('sha256').update(value).digest('hex').slice(0, 24)}`
}

function sourceDriverClass(rawDriver: unknown): string {
  if (typeof rawDriver !== 'string' || !rawDriver.trim()) return 'unknown'
  return rawDriver.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '_')
}

function authenticationRequirement(driver: string): LegacyRemoteMediaAuthRequirement {
  if (['s3', 'r2', 'cloudflare_r2', 'cloudflare-r2', 'amazon_s3', 'amazon-s3'].includes(driver)) {
    return 'provider_credentials_required'
  }
  if (['public', 'public_url', 'public-url', 'url', 'http', 'https'].includes(driver)) {
    return 'no_authentication_source_proven'
  }
  return 'authentication_unknown'
}

function parseLocator(locator: string): {
  protocol: 'https' | 'http' | 'unsupported'
  hostClass: 'legacy_origin' | 'object_storage_origin' | 'other_remote_origin'
} {
  try {
    const url = new URL(locator)
    const protocol = url.protocol === 'https:' ? 'https' : url.protocol === 'http:' ? 'http' : 'unsupported'
    const host = url.hostname.toLowerCase()
    const hostClass = /(?:s3|r2|cloudflarestorage|amazonaws|storage)\./.test(host) || /(?:s3|r2|storage)/.test(host)
      ? 'object_storage_origin'
      : /jpv|bootcamp|wordpress|wp-content/.test(`${host}${url.pathname.toLowerCase()}`)
        ? 'legacy_origin'
        : 'other_remote_origin'
    return { protocol, hostClass }
  } catch {
    return { protocol: 'unsupported', hostClass: 'other_remote_origin' }
  }
}

function acquisitionMethod(
  auth: LegacyRemoteMediaAuthRequirement,
  protocol: 'https' | 'http' | 'unsupported',
): LegacyRemoteMediaAcquisitionMethod {
  if (auth === 'provider_credentials_required' && protocol === 'https') return 'authenticated_object_storage_download'
  if (auth === 'no_authentication_source_proven' && protocol === 'https') return 'unauthenticated_https_download'
  return 'blocked_unknown_acquisition_method'
}

function verificationRequirements(mime: string | null, sha256: string | null, bytes: number | null): string[] {
  return [
    'compute_sha256_after_acquisition',
    'verify_nonzero_bytes_after_acquisition',
    ...(mime ? [`verify_mime_equals:${mime}`] : ['record_detected_mime_after_acquisition']),
    ...(sha256 ? [`verify_sha256_equals:${sha256}`] : ['pin_computed_sha256_before_import']),
    ...(bytes !== null ? [`verify_bytes_equals:${bytes}`] : ['record_acquired_bytes_before_import']),
  ]
}

export function buildLegacyRemoteMediaAcquisitionPlan(
  input: BuildLegacyRemoteMediaAcquisitionPlanInput,
): LegacyRemoteMediaAcquisitionPlan {
  const manifestById = new Map(input.manifest.records.map((record) => [record.manifestId, record]))
  const operationById = new Map(input.operationPlan.operations.map((operation) => [operation.operationId, operation]))

  const definitions = input.executionPlan.entries
    .filter((entry) => entry.isUploadIntent && entry.remoteSourceRequired)
    .map((entry): LegacyRemoteMediaAcquisitionDefinition => {
      const manifest = manifestById.get(entry.sourceManifestId)
      if (!manifest) throw new Error(`REMOTE_MEDIA_MANIFEST_RECORD_MISSING ${entry.sourceManifestId}`)
      if (!entry.plannerOperationId) throw new Error(`REMOTE_MEDIA_PLANNER_OPERATION_ID_MISSING ${entry.executionEntryId}`)
      const operation = operationById.get(entry.plannerOperationId)
      if (!operation) throw new Error(`REMOTE_MEDIA_PLANNER_OPERATION_MISSING ${entry.plannerOperationId}`)
      if (!entry.sourceLocator) throw new Error(`REMOTE_MEDIA_LOCATOR_MISSING ${entry.executionEntryId}`)
      if (!entry.targetCollection) throw new Error(`REMOTE_MEDIA_TARGET_MISSING ${entry.executionEntryId}`)
      if (entry.storageClass !== 'public' && entry.storageClass !== 'private') {
        throw new Error(`REMOTE_MEDIA_STORAGE_CLASS_AMBIGUOUS ${entry.executionEntryId}`)
      }

      const driver = sourceDriverClass(operation.source.raw?.fcDriver)
      const auth = authenticationRequirement(driver)
      const locator = parseLocator(entry.sourceLocator)
      const method = acquisitionMethod(auth, locator.protocol)
      const failureReasons = [
        ...(locator.protocol !== 'https' ? [`unsupported_or_insecure_protocol:${locator.protocol}`] : []),
        ...(auth === 'authentication_unknown' ? ['authentication_requirement_not_source_proven'] : []),
        ...(method === 'blocked_unknown_acquisition_method' ? ['acquisition_method_not_deterministic'] : []),
      ]
      const status: LegacyRemoteMediaAcquisitionStatus = failureReasons.length === 0
        ? 'acquisition_definition_ready'
        : 'fail_closed_additional_evidence_required'

      return {
        acquisitionId: stableId('remote_acq', `${entry.executionEntryId}:${entry.sourceLocator}:${driver}`),
        executionIntentId: entry.executionEntryId,
        sourceManifestId: entry.sourceManifestId,
        plannerOperationId: entry.plannerOperationId,
        locatorClass: 'external_or_remote_source',
        locatorProtocol: locator.protocol,
        locatorHostClass: locator.hostClass,
        sanitizedSourceLocator: entry.sourceLocator,
        sourceDriverClass: driver,
        targetCollection: entry.targetCollection,
        targetField: entry.targetField,
        targetGlobal: entry.targetGlobal,
        targetFields: [...entry.targetFields],
        storageClass: entry.storageClass,
        expectedMime: manifest.expectedMime,
        expectedSha256: entry.sourceSha256,
        expectedBytes: entry.sourceBytes,
        authenticationRequirement: auth,
        acquisitionMethod: method,
        verificationRequirements: verificationRequirements(manifest.expectedMime, entry.sourceSha256, entry.sourceBytes),
        schemaPrerequisites: [...entry.schemaPrerequisites],
        relationshipPrerequisites: [...entry.dependencyOperationIds],
        idempotencyKey: `remote_acquisition:${entry.idempotencyKey}`,
        status,
        failureReasons,
        provenance: 'Compiled from sanitized A2 manifest locator plus source-proven planner driver/target metadata; no remote request performed.',
      }
    })
    .sort((a, b) => a.acquisitionId.localeCompare(b.acquisitionId))

  const increment = <T extends string>(values: T[]): Record<string, number> => values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1
    return counts
  }, {})

  const summary: LegacyRemoteMediaAcquisitionPlan['summary'] = {
    remoteIntents: definitions.length,
    publicRemoteIntents: definitions.filter((item) => item.storageClass === 'public').length,
    privateRemoteIntents: definitions.filter((item) => item.storageClass === 'private').length,
    authenticatedRemoteIntents: definitions.filter((item) => item.authenticationRequirement === 'provider_credentials_required').length,
    unauthenticatedSourceProvenRemoteIntents: definitions.filter((item) => item.authenticationRequirement === 'no_authentication_source_proven').length,
    authenticationUnknownRemoteIntents: definitions.filter((item) => item.authenticationRequirement === 'authentication_unknown').length,
    knownChecksumRemoteIntents: definitions.filter((item) => Boolean(item.expectedSha256)).length,
    knownBytesRemoteIntents: definitions.filter((item) => item.expectedBytes !== null).length,
    acquisitionDefinitionReady: definitions.filter((item) => item.status === 'acquisition_definition_ready').length,
    failClosedAdditionalEvidenceRequired: definitions.filter((item) => item.status === 'fail_closed_additional_evidence_required').length,
    httpsLocators: definitions.filter((item) => item.locatorProtocol === 'https').length,
    httpLocators: definitions.filter((item) => item.locatorProtocol === 'http').length,
    unsupportedLocators: definitions.filter((item) => item.locatorProtocol === 'unsupported').length,
    authenticatedObjectStorageDownloads: definitions.filter((item) => item.acquisitionMethod === 'authenticated_object_storage_download').length,
    unauthenticatedHttpsDownloads: definitions.filter((item) => item.acquisitionMethod === 'unauthenticated_https_download').length,
    blockedUnknownAcquisitionMethods: definitions.filter((item) => item.acquisitionMethod === 'blocked_unknown_acquisition_method').length,
    sourceDriverClasses: increment(definitions.map((item) => item.sourceDriverClass)),
    locatorHostClasses: increment(definitions.map((item) => item.locatorHostClass)),
  }

  const plan: LegacyRemoteMediaAcquisitionPlan = {
    planVersion: '1.0',
    mutationMode: 'none',
    networkAuthorized: false,
    containsPii: false,
    definitions,
    summary,
  }
  assertLegacyRemoteMediaAcquisitionPlan(plan)
  return plan
}

export function assertLegacyRemoteMediaAcquisitionPlan(plan: LegacyRemoteMediaAcquisitionPlan): void {
  if (plan.mutationMode !== 'none' || plan.networkAuthorized || plan.containsPii) {
    throw new Error('REMOTE_MEDIA_ACQUISITION_PLAN_SAFETY_INVALID')
  }
  if (plan.definitions.some((item) => !item.sanitizedSourceLocator || item.locatorClass !== 'external_or_remote_source')) {
    throw new Error('REMOTE_MEDIA_ACQUISITION_PLAN_LOCATOR_INVALID')
  }
  if (plan.definitions.some((item) => item.storageClass === 'private' && item.targetCollection !== 'payload_private_media')) {
    throw new Error('REMOTE_MEDIA_ACQUISITION_PLAN_PRIVATE_STORAGE_DOWNGRADE')
  }
  if (plan.definitions.some((item) => item.status === 'acquisition_definition_ready' && item.acquisitionMethod === 'blocked_unknown_acquisition_method')) {
    throw new Error('REMOTE_MEDIA_ACQUISITION_PLAN_READY_WITHOUT_METHOD')
  }
  if (plan.definitions.some((item) => item.locatorProtocol !== 'https' && item.status === 'acquisition_definition_ready')) {
    throw new Error('REMOTE_MEDIA_ACQUISITION_PLAN_INSECURE_READY_LOCATOR')
  }
}
