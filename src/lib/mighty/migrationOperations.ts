import { createHash } from 'node:crypto'

import { normalizeEmail } from '@/lib/normalize-email'

import { JPV_MIGHTY_ACCESS_PLAN_ID } from './config'
import { MAX_CUTOVER_BATCH_SIZE } from './cutoverRunner'

export const MIGRATION_MANIFEST_VERSION = 'mighty-jpv-v1'

export type MigrationEntitlement = 'ALLOWED' | 'DENIED'
export type MigrationAccessState = 'PRESENT' | 'ABSENT' | 'UNKNOWN'
export type MigrationPrivilege = 'ORDINARY' | 'HOST' | 'ADMIN' | 'STAFF' | 'UNKNOWN'
export type MigrationOverlap = 'NONE' | 'OTHER_PLAN' | 'DIRECT_SPACE' | 'PURCHASE' | 'PRIVILEGED' | 'UNKNOWN'

export type MigrationManifestRow = {
	canonicalIdentity: string
	email: string
	stripe: {
		entitlement: MigrationEntitlement
		inputReference: string
	}
	mighty: {
		expectedMemberId: string | null
		currentAccess: MigrationAccessState
		desiredAccess: MigrationEntitlement
	}
	targetPlanId: string
	privilege: MigrationPrivilege
	overlap: MigrationOverlap
	sourceMetadata: {
		kind: 'synthetic_fixture' | 'approved_snapshot'
		reference: string
		capturedAt: string
	}
}

export type MigrationManifestPayload = {
	version: typeof MIGRATION_MANIFEST_VERSION
	targetPlanId: string
	batchSize: number
	rows: MigrationManifestRow[]
}

export type MigrationManifest = MigrationManifestPayload & {
	manifestHash: string
}

export type MigrationAuthorization = {
	authorizationId: string
	ownerApproved: boolean
	manifestHash: string
	targetPlanId: string
	batchSize: number
	productionExecution: boolean
	workerAuthenticated: boolean
}

export type MigrationExecutionRequest = {
	manifest: MigrationManifest
	authorization: MigrationAuthorization
	requestedManifestHash: string
	requestedTargetPlanId: string
	requestedBatchSize: number
	dryRun: boolean
	productionExecution: boolean
	workerAuthenticated: boolean
	populationDiscovery?: boolean
}

export type MigrationAuditRecord = {
	manifestVersion: string
	manifestHash: string
	authorizationId: string
	targetPlanId: string
	batchSize: number
	rowCount: number
	mode: 'DRY_RUN' | 'APPLY'
	mutationPerformed: false
}

export type MigrationPlannedAction = 'NONE' | 'GRANT_PLAN' | 'REVOKE_PLAN' | 'REVIEW_REQUIRED'

export type MigrationPlanDecision = {
	action: MigrationPlannedAction
	reason: string
}

function canonicalJson(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
	if (value && typeof value === 'object') {
		return `{${Object.entries(value as Record<string, unknown>)
			.sort(([left], [right]) => left.localeCompare(right))
			.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
			.join(',')}}`
	}
	return JSON.stringify(value)
}

function manifestPayload(manifest: MigrationManifest | MigrationManifestPayload): MigrationManifestPayload {
	return {
		version: manifest.version,
		targetPlanId: String(manifest.targetPlanId),
		batchSize: manifest.batchSize,
		rows: manifest.rows,
	}
}

export function hashMigrationManifest(payload: MigrationManifestPayload): string {
	return createHash('sha256').update(canonicalJson(manifestPayload(payload))).digest('hex')
}

function assertManifestStructure(payload: MigrationManifestPayload): void {
	if (payload.version !== MIGRATION_MANIFEST_VERSION) throw new Error('migration_manifest_version_unsupported')
	if (String(payload.targetPlanId) !== String(JPV_MIGHTY_ACCESS_PLAN_ID)) throw new Error('migration_manifest_target_plan_mismatch')
	if (!Number.isInteger(payload.batchSize) || payload.batchSize < 1) throw new Error('migration_manifest_batch_size_invalid')
	if (payload.batchSize > MAX_CUTOVER_BATCH_SIZE) throw new Error('migration_manifest_batch_size_exceeds_approved_maximum')
	if (!Array.isArray(payload.rows)) throw new Error('migration_manifest_rows_invalid')
	if (payload.rows.length === 0) throw new Error('migration_manifest_required')

	const identities = new Set<string>()
	const memberIds = new Set<string>()
	for (const row of payload.rows) {
		if (!row || typeof row !== 'object') throw new Error('migration_manifest_row_invalid')
		const email = normalizeEmail(row.email)
		if (!email || email !== row.email) throw new Error('migration_manifest_email_not_canonical')
		if (!row.canonicalIdentity.trim()) throw new Error('migration_manifest_identity_required')
		if (identities.has(row.canonicalIdentity) || identities.has(email)) throw new Error('migration_manifest_duplicate_identity')
		identities.add(row.canonicalIdentity)
		identities.add(email)
		if (row.mighty.expectedMemberId) {
			if (memberIds.has(row.mighty.expectedMemberId)) throw new Error('migration_manifest_duplicate_member_id')
			memberIds.add(row.mighty.expectedMemberId)
		}
		if (String(row.targetPlanId) !== String(payload.targetPlanId)) throw new Error('migration_manifest_row_plan_mismatch')
		if (!['ALLOWED', 'DENIED'].includes(row.stripe.entitlement)) throw new Error('migration_manifest_entitlement_invalid')
		if (!row.stripe.inputReference.trim()) throw new Error('migration_manifest_entitlement_reference_required')
		if (!['PRESENT', 'ABSENT', 'UNKNOWN'].includes(row.mighty.currentAccess)) throw new Error('migration_manifest_access_state_invalid')
		if (!['ALLOWED', 'DENIED'].includes(row.mighty.desiredAccess)) throw new Error('migration_manifest_desired_access_invalid')
		if (!row.sourceMetadata.reference.trim()) throw new Error('migration_manifest_source_reference_required')
		if (!['synthetic_fixture', 'approved_snapshot'].includes(row.sourceMetadata.kind)) throw new Error('migration_manifest_source_kind_invalid')
		if (row.mighty.desiredAccess !== row.stripe.entitlement) throw new Error('migration_manifest_entitlement_state_mismatch')
	}
}

