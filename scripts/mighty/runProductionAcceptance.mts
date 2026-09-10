import assert from 'node:assert/strict'

import { reconcileAccess } from '../../src/lib/mighty/accessSync'
import { createMightyAdminApi } from '../../src/lib/mighty/adminApi'
import { getMightyConfig } from '../../src/lib/mighty/config'
import { normalizeEmail } from '../../src/lib/normalize-email'

function required(name: string): string {
	const value = process.env[name]?.trim()
	if (!value) throw new Error(`missing_${name.toLowerCase()}`)
	return value
}

function assertProductionBoundary(): void {
	if (process.env.MIGHTY_PROVIDER_ENV?.trim() !== 'production') {
		throw new Error('mighty_acceptance_requires_production_provider_env')
	}
	if (process.env.MIGHTY_PRODUCTION_ALLOW_API_MUTATIONS?.trim() !== 'true') {
		throw new Error('mighty_acceptance_requires_explicit_production_mutation_guard')
	}
}

function purchaseIds(purchases: Array<{ purchase?: { id?: number | string | null } }>): string[] {
	return purchases
		.map((purchase) => String(purchase.purchase?.id ?? ''))
		.filter(Boolean)
		.sort()
}

function testRow(email: string, overrides: Partial<Parameters<typeof reconcileAccess>[0]['row']> = {}) {
	return {
		id: 'production-acceptance',
		email,
		normalizedEmail: email,
		stripeCustomerId: 'production-acceptance-customer',
		stripeSubscriptionId: 'production-acceptance-subscription',
		lastStripeEventId: 'production-acceptance-event',
		lastStripeEventCreatedAt: null,
		lastStripeEventType: null,
		plan: 'jpv_bootcamp_membership',
		desiredAccess: 'ALLOWED',
		mightyMemberId: null,
		mightyPurchaseId: null,
		welcomeRequired: false,
		welcomeSentAt: null,
		attemptCount: 0,
		...overrides,
	} as Parameters<typeof reconcileAccess>[0]['row']
}

async function main(): Promise<void> {
	assertProductionBoundary()
	const email = normalizeEmail(required('MIGHTY_PRODUCTION_TEST_EMAIL'))
	if (!email) throw new Error('mighty_acceptance_test_email_must_be_valid')

	const config = getMightyConfig()
	const api = createMightyAdminApi(config)
	let memberId: string | null = null
	let report: Record<string, unknown> | null = null

	try {
		const preExistingMember = await api.findMember(email)
		const created = await reconcileAccess({
			row: testRow(email, { mightyMemberId: preExistingMember ? String(preExistingMember.id) : null }),
			config,
			api,
		})
		memberId = created.mightyMemberId
		assert(memberId, 'find/create path must return a Mighty member ID')
		const afterCreateAndGrant = await api.getAccessState(memberId, config.accessPlanId)
		assert.equal(afterCreateAndGrant.hasAccess, true, 'grant must be verified by a separate provider read')
		const firstPurchaseIds = purchaseIds(afterCreateAndGrant.purchases)
		assert.ok(firstPurchaseIds.length > 0, 'grant must create or preserve test access')

		const repeatedGrant = await reconcileAccess({
			row: testRow(email, { mightyMemberId: memberId }),
			config,
			api,
		})
		const afterRepeatedGrant = await api.getAccessState(memberId, config.accessPlanId)
		assert.deepEqual(purchaseIds(afterRepeatedGrant.purchases), firstPurchaseIds, 'repeated grant must not duplicate access')

		await reconcileAccess({
			row: testRow(email, {
				desiredAccess: 'DENIED',
				mightyMemberId: memberId,
				welcomeRequired: false,
			}),
			config,
			api,
		})
		const afterRevoke = await api.getAccessState(memberId, config.accessPlanId)
		assert.equal(afterRevoke.hasAccess, false, 'revoke must be verified by a separate provider read')

		await reconcileAccess({
			row: testRow(email, {
				desiredAccess: 'DENIED',
				mightyMemberId: memberId,
				welcomeRequired: false,
			}),
			config,
			api,
		})
		assert.equal((await api.getAccessState(memberId, config.accessPlanId)).hasAccess, false, 'repeated revoke must remain safe')

		const restored = await reconcileAccess({
			row: testRow(email, {
				mightyMemberId: memberId,
				welcomeRequired: false,
			}),
			config,
			api,
		})
		assert(restored.mightyPurchaseId, 'restore path must return a Mighty purchase ID')
		const afterRestore = await api.getAccessState(memberId, config.accessPlanId)
		assert.equal(afterRestore.hasAccess, true, 'restore must be verified by a separate provider read')

		report = {
			environment: 'production',
			memberCreatedThroughReconcileAccess: !preExistingMember,
			memberReusedThroughReconcileAccess: Boolean(preExistingMember),
			grantVerifiedBySeparateRead: true,
			repeatedGrantWasIdempotent: true,
			revokeVerifiedBySeparateRead: true,
			repeatedRevokeWasSafe: true,
			restoreVerifiedBySeparateRead: true,
			finalStateAccessGranted: true,
		}
	} finally {
		if (memberId) {
			const currentState = await api.getAccessState(memberId, config.accessPlanId)
			if (!currentState.hasAccess) await api.restoreAccess(memberId, config.accessPlanId)
			assert.equal(
				(await api.getAccessState(memberId, config.accessPlanId)).hasAccess,
				true,
				'acceptance cleanup must leave disposable test access granted',
			)
		}
	}

	if (!report) throw new Error('mighty_acceptance_report_missing')
	console.log(JSON.stringify({ ...report, cleanupSucceeded: true }, null, 2))
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : 'mighty_production_acceptance_failed')
	process.exitCode = 1
})
