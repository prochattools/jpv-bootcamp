import type { MightyMember, MightyPlan, MightySpace } from './adminApi'
import { classifyMightyIdentity, type MightyIdentityClass, type MightyMutationScope } from './mutationPolicy'

export type MightyReconciliationClassification =
	| 'IN_SYNC_ALLOWED'
	| 'IN_SYNC_DENIED'
	| 'NEEDS_PLAN_GRANT'
	| 'NEEDS_PLAN_REVOKE'
	| 'IDENTITY_REVIEW'
	| 'PRIVILEGED_EXCLUDED'
	| 'OVERLAPPING_ACCESS_REVIEW'
	| 'PROVIDER_ERROR'

export type MightyReconciliationRow = {
	email: string | null
	desiredAccess: 'ALLOWED' | 'DENIED' | null
	member: MightyMember | null
	plans: MightyPlan[]
	spaces: MightySpace[]
	targetPurchaseCount: number
	targetPlanId: number | string
	providerError?: string | null
}

export type MightyReconciliationDecision = {
	classification: MightyReconciliationClassification
	action: 'none' | 'grant_plan' | 'revoke_plan' | 'review'
	identityClass: MightyIdentityClass | null
	reason: string
}

export function classifyMightyReconciliation(
	row: MightyReconciliationRow,
	scope: MightyMutationScope,
): MightyReconciliationDecision {
	if (row.providerError) {
		return { classification: 'PROVIDER_ERROR', action: 'review', identityClass: null, reason: row.providerError }
	}
	if (!row.email || !row.desiredAccess || !row.member) {
		return {
			classification: 'IDENTITY_REVIEW',
			action: 'review',
			identityClass: null,
			reason: !row.email ? 'missing_email' : !row.desiredAccess ? 'missing_entitlement' : 'exact_mighty_member_not_found',
		}
	}

	const identityClass = classifyMightyIdentity({
		email: row.email,
		member: row.member,
		spaces: row.spaces,
		plans: row.plans,
		scope,
	})
	if (identityClass === 'host' || identityClass === 'administrator' || identityClass === 'review') {
		return {
			classification: 'PRIVILEGED_EXCLUDED',
			action: 'review',
			identityClass,
			reason: identityClass === 'review' ? 'provider_role_requires_review' : `${identityClass}_identity`,
		}
	}

	const targetPlanId = String(row.targetPlanId)
	const hasTargetPlan = row.plans.some((plan) => String(plan.id) === targetPlanId)
	const hasOtherPlan = row.plans.some((plan) => String(plan.id) !== targetPlanId)
	const hasUnexpectedSpace = row.spaces.some((space) => {
		const name = space.name?.trim().toLowerCase() ?? ''
		return name !== '' && !['activity feed', 'chat', 'course', 'events', 'jpv resource library'].includes(name)
	})
	if (hasOtherPlan || hasUnexpectedSpace || identityClass === 'exception') {
		return {
			classification: 'OVERLAPPING_ACCESS_REVIEW',
			action: 'review',
			identityClass,
			reason: hasOtherPlan ? 'other_plan_membership' : 'exceptional_space_membership',
		}
	}

	if (row.desiredAccess === 'ALLOWED') {
		return hasTargetPlan
			? { classification: 'IN_SYNC_ALLOWED', action: 'none', identityClass, reason: 'target_plan_present' }
			: { classification: 'NEEDS_PLAN_GRANT', action: 'grant_plan', identityClass, reason: 'target_plan_missing' }
	}

	return hasTargetPlan || row.targetPurchaseCount > 0
		? { classification: 'NEEDS_PLAN_REVOKE', action: 'revoke_plan', identityClass, reason: 'target_access_present' }
		: { classification: 'IN_SYNC_DENIED', action: 'none', identityClass, reason: 'target_access_absent' }
}

export function summarizeMightyReconciliation(decisions: MightyReconciliationDecision[]) {
	const counts = new Map<MightyReconciliationClassification, number>()
	for (const decision of decisions) counts.set(decision.classification, (counts.get(decision.classification) ?? 0) + 1)
	return {
		readOnly: true,
		mutationPerformed: false,
		totalRows: decisions.length,
		counts: Object.fromEntries([...counts.entries()].sort(([left], [right]) => left.localeCompare(right))),
		proposedActions: decisions.filter((decision) => decision.action !== 'none').length,
	}
}
