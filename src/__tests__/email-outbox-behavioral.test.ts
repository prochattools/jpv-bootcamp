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
const mockEmailEventUpdate = vi.fn()
// updateMany is used for the atomic claim/lease step in processEmailQueue
const mockEmailEventUpdateMany = vi.fn()

vi.mock('@/libs/prisma', () => ({
	default: {
		emailEvent: {
			create: (...args: unknown[]) => mockEmailEventCreate(...args),
			findMany: (...args: unknown[]) => mockEmailEventFindMany(...args),
			findUnique: (...args: unknown[]) => mockEmailEventFindUnique(...args),
			update: (...args: unknown[]) => mockEmailEventUpdate(...args),
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
		// Default: atomic claim succeeds (count=1 means this worker won the row)
		mockEmailEventUpdateMany.mockResolvedValue({ count: 1 })
	})

	// ── Test 1: Ambiguous response stays pending ──────────────────────────────

	describe('ambiguous response (no id) stays pending, not marked sent', () => {
		it('increments retryCount and does not mark status=sent', async () => {
			const event = makePendingEvent()
			mockEmailEventFindMany.mockResolvedValueOnce([event])
			mockEmailEventUpdate.mockResolvedValue({})

			// Resend returns no error but no data.id — ambiguous
			mockResendSend.mockResolvedValueOnce({ data: null, error: null })

			const result = await processEmailQueue()

			// Should not be counted as sent
			expect(result.sent).toBe(0)
			expect(result.skipped).toBe(1)

			// Should have released the claim back to 'pending', incremented retryCount, NOT set status='sent'
			const updateCall = mockEmailEventUpdate.mock.calls[0][0]
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
			mockEmailEventUpdate.mockResolvedValue({})

			const result = await processEmailQueue()

			// Resend should never be called
			expect(mockResendSend).not.toHaveBeenCalled()

			// Event should be dead-lettered
			expect(result.failed).toBe(1)
			expect(result.sent).toBe(0)

			const updateCall = mockEmailEventUpdate.mock.calls[0][0]
			expect(updateCall.data.status).toBe('dead_letter')
			expect(updateCall.data.errorMessage).toMatch(/max_retries_exceeded/)
		})

		it('also dead-letters when retryCount is greater than MAX_RETRIES (e.g. 7)', async () => {
			const event = makePendingEvent({ retryCount: 7 })
			mockEmailEventFindMany.mockResolvedValueOnce([event])
			mockEmailEventUpdate.mockResolvedValue({})

			await processEmailQueue()

			expect(mockResendSend).not.toHaveBeenCalled()
			const updateCall = mockEmailEventUpdate.mock.calls[0][0]
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
			mockEmailEventUpdate.mockResolvedValue({})

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
			mockEmailEventUpdate.mockResolvedValue({})
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
			mockEmailEventUpdate.mockResolvedValue({})

			const result = await processEmailQueue()

			expect(result.failed).toBe(1)
			expect(mockResendSend).not.toHaveBeenCalled()

			const updateCall = mockEmailEventUpdate.mock.calls[0][0]
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

		it('returns empty string when P2002 and findUnique returns nothing', async () => {
			const p2002Error = Object.assign(new Error('Unique constraint failed'), {
				code: 'P2002',
			})

			mockEmailEventCreate.mockRejectedValueOnce(p2002Error)
			mockEmailEventFindUnique.mockResolvedValueOnce(null)

			const id = await queueEmail({
				type: 'welcome',
				recipient: 'user@example.com',
				payload: {},
				idempotencyKey: 'idem-missing',
			})

			expect(id).toBe('')
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
			mockEmailEventUpdate.mockResolvedValue({})
			mockResendSend.mockResolvedValueOnce({ data: { id: 'resend-abc' }, error: null })

			const result = await processEmailQueue()

			expect(result.sent).toBe(1)
			const updateCall = mockEmailEventUpdate.mock.calls[0][0]
			expect(updateCall.data.status).toBe('sent')
			expect(updateCall.data.resendId).toBe('resend-abc')
			expect(updateCall.data.errorMessage).toBeNull()
		})
	})
})
