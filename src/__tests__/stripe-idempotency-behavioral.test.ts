/**
 * Behavioral tests for src/lib/idempotency.ts
 *
 * Tests use vitest with a mocked @/libs/prisma to exercise real code paths
 * rather than static source assertions.
 *
 * Run: pnpm exec vitest run src/__tests__/stripe-idempotency-behavioral.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks must be declared before any imports that reference the mocked modules ──

vi.mock('server-only', () => ({}))

vi.mock('@/lib/config', () => ({
	getOpsConfig: vi.fn(() => ({ idempotencyTtlHours: 24 })),
}))

// We will configure the prisma mock per-test using the factory reference below.
const mockStripeWebhookEvent = {
	findUnique: vi.fn(),
	create: vi.fn(),
	update: vi.fn(),
	delete: vi.fn(),
	deleteMany: vi.fn(),
}

vi.mock('@/libs/prisma', () => ({
	default: {
		stripeWebhookEvent: mockStripeWebhookEvent,
	},
}))

// ── Ensure DATABASE_URL is set so shouldUsePrisma = true inside idempotency.ts ──
beforeEach(() => {
	process.env.DATABASE_URL = 'postgresql://test:test@localhost/test'
	// Reset all mock implementations and call counts between tests.
	vi.clearAllMocks()
	// Default no-ops to avoid unintentional throws.
	mockStripeWebhookEvent.findUnique.mockResolvedValue(null)
	mockStripeWebhookEvent.create.mockResolvedValue({ eventId: 'evt_test' })
	mockStripeWebhookEvent.update.mockResolvedValue({ eventId: 'evt_test' })
	mockStripeWebhookEvent.delete.mockResolvedValue({ eventId: 'evt_test' })
	mockStripeWebhookEvent.deleteMany.mockResolvedValue({ count: 0 })
})

// ── Import the module under test AFTER mocks are declared ──
// Dynamic import inside tests avoids Vitest hoisting issues.
async function getIdempotency() {
	// Force module re-evaluation per test suite run (mocks reset between files).
	const mod = await import('@/lib/idempotency')
	return mod
}

// ─────────────────────────────────────────────────────────────────────────────

describe('atomicClaimProcessing', () => {
	it('concurrent duplicate: second claim returns {claimed:false, alreadyProcessed:false}', async () => {
		const { atomicClaimProcessing } = await getIdempotency()

		const p2002 = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' })

		// First call: create throws P2002 (simulating a race with another worker).
		mockStripeWebhookEvent.create.mockRejectedValue(p2002)
		// Lookup returns a row with processedAt=null (other worker is in-flight).
		mockStripeWebhookEvent.findUnique.mockResolvedValue({
			eventId: 'evt_concurrent',
			processedAt: null,
			receivedAt: new Date(), // fresh — not stale
			payload: { _ownerToken: 'other-worker-token' },
		})

		const result = await atomicClaimProcessing({
			eventId: 'evt_concurrent',
			eventType: 'checkout.session.completed',
			livemode: false,
		})

		expect(result.claimed).toBe(false)
		expect(result.alreadyProcessed).toBe(false)
	})

	it('already processed: claim returns {claimed:false, alreadyProcessed:true}', async () => {
		const { atomicClaimProcessing } = await getIdempotency()

		const p2002 = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' })

		mockStripeWebhookEvent.create.mockRejectedValue(p2002)
		// Lookup returns a row with processedAt set — already done.
		mockStripeWebhookEvent.findUnique.mockResolvedValue({
			eventId: 'evt_done',
			processedAt: new Date(),
			receivedAt: new Date(Date.now() - 5000),
			payload: {},
		})

		const result = await atomicClaimProcessing({
			eventId: 'evt_done',
			eventType: 'checkout.session.completed',
			livemode: false,
		})

		expect(result.claimed).toBe(false)
		expect(result.alreadyProcessed).toBe(true)
	})

	it('stale claim recovery: stale row is reclaimed via atomic update', async () => {
		const { atomicClaimProcessing } = await getIdempotency()

		const p2002 = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' })

		mockStripeWebhookEvent.create.mockRejectedValueOnce(p2002)

		// The existing row is stale: processedAt=null, receivedAt > 10 min ago.
		const staleReceivedAt = new Date(Date.now() - 15 * 60 * 1000) // 15 min ago
		mockStripeWebhookEvent.findUnique.mockResolvedValue({
			eventId: 'evt_stale',
			processedAt: null,
			receivedAt: staleReceivedAt,
			payload: { _ownerToken: 'dead-worker-token' },
		})

		mockStripeWebhookEvent.update.mockResolvedValue({ eventId: 'evt_stale' })

		const result = await atomicClaimProcessing({
			eventId: 'evt_stale',
			eventType: 'invoice.paid',
			livemode: false,
		})

		expect(result.claimed).toBe(true)
		expect(result.alreadyProcessed).toBe(false)
		expect(result.ownerToken).toBeTruthy()
		// Verify update was called to reclaim the stale row (not delete + re-create).
		expect(mockStripeWebhookEvent.update).toHaveBeenCalledWith({
			where: { eventId: 'evt_stale' },
			data: expect.objectContaining({ receivedAt: expect.any(Date) }),
		})
		expect(mockStripeWebhookEvent.delete).not.toHaveBeenCalled()
	})

	it('production DB outage: throws instead of falling back to memory', async () => {
		const { atomicClaimProcessing } = await getIdempotency()

		const originalNodeEnv = process.env.NODE_ENV
		process.env.NODE_ENV = 'production'

		try {
			const dbError = new Error('Connection refused')
			// Non-P2002 error — connectivity failure.
			mockStripeWebhookEvent.create.mockRejectedValue(dbError)

			await expect(
				atomicClaimProcessing({
					eventId: 'evt_prod_outage',
					eventType: 'checkout.session.completed',
					livemode: true,
				})
			).rejects.toThrow('idempotency_db_unavailable')
		} finally {
			process.env.NODE_ENV = originalNodeEnv
		}
	})
})

// ─────────────────────────────────────────────────────────────────────────────

describe('finalizeProcessed', () => {
	it('finalize failure: throws on DB error', async () => {
		const { finalizeProcessed } = await getIdempotency()

		mockStripeWebhookEvent.update.mockRejectedValue(new Error('DB connection lost'))

		await expect(finalizeProcessed('evt_finalize_fail')).rejects.toThrow('DB connection lost')
	})

	it('owner token verification: finalize rejects wrong token', async () => {
		const { finalizeProcessed } = await getIdempotency()

		mockStripeWebhookEvent.findUnique.mockResolvedValue({
			eventId: 'evt_ot',
			processedAt: null,
			receivedAt: new Date(),
			payload: { _ownerToken: 'correct-token' },
		})

		await expect(
			finalizeProcessed('evt_ot', 'wrong-token')
		).rejects.toThrow('idempotency_owner_mismatch')

		// Verify update was NOT called after the mismatch.
		expect(mockStripeWebhookEvent.update).not.toHaveBeenCalled()
	})

	it('owner token verification: finalize succeeds with correct token', async () => {
		const { finalizeProcessed } = await getIdempotency()

		mockStripeWebhookEvent.findUnique.mockResolvedValue({
			eventId: 'evt_ot_ok',
			processedAt: null,
			receivedAt: new Date(),
			payload: { _ownerToken: 'correct-token' },
		})
		mockStripeWebhookEvent.update.mockResolvedValue({ eventId: 'evt_ot_ok' })
		mockStripeWebhookEvent.deleteMany.mockResolvedValue({ count: 0 })

		await expect(
			finalizeProcessed('evt_ot_ok', 'correct-token')
		).resolves.toBeUndefined()

		expect(mockStripeWebhookEvent.update).toHaveBeenCalledWith({
			where: { eventId: 'evt_ot_ok' },
			data: { processedAt: expect.any(Date) },
		})
	})
})

// ─────────────────────────────────────────────────────────────────────────────

describe('releaseProcessingClaim', () => {
	it('release failure: throws on DB error', async () => {
		const { releaseProcessingClaim } = await getIdempotency()

		mockStripeWebhookEvent.delete.mockRejectedValue(new Error('DB timeout'))

		await expect(releaseProcessingClaim('evt_release_fail')).rejects.toThrow('DB timeout')
	})

	it('owner token verification: release rejects wrong token', async () => {
		const { releaseProcessingClaim } = await getIdempotency()

		mockStripeWebhookEvent.findUnique.mockResolvedValue({
			eventId: 'evt_rel_ot',
			processedAt: null,
			receivedAt: new Date(),
			payload: { _ownerToken: 'correct-token' },
		})

		await expect(
			releaseProcessingClaim('evt_rel_ot', 'wrong-token')
		).rejects.toThrow('idempotency_owner_mismatch')

		// Verify delete was NOT called after the mismatch.
		expect(mockStripeWebhookEvent.delete).not.toHaveBeenCalled()
	})

	it('owner token verification: release succeeds with correct token', async () => {
		const { releaseProcessingClaim } = await getIdempotency()

		mockStripeWebhookEvent.findUnique.mockResolvedValue({
			eventId: 'evt_rel_ot_ok',
			processedAt: null,
			receivedAt: new Date(),
			payload: { _ownerToken: 'correct-token' },
		})
		mockStripeWebhookEvent.delete.mockResolvedValue({ eventId: 'evt_rel_ot_ok' })

		await expect(
			releaseProcessingClaim('evt_rel_ot_ok', 'correct-token')
		).resolves.toBeUndefined()

		expect(mockStripeWebhookEvent.delete).toHaveBeenCalledWith({
			where: { eventId: 'evt_rel_ot_ok' },
		})
	})
})
