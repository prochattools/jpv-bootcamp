import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/mighty/accessSync', () => ({
	queueMightyAccessSync: vi.fn(async () => ({ queued: true, rowId: 'sync_synthetic' })),
}))

import { queueMightyAccessSync } from '@/lib/mighty/accessSync'
import {
	bootstrapMightyAccessSync,
	PHASE_A_BOOTSTRAP_EMAIL,
} from '@/lib/mighty/bootstrap'

const queueMock = vi.mocked(queueMightyAccessSync)

function localIdentity(overrides: Record<string, unknown> = {}) {
	return {
		id: 'local-westhoek',
		email: PHASE_A_BOOTSTRAP_EMAIL,
		normalizedEmail: PHASE_A_BOOTSTRAP_EMAIL,
		stripeCustomerId: 'cus_westhoek_synthetic',
		stripeSubscriptionId: 'sub_westhoek_synthetic',
		status: 'active',
		plan: 'jpv_bootcamp_membership',
		currentPlan: null,
		subscriptionStatus: 'active',
		subscriptionUpdatedAt: new Date(1_700_000_000_000),
		paymentStatus: 'paid',
		...overrides,
	}
}

function fakeStore(local = localIdentity()) {
	return {
		customerProvisioning: {
			findUnique: vi.fn(async ({ where }: { where: Record<string, string> }) => {
				if (where.normalizedEmail === PHASE_A_BOOTSTRAP_EMAIL) return local
				if (where.stripeCustomerId === local.stripeCustomerId) return { id: local.id, normalizedEmail: local.normalizedEmail }
				if (where.stripeSubscriptionId === local.stripeSubscriptionId) return { id: local.id, normalizedEmail: local.normalizedEmail }
				return null
			}),
		},
	} as never
}

function fakeStripe(overrides: Record<string, unknown> = {}) {
	const customerRetrieve = vi.fn(async () => ({
		id: 'cus_westhoek_synthetic',
		object: 'customer',
		email: PHASE_A_BOOTSTRAP_EMAIL,
	}))
	const subscriptionRetrieve = vi.fn(async () => ({
		id: 'sub_westhoek_synthetic',
		object: 'subscription',
		customer: 'cus_westhoek_synthetic',
		status: 'active',
		created: 1_700_000_000,
		updated: 1_700_000_100,
		...overrides,
	}))
	return { customers: { retrieve: customerRetrieve }, subscriptions: { retrieve: subscriptionRetrieve }, customerRetrieve, subscriptionRetrieve } as never
}

beforeEach(() => {
	vi.clearAllMocks()
	queueMock.mockResolvedValue({ queued: true, rowId: 'sync_synthetic' })
})

