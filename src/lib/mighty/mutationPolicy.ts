import { normalizeEmail } from '@/lib/normalize-email'

import type { MightyMember, MightyPlan, MightySpace } from './adminApi'

export type MightyIdentityClass = 'ordinary' | 'administrator' | 'host' | 'exception' | 'review'
export type MightyRoleOverride = Exclude<MightyIdentityClass, 'review' | 'exception'>

export type MightyMutationScope = {
	enforce: boolean
	allowedEmails: ReadonlySet<string>
	allowNewMemberCreation: boolean
	roleOverrides: ReadonlyMap<string, MightyRoleOverride>
}

export const STANDARD_JPV_SPACE_NAMES = new Set([
	'activity feed',
	'chat',
	'course',
	'events',
	'jpv resource library',
])

function listValues(value: string | undefined): string[] {
	return (value ?? '')
		.split(',')
		.map((item) => normalizeEmail(item) || item.trim().toLowerCase())
		.filter(Boolean)
}

function roleOverride(value: string): MightyRoleOverride | null {
	if (value === 'ordinary' || value === 'administrator' || value === 'host') return value
	return null
}

export function getMightyMutationScope(env: Record<string, string | undefined> = process.env): MightyMutationScope {
	const providerEnv = env.MIGHTY_PROVIDER_ENV?.trim().toLowerCase() ?? ''
	const enforce = providerEnv === 'production' || providerEnv === 'staging'
	const guardEnabled = providerEnv === 'production'
		? env.MIGHTY_PRODUCTION_ALLOW_API_MUTATIONS?.trim() === 'true'
		: providerEnv === 'staging'
			? env.MIGHTY_STAGING_ALLOW_API_MUTATIONS?.trim() === 'true'
			: false
	const allowedEmails = new Set(listValues(env.MIGHTY_ACCESS_SYNC_MUTATION_ALLOWLIST))
	if (guardEnabled) {
		const testEmail = normalizeEmail(
			providerEnv === 'production' ? env.MIGHTY_PRODUCTION_TEST_EMAIL : env.MIGHTY_STAGING_TEST_EMAIL,
		)
		if (testEmail) allowedEmails.add(testEmail)
	}

	const roleOverrides = new Map<string, MightyRoleOverride>()
	for (const entry of (env.MIGHTY_IDENTITY_ROLE_OVERRIDES ?? '').split(',')) {
		const [emailValue, roleValue] = entry.split(':', 2)
		const email = normalizeEmail(emailValue)
		const role = roleOverride(roleValue?.trim().toLowerCase() ?? '')
		if (email && role) roleOverrides.set(email, role)
	}

	return {
		enforce,
		allowedEmails,
		allowNewMemberCreation: env.MIGHTY_ALLOW_NEW_MEMBER_CREATION?.trim() === 'true',
		roleOverrides,
	}
}

export function assertMightyMutationAllowed(
	scope: MightyMutationScope,
	email: string,
	action: string,
): void {
	if (!scope.enforce) return
	const normalized = normalizeEmail(email)
	if (!normalized || !scope.allowedEmails.has(normalized)) {
		throw new MightySafetyError('mighty_mutation_scope_denied', `${action}:${normalized || 'missing_email'}`)
	}
}

export function assertMightyMemberCreationAllowed(scope: MightyMutationScope, email: string): void {
	assertMightyMutationAllowed(scope, email, 'create_member')
	if (scope.enforce && !scope.allowNewMemberCreation) {
		throw new MightySafetyError('mighty_member_creation_disabled', 'new_member_creation_disabled')
	}
	if (scope.enforce && scope.roleOverrides.get(normalizeEmail(email)) !== 'ordinary') {
		throw new MightySafetyError('mighty_new_member_identity_review_required')
	}
}

export function assertMightyRecoveryAllowed(scope: MightyMutationScope, email: string): void {
	assertMightyMutationAllowed(scope, email, 'recover_member')
}

export class MightySafetyError extends Error {
	readonly code: string

	constructor(code: string, message = code) {
		super(message)
		this.name = 'MightySafetyError'
		this.code = code
	}
}

export function classifyMightyIdentity(params: {
	email: string
	member: MightyMember | null
	spaces: MightySpace[]
	plans: MightyPlan[]
	scope: MightyMutationScope
}): MightyIdentityClass {
	const email = normalizeEmail(params.email)
	const override = params.scope.roleOverrides.get(email)
	if (override) return override

	const providerRole = params.member?.role?.trim().toLowerCase() ?? ''
	if (providerRole === 'host' || providerRole === 'owner') return 'host'
	if (providerRole === 'admin' || providerRole === 'administrator' || providerRole === 'staff') return 'administrator'
	if (providerRole === 'member' || providerRole === 'contributor' || providerRole === 'student') return 'ordinary'

	const hasUnexpectedSpace = params.spaces.some((space) => {
		const name = space.name?.trim().toLowerCase() ?? ''
		return name !== '' && !STANDARD_JPV_SPACE_NAMES.has(name)
	})
	if (hasUnexpectedSpace) return 'exception'

	// A null provider role is not proof of ordinary-member status. The caller
	// must supply an explicit operator/test override before a live mutation.
	return 'review'
}

export function assertIdentityMutationSafe(params: {
	identityClass: MightyIdentityClass
	desiredAccess: 'ALLOWED' | 'DENIED'
	mutationRequired: boolean
}): void {
	if (!params.mutationRequired) return
	if (params.identityClass === 'host') {
		throw new MightySafetyError('mighty_host_mutation_protected')
	}
	if (params.identityClass === 'review') {
		throw new MightySafetyError('mighty_identity_review_required')
	}
	if (params.identityClass === 'exception') {
		throw new MightySafetyError('mighty_overlap_review_required')
	}
}
