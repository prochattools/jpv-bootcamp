import prisma from '../../src/libs/prisma'
import { normalizeEmail } from '../../src/lib/normalize-email'
import { createMightyAdminApi } from '../../src/lib/mighty/adminApi'
import { getMightyConfig } from '../../src/lib/mighty/config'

type StripeEntitled = {
	email: string
	stripeCustomerId: string
	stripeSubscriptionId: string | null
}

function assertProductionReadOnlyBoundary(): void {
	if (process.env.MIGHTY_PROVIDER_ENV?.trim() !== 'production') {
		throw new Error('mighty_manual_access_audit_requires_production_provider_env')
	}
}

function isPurchaseForMember(
	purchase: { member_id: number | string; member_email?: string | null },
	member: { id: number | string; email: string },
): boolean {
	return String(purchase.member_id) === String(member.id) || normalizeEmail(purchase.member_email) === normalizeEmail(member.email)
}

async function main(): Promise<void> {
	assertProductionReadOnlyBoundary()
	const config = getMightyConfig()
	const api = createMightyAdminApi(config)
	const [stripeRows, mightyMembers, mightyPurchases] = await Promise.all([
		prisma.customerProvisioning.findMany({
			where: {
				status: 'active',
				subscriptionStatus: { in: ['active', 'trialing'] },
				OR: [
					{ paymentStatus: null },
					{ paymentStatus: { notIn: ['failed', 'action_required', 'disputed', 'refunded', 'dispute_lost'] } },
				],
			},
			select: { email: true, stripeCustomerId: true, stripeSubscriptionId: true },
		}),
		api.listMembers(),
		api.findAllPurchases(),
	])

	const entitledByEmail = new Map<string, StripeEntitled>()
	for (const row of stripeRows) {
		const email = normalizeEmail(row.email)
		if (email) entitledByEmail.set(email, { email, stripeCustomerId: row.stripeCustomerId, stripeSubscriptionId: row.stripeSubscriptionId })
	}

	let matchedEntitledMembers = 0
	let entitledMissingTargetPlan = 0
	let entitledWithOtherPlanOverlap = 0
	let directMemberWithoutPlan = 0
	let nonEntitledMemberWithTargetPlan = 0
	let nonEntitledMemberWithOtherPlan = 0

	for (const member of mightyMembers) {
		const email = normalizeEmail(member.email)
		const entitled = email ? entitledByEmail.get(email) : undefined
		const purchases = mightyPurchases.filter((purchase) => isPurchaseForMember(purchase, member))
		const targetPlanPurchases = purchases.filter((purchase) => String(purchase.plan?.id ?? '') === String(config.accessPlanId))
		const otherPlanPurchases = purchases.filter((purchase) => {
			const planId = String(purchase.plan?.id ?? '')
			return Boolean(planId) && planId !== String(config.accessPlanId)
		})

		if (entitled) {
			matchedEntitledMembers += 1
			if (targetPlanPurchases.length === 0) entitledMissingTargetPlan += 1
			if (otherPlanPurchases.length > 0) entitledWithOtherPlanOverlap += 1
		} else {
			if (targetPlanPurchases.length > 0) nonEntitledMemberWithTargetPlan += 1
			if (otherPlanPurchases.length > 0) nonEntitledMemberWithOtherPlan += 1
			if (purchases.length === 0) directMemberWithoutPlan += 1
		}
	}

	console.log(JSON.stringify({
		readOnly: true,
		accessPlanId: String(config.accessPlanId),
		stripeEntitledSubscriberCount: entitledByEmail.size,
		mightyMemberCount: mightyMembers.length,
		mightyPurchaseCount: mightyPurchases.length,
		matchedEntitledMembers,
		overlapRisk: {
			stripeEntitledMissingTargetPlan: entitledMissingTargetPlan,
			stripeEntitledWithOtherPlanOverlap: entitledWithOtherPlanOverlap,
			directMemberWithoutAnyPlan: directMemberWithoutPlan,
			nonEntitledMemberWithTargetPlan,
			nonEntitledMemberWithOtherPlan,
		},
		mutationPerformed: false,
		interpretation: 'Any non-target Plan or direct membership must be reviewed before automated revocation is enabled.',
	}, null, 2))
}

main()
	.catch((error) => {
		console.error(error instanceof Error ? error.message : 'mighty_manual_access_audit_failed')
		process.exitCode = 1
	})
	.finally(async () => {
		await prisma.$disconnect()
	})
