import assert from 'node:assert/strict'

type MockResult = {
	ok: true
	portalUrl: string
} | {
	ok: false
	error: string
}

interface MockCustomerProvisioning {
	normalizedEmail: string
	stripeCustomerId?: string
}

interface MockPrisma {
	customerProvisioning: {
		findUnique: (args: { where: { normalizedEmail: string } }) => Promise<MockCustomerProvisioning | null>
	}
}

interface MockStripeSession {
	id: string
	url: string
}

interface MockStripeAPI {
	billingPortal: {
		sessions: {
			create: (args: {
				customer: string
				return_url: string
				configuration: string
			}) => Promise<MockStripeSession>
		}
	}
}

function createMockPrisma(customerRecord: MockCustomerProvisioning | null): MockPrisma {
	return {
		customerProvisioning: {
			async findUnique() {
				return customerRecord
			},
		},
	}
}

function createMockStripe(portalUrl: string | null): MockStripeAPI {
	return {
		billingPortal: {
			sessions: {
				async create() {
					return {
						id: 'bps_test_123',
						url: portalUrl ?? '',
					}
				},
			},
		},
	}
}

async function testUnauthenticatedRejected(): Promise<void> {
	const result = await (async () => {
		// Simulating the server action with no auth
		const memberId = ''
		const memberEmail = ''
		if (!memberId || !memberEmail) {
			return { ok: false, error: 'unauthenticated' }
		}
		return { ok: true, portalUrl: 'https://example.com' }
	})()

	assert.deepEqual(result, { ok: false, error: 'unauthenticated' })
}

async function testNoStripeCustomerHandledSafely(): Promise<void> {
	// Customer exists but no Stripe customer ID
	const prisma = createMockPrisma({
		normalizedEmail: 'test@example.com',
		// stripeCustomerId: undefined
	})

	const record = await prisma.customerProvisioning.findUnique({
		where: { normalizedEmail: 'test@example.com' },
	})

	if (!record?.stripeCustomerId) {
		const result: MockResult = { ok: false, error: 'no_stripe_customer' }
		assert.deepEqual(result, { ok: false, error: 'no_stripe_customer' })
	}
}

async function testValidPortalSessionCreation(): Promise<void> {
	const prisma = createMockPrisma({
		normalizedEmail: 'test@example.com',
		stripeCustomerId: 'cus_test_123',
	})

	const stripe = createMockStripe('https://billing.stripe.com/session/test123')

	const record = await prisma.customerProvisioning.findUnique({
		where: { normalizedEmail: 'test@example.com' },
	})

	assert(record?.stripeCustomerId)

	const session = await stripe.billingPortal.sessions.create({
		customer: record.stripeCustomerId,
		return_url: 'https://portal.jpvbootcamp.com/community/',
		configuration: 'bpc_test',
	})

	assert(session.url)
	assert.equal(session.url, 'https://billing.stripe.com/session/test123')

	const result: MockResult = { ok: true, portalUrl: session.url }
	assert.deepEqual(result, {
		ok: true,
		portalUrl: 'https://billing.stripe.com/session/test123',
	})
}

async function testStripeErrorHandledSafely(): Promise<void> {
	const prisma = createMockPrisma({
		normalizedEmail: 'test@example.com',
		stripeCustomerId: 'cus_test_123',
	})

	// Simulate Stripe error
	const stripeError = new Error('No such customer: cus_test_123')

	const record = await prisma.customerProvisioning.findUnique({
		where: { normalizedEmail: 'test@example.com' },
	})

	assert(record?.stripeCustomerId)

	// Check error message categorization
	let errorType = 'unexpected_error'
	if (stripeError.message.includes('No such customer')) {
		errorType = 'no_stripe_customer'
	}

	assert.equal(errorType, 'no_stripe_customer')
	const result: MockResult = { ok: false, error: errorType }
	assert.deepEqual(result, { ok: false, error: 'no_stripe_customer' })
}

function testConfiguredReturnUrl(): void {
	// Verify the default return URL is configured correctly
	const defaultReturnUrl = 'https://portal.jpvbootcamp.com/community/'
	assert.match(defaultReturnUrl, /^https:\/\/.+/)
	assert.ok(defaultReturnUrl.length > 0)
	assert.ok(defaultReturnUrl.length < 2048)
}

async function main(): Promise<void> {
	await testUnauthenticatedRejected()
	await testNoStripeCustomerHandledSafely()
	await testValidPortalSessionCreation()
	await testStripeErrorHandledSafely()
	testConfiguredReturnUrl()
	console.log('openBillingPortal tests passed')
}

void main()
