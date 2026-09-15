import { normalizeEmail } from '@/lib/normalize-email'

import { assertMightyMemberMatchesExpectedEmail, type MightyMember } from './adminApi'
import { JPV_MIGHTY_ACCESS_PLAN_ID } from './config'
import type { CutoverManifestRow } from './cutoverManifest'

export const SILENT_MIGRATION_AUTHORIZATION_VERSION = 'mighty-jpv-silent-existing-member-v1' as const
export const SILENT_MIGRATION_ACTION = 'GRANT_PLAN_ONLY' as const
export const SILENT_MIGRATION_ROLE_CLASS = 'ORDINARY' as const
export const SILENT_MIGRATION_BATCH_SIZE = 1 as const
export const SILENT_MIGRATION_EMAIL_ALLOWED = false as const
export const SILENT_MIGRATION_MEMBER_CREATION_ALLOWED = false as const
export const SILENT_MIGRATION_REVOKE_ALLOWED = false as const
export const SILENT_MIGRATION_TARGET_PLAN_ID = String(JPV_MIGHTY_ACCESS_PLAN_ID) as '2000039'

export type SilentExistingMemberGrantAuthorization = {
	version: typeof SILENT_MIGRATION_AUTHORIZATION_VERSION
	email: string
	mightyMemberId: string
	manifestSha256: string
	roleAttestationSha256: string
	roleClass: typeof SILENT_MIGRATION_ROLE_CLASS
	targetPlanId: typeof SILENT_MIGRATION_TARGET_PLAN_ID
	action: typeof SILENT_MIGRATION_ACTION
	batchSize: typeof SILENT_MIGRATION_BATCH_SIZE
	emailAllowed: typeof SILENT_MIGRATION_EMAIL_ALLOWED
	memberCreationAllowed: typeof SILENT_MIGRATION_MEMBER_CREATION_ALLOWED
	revokeAllowed: typeof SILENT_MIGRATION_REVOKE_ALLOWED
}

/**
 * Deliberately empty. Real entries may only be added by a reviewed source
 * change that binds one owner-attested identity to one exact evidence packet.
 * Environment variables are never consulted by this registry.
 */
export const SILENT_EXISTING_MEMBER_GRANT_AUTHORIZATIONS: readonly SilentExistingMemberGrantAuthorization[] = []

export type SilentExistingMemberState = {
	member: MightyMember
	planIds: string[]
	purchasePlanIds: string[]
	extraSpaceNames: string[]
	profileFingerprint: string
	contentFingerprint: string
	loginFingerprint: string
}

export type SilentExistingMemberGrantAdapter = {
	findMemberByEmail(email: string): Promise<MightyMember | null>
	readState(memberId: string, planId: string): Promise<SilentExistingMemberState>
	grantPlan(memberId: string, planId: string): Promise<void>
}

export type SilentExistingMemberGrantResult = {
	status: 'GRANTED_AND_VERIFIED' | 'ALREADY_CONVERGED'
	memberId: string
	planId: typeof SILENT_MIGRATION_TARGET_PLAN_ID
	mutationPerformed: boolean
	communicationPerformed: false
}

export class SilentMigrationAuthorizationError extends Error {
	readonly code: string

	constructor(code: string) {
		super(code)
		this.name = 'SilentMigrationAuthorizationError'
		this.code = code
	}
}

function fail(code: string): never {
	throw new SilentMigrationAuthorizationError(code)
}

function normalized(value: string | null | undefined): string {
	return value?.trim().toLowerCase() ?? ''
}

function equalStringLists(left: string[], right: string[]): boolean {
	return left.length === right.length && left.every((value, index) => value === right[index])
}

function assertHash(value: string, field: string): void {
	if (!/^[0-9a-f]{64}$/.test(value)) fail(`silent_migration_${field}_invalid`)
}

