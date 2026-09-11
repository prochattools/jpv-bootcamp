import prisma from '../../src/libs/prisma'
import { createMightyAdminApi } from '../../src/lib/mighty/adminApi'
import { getMightyConfig } from '../../src/lib/mighty/config'
import { isStripeEntitled } from '../../src/lib/mighty/stripeEntitlementSummary'
import {
	classifyMightyReconciliation,
	summarizeMightyReconciliation,
	type MightyReconciliationDecision,
} from '../../src/lib/mighty/reconciliation'
import { AUTHORIZED_MIGHTY_LIVE_TEST_EMAILS, getMightyMutationScope } from '../../src/lib/mighty/mutationPolicy'

function assertReadOnlyProductionBoundary(): void {
	if (process.env.MIGHTY_PROVIDER_ENV?.trim() !== 'production') throw new Error('mighty_three_account_dry_run_requires_production_provider_env')
}

async function main(): Promise<void> {
	assertReadOnlyProductionBoundary()
	const config = getMightyConfig()
	const api = createMightyAdminApi(config)
	const scope = getMightyMutationScope()
	const rows = await prisma.customerProvisioning.findMany({
		where: { email: { in: [...AUTHORIZED_MIGHTY_LIVE_TEST_EMAILS] } },
		select: { email: true, status: true, subscriptionStatus: true, paymentStatus: true },
	})
	const rowByEmail = new Map(rows.map((row) => [row.email.trim().toLowerCase(), row]))
	const decisions: MightyReconciliationDecision[] = []

	for (const email of AUTHORIZED_MIGHTY_LIVE_TEST_EMAILS) {
		const row = rowByEmail.get(email)
		const desiredAccess = row && isStripeEntitled(row) ? 'ALLOWED' : 'DENIED'
		try {
			const member = await api.findMemberByEmail(email)
			if (!member) {
				decisions.push(classifyMightyReconciliation({ email, desiredAccess, member: null, plans: [], spaces: [], targetPurchaseCount: 0, targetPlanId: config.accessPlanId }, scope))
				continue
			}
			const [state, spaces] = await Promise.all([api.getAccessState(member.id, config.accessPlanId), api.listMemberSpaces(member.id)])
			decisions.push(classifyMightyReconciliation({ email, desiredAccess, member, plans: state.plans, spaces, targetPurchaseCount: state.purchases.length, targetPlanId: config.accessPlanId }, scope))
		} catch (error) {
			decisions.push(classifyMightyReconciliation({ email, desiredAccess, member: null, plans: [], spaces: [], targetPurchaseCount: 0, targetPlanId: config.accessPlanId, providerError: error instanceof Error ? error.name.toLowerCase() : 'provider_error' }, scope))
		}
	}

	console.log(JSON.stringify({
		readOnly: true,
		engineeringScope: 'exactly three authorized live test identities; not a population dry run',
		...summarizeMightyReconciliation(decisions),
		accessPlanId: String(config.accessPlanId),
		rows: decisions.map((decision, index) => ({ row: index + 1, email: AUTHORIZED_MIGHTY_LIVE_TEST_EMAILS[index], classification: decision.classification, action: decision.action, reason: decision.reason })),
		mutationPerformed: false,
	}, null, 2))
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : 'mighty_three_account_dry_run_failed')
	process.exitCode = 1
}).finally(async () => {
	await prisma.$disconnect()
})
