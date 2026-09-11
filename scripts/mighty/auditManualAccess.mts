import prisma from '../../src/libs/prisma'
import { createMightyAdminApi } from '../../src/lib/mighty/adminApi'
import { getMightyConfig } from '../../src/lib/mighty/config'
import { isStripeEntitled } from '../../src/lib/mighty/stripeEntitlementSummary'
import { AUTHORIZED_MIGHTY_LIVE_TEST_EMAILS } from '../../src/lib/mighty/mutationPolicy'

function assertProductionReadOnlyBoundary(): void {
	if (process.env.MIGHTY_PROVIDER_ENV?.trim() !== 'production') throw new Error('mighty_manual_access_audit_requires_production_provider_env')
}

async function main(): Promise<void> {
	assertProductionReadOnlyBoundary()
	const config = getMightyConfig()
	const api = createMightyAdminApi(config)
	const stripeRows = await prisma.customerProvisioning.findMany({
		where: { email: { in: [...AUTHORIZED_MIGHTY_LIVE_TEST_EMAILS] } },
		select: { email: true, stripeCustomerId: true, stripeSubscriptionId: true, status: true, subscriptionStatus: true, paymentStatus: true },
	})
	const stripeByEmail = new Map(stripeRows.map((row) => [row.email.trim().toLowerCase(), row]))
	const accounts = []
	let stripeEntitledCount = 0
	let targetPlanOverlapCount = 0
	let otherPlanOverlapCount = 0
	let directAccessWithoutTargetPlanCount = 0

	for (const email of AUTHORIZED_MIGHTY_LIVE_TEST_EMAILS) {
		const stripe = stripeByEmail.get(email)
		const stripeEntitled = stripe ? isStripeEntitled(stripe) : false
		if (stripeEntitled) stripeEntitledCount += 1
		const member = await api.findMemberByEmail(email)
		if (!member) {
			accounts.push({ email, stripeEntitled, mightyMember: null })
			continue
		}
		const [state, spaces] = await Promise.all([api.getAccessState(member.id, config.accessPlanId), api.listMemberSpaces(member.id)])
		const otherPlans = state.plans.filter((plan) => String(plan.id) !== String(config.accessPlanId))
		const otherPurchases = state.purchases.filter((purchase) => {
			const planId = String(purchase.plan?.id ?? '')
			return Boolean(planId) && planId !== String(config.accessPlanId)
		})
		const targetPlanPresent = state.memberPlanAccess || state.purchases.some((purchase) => String(purchase.plan?.id ?? '') === String(config.accessPlanId))
		if (targetPlanPresent) targetPlanOverlapCount += 1
		if (otherPlans.length > 0 || otherPurchases.length > 0) otherPlanOverlapCount += 1
		if (!targetPlanPresent && state.hasAccess) directAccessWithoutTargetPlanCount += 1
		accounts.push({
			email,
			stripeEntitled,
			mightyMember: { id: String(member.id), role: member.role ?? null, planIds: state.plans.map((plan) => String(plan.id)), targetPlanPresent, purchaseCount: state.purchases.length, spaceCount: spaces.length },
		})
	}

	console.log(JSON.stringify({
		readOnly: true,
		engineeringScope: 'exactly three authorized live test identities; no population audit',
		accessPlanId: String(config.accessPlanId),
		accounts,
		stripeEntitledCount,
		overlapRisk: { targetPlanPresentCount: targetPlanOverlapCount, otherPlanOverlapCount, directAccessWithoutTargetPlanCount },
		mutationPerformed: false,
		interpretation: 'Only the three authorized engineering accounts were read. Existing real-member normalization remains unexecuted and requires future owner authorization.',
	}, null, 2))
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : 'mighty_manual_access_audit_failed')
	process.exitCode = 1
}).finally(async () => {
	await prisma.$disconnect()
})