export function validateSilentExistingMemberGrantAuthorization(
	authorization: SilentExistingMemberGrantAuthorization,
): SilentExistingMemberGrantAuthorization {
	if (authorization.version !== SILENT_MIGRATION_AUTHORIZATION_VERSION) fail('silent_migration_authorization_version_mismatch')
	if (normalizeEmail(authorization.email) !== authorization.email) fail('silent_migration_authorization_email_not_normalized')
	if (!authorization.mightyMemberId.trim()) fail('silent_migration_authorization_member_id_required')
	assertHash(authorization.manifestSha256, 'manifest_hash')
	assertHash(authorization.roleAttestationSha256, 'role_attestation_hash')
	if (authorization.roleClass !== SILENT_MIGRATION_ROLE_CLASS) fail('silent_migration_authorization_role_mismatch')
	if (authorization.targetPlanId !== SILENT_MIGRATION_TARGET_PLAN_ID) fail('silent_migration_authorization_plan_mismatch')
	if (authorization.action !== SILENT_MIGRATION_ACTION) fail('silent_migration_authorization_action_mismatch')
	if (authorization.batchSize !== SILENT_MIGRATION_BATCH_SIZE) fail('silent_migration_authorization_batch_mismatch')
	if (authorization.emailAllowed !== SILENT_MIGRATION_EMAIL_ALLOWED) fail('silent_migration_authorization_email_capability_enabled')
	if (authorization.memberCreationAllowed !== SILENT_MIGRATION_MEMBER_CREATION_ALLOWED) fail('silent_migration_authorization_creation_capability_enabled')
	if (authorization.revokeAllowed !== SILENT_MIGRATION_REVOKE_ALLOWED) fail('silent_migration_authorization_revoke_capability_enabled')
	return authorization
}

export function findSilentExistingMemberGrantAuthorization(
	email: string,
	manifestSha256: string,
	roleAttestationSha256: string,
	authorizations: readonly SilentExistingMemberGrantAuthorization[] = SILENT_EXISTING_MEMBER_GRANT_AUTHORIZATIONS,
): SilentExistingMemberGrantAuthorization {
	const normalizedEmail = normalizeEmail(email)
	if (!normalizedEmail) fail('silent_migration_identity_required')
	const authorization = authorizations.find((candidate) =>
		normalizeEmail(candidate.email) === normalizedEmail &&
		candidate.manifestSha256 === manifestSha256 &&
		candidate.roleAttestationSha256 === roleAttestationSha256,
	)
	if (!authorization) fail('silent_migration_authorization_not_found')
	return validateSilentExistingMemberGrantAuthorization(authorization)
}

function assertManifestRowEligible(
	row: CutoverManifestRow,
	authorization: SilentExistingMemberGrantAuthorization,
): void {
	if (row.email !== authorization.email) fail('silent_migration_manifest_email_mismatch')
	if (row.proposedCutoverAction !== 'MIGRATE_EXISTING') fail('silent_migration_manifest_action_not_allowed')
	if (row.stripeEntitlement !== 'ALLOWED') fail('silent_migration_manifest_entitlement_not_allowed')
	if (row.roleClass !== SILENT_MIGRATION_ROLE_CLASS) fail('silent_migration_manifest_role_not_attested')
	if (row.mightyMatchState !== 'EXACT_EMAIL') fail('silent_migration_manifest_identity_not_exact')
	if (row.mightyMemberId !== authorization.mightyMemberId) fail('silent_migration_manifest_member_id_mismatch')
	if (row.targetPlan.id !== SILENT_MIGRATION_TARGET_PLAN_ID || row.targetPlan.present) fail('silent_migration_manifest_target_plan_invalid')
	if (row.otherPlans.length > 0 || row.purchaseState.targetCount > 0 || row.purchaseState.otherCount > 0) fail('silent_migration_manifest_overlap_invalid')
	if (row.extraSpaces.length > 0 || row.duplicateRisk !== 'NONE') fail('silent_migration_manifest_overlap_invalid')
	const identityEvidence = row.identityEvidence
	if (!identityEvidence) fail('silent_migration_manifest_identity_evidence_missing')
	if (identityEvidence.source === 'exact_by_email_lookup' && identityEvidence.requestedEmail !== row.email) fail('silent_migration_manifest_identity_evidence_mismatch')
	if (identityEvidence.source === 'provider_email_match' && identityEvidence.expectedEmail !== row.email) fail('silent_migration_manifest_identity_evidence_mismatch')
}