export function createMigrationManifest(payload: MigrationManifestPayload): MigrationManifest {
	assertManifestStructure(payload)
	return { ...payload, targetPlanId: String(payload.targetPlanId), manifestHash: hashMigrationManifest(payload) }
}

export function assertMigrationExecutionAllowed(request: MigrationExecutionRequest): MigrationAuditRecord {
	const { manifest, authorization } = request
	assertManifestStructure(manifestPayload(manifest))
	const calculatedHash = hashMigrationManifest(manifest)
	if (calculatedHash !== manifest.manifestHash) throw new Error('migration_manifest_hash_invalid')
	if (!authorization.ownerApproved || !authorization.authorizationId.trim()) throw new Error('migration_owner_authorization_required')
	if (request.requestedManifestHash !== manifest.manifestHash || authorization.manifestHash !== manifest.manifestHash) {
		throw new Error('migration_manifest_approval_mismatch')
	}
	if (request.requestedTargetPlanId !== String(JPV_MIGHTY_ACCESS_PLAN_ID) || authorization.targetPlanId !== manifest.targetPlanId) {
		throw new Error('migration_target_plan_mismatch')
	}
	if (request.requestedBatchSize !== manifest.batchSize || authorization.batchSize !== manifest.batchSize) {
		throw new Error('migration_batch_approval_mismatch')
	}
	if (request.productionExecution !== !request.dryRun || authorization.productionExecution !== request.productionExecution) {
		throw new Error('migration_production_execution_flag_mismatch')
	}
	if (!request.workerAuthenticated || !authorization.workerAuthenticated) throw new Error('migration_worker_authentication_required')
	if (request.populationDiscovery) throw new Error('migration_population_discovery_forbidden')
	if (manifest.rows.some((row) => row.privilege !== 'ORDINARY')) throw new Error('migration_privilege_review_required')
	if (manifest.rows.some((row) => row.overlap !== 'NONE')) throw new Error('migration_overlap_review_required')

	return {
		manifestVersion: manifest.version,
		manifestHash: manifest.manifestHash,
		authorizationId: authorization.authorizationId,
		targetPlanId: manifest.targetPlanId,
		batchSize: manifest.batchSize,
		rowCount: manifest.rows.length,
		mode: request.dryRun ? 'DRY_RUN' : 'APPLY',
		mutationPerformed: false,
	}
}

export function planMigrationRow(params: {
	row: MigrationManifestRow
	currentEntitlement: MigrationEntitlement
}): MigrationPlanDecision {
	const { row } = params
	if (params.currentEntitlement !== row.stripe.entitlement) return { action: 'REVIEW_REQUIRED', reason: 'current_entitlement_mismatch' }
	if (row.privilege !== 'ORDINARY') return { action: 'REVIEW_REQUIRED', reason: 'privilege_review_required' }
	if (row.overlap !== 'NONE') return { action: 'REVIEW_REQUIRED', reason: 'overlap_review_required' }
	if (row.mighty.desiredAccess === 'ALLOWED') {
		return row.mighty.currentAccess === 'PRESENT'
			? { action: 'NONE', reason: 'target_plan_already_present' }
			: row.mighty.currentAccess === 'ABSENT'
				? { action: 'GRANT_PLAN', reason: 'target_plan_missing' }
				: { action: 'REVIEW_REQUIRED', reason: 'current_access_unknown' }
	}
	return row.mighty.currentAccess === 'PRESENT'
		? { action: 'REVOKE_PLAN', reason: 'target_plan_present_for_denied_entitlement' }
		: row.mighty.currentAccess === 'ABSENT'
			? { action: 'NONE', reason: 'target_plan_already_absent' }
			: { action: 'REVIEW_REQUIRED', reason: 'current_access_unknown' }
}

export function buildMigrationAuditRecord(request: MigrationExecutionRequest): MigrationAuditRecord {
	return assertMigrationExecutionAllowed(request)
}
