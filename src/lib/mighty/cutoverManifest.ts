import { normalizeEmail } from '@/lib/normalize-email'

import type { MightyMember, MightyPlan, MightyPurchase, MightySpace } from './adminApi'
import { STANDARD_JPV_SPACE_NAMES } from './mutationPolicy'

export type CutoverAction =
	| 'MIGRATE_EXISTING'
	| 'ALREADY_PLAN_CONTROLLED'
	| 'CREATE_NEW_AT_CUTOVER'
	| 'PRIVILEGED_EXCLUDED'
	| 'OVERLAP_REVIEW_REQUIRED'
	| 'IDENTITY_REVIEW_REQUIRED'
	| 'NO_ACTION'
	| 'BLOCKED'

export type CutoverMatchState = 'EXACT_EMAIL' | 'NO_EXACT_EMAIL' | 'AMBIGUOUS_PROVIDER_IDENTITY' | 'PROVIDER_UNCERTAIN'
export type CutoverRoleClass = 'ORDINARY' | 'PRIVILEGED' | 'PRIVILEGE_UNKNOWN' | 'NOT_YET_PROVISIONED'

export type CutoverManifestInput = {
	email: string
	stripeEntitled: boolean
	stripeSubscriptionId?: string | null
	member: MightyMember | null
	matchState?: Exclude<CutoverMatchState, 'PROVIDER_UNCERTAIN'>
	identityReviewReason?: string | null
	operatorRoleClass?: Extract<CutoverRoleClass, 'ORDINARY' | 'PRIVILEGED'>
	plans: MightyPlan[]
	purchases: MightyPurchase[]
	spaces: MightySpace[]
	targetPlanId: number | string
	providerError?: string | null
}

export type CutoverManifestRow = {
	email: string
	stripeEntitlement: 'ALLOWED' | 'DENIED'
	stripeSubscriptionId: string | null
	mightyMatchState: CutoverMatchState
	mightyMemberId: string | null
	roleClass: CutoverRoleClass
	targetPlan: { id: string; present: boolean }
	otherPlans: Array<{ id: string; name: string | null }>
	purchaseState: { targetCount: number; otherCount: number }
	standardSpaces: { count: number; complete: boolean }
	extraSpaces: string[]
	duplicateRisk: 'NONE' | 'REVIEW'
	proposedCutoverAction: CutoverAction
	reviewReason: string | null
	rollbackReference: string
}

function normalized(value: string | null | undefined): string {
	return value?.trim().toLowerCase() ?? ''
}

function roleClass(member: MightyMember | null, matchState: CutoverManifestRow['mightyMatchState'], operatorRoleClass?: CutoverManifestInput['operatorRoleClass']): CutoverRoleClass {
	if (operatorRoleClass) return operatorRoleClass
	if (!member || matchState === 'NO_EXACT_EMAIL' || matchState === 'AMBIGUOUS_PROVIDER_IDENTITY') return 'NOT_YET_PROVISIONED'
	const role = normalized(member.role)
	if (['host', 'owner', 'admin', 'administrator', 'staff'].includes(role)) return 'PRIVILEGED'
	if (['member', 'contributor', 'student'].includes(role)) return 'ORDINARY'
	return 'PRIVILEGE_UNKNOWN'
}

function extraSpaces(spaces: MightySpace[]): string[] {
	return spaces
		.map((space) => space.name?.trim() ?? '')
		.filter((name) => name.length > 0 && !STANDARD_JPV_SPACE_NAMES.has(name.toLowerCase()))
}

function purchasePlanId(purchase: MightyPurchase): string {
	return String(purchase.plan?.id ?? '').trim()
}

