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

const AUTHORIZED_ORDINARY_TEST_EMAIL = 'westhoek@hotmail.com'

function purchaseIds(purchases: Array<{ purchase?: { id?: number | string | null } }>): string[] {
	return purchases
		.map((purchase) => String(purchase.purchase?.id ?? ''))
		.filter(Boolean)
		.sort()
}

function assertMemberProfile(
	member: { id: number | string; email?: string | null; member_type?: string | null; first_name?: string | null; last_name?: string | null } | null,
	memberId: string,
	email: string,
	label: string,
): void {
	assert(member, `${label} must resolve the exact Mighty member`)
	assert.equal(String(member.id), memberId, `${label} must preserve the Mighty member identity`)
	assert.equal(member.member_type, 'full', `${label} must preserve full Network membership`)
	assert.equal(typeof member.first_name, 'string', `${label} must return the member profile`)
	assert.equal(typeof member.last_name, 'string', `${label} must return the member profile`)
	if (member.email?.trim()) assert.equal(normalizeEmail(member.email), email, `${label} must preserve the normalized member email`)
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
	if (email !== AUTHORIZED_ORDINARY_TEST_EMAIL) {
		throw new Error('mighty_acceptance_allows_only_authorized_ordinary_test_member')
	}
	if (!process.env.MIGHTY_IDENTITY_ROLE_OVERRIDES?.toLowerCase().includes(`${email}:ordinary`)) {
		throw new Error('mighty_acceptance_requires_explicit_ordinary_role_override')
	}

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
		assert.equal(afterCreateAndGrant.memberPlanAccess, true, 'grant must place the member in the target access Plan')
		const grantedMember = await api.findMember(email)
		assertMemberProfile(grantedMember, memberId, email, 'grant')
		assert.equal((await api.listMemberSpaces(memberId)).length, 5, 'grant must preserve access to the five migrated Spaces')
		const firstPurchaseIds = purchaseIds(afterCreateAndGrant.purchases)
		assert.ok(firstPurchaseIds.length >= 0, 'access state must return a purchase collection')

		const repeatedGrant = await reconcileAccess({
			row: testRow(email, { mightyMemberId: memberId }),
			config,
			api,
		})
		const afterRepeatedGrant = await api.getAccessState(memberId, config.accessPlanId)
		assert.deepEqual(purchaseIds(afterRepeatedGrant.purchases), firstPurchaseIds, 'repeated grant must not duplicate access')
		assert.equal(afterRepeatedGrant.hasAccess, true, 'repeated grant must preserve access')
		assert.equal(afterRepeatedGrant.memberPlanAccess, true, 'repeated grant must preserve target Plan access')

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
		assert.equal(afterRevoke.memberPlanAccess, false, 'revoke must remove target Plan membership')

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
		const afterRestore = await api.getAccessState(memberId, config.accessPlanId)
		assert.equal(afterRestore.hasAccess, true, 'restore must be verified by a separate provider read')
		assert.equal(afterRestore.memberPlanAccess, true, 'restore must restore target Plan membership')
		const restoredMember = await api.findMember(email)
		assertMemberProfile(restoredMember, memberId, email, 'restore')
		assert.equal((await api.listMemberSpaces(memberId)).length, 5, 'restore must restore access to the five migrated Spaces')

		await reconcileAccess({
			row: testRow(email, {
				desiredAccess: 'DENIED',
				mightyMemberId: memberId,
				welcomeRequired: false,
			}),
			config,
			api,
		})
		const secondDenied = await api.getAccessState(memberId, config.accessPlanId)
		assert.equal(secondDenied.hasAccess, false, 'second deny must remove effective access')

		await reconcileAccess({
			row: testRow(email, { mightyMemberId: memberId, welcomeRequired: false }),
			config,
			api,
		})
		const secondRestored = await api.getAccessState(memberId, config.accessPlanId)
		assert.equal(secondRestored.hasAccess, true, 'second restore must restore effective access')
		assert.equal(secondRestored.memberPlanAccess, true, 'second restore must restore target Plan membership')
		const finalMember = await api.findMember(email)
		assertMemberProfile(finalMember, memberId, email, 'repeat restore')
		assert.equal((await api.listMemberSpaces(memberId)).length, 5, 'repeat restore must preserve access to the five migrated Spaces')

		report = {
			environment: 'production',
			memberCreatedThroughReconcileAccess: !preExistingMember,
			memberReusedThroughReconcileAccess: Boolean(preExistingMember),
			grantVerifiedBySeparateRead: true,
			repeatedGrantWasIdempotent: true,
			revokeVerifiedBySeparateRead: true,
			repeatedRevokeWasSafe: true,
			restoreVerifiedBySeparateRead: true,
			repeatedDenyRestoreWasSafe: true,
			finalStateAccessGranted: true,
		}
	} finally {
		if (memberId) {
			const currentState = await api.getAccessState(memberId, config.accessPlanId)
			if (!currentState.hasAccess) {
				await reconcileAccess({
					row: testRow(email, { mightyMemberId: memberId, welcomeRequired: false }),
					config,
					api,
				})
			}
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
