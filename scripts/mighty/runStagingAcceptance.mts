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

function assertStagingBoundary(): void {
	const environment = process.env.MIGHTY_PROVIDER_ENV?.trim()
	if (environment !== 'staging') throw new Error('mighty_acceptance_requires_staging_provider_env')
	if (process.env.MIGHTY_STAGING_ALLOW_API_MUTATIONS?.trim() !== 'true') {
		throw new Error('mighty_acceptance_requires_explicit_staging_mutation_guard')
	}
}

function purchaseIds(purchases: Array<{ purchase?: { id?: number | string | null } }>): string[] {
	return purchases
		.map((purchase) => String(purchase.purchase?.id ?? ''))
		.filter(Boolean)
		.sort()
}

async function main(): Promise<void> {
	assertStagingBoundary()
	const originalEmail = normalizeEmail(required('MIGHTY_STAGING_TEST_EMAIL'))
	const changedEmail = normalizeEmail(required('MIGHTY_STAGING_TEST_EMAIL_CHANGED'))
	if (!originalEmail || !changedEmail || originalEmail === changedEmail) {
		throw new Error('mighty_acceptance_test_emails_must_be_distinct_valid_values')
	}

	const config = getMightyConfig()
	const api = createMightyAdminApi(config)
	let testMemberId: string | null = null
	let report: Record<string, unknown> | null = null

	try {
		const preExistingMember = await api.findMember(originalEmail)
		if (preExistingMember) throw new Error('mighty_acceptance_test_member_must_be_disposable_and_absent')

		const createdMember = await api.createMember({ email: originalEmail })
		testMemberId = String(createdMember.id)
		const foundMember = await api.findMember(originalEmail)
		assert(foundMember, 'created Mighty member must be discoverable')
		assert.equal(String(foundMember.id), testMemberId, 'find must return the created member')

		const firstGrant = await api.grantAccess(foundMember.id, config.accessPlanId)
		assert(firstGrant, 'first Mighty grant must return a plan')
		const afterFirstGrant = purchaseIds(await api.findPurchases(foundMember.id, config.accessPlanId))
		assert.equal(afterFirstGrant.length, 1, 'first grant must create exactly one test purchase')

		await api.grantAccess(foundMember.id, config.accessPlanId)
		const afterRepeatedGrant = purchaseIds(await api.findPurchases(foundMember.id, config.accessPlanId))
		assert.deepEqual(afterRepeatedGrant, afterFirstGrant, 'repeated grant must not duplicate access')

		for (const purchaseId of afterRepeatedGrant) await api.revokeAccess(purchaseId, { immediate: true })
		assert.deepEqual(
			purchaseIds(await api.findPurchases(foundMember.id, config.accessPlanId)),
			[],
			'revoke must remove all test access',
		)

		await api.restoreAccess(foundMember.id, config.accessPlanId)
		const afterRestore = purchaseIds(await api.findPurchases(foundMember.id, config.accessPlanId))
		assert.equal(afterRestore.length, 1, 'restore must return one test purchase')

		const stableIdentityResult = await reconcileAccess({
			row: {
				id: 'staging-acceptance',
				email: changedEmail,
				normalizedEmail: changedEmail,
				stripeCustomerId: 'staging-acceptance-customer',
				stripeSubscriptionId: 'staging-acceptance-subscription',
				lastStripeEventId: 'staging-acceptance-event',
				plan: 'jpv_bootcamp_membership',
				desiredAccess: 'ALLOWED',
				mightyMemberId: testMemberId,
				mightyPurchaseId: afterRestore[0] ?? null,
				welcomeRequired: false,
				welcomeSentAt: null,
				attemptCount: 0,
			},
			config,
			api,
		})
		assert.equal(String(stableIdentityResult.mightyMemberId), testMemberId)
		assert.equal(stableIdentityResult.mightyPurchaseId, afterRestore[0])
		const afterChangedEmail = purchaseIds(await api.findPurchases(foundMember.id, config.accessPlanId))
		assert.deepEqual(afterChangedEmail, afterRestore, 'changed email must reuse the stable Mighty member and purchase')

		report = {
			environment: 'staging',
			memberCreated: true,
			memberFoundExactlyOnce: true,
			grantSucceeded: true,
			repeatedGrantWasIdempotent: true,
			revokeSucceeded: true,
			restoreSucceeded: true,
			changedEmailReusedStableMember: true,
		}
	} finally {
		if (testMemberId) {
			const remainingPurchases = purchaseIds(await api.findPurchases(testMemberId, config.accessPlanId))
			for (const purchaseId of remainingPurchases) await api.revokeAccess(purchaseId, { immediate: true })
			assert.deepEqual(
				purchaseIds(await api.findPurchases(testMemberId, config.accessPlanId)),
				[],
				'acceptance cleanup must remove disposable test access',
			)
		}
	}

	if (!report) throw new Error('mighty_acceptance_report_missing')
	console.log(JSON.stringify({ ...report, cleanupSucceeded: true }, null, 2))
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : 'mighty_staging_acceptance_failed')
	process.exitCode = 1
})
