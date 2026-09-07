/**
 * Behavioral tests for the email outbox (processEmailQueue / queueEmail / sendSupportEmail).
 *
 * Covers:
 *  1. Ambiguous Resend response (no id, no error) stays pending — not marked sent
 *  2. Dead-letter after max retries (retryCount >= 5)
 *  3. billing_failed type builds correct email subject
 *  4. PII redaction: support email log does not contain raw email address
 *  5. Staging guard blocks wrong recipient
 *  6. Welcome email idempotency: duplicate key (P2002) returns existing id
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Module mocks — must be declared before any import that resolves them
// ---------------------------------------------------------------------------

// Mock server-only so the import guard doesn't throw in test
vi.mock('server-only', () => ({}))

const mockEmailEventCreate = vi.fn()
const mockEmailEventFindMany = vi.fn()
const mockEmailEventFindUnique = vi.fn()
// updateMany is used for the atomic claim/lease step in processEmailQueue
const mockEmailEventUpdateMany = vi.fn()

vi.mock('@/libs/prisma', () => ({
	default: {
		emailEvent: {
			create: (...args: unknown[]) => mockEmailEventCreate(...args),
			findMany: (...args: unknown[]) => mockEmailEventFindMany(...args),
			findUnique: (...args: unknown[]) => mockEmailEventFindUnique(...args),
			updateMany: (...args: unknown[]) => mockEmailEventUpdateMany(...args),
		},
	},
}))

const mockResendSend = vi.fn()

vi.mock('resend', () => ({
	Resend: class MockResend {
		emails = {
			send: (...args: unknown[]) => mockResendSend(...args),
		}
	},
}))

vi.mock('@/lib/config', () => ({
	getServerConfig: vi.fn(() => ({
		email: {
			resendApiKey: 'test-resend-key',
			from: 'JPV Bootcamp <noreply@jpvbootcamp.com>',
			replyTo: 'support@jpvbootcamp.com',
			portalUrl: 'https://jpvbootcamp.com/portal',
			supportTo: 'support@jpvbootcamp.com',
		},
	})),
}))

vi.mock('@/lib/membership-email-copy', () => ({
	getMembershipEmailIntro: vi.fn(() => 'Welcome to JPV Bootcamp!'),
	getMembershipEmailIntroHtml: vi.fn(() => '<strong>Welcome to JPV Bootcamp!</strong>'),
	getPlanLabel: vi.fn((plan: string) => plan),
}))

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import {
	processEmailQueue,
	queueEmail,
	assertStagingRecipientAllowed,
	sendWelcomeEmail,
} from '@/lib/email'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePendingEvent(overrides: Record<string, unknown> = {}) {
	return {
		id: 'evt-001',
		type: 'welcome',
		recipient: 'user@example.com',
		payload: { plan: 'basic', resetUrl: 'https://jpvbootcamp.com/reset?token=abc', variant: 'welcome' },
		idempotencyKey: 'idem-001',
		retryCount: 0,
		status: 'pending',
		...overrides,
	}
}

function findLeaseTransition(status: string) {
	return mockEmailEventUpdateMany.mock.calls
		.map(([call]) => call as {
			where?: { status?: string; updatedAt?: unknown }
			data?: Record<string, unknown>
		})
		.find((call) =>
			call.where?.status === 'processing' &&
			call.where.updatedAt instanceof Date &&
			call.data?.status === status
		)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('email outbox behavioral tests', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		// Reset environment flags
		delete process.env.STAGING_EMAIL_GUARD
		delete process.env.STAGING_TEST_RECIPIENT_EMAIL
		delete process.env.DISABLE_NON_WEBHOOK_EMAILS
		// Default: no stale lease exists; atomic claims and lease-owned state
		// transitions succeed.
		mockEmailEventUpdateMany.mockImplementation(async (args: {
			where?: { status?: string; updatedAt?: { lt?: Date } | Date }
		}) => {
			if (
				args?.where?.status === 'processing' &&
				args.where.updatedAt &&
				!(args.where.updatedAt instanceof Date) &&
				args.where.updatedAt.lt instanceof Date
			) {
				return { count: 0 }
			}
			return { count: 1 }
		})
	})

	// ── Test 1: Ambiguous response stays pending ──────────────────────────────

	describe('ambiguous response (no id) stays pending, not marked sent', () => {
		it('increments retryCount and does not mark status=sent', async () => {
			const event = makePendingEvent()
			mockEmailEventFindMany.mockResolvedValueOnce([event])

			// Resend returns no error but no data.id — ambiguous
			mockResendSend.mockResolvedValueOnce({ data: null, error: null })

			const result = await processEmailQueue()

			// Should not be counted as sent
			expect(result.sent).toBe(0)
			expect(result.skipped).toBe(1)

			// Should have released the claim back to 'pending', incremented retryCount, NOT set status='sent'
			const updateCall = findLeaseTransition('pending')
			expect(updateCall).toBeDefined()
			if (!updateCall) throw new Error('pending lease transition missing')
			expect(updateCall.data.status).toBe('pending')
			expect(updateCall.data.retryCount).toEqual({ increment: 1 })
			expect(updateCall.data.errorMessage).toMatch(/ambiguous_response/)
		})
	})

	// ── Test 2: Dead-letter after max retries ─────────────────────────────────

	describe('dead letter after max retries', () => {
		it('marks status=dead_letter for event with retryCount>=5, does not call Resend', async () => {
			const event = makePendingEvent({ retryCount: 5 })
			mockEmailEventFindMany.mockResolvedValueOnce([event])

			const result = await processEmailQueue()

			// Resend should never be called
			expect(mockResendSend).not.toHaveBeenCalled()

			// Event should be dead-lettered
			expect(result.failed).toBe(1)
			expect(result.sent).toBe(0)

			const updateCall = findLeaseTransition('dead_letter')
			expect(updateCall).toBeDefined()
			if (!updateCall) throw new Error('dead-letter lease transition missing')
			expect(updateCall.data.status).toBe('dead_letter')
			expect(updateCall.data.errorMessage).toMatch(/max_retries_exceeded/)
		})

		it('also dead-letters when retryCount is greater than MAX_RETRIES (e.g. 7)', async () => {
			const event = makePendingEvent({ retryCount: 7 })
			mockEmailEventFindMany.mockResolvedValueOnce([event])

			await processEmailQueue()

			expect(mockResendSend).not.toHaveBeenCalled()
			const updateCall = findLeaseTransition('dead_letter')
			expect(updateCall).toBeDefined()
			if (!updateCall) throw new Error('dead-letter lease transition missing')
			expect(updateCall.data.status).toBe('dead_letter')
		})
	})

	// ── Test 3: billing_failed builds correct email ───────────────────────────

	describe('billing_failed type builds correct email', () => {
		it('uses the correct subject and includes portal URL', async () => {
			const event = makePendingEvent({
				type: 'billing_failed',
				payload: { portalUrl: 'https://jpvbootcamp.com/billing' },
			})
			mockEmailEventFindMany.mockResolvedValueOnce([event])

			// Resend succeeds with a real id
			mockResendSend.mockResolvedValueOnce({ data: { id: 'resend-123' }, error: null })

			const result = await processEmailQueue()

			expect(result.sent).toBe(1)
			expect(mockResendSend).toHaveBeenCalledOnce()

			const sendArgs = mockResendSend.mock.calls[0][0]
			expect(sendArgs.subject).toBe('Action needed: Your JPV Bootcamp payment failed')
			expect(sendArgs.text).toContain('https://jpvbootcamp.com/billing')
			expect(sendArgs.html).toContain('https://jpvbootcamp.com/billing')
		})

		it('falls back to emailConfig.portalUrl when payload has no portalUrl', async () => {
			const event = makePendingEvent({
				type: 'billing_failed',
				payload: {},
			})
			mockEmailEventFindMany.mockResolvedValueOnce([event])
			mockResendSend.mockResolvedValueOnce({ data: { id: 'resend-456' }, error: null })

			await processEmailQueue()

			const sendArgs = mockResendSend.mock.calls[0][0]
			// Falls back to config portalUrl
			expect(sendArgs.text).toContain('https://jpvbootcamp.com/portal')
		})
	})

	// ── Test 4: PII redaction — support email log does not contain email addr ─

	describe('PII redaction: support email log does not contain email address', () => {
		it('does not call console.log with the raw email address', async () => {
			const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

			// Inline the call to sendSupportEmail by importing it here — we need to
			// spy before the module executes the log statement. Because the mock for
			// Resend is already set up we drive this via a direct invocation.
			const { sendSupportEmail } = await import('@/lib/email')

			mockResendSend.mockResolvedValueOnce({ data: { id: 'rs-001' }, error: null })

			await sendSupportEmail({
				name: 'Test User',
				email: 'private@example.com',
				question: 'How do I access the course?',
				source: 'contact-form',
				page: '/contact',
				submittedAt: '2026-07-22T00:00:00Z',
			})

			// console.log should never have been called with the raw email address
			for (const call of consoleSpy.mock.calls) {
				const stringified = JSON.stringify(call)
				expect(stringified).not.toContain('private@example.com')
			}

			consoleSpy.mockRestore()
		})
	})

	// ── Test 5: Staging guard blocks wrong recipient ──────────────────────────
	//
	// The canonical staging guard (staging-email-guard.ts) activates automatically
	// when STAGING_TEST_RECIPIENT_EMAIL is set — no STAGING_EMAIL_GUARD flag needed.

	describe('staging guard blocks wrong recipient', () => {
		it('marks event as failed when recipient is not the allowed staging address', async () => {
			// Setting STAGING_TEST_RECIPIENT_EMAIL alone activates the guard
			process.env.STAGING_TEST_RECIPIENT_EMAIL = 'allowed@test.com'

			const event = makePendingEvent({ recipient: 'other@other.com' })
			mockEmailEventFindMany.mockResolvedValueOnce([event])

			const result = await processEmailQueue()

			expect(result.failed).toBe(1)
			expect(mockResendSend).not.toHaveBeenCalled()

			const updateCall = findLeaseTransition('failed')
			expect(updateCall).toBeDefined()
			if (!updateCall) throw new Error('failed lease transition missing')
			expect(updateCall.data.status).toBe('failed')
			// Canonical guard message pattern
			expect(updateCall.data.errorMessage).toMatch(/STAGING_EMAIL_GUARD/)
		})

		it('assertStagingRecipientAllowed throws for wrong recipient', () => {
			process.env.STAGING_TEST_RECIPIENT_EMAIL = 'allowed@test.com'

			expect(() => assertStagingRecipientAllowed('other@other.com')).toThrow(
				/STAGING_EMAIL_GUARD/
			)
		})

		it('assertStagingRecipientAllowed passes for the correct recipient', () => {
			process.env.STAGING_TEST_RECIPIENT_EMAIL = 'allowed@test.com'

			expect(() => assertStagingRecipientAllowed('allowed@test.com')).not.toThrow()
		})
	})

	// ── Test 6: Welcome email idempotency — P2002 returns existing id ─────────

	describe('welcome email idempotency: duplicate key returns existing id', () => {
		it('returns the existing event id when P2002 is thrown on create', async () => {
			const p2002Error = Object.assign(new Error('Unique constraint failed'), {
				code: 'P2002',
			})

			mockEmailEventCreate.mockRejectedValueOnce(p2002Error)
			mockEmailEventFindUnique.mockResolvedValueOnce({ id: 'existing-evt-999' })

			const id = await queueEmail({
				type: 'welcome',
				recipient: 'user@example.com',
				payload: { plan: 'basic', resetUrl: 'https://x.com/reset', variant: 'welcome' },
				idempotencyKey: 'idem-existing',
			})

			expect(id).toBe('existing-evt-999')
		})

		it('fails closed when P2002 is raised but the existing event cannot be resolved', async () => {
			const p2002Error = Object.assign(new Error('Unique constraint failed'), {
				code: 'P2002',
			})

			mockEmailEventCreate.mockRejectedValueOnce(p2002Error)
			mockEmailEventFindUnique.mockResolvedValueOnce(null)

			await expect(
				queueEmail({
					type: 'welcome',
					recipient: 'user@example.com',
					payload: {},
					idempotencyKey: 'idem-missing',
				})
			).rejects.toThrow(/duplicate.*lookup|existing.*event/i)
		})

		it('never widens an explicit empty event id into processing the whole pending queue', async () => {
			mockEmailEventFindMany.mockResolvedValueOnce([])

			await processEmailQueue('')

			expect(mockEmailEventFindMany).toHaveBeenCalledWith({
				where: { id: '', status: { in: ['pending'] } },
			})
		})

		it.each(['failed', 'dead_letter'])('does not report success for a duplicate welcome event already in %s state', async (status) => {
			const p2002Error = Object.assign(new Error('Unique constraint failed'), {
				code: 'P2002',
			})

			mockEmailEventCreate.mockRejectedValueOnce(p2002Error)
			mockEmailEventFindUnique
				.mockResolvedValueOnce({ id: 'existing-terminal-event' })
				.mockResolvedValueOnce({ status, errorMessage: `${status}: prior delivery failure` })
			mockEmailEventFindMany.mockResolvedValueOnce([])

			await expect(
				sendWelcomeEmail({
					to: 'user@example.com',
					plan: 'basic',
					resetUrl: 'https://jpvbootcamp.com/reset?token=abc',
					meta: { dedupeKey: 'duplicate-terminal-event' },
				})
			).rejects.toThrow(/prior delivery failure/)
		})

		it('treats an already-sent duplicate welcome event as a successful no-op', async () => {
			const p2002Error = Object.assign(new Error('Unique constraint failed'), {
				code: 'P2002',
			})

			mockEmailEventCreate.mockRejectedValueOnce(p2002Error)
			mockEmailEventFindUnique
				.mockResolvedValueOnce({ id: 'existing-sent-event' })
				.mockResolvedValueOnce({ status: 'sent', errorMessage: null })
			mockEmailEventFindMany.mockResolvedValueOnce([])

			await expect(
				sendWelcomeEmail({
					to: 'user@example.com',
					plan: 'basic',
					resetUrl: 'https://jpvbootcamp.com/reset?token=abc',
					meta: { dedupeKey: 'duplicate-sent-event' },
				})
			).resolves.toBeUndefined()
			expect(mockResendSend).not.toHaveBeenCalled()
		})

		it.each(['pending', 'processing'])('does not report delivery for a duplicate welcome event still %s', async (status) => {
			const p2002Error = Object.assign(new Error('Unique constraint failed'), {
				code: 'P2002',
			})

			mockEmailEventCreate.mockRejectedValueOnce(p2002Error)
			mockEmailEventFindUnique
				.mockResolvedValueOnce({ id: 'existing-inflight-event' })
				.mockResolvedValueOnce({ status, errorMessage: null })
			mockEmailEventFindMany.mockResolvedValueOnce([])

			await expect(
				sendWelcomeEmail({
					to: 'user@example.com',
					plan: 'basic',
					resetUrl: 'https://jpvbootcamp.com/reset?token=abc',
					meta: { dedupeKey: 'duplicate-inflight-event' },
				})
			).rejects.toThrow(new RegExp(`delivery not confirmed.*status=${status}`))
			expect(mockResendSend).not.toHaveBeenCalled()
		})

		it('does not report delivery when the synchronous send falls back to pending after a transient error', async () => {
			mockEmailEventCreate.mockResolvedValueOnce({ id: 'new-transient-event' })
			mockEmailEventFindMany.mockResolvedValueOnce([
				makePendingEvent({ id: 'new-transient-event' }),
			])
			mockResendSend.mockRejectedValueOnce(new Error('ECONNRESET'))
			mockEmailEventFindUnique.mockResolvedValueOnce({
				status: 'pending',
				errorMessage: 'transient: ECONNRESET',
			})

			await expect(
				sendWelcomeEmail({
					to: 'user@example.com',
					plan: 'basic',
					resetUrl: 'https://jpvbootcamp.com/reset?token=abc',
					meta: { dedupeKey: 'new-transient-event' },
				})
			).rejects.toThrow(/delivery not confirmed.*status=pending.*ECONNRESET/)
		})

		it('rethrows non-P2002 errors from create', async () => {
			const otherError = new Error('Database connection lost')
			mockEmailEventCreate.mockRejectedValueOnce(otherError)

			await expect(
				queueEmail({
					type: 'welcome',
					recipient: 'user@example.com',
					payload: {},
					idempotencyKey: 'idem-fail',
				})
			).rejects.toThrow('Database connection lost')
		})
	})

	// ── Extra: successful send marks status=sent with resendId ───────────────

	describe('successful send marks status=sent', () => {
		it('updates status to sent with resendId when Resend returns data.id', async () => {
			const event = makePendingEvent()
			mockEmailEventFindMany.mockResolvedValueOnce([event])
			mockResendSend.mockResolvedValueOnce({ data: { id: 'resend-abc' }, error: null })

			const result = await processEmailQueue()

			expect(result.sent).toBe(1)
			const updateCall = findLeaseTransition('sent')
			expect(updateCall).toBeDefined()
			if (!updateCall) throw new Error('sent lease transition missing')
			expect(updateCall.data.status).toBe('sent')
			expect(updateCall.data.resendId).toBe('resend-abc')
			expect(updateCall.data.errorMessage).toBeNull()
		})
	})

	describe('stale processing lease recovery', () => {
		it('does not reclaim a fresh processing lease', async () => {
			const freshUpdatedAt = new Date()
			mockEmailEventUpdateMany.mockImplementation(async (args: {
				where?: { status?: string; updatedAt?: { lt?: Date } | Date }
			}) => {
				const updatedAt = args?.where?.updatedAt
				if (
					args?.where?.status === 'processing' &&
					updatedAt &&
					!(updatedAt instanceof Date) &&
					updatedAt.lt instanceof Date
				) {
					return { count: freshUpdatedAt < updatedAt.lt ? 1 : 0 }
				}
				return { count: 1 }
			})
			mockEmailEventFindMany.mockResolvedValueOnce([])

			const result = await processEmailQueue('fresh-processing')

			expect(result).toEqual({ processed: 0, sent: 0, failed: 0, skipped: 0 })
			expect(mockResendSend).not.toHaveBeenCalled()
			const recoveryCall = mockEmailEventUpdateMany.mock.calls[0][0]
			expect(recoveryCall.where).toMatchObject({
				id: 'fresh-processing',
				status: 'processing',
			})
			expect(recoveryCall.where.updatedAt.lt).toBeInstanceOf(Date)
		})

		it('reclaims only a stale processing lease without incrementing retry count', async () => {
			const staleUpdatedAt = new Date(Date.now() - 10 * 60 * 1000)
			const event = makePendingEvent({ id: 'stale-processing' })
			mockEmailEventUpdateMany.mockImplementation(async (args: {
				where?: { status?: string; updatedAt?: { lt?: Date } | Date }
			}) => {
				const updatedAt = args?.where?.updatedAt
				if (
					args?.where?.status === 'processing' &&
					updatedAt &&
					!(updatedAt instanceof Date) &&
					updatedAt.lt instanceof Date
				) {
					return { count: staleUpdatedAt < updatedAt.lt ? 1 : 0 }
				}
				return { count: 1 }
			})
			mockEmailEventFindMany.mockResolvedValueOnce([event])
			mockResendSend.mockResolvedValueOnce({ data: { id: 'resend-stale' }, error: null })

			const result = await processEmailQueue('stale-processing')

			expect(result.sent).toBe(1)
			const recoveryCall = mockEmailEventUpdateMany.mock.calls[0][0]
			expect(recoveryCall.where).toMatchObject({
				id: 'stale-processing',
				status: 'processing',
			})
			expect(recoveryCall.data).toMatchObject({
				status: 'pending',
				errorMessage: 'stale_lease_recovered',
			})
			expect(recoveryCall.data.retryCount).toBeUndefined()
		})

		it('stamps claim time and conditions completion on the same lease token', async () => {
			const event = makePendingEvent({ id: 'lease-token-event' })
			mockEmailEventFindMany.mockResolvedValueOnce([event])
			mockResendSend.mockResolvedValueOnce({ data: { id: 'resend-lease' }, error: null })

			await processEmailQueue('lease-token-event')

			const claimCall = mockEmailEventUpdateMany.mock.calls.find(
				([call]) => call.where?.status === 'pending'
			)?.[0]
			expect(claimCall?.data.updatedAt).toBeInstanceOf(Date)

			const sentCall = findLeaseTransition('sent')
			expect(sentCall).toBeDefined()
			if (!sentCall || !claimCall) throw new Error('lease claim/completion missing')
			expect(sentCall.where.updatedAt).toBe(claimCall.data.updatedAt)
		})

		it('does not let a worker that lost its lease overwrite durable state', async () => {
			const event = makePendingEvent({ id: 'lost-lease-event' })
			mockEmailEventFindMany.mockResolvedValueOnce([event])
			mockResendSend.mockResolvedValueOnce({ data: { id: 'resend-lost-lease' }, error: null })
			mockEmailEventUpdateMany.mockImplementation(async (args: {
				where?: { status?: string; updatedAt?: { lt?: Date } | Date }
				data?: { status?: string }
			}) => {
				const updatedAt = args?.where?.updatedAt
				if (
					args?.where?.status === 'processing' &&
					updatedAt &&
					!(updatedAt instanceof Date) &&
					updatedAt.lt instanceof Date
				) {
					return { count: 0 }
				}
				if (args?.where?.status === 'processing' && args?.data?.status === 'sent') {
					return { count: 0 }
				}
				return { count: 1 }
			})

			const result = await processEmailQueue('lost-lease-event')

			expect(result.sent).toBe(0)
			expect(result.skipped).toBe(1)
			expect(mockResendSend).toHaveBeenCalledOnce()
		})

		it('preserves the atomic claim so a concurrent worker cannot duplicate delivery', async () => {
			const event = makePendingEvent({ id: 'concurrent-event' })
			mockEmailEventFindMany.mockResolvedValueOnce([event])
			mockEmailEventUpdateMany.mockImplementation(async (args: {
				where?: { status?: string; updatedAt?: { lt?: Date } | Date }
			}) => {
				const updatedAt = args?.where?.updatedAt
				if (
					args?.where?.status === 'processing' &&
					updatedAt &&
					!(updatedAt instanceof Date) &&
					updatedAt.lt instanceof Date
				) {
					return { count: 0 }
				}
				if (args?.where?.status === 'pending') return { count: 0 }
				return { count: 1 }
			})

			const result = await processEmailQueue('concurrent-event')

			expect(result.processed).toBe(0)
			expect(result.skipped).toBe(1)
			expect(mockResendSend).not.toHaveBeenCalled()
		})

		it('allows sendWelcomeEmail to complete after recovering its stale duplicate', async () => {
			const p2002Error = Object.assign(new Error('Unique constraint failed'), {
				code: 'P2002',
			})
			const event = makePendingEvent({ id: 'stale-welcome-event' })
			mockEmailEventCreate.mockRejectedValueOnce(p2002Error)
			mockEmailEventFindUnique
				.mockResolvedValueOnce({ id: 'stale-welcome-event' })
				.mockResolvedValueOnce({ status: 'sent', errorMessage: null })
			mockEmailEventUpdateMany.mockImplementation(async () => ({ count: 1 }))
			mockEmailEventFindMany.mockResolvedValueOnce([event])
			mockResendSend.mockResolvedValueOnce({ data: { id: 'resend-recovered-welcome' }, error: null })

			await expect(
				sendWelcomeEmail({
					to: 'user@example.com',
					plan: 'basic',
					resetUrl: 'https://jpvbootcamp.com/reset?token=abc',
					meta: { dedupeKey: 'stale-welcome-event' },
				})
			).resolves.toBeUndefined()

			const recoveryCall = mockEmailEventUpdateMany.mock.calls[0][0]
			expect(recoveryCall.data.retryCount).toBeUndefined()
			expect(mockResendSend.mock.calls[0][0].headers['Idempotency-Key']).toBe(event.idempotencyKey)
		})
	})
})