export function buildCutoverManifestRow(input: CutoverManifestInput): CutoverManifestRow {
	const email = normalizeEmail(input.email)
	if (!email) throw new Error('cutover_manifest_email_required')
	const targetPlanId = String(input.targetPlanId)
	const matchState: CutoverManifestRow['mightyMatchState'] = input.providerError
		? 'PROVIDER_UNCERTAIN'
		: input.matchState ?? (input.member ? 'EXACT_EMAIL' : 'NO_EXACT_EMAIL')
	const extras = extraSpaces(input.spaces)
	const targetPresent = input.plans.some((plan) => String(plan.id) === targetPlanId)
	const otherPlans = input.plans
		.filter((plan) => String(plan.id) !== targetPlanId)
		.map((plan) => ({ id: String(plan.id), name: plan.name?.trim() || null }))
	const targetPurchaseCount = input.purchases.filter((purchase) => purchasePlanId(purchase) === targetPlanId).length
	const otherPurchaseCount = input.purchases.filter((purchase) => {
		const id = purchasePlanId(purchase)
		return id.length > 0 && id !== targetPlanId
	}).length
	const role = roleClass(input.member, matchState, input.operatorRoleClass)
	const duplicateRisk = matchState === 'AMBIGUOUS_PROVIDER_IDENTITY' ? 'REVIEW' : 'NONE'

	let action: CutoverAction
	let reviewReason: string | null = input.identityReviewReason ?? null
	if (input.providerError) {
		action = 'BLOCKED'
		reviewReason = input.providerError
	} else if (!input.stripeEntitled) {
		action = 'NO_ACTION'
		reviewReason = 'stripe_entitlement_not_allowed; revocation is a separate guarded reconciliation path'
	} else if (matchState === 'AMBIGUOUS_PROVIDER_IDENTITY') {
		action = 'IDENTITY_REVIEW_REQUIRED'
		reviewReason = reviewReason ?? 'provider identity is not deterministic'
	} else if (role === 'PRIVILEGED') {
		action = 'PRIVILEGED_EXCLUDED'
		reviewReason = reviewReason ?? 'provider role is privileged'
	} else if (otherPlans.length > 0 || otherPurchaseCount > 0 || extras.length > 0) {
		action = 'OVERLAP_REVIEW_REQUIRED'
		reviewReason = reviewReason ?? 'other Plan, purchase, or non-standard Space creates overlapping access'
	} else if (role === 'PRIVILEGE_UNKNOWN') {
		action = 'IDENTITY_REVIEW_REQUIRED'
		reviewReason = reviewReason ?? 'provider role is absent or not an explicit ordinary-member role'
	} else if (matchState === 'PROVIDER_UNCERTAIN') {
		action = 'BLOCKED'
		reviewReason = reviewReason ?? 'provider response was uncertain'
	} else if (matchState === 'NO_EXACT_EMAIL') {
		action = 'CREATE_NEW_AT_CUTOVER'
		reviewReason = reviewReason ?? 'no exact Mighty email match; creation is future cutover work only'
	} else if (targetPresent || targetPurchaseCount > 0) {
		action = 'ALREADY_PLAN_CONTROLLED'
	} else if (role === 'ORDINARY') {
		action = 'MIGRATE_EXISTING'
	} else {
		action = 'BLOCKED'
		reviewReason = reviewReason ?? 'manifest state is not safe to classify'
	}

	return {
		email,
		stripeEntitlement: input.stripeEntitled ? 'ALLOWED' : 'DENIED',
		stripeSubscriptionId: input.stripeSubscriptionId?.trim() || null,
		mightyMatchState: matchState,
		mightyMemberId: input.member ? String(input.member.id) : null,
		roleClass: role,
		targetPlan: { id: targetPlanId, present: targetPresent },
		otherPlans,
		purchaseState: { targetCount: targetPurchaseCount, otherCount: otherPurchaseCount },
		standardSpaces: {
			count: input.spaces.filter((space) => STANDARD_JPV_SPACE_NAMES.has(normalized(space.name))).length,
			complete: input.spaces.length > 0 && extras.length === 0 && input.spaces.every((space) => STANDARD_JPV_SPACE_NAMES.has(normalized(space.name))),
		},
		extraSpaces: extras,
		duplicateRisk,
		proposedCutoverAction: action,
		reviewReason,
		rollbackReference: targetPresent || targetPurchaseCount > 0
			? `remove Plan ${targetPlanId} only; preserve Mighty member identity ${String(input.member?.id ?? 'unknown')}`
			: `restore or create the same normalized email ${email}; do not delete a member`,
	}
}

export function summarizeCutoverManifest(rows: CutoverManifestRow[]) {
	const count = (action: CutoverAction) => rows.filter((row) => row.proposedCutoverAction === action).length
	return {
		totalRows: rows.length,
		allowed: rows.filter((row) => row.stripeEntitlement === 'ALLOWED').length,
		denied: rows.filter((row) => row.stripeEntitlement === 'DENIED').length,
		readyToMigrate: count('MIGRATE_EXISTING') + count('CREATE_NEW_AT_CUTOVER'),
		reviewRequired: count('IDENTITY_REVIEW_REQUIRED') + count('OVERLAP_REVIEW_REQUIRED') + count('BLOCKED'),
		actionCounts: Object.fromEntries((['MIGRATE_EXISTING', 'ALREADY_PLAN_CONTROLLED', 'CREATE_NEW_AT_CUTOVER', 'PRIVILEGED_EXCLUDED', 'OVERLAP_REVIEW_REQUIRED', 'IDENTITY_REVIEW_REQUIRED', 'NO_ACTION', 'BLOCKED'] as const).map((action) => [action, count(action)])),
		mutationPerformed: false,
	}
}
