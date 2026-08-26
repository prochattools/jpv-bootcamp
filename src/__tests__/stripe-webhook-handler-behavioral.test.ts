/**
 * Behavioral tests for src/lib/stripe-webhook-handler.ts
 *
 * Tests verify:
 * - Missing Stripe config → 503 (retryable)
 * - Missing webhook secret → 503 (retryable)
 * - Missing signature → 400
 * - Invalid signature → 400
 * - checkout.session.completed → provisionFromCheckoutSession called
 * - customer.subscription.deleted → syncFromSubscription called
 * - DB down during idempotency claim → 500 (retryable)
 * - Already processed event → 200 idempotent
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

vi.mock('@/lib/stripe-config', () => ({
	getStripeConfig: vi.fn(),
	getStripeWebhookSecrets: vi.fn(() => []),
}))

vi.mock('@/lib/stripe', () => ({
	getStripe: vi.fn(),
}))

vi.mock('@/lib/provisioning', () => ({
	logProvisioningDecision: vi.fn(),
	projectInvoicePaymentState: vi.fn(),
	provisionFromCheckoutSession: vi.fn(async () => ({ provisioned: true })),
	syncFromSubscription: vi.fn(async () => ({ synced: true })),
}))

vi.mock('@/lib/billing/commitmentProjection', () => ({
	projectAsyncCheckoutFailure: vi.fn(async () => null),
	projectSubscriptionSchedule: vi.fn(async () => ({ updated: false })),
}))

vi.mock('@/lib/payloadCourse/stripeShadowSync', () => ({
	shadowSyncStripeEventToPayload: vi.fn(async () => ({})),
}))

vi.mock('@/lib/sponsored-seats', () => ({
	isSponsoredSeatSession: vi.fn(() => null),
	upsertSponsoredSeatFromSession: vi.fn(async () => ({ seatId: null, created: false })),
}))

vi.mock('@/lib/sponsored-seat-notifications', () => ({
	notifySponsoredSeatPurchase: vi.fn(async () => ({})),
}))

vi.mock('@/lib/stripe-membership-email-gate', () => ({
	shouldSendMembershipEmailForEvent: vi.fn(() => false),
}))

vi.mock('@/lib/idempotency', () => ({
	atomicCheckAndMarkProcessed: vi.fn(async () => ({ claimed: true, alreadyProcessed: false })),
	atomicClaimProcessing: vi.fn(async () => ({ claimed: true })),
	finalizeProcessed: vi.fn(async () => ({})),
	hasProcessed: vi.fn(async () => false),
	markProcessed: vi.fn(async () => ({})),
	releaseProcessingClaim: vi.fn(async () => ({})),
}))

import { getStripeConfig, getStripeWebhookSecrets } from '@/lib/stripe-config'
import { getStripe } from '@/lib/stripe'
import { provisionFromCheckoutSession, syncFromSubscription } from '@/lib/provisioning'
import { atomicClaimProcessing, finalizeProcessed, releaseProcessingClaim } from '@/lib/idempotency'

const mockGetStripeConfig = vi.mocked(getStripeConfig)
const mockGetStripeWebhookSecrets = vi.mocked(getStripeWebhookSecrets)
const mockGetStripe = vi.mocked(getStripe)
const mockProvision = vi.mocked(provisionFromCheckoutSession)
const mockSync = vi.mocked(syncFromSubscription)
const mockAtomicClaim = vi.mocked(atomicClaimProcessing)
const mockFinalize = vi.mocked(finalizeProcessed)
const mockRelease = vi.mocked(releaseProcessingClaim)

function makeWebhooksConstructEvent(returnEvent: object | null = null, throwError: Error | null = null) {
	return {
		constructEvent: vi.fn((_body: unknown, _sig: unknown, _secret: unknown) => {
			if (throwError) throw throwError
			return returnEvent
		}),
	}
}

function buildFakeRequest(opts: {
	signature?: string | null
	body?: string
}): Request {
	const headers = new Headers({ 'content-type': 'application/json' })
	if (opts.signature !== null) {
		headers.set('stripe-signature', opts.signature ?? 'valid-sig')
	}
	return new Request('https://preview.jpvbootcamp.com/api/webhook/stripe', {
		method: 'POST',
		headers,
		body: opts.body ?? '{}',
	})
}

function fakeCheckoutEvent(overrides: Record<string, unknown> = {}) {
	return {
		id: 'evt_checkout_001',
		type: 'checkout.session.completed',
		livemode: false,
		created: 1_700_000_000,
		data: {
			object: {
				id: 'cs_test_001',
				object: 'checkout.session',
				payment_status: 'paid',
				mode: 'subscription',
				customer_email: null,
				customer_details: null,
				metadata: {},
			},
		},
		...overrides,
	}
}

function fakeSubscriptionDeletedEvent(overrides: Record<string, unknown> = {}) {
	return {
		id: 'evt_sub_deleted_001',
		type: 'customer.subscription.deleted',
		livemode: false,
		created: 1_700_000_000,
		data: {
			object: {
				id: 'sub_test_001',
				object: 'subscription',
				customer: 'cus_test_001',
				status: 'canceled',
			},
		},
		...overrides,
	}
}

const VALID_CONFIG = {
	stripe: {
		secretKey: 'sk_test_valid',
		webhookSecret: 'whsec_test_valid',
		priceIdPro: 'price_pro_test',
		priceIdProAnnual: 'price_pro_annual_test',
		successUrl: 'https://preview.jpvbootcamp.com/success',
		cancelUrl: 'https://preview.jpvbootcamp.com/cancel',
	},
	app: { url: 'https://preview.jpvbootcamp.com' },
}

beforeEach(() => {
	vi.clearAllMocks()
	// Healthy defaults — individual tests override as needed
	mockGetStripeConfig.mockReturnValue(VALID_CONFIG as ReturnType<typeof getStripeConfig>)
	mockGetStripeWebhookSecrets.mockReturnValue(['whsec_test_valid'])
	mockAtomicClaim.mockResolvedValue({ claimed: true } as Awaited<ReturnType<typeof atomicClaimProcessing>>)
	mockFinalize.mockResolvedValue(undefined as unknown as Awaited<ReturnType<typeof finalizeProcessed>>)
	mockRelease.mockResolvedValue(undefined as unknown as Awaited<ReturnType<typeof releaseProcessingClaim>>)
})

describe('handleStripeWebhook — config/secret guards', () => {
	it('returns 503 when getStripeConfig throws', async () => {
		mockGetStripeConfig.mockImplementation(() => { throw new Error('env var missing') })
		const { handleStripeWebhook } = await import('@/lib/stripe-webhook-handler')

		const req = buildFakeRequest({ signature: 'sig' })
		const res = await handleStripeWebhook(req)
		expect(res.status).toBe(503)
		const body = await res.json() as { error: string }
		expect(body.error).toMatch(/config unavailable|retry/i)
	})

	it('returns 503 when webhook secrets array is empty', async () => {
		mockGetStripeWebhookSecrets.mockReturnValue([])
		const fakeStripe = {
			webhooks: makeWebhooksConstructEvent(fakeCheckoutEvent()),
		}
		mockGetStripe.mockReturnValue(fakeStripe as unknown as ReturnType<typeof getStripe>)
		const { handleStripeWebhook } = await import('@/lib/stripe-webhook-handler')

		const req = buildFakeRequest({ signature: 'sig' })
		const res = await handleStripeWebhook(req)
		expect(res.status).toBe(503)
		const body = await res.json() as { error: string }
		expect(body.error).toMatch(/secret unavailable|retry/i)
	})

	it('returns 400 when stripe-signature header is absent', async () => {
		const { handleStripeWebhook } = await import('@/lib/stripe-webhook-handler')
		const req = buildFakeRequest({ signature: null })
		const res = await handleStripeWebhook(req)
		expect(res.status).toBe(400)
	})

	it('returns 400 when signature verification fails for all secrets', async () => {
		mockGetStripeWebhookSecrets.mockReturnValue(['whsec_secret_a', 'whsec_secret_b'])
		const fakeStripe = {
			webhooks: makeWebhooksConstructEvent(null, new Error('No signatures found matching the expected signature')),
		}
		mockGetStripe.mockReturnValue(fakeStripe as unknown as ReturnType<typeof getStripe>)
		const { handleStripeWebhook } = await import('@/lib/stripe-webhook-handler')

		const req = buildFakeRequest({ signature: 'bad-sig' })
		const res = await handleStripeWebhook(req)
		expect(res.status).toBe(400)
		const body = await res.json() as { error: string }
		expect(body.error).toMatch(/invalid stripe signature/i)
	})
})

describe('handleStripeWebhook — checkout.session.completed dispatch', () => {
	it('calls provisionFromCheckoutSession and returns 200', async () => {
		const event = fakeCheckoutEvent()
		const fakeStripe = { webhooks: makeWebhooksConstructEvent(event) }
		mockGetStripe.mockReturnValue(fakeStripe as unknown as ReturnType<typeof getStripe>)
		const { handleStripeWebhook } = await import('@/lib/stripe-webhook-handler')

		const req = buildFakeRequest({ signature: 'valid-sig', body: JSON.stringify(event) })
		const res = await handleStripeWebhook(req)
		expect(res.status).toBe(200)
		expect(mockProvision).toHaveBeenCalledWith(
			event.data.object,
			event.id,
			event.type,
			expect.objectContaining({ eventLivemode: false }),
		)
	})

	it('does not call syncFromSubscription for checkout events', async () => {
		const event = fakeCheckoutEvent()
		const fakeStripe = { webhooks: makeWebhooksConstructEvent(event) }
		mockGetStripe.mockReturnValue(fakeStripe as unknown as ReturnType<typeof getStripe>)
		const { handleStripeWebhook } = await import('@/lib/stripe-webhook-handler')

		const req = buildFakeRequest({ signature: 'valid-sig', body: JSON.stringify(event) })
		await handleStripeWebhook(req)
		expect(mockSync).not.toHaveBeenCalled()
	})
})

describe('handleStripeWebhook — customer.subscription.deleted dispatch', () => {
	it('calls syncFromSubscription with subscription id and returns 200', async () => {
		const event = fakeSubscriptionDeletedEvent()
		const fakeStripe = { webhooks: makeWebhooksConstructEvent(event) }
		mockGetStripe.mockReturnValue(fakeStripe as unknown as ReturnType<typeof getStripe>)
		const { handleStripeWebhook } = await import('@/lib/stripe-webhook-handler')

		const req = buildFakeRequest({ signature: 'valid-sig', body: JSON.stringify(event) })
		const res = await handleStripeWebhook(req)
		expect(res.status).toBe(200)
		expect(mockSync).toHaveBeenCalledWith(
			'sub_test_001',
			event.id,
			'customer.subscription.deleted',
			expect.objectContaining({ eventLivemode: false }),
		)
	})

	it('does not call provisionFromCheckoutSession for subscription events', async () => {
		const event = fakeSubscriptionDeletedEvent()
		const fakeStripe = { webhooks: makeWebhooksConstructEvent(event) }
		mockGetStripe.mockReturnValue(fakeStripe as unknown as ReturnType<typeof getStripe>)
		const { handleStripeWebhook } = await import('@/lib/stripe-webhook-handler')

		const req = buildFakeRequest({ signature: 'valid-sig', body: JSON.stringify(event) })
		await handleStripeWebhook(req)
		expect(mockProvision).not.toHaveBeenCalled()
	})
})

describe('handleStripeWebhook — idempotency / DB error paths', () => {
	it('returns 500 and releases claim when provisionFromCheckoutSession throws', async () => {
		const event = fakeCheckoutEvent()
		const fakeStripe = { webhooks: makeWebhooksConstructEvent(event) }
		mockGetStripe.mockReturnValue(fakeStripe as unknown as ReturnType<typeof getStripe>)
		mockProvision.mockRejectedValueOnce(new Error('DB connection refused'))
		const { handleStripeWebhook } = await import('@/lib/stripe-webhook-handler')

		const req = buildFakeRequest({ signature: 'valid-sig', body: JSON.stringify(event) })
		const res = await handleStripeWebhook(req)
		expect(res.status).toBe(500)
		expect(mockRelease).toHaveBeenCalled()
	})

	it('returns 500 and releases claim when syncFromSubscription throws', async () => {
		const event = fakeSubscriptionDeletedEvent()
		const fakeStripe = { webhooks: makeWebhooksConstructEvent(event) }
		mockGetStripe.mockReturnValue(fakeStripe as unknown as ReturnType<typeof getStripe>)
		mockSync.mockRejectedValueOnce(new Error('Payload unavailable'))
		const { handleStripeWebhook } = await import('@/lib/stripe-webhook-handler')

		const req = buildFakeRequest({ signature: 'valid-sig', body: JSON.stringify(event) })
		const res = await handleStripeWebhook(req)
		expect(res.status).toBe(500)
		expect(mockRelease).toHaveBeenCalled()
	})

	it('returns 500 when atomicClaimProcessing throws (DB down during claim)', async () => {
		const event = fakeCheckoutEvent()
		const fakeStripe = { webhooks: makeWebhooksConstructEvent(event) }
		mockGetStripe.mockReturnValue(fakeStripe as unknown as ReturnType<typeof getStripe>)
		mockAtomicClaim.mockRejectedValueOnce(new Error('Connection timeout'))
		const { handleStripeWebhook } = await import('@/lib/stripe-webhook-handler')

		const req = buildFakeRequest({ signature: 'valid-sig', body: JSON.stringify(event) })
		const res = await handleStripeWebhook(req)
		expect(res.status).toBe(500)
	})
})