describe('Phase A exact-account authoritative queue bootstrap', () => {
	it('reads one exact Stripe identity, derives ALLOWED, queues provenance, and performs no Mighty operation', async () => {
		const stripe = fakeStripe()
		const result = await bootstrapMightyAccessSync({
			email: PHASE_A_BOOTSTRAP_EMAIL,
			stripe,
			prismaClient: fakeStore(),
		})

		expect(result).toMatchObject({ queued: true, desiredAccess: 'ALLOWED', stateSource: 'operator_bootstrap' })
		expect(stripe.customerRetrieve).toHaveBeenCalledOnce()
		expect(stripe.subscriptionRetrieve).toHaveBeenCalledOnce()
		expect(queueMock).toHaveBeenCalledOnce()
		expect(queueMock.mock.calls[0]?.[0]).toMatchObject({
			email: PHASE_A_BOOTSTRAP_EMAIL,
			stripeCustomerId: 'cus_westhoek_synthetic',
			stripeSubscriptionId: 'sub_westhoek_synthetic',
			stateSource: 'operator_bootstrap',
			welcomeRequired: false,
		})
		expect(queueMock.mock.calls[0]?.[0]).not.toHaveProperty('stripeEventId')
	})

	it('derives DENIED from the current canceled Stripe subscription without mutating Stripe', async () => {
		const stripe = fakeStripe({ status: 'canceled' })
		const result = await bootstrapMightyAccessSync({
			email: PHASE_A_BOOTSTRAP_EMAIL,
			stripe,
			prismaClient: fakeStore(),
		})

		expect(result.desiredAccess).toBe('DENIED')
		expect(stripe.customerRetrieve).toHaveBeenCalledOnce()
		expect(stripe.subscriptionRetrieve).toHaveBeenCalledOnce()
	})

	it('repeats the same authoritative observation without fabricating an event or welcome email', async () => {
		const stripe = fakeStripe()
		const store = fakeStore()
		await bootstrapMightyAccessSync({ email: PHASE_A_BOOTSTRAP_EMAIL, stripe, prismaClient: store })
		await bootstrapMightyAccessSync({ email: PHASE_A_BOOTSTRAP_EMAIL, stripe, prismaClient: store })

		expect(queueMock).toHaveBeenCalledTimes(2)
		expect(queueMock.mock.calls[0]?.[0]).toMatchObject(queueMock.mock.calls[1]?.[0] as object)
		expect(queueMock.mock.calls[1]?.[0]).not.toHaveProperty('stripeEventType')
	})

	it('rejects every non-Westhoek email before any local or Stripe lookup', async () => {
		const store = fakeStore()
		const stripe = fakeStripe()
		for (const email of ['steve@yeshua.academy', 'info@prochat.tools', 'fourth@example.test']) {
			await expect(bootstrapMightyAccessSync({ email, stripe, prismaClient: store })).rejects.toThrow('mighty_bootstrap_email_not_authorized')
		}
		expect(store.customerProvisioning.findUnique).not.toHaveBeenCalled()
		expect(stripe.customerRetrieve).not.toHaveBeenCalled()
		expect(stripe.subscriptionRetrieve).not.toHaveBeenCalled()
		expect(queueMock).not.toHaveBeenCalled()
	})

	it('fails closed for missing or ambiguous local Stripe identity', async () => {
		const missingStore = fakeStore(null as never)
		await expect(bootstrapMightyAccessSync({ email: PHASE_A_BOOTSTRAP_EMAIL, stripe: fakeStripe(), prismaClient: missingStore })).rejects.toThrow('mighty_bootstrap_identity_missing')

		const ambiguousStore = fakeStore(localIdentity({ normalizedEmail: 'other@example.test' }))
		const stripe = fakeStripe()
		await expect(bootstrapMightyAccessSync({ email: PHASE_A_BOOTSTRAP_EMAIL, stripe, prismaClient: ambiguousStore })).rejects.toThrow('mighty_bootstrap_identity_ambiguous')
		expect(stripe.customerRetrieve).not.toHaveBeenCalled()
	})

	it('fails closed on exact Stripe mismatch, read failure, missing subscription, or unsupported state', async () => {
		const mismatch = fakeStripe()
		;(mismatch.customers.retrieve as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'cus_westhoek_synthetic', email: 'other@example.test' })
		await expect(bootstrapMightyAccessSync({ email: PHASE_A_BOOTSTRAP_EMAIL, stripe: mismatch, prismaClient: fakeStore() })).rejects.toThrow('mighty_bootstrap_stripe_customer_mismatch')

		const readFailure = fakeStripe()
		;(readFailure.subscriptions.retrieve as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('stripe_read_failed'))
		await expect(bootstrapMightyAccessSync({ email: PHASE_A_BOOTSTRAP_EMAIL, stripe: readFailure, prismaClient: fakeStore() })).rejects.toThrow('stripe_read_failed')

		const noSubscription = fakeStore(localIdentity({ stripeSubscriptionId: null }))
		await expect(bootstrapMightyAccessSync({ email: PHASE_A_BOOTSTRAP_EMAIL, stripe: fakeStripe(), prismaClient: noSubscription })).rejects.toThrow('mighty_bootstrap_stripe_identity_missing')

		await expect(bootstrapMightyAccessSync({ email: PHASE_A_BOOTSTRAP_EMAIL, stripe: fakeStripe({ status: 'unknown_state' }), prismaClient: fakeStore() })).rejects.toThrow('mighty_bootstrap_subscription_state_unsupported')
		expect(queueMock).not.toHaveBeenCalled()
	})
})