function assertCurrentStateEligible(
	state: SilentExistingMemberState,
	authorization: SilentExistingMemberGrantAuthorization,
): void {
	assertMightyMemberMatchesExpectedEmail(state.member, authorization.email)
	if (String(state.member.id) !== authorization.mightyMemberId) fail('silent_migration_current_member_id_mismatch')
	if (!['member', 'contributor', 'student'].includes(normalized(state.member.role))) fail('silent_migration_current_role_not_ordinary')
	if (state.planIds.includes(SILENT_MIGRATION_TARGET_PLAN_ID)) fail('silent_migration_target_plan_already_present')
	if (state.planIds.length > 0 || state.purchasePlanIds.length > 0 || state.extraSpaceNames.length > 0) fail('silent_migration_current_overlap_detected')
}

function assertPostGrantState(
	before: SilentExistingMemberState,
	after: SilentExistingMemberState,
	authorization: SilentExistingMemberGrantAuthorization,
): void {
	assertMightyMemberMatchesExpectedEmail(after.member, authorization.email)
	if (String(after.member.id) !== authorization.mightyMemberId) fail('silent_migration_post_grant_member_id_mismatch')
	if (after.member.role !== before.member.role || after.member.member_type !== before.member.member_type) fail('silent_migration_post_grant_role_changed')
	if (after.profileFingerprint !== before.profileFingerprint) fail('silent_migration_post_grant_profile_changed')
	if (after.contentFingerprint !== before.contentFingerprint) fail('silent_migration_post_grant_content_changed')
	if (after.loginFingerprint !== before.loginFingerprint) fail('silent_migration_post_grant_login_changed')
	if (!equalStringLists(after.purchasePlanIds, before.purchasePlanIds)) fail('silent_migration_post_grant_purchase_changed')
	if (!equalStringLists(after.extraSpaceNames, before.extraSpaceNames)) fail('silent_migration_post_grant_spaces_changed')
	const beforePlans = before.planIds.filter((id) => id !== SILENT_MIGRATION_TARGET_PLAN_ID)
	const afterPlans = after.planIds.filter((id) => id !== SILENT_MIGRATION_TARGET_PLAN_ID)
	if (!equalStringLists(afterPlans, beforePlans) || !after.planIds.includes(SILENT_MIGRATION_TARGET_PLAN_ID)) fail('silent_migration_post_grant_plan_state_invalid')
}

export async function runSilentExistingMemberGrant(params: {
	row: CutoverManifestRow
	manifestSha256: string
	roleAttestationSha256: string
	currentEntitlement: () => Promise<'ALLOWED' | 'DENIED'>
	adapter: SilentExistingMemberGrantAdapter
	authorizations?: readonly SilentExistingMemberGrantAuthorization[]
}): Promise<SilentExistingMemberGrantResult> {
	const authorization = findSilentExistingMemberGrantAuthorization(
		params.row.email,
		params.manifestSha256,
		params.roleAttestationSha256,
		params.authorizations,
	)
	assertManifestRowEligible(params.row, authorization)
	if (await params.currentEntitlement() !== 'ALLOWED') fail('silent_migration_current_entitlement_not_allowed')

	const currentMember = await params.adapter.findMemberByEmail(authorization.email)
	if (!currentMember) fail('silent_migration_current_member_missing')
	assertMightyMemberMatchesExpectedEmail(currentMember, authorization.email)
	if (String(currentMember.id) !== authorization.mightyMemberId) fail('silent_migration_current_member_id_mismatch')

	const before = await params.adapter.readState(authorization.mightyMemberId, SILENT_MIGRATION_TARGET_PLAN_ID)
	if (before.planIds.includes(SILENT_MIGRATION_TARGET_PLAN_ID)) {
		return {
			status: 'ALREADY_CONVERGED',
			memberId: authorization.mightyMemberId,
			planId: SILENT_MIGRATION_TARGET_PLAN_ID,
			mutationPerformed: false,
			communicationPerformed: false,
		}
	}
	assertCurrentStateEligible(before, authorization)
	if (await params.currentEntitlement() !== 'ALLOWED') fail('silent_migration_current_entitlement_not_allowed')

	await params.adapter.grantPlan(authorization.mightyMemberId, SILENT_MIGRATION_TARGET_PLAN_ID)
	const after = await params.adapter.readState(authorization.mightyMemberId, SILENT_MIGRATION_TARGET_PLAN_ID)
	assertPostGrantState(before, after, authorization)
	return {
		status: 'GRANTED_AND_VERIFIED',
		memberId: authorization.mightyMemberId,
		planId: SILENT_MIGRATION_TARGET_PLAN_ID,
		mutationPerformed: true,
		communicationPerformed: false,
	}
}
