import prisma from '../../src/libs/prisma'
import { createMightyAdminApi } from '../../src/lib/mighty/adminApi'
import { getMightyConfig } from '../../src/lib/mighty/config'
import { isStripeEntitled } from '../../src/lib/mighty/stripeEntitlementSummary'
import {
	classifyMightyReconciliation,
	summarizeMightyReconciliation,
	type MightyReconciliationDecision,
} from '../../src/lib/mighty/reconciliation'
import { getMightyMutationScope } from '../../src/lib/mighty/mutationPolicy'

function assertReadOnlyProductionBoundary(): void {
	if (process.env.MIGHTY_PROVIDER_ENV?.trim() !== 'production') {
		throw new Error('mighty_access_dry_run_requires_production_provider_env')
	}
}

async function main(): Promise<void> {
	assertReadOnlyProductionBoundary()
	const config = getMightyConfig()
	const api = createMightyAdminApi(config)
	const scope = getMightyMutationScope()
	const rows = await prisma.customerProvisioning.findMany({
		where: { status: 'active' },
		select: {
			email: true,
			status: true,
			subscriptionStatus: true,
			paymentStatus: true,
		},
	})

	const decisions: MightyReconciliationDecision[] = []
	for (const row of rows) {
		const desiredAccess = isStripeEntitled(row) ? 'ALLOWED' : 'DENIED'
		try {
			const member = row.email ? await api.findMember(row.email) : null
			if (!member) {
				decisions.push(classifyMightyReconciliation({
					email: row.email,
					desiredAccess,
					member: null,
					plans: [],
					spaces: [],
					targetPurchaseCount: 0,
					targetPlanId: config.accessPlanId,
				}, scope))
				continue
			}
			const [state, spaces] = await Promise.all([
				api.getAccessState(member.id, config.accessPlanId),
				api.listMemberSpaces(member.id),
			])
			decisions.push(classifyMightyReconciliation({
				email: row.email,
				desiredAccess,
				member,
				plans: state.plans,
				spaces,
				targetPurchaseCount: state.purchases.length,
				targetPlanId: config.accessPlanId,
			}, scope))
		} catch (error) {
			decisions.push(classifyMightyReconciliation({
				email: row.email,
				desiredAccess,
				member: null,
				plans: [],
				spaces: [],
				targetPurchaseCount: 0,
				targetPlanId: config.accessPlanId,
				providerError: error instanceof Error ? error.name.toLowerCase() : 'provider_error',
			}, scope))
		}
	}

	const summary = summarizeMightyReconciliation(decisions)
	console.log(JSON.stringify({
		...summary,
		accessPlanId: String(config.accessPlanId),
		rows: decisions.map((decision, index) => ({
			row: index + 1,
			classification: decision.classification,
			action: decision.action,
			reason: decision.reason,
		})),
	}, null, 2))
}

main()
	.catch((error) => {
		console.error(error instanceof Error ? error.message : 'mighty_access_dry_run_failed')
		process.exitCode = 1
	})
	.finally(async () => {
		await prisma.$disconnect()
	})
