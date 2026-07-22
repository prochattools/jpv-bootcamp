import 'server-only'
import { Resend } from 'resend'
import { getServerConfig } from '@/lib/config'
import type { Plan } from '@/lib/plans'
import {
	getMembershipEmailIntro,
	getMembershipEmailIntroHtml,
	getPlanLabel,
	type MembershipEmailVariant,
} from '@/lib/membership-email-copy'
import prisma from '@/libs/prisma'
import crypto from 'crypto'

// Canonical Resend helpers live in this module; server routes call these functions to send email.
let resendClient: Resend | null = null

function getResendClient(): Resend {
	if (!resendClient) {
		const { email } = getServerConfig()
		resendClient = new Resend(email.resendApiKey)
	}
	return resendClient
}

function isEnvEnabled(value?: string): boolean {
	if (!value) return false
	return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase())
}

function isNonWebhookEmailDisabled(): boolean {
	return isEnvEnabled(process.env.DISABLE_NON_WEBHOOK_EMAILS)
}

const SUBJECT = 'Your JPV Bootcamp access is ready'
const SUPPORT_SUBJECT_PREFIX = `JPV Bootcamp Support Request — `

type EmailAttemptMeta = {
	templateKey?: string
	variant?: MembershipEmailVariant
	eventId?: string | null
	eventType?: string | null
	subscriptionId?: string | null
	customerId?: string | null
	source?: string | null
	dedupeKey?: string | null
	stackHint?: string
}

function logEmailAttempt(params: {
	templateKey: string
	email: string
	plan?: Plan | null
	eventId?: string | null
	eventType?: string | null
	subscriptionId?: string | null
	customerId?: string | null
	source?: string | null
	dedupeKey?: string | null
	stackHint: string
}) {
	console.info('email_attempt', {
		at: 'email_attempt',
		templateKey: params.templateKey,
		email: params.email,
		plan: params.plan ?? null,
		eventId: params.eventId ?? null,
		eventType: params.eventType ?? null,
		subscriptionId: params.subscriptionId ?? null,
		customerId: params.customerId ?? null,
		source: params.source ?? null,
		dedupeKey: params.dedupeKey ?? null,
		stackHint: params.stackHint,
	})
}

/**
 * Staging recipient guard.
 * When STAGING_EMAIL_GUARD=1 is set, all outgoing emails must go to
 * STAGING_TEST_RECIPIENT_EMAIL. Throws if the recipient is not the allowed address.
 */
export function assertStagingRecipientAllowed(recipient: string): void {
	if (!isEnvEnabled(process.env.STAGING_EMAIL_GUARD)) return
	const allowed = (process.env.STAGING_TEST_RECIPIENT_EMAIL ?? '').trim().toLowerCase()
	if (!allowed) {
		throw new Error(
			'STAGING_EMAIL_GUARD=1 but STAGING_TEST_RECIPIENT_EMAIL is not set'
		)
	}
	if (recipient.trim().toLowerCase() !== allowed) {
		throw new Error(
			`Staging guard blocked email to ${recipient}; only ${allowed} is allowed when STAGING_EMAIL_GUARD=1`
		)
	}
}

// ---------------------------------------------------------------------------
// Prisma-backed email outbox types
// ---------------------------------------------------------------------------

export type EmailEventType = 'welcome' | 'billing_failed' | 'account_action' | 'support'

export type QueueEmailParams = {
	type: EmailEventType
	recipient: string
	/** No PII like raw email addresses in payload. Use IDs, plans, URLs. */
	payload: Record<string, unknown>
	/**
	 * Stable, non-PII idempotency key. Use a hash of (eventId + type), not an
	 * email address. Example: sha256(stripeEventId + ':' + type).
	 */
	idempotencyKey: string
}

/**
 * Enqueue an email_event for deferred sending via processEmailQueue().
 * Staging recipient guard fires before insertion.
 */
export async function queueEmail(params: QueueEmailParams): Promise<string> {
	assertStagingRecipientAllowed(params.recipient)

	try {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const event = await (prisma as any).emailEvent.create({
			data: {
				type: params.type,
				recipient: params.recipient,
				payload: params.payload,
				idempotencyKey: params.idempotencyKey,
				status: 'pending',
			},
		})
		return event.id as string
	} catch (error) {
		// Unique constraint violation = already queued; treat as idempotent success
		if (
			typeof error === 'object' &&
			error !== null &&
			'code' in error &&
			(error as { code?: string }).code === 'P2002'
		) {
			console.info('email_event_already_queued', {
				idempotencyKey: params.idempotencyKey,
				type: params.type,
			})
			// Return the existing event id
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const existing = await (prisma as any).emailEvent.findUnique({
				where: { idempotencyKey: params.idempotencyKey },
				select: { id: true },
			})
			return existing?.id ?? ''
		}
		throw error
	}
}

// ---------------------------------------------------------------------------
// Resend payload builders
// ---------------------------------------------------------------------------

type WelcomeEmailContent = {
	subject: string
	text: string
	html: string
	from: string
	replyTo: string
}

function buildWelcomeEmailContent(params: {
	plan: Plan
	resetUrl: string
	variant: MembershipEmailVariant
}): WelcomeEmailContent {
	const { email: emailConfig } = getServerConfig()
	const introLine = getMembershipEmailIntro({ plan: params.plan, variant: params.variant })
	const text = [
		introLine,
		'',
		`Log in here: ${emailConfig.portalUrl}`,
		`Set or reset your password here: ${params.resetUrl}`,
		'',
		`If you need help, reply to this email: ${emailConfig.replyTo}`,
	].join('\n')

	const html = `
		<p>${getMembershipEmailIntroHtml({ plan: params.plan, variant: params.variant })}</p>
		<p><a href="${emailConfig.portalUrl}">Log in to the portal</a></p>
		<p><a href="${params.resetUrl}">Set or reset your password</a></p>
		<p>If you need help, reply to this email: ${emailConfig.replyTo}</p>
	`

	return {
		subject: SUBJECT,
		text,
		html,
		from: emailConfig.from,
		replyTo: emailConfig.replyTo,
	}
}

// ---------------------------------------------------------------------------
// Email queue processor
// ---------------------------------------------------------------------------

type ProcessResult = {
	processed: number
	sent: number
	failed: number
	skipped: number
}

/**
 * Read pending email_event rows and send via Resend.
 * - Pass eventId to process a single event by DB row id.
 * - Omit eventId to process all pending events (batch).
 * - Idempotency key is forwarded to Resend's idempotency header.
 * - Staging guard fires before every Resend call.
 *
 * Error handling:
 *   - Resend success → status = 'sent', resend_id stored
 *   - Transient error (5xx / network) → retry_count++, status stays 'pending'
 *   - Permanent error (4xx) → status = 'failed', error stored
 *   - Ambiguous (no error, no id) → status = 'sent' with warning note
 */
export async function processEmailQueue(eventId?: string): Promise<ProcessResult> {
	const result: ProcessResult = { processed: 0, sent: 0, failed: 0, skipped: 0 }

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const prismaAny = prisma as any

	// Fetch pending events
	const where = eventId
		? { id: eventId, status: 'pending' }
		: { status: 'pending' }

	const events = await prismaAny.emailEvent.findMany({ where })

	for (const event of events) {
		result.processed++
		try {
			assertStagingRecipientAllowed(event.recipient)
		} catch (guardError) {
			// If staging guard blocks, mark failed immediately — do not retry
			await prismaAny.emailEvent.update({
				where: { id: event.id },
				data: {
					status: 'failed',
					errorMessage: (guardError as Error).message,
				},
			})
			result.failed++
			console.warn('email_queue_staging_guard_blocked', {
				eventId: event.id,
				type: event.type,
				error: (guardError as Error).message,
			})
			continue
		}

		const resend = getResendClient()
		const { email: emailConfig } = getServerConfig()

		// Build the email from payload
		const payload = event.payload as Record<string, unknown>
		let sendParams: Parameters<typeof resend.emails.send>[0]

		try {
			sendParams = buildSendParams({
				type: event.type as EmailEventType,
				recipient: event.recipient,
				payload,
				emailConfig,
			})
		} catch (buildError) {
			// Unknown event type or malformed payload — permanent failure
			await prismaAny.emailEvent.update({
				where: { id: event.id },
				data: {
					status: 'failed',
					errorMessage: `build_error: ${(buildError as Error).message}`,
				},
			})
			result.failed++
			continue
		}

		let sendResult: Awaited<ReturnType<typeof resend.emails.send>>
		try {
			const existingHeaders = (sendParams as { headers?: Record<string, string> }).headers
			sendResult = await resend.emails.send({
				...sendParams,
				headers: {
					...existingHeaders,
					'Idempotency-Key': event.idempotencyKey,
				},
			})
		} catch (networkError) {
			// Network / transient error — keep pending, increment retry
			await prismaAny.emailEvent.update({
				where: { id: event.id },
				data: {
					retryCount: { increment: 1 },
					errorMessage: `transient: ${(networkError as Error).message}`,
				},
			})
			result.skipped++
			console.warn('email_queue_transient_error', {
				eventId: event.id,
				type: event.type,
				error: (networkError as Error).message,
			})
			continue
		}

		const { data, error } = sendResult

		if (error) {
			// Determine if permanent (4xx) or transient (5xx / unknown)
			const statusCode = (error as { statusCode?: number }).statusCode ?? 0
			const isPermanent = statusCode >= 400 && statusCode < 500

			if (isPermanent) {
				await prismaAny.emailEvent.update({
					where: { id: event.id },
					data: {
						status: 'failed',
						errorMessage: `resend_${statusCode}: ${error.message}`,
					},
				})
				result.failed++
				console.error('email_queue_permanent_error', {
					eventId: event.id,
					type: event.type,
					statusCode,
					error: error.message,
				})
			} else {
				// Transient — keep pending, increment retry
				await prismaAny.emailEvent.update({
					where: { id: event.id },
					data: {
						retryCount: { increment: 1 },
						errorMessage: `transient_${statusCode}: ${error.message}`,
					},
				})
				result.skipped++
			}
			continue
		}

		// Success path
		const resendId = data?.id ?? null
		if (!resendId) {
			// Ambiguous: no error, no id
			console.warn('email_queue_ambiguous_response', {
				eventId: event.id,
				type: event.type,
			})
		}

		await prismaAny.emailEvent.update({
			where: { id: event.id },
			data: {
				status: 'sent',
				resendId: resendId ?? 'ambiguous_no_id',
				sentAt: new Date(),
				errorMessage: resendId ? null : 'ambiguous: no resend id in response',
			},
		})
		result.sent++
	}

	return result
}

// ---------------------------------------------------------------------------
// Payload-to-Resend dispatch
// ---------------------------------------------------------------------------

type EmailConfig = { from: string; replyTo: string; portalUrl: string }

function buildSendParams(params: {
	type: EmailEventType
	recipient: string
	payload: Record<string, unknown>
	emailConfig: EmailConfig
}): Parameters<Resend['emails']['send']>[0] {
	const { type, recipient, payload, emailConfig } = params

	if (type === 'welcome') {
		const plan = payload.plan as Plan
		const resetUrl = payload.resetUrl as string
		const variant = (payload.variant as MembershipEmailVariant | undefined) ?? 'welcome'
		const content = buildWelcomeEmailContent({ plan, resetUrl, variant })
		return {
			from: content.from,
			to: [recipient],
			replyTo: content.replyTo,
			subject: content.subject,
			text: content.text,
			html: content.html,
		}
	}

	if (type === 'support') {
		// Support emails are handled by sendSupportEmail directly; not via queue
		throw new Error(`support emails do not go through the outbox queue`)
	}

	throw new Error(`unknown email event type: ${type}`)
}

// ---------------------------------------------------------------------------
// Helper: derive a stable, non-PII idempotency key from event data
// ---------------------------------------------------------------------------

/**
 * Derive an idempotency key from eventId + type.
 * Result is a hex SHA-256 — no PII, stable across retries.
 */
export function deriveEmailIdempotencyKey(eventId: string, type: string): string {
	return crypto.createHash('sha256').update(`${eventId}:${type}`).digest('hex')
}

// ---------------------------------------------------------------------------
// Public API: sendWelcomeEmail (now enqueues then immediately processes)
// ---------------------------------------------------------------------------

export async function sendWelcomeEmail({
	to,
	plan,
	resetUrl,
	meta,
}: {
	to: string
	plan: Plan
	resetUrl: string
	meta?: EmailAttemptMeta
}): Promise<void> {
	const variant = meta?.variant ?? 'welcome'
	const templateKey =
		meta?.templateKey ??
		(variant === 'upgrade' ? 'membership_upgrade_ready' : 'membership_access_ready')
	logEmailAttempt({
		templateKey,
		email: to,
		plan,
		eventId: meta?.eventId ?? null,
		eventType: meta?.eventType ?? null,
		subscriptionId: meta?.subscriptionId ?? null,
		customerId: meta?.customerId ?? null,
		source: meta?.source ?? null,
		dedupeKey: meta?.dedupeKey ?? null,
		stackHint: meta?.stackHint ?? 'lib/email:sendWelcomeEmail',
	})

	// Derive a stable idempotency key. Prefer the dedupe key derived from
	// event+subscription identity; fall back to hashing the email + plan if
	// no structured key is available.
	const rawIdempotencyBase =
		meta?.dedupeKey ??
		(meta?.eventId ? `${meta.eventId}:welcome` : `${to}:${plan}:welcome`)
	const idempotencyKey = deriveEmailIdempotencyKey(rawIdempotencyBase, 'welcome')

	// Enqueue the event
	const eventDbId = await queueEmail({
		type: 'welcome',
		recipient: to,
		payload: {
			plan,
			resetUrl,
			variant,
			templateKey,
			subscriptionId: meta?.subscriptionId ?? null,
			customerId: meta?.customerId ?? null,
		},
		idempotencyKey,
	})

	// Process synchronously (inline) so callers get the same throw-on-failure
	// semantics as the previous direct-send approach. A background worker can
	// call processEmailQueue() independently to retry failures.
	const result = await processEmailQueue(eventDbId)

	if (result.failed > 0) {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const prismaAny = prisma as any
		const event = await prismaAny.emailEvent.findUnique({
			where: { id: eventDbId },
			select: { errorMessage: true },
		})
		throw new Error(
			`sendWelcomeEmail failed: ${event?.errorMessage ?? 'unknown error'}`
		)
	}
}

function escapeHtml(value: string): string {
	return value.replace(/[&<>"']/g, (char) => {
		switch (char) {
			case '&':
				return '&amp;'
			case '<':
				return '&lt;'
			case '>':
				return '&gt;'
			case '"':
				return '&quot;'
			case "'":
				return '&#39;'
			default:
				return char
		}
	})
}

function extractEmailAddress(value: string): string {
	const match = value.match(/<([^>]+)>/)
	return (match ? match[1] : value).trim()
}

export async function sendSupportEmail({
	name,
	email,
	question,
	source,
	page,
	submittedAt,
}: {
	name: string
	email: string
	question: string
	source: string
	page: string
	submittedAt: string
}): Promise<void> {
	logEmailAttempt({
		templateKey: 'support_request',
		email,
		stackHint: 'lib/email:sendSupportEmail',
		source: 'support',
	})

	if (isNonWebhookEmailDisabled()) {
		console.info('Non-webhook email skipped', {
			email,
			templateKey: 'support_request',
			source: 'support',
		})
		return
	}

	const { email: emailConfig } = getServerConfig()
	// Support sender/recipient resolve from env-backed config (RESEND_FROM/EMAIL_FROM, SUPPORT_TO_EMAIL).
	const supportFrom = emailConfig.from
	const supportTo = emailConfig.supportTo
	const supportFromAddress = extractEmailAddress(supportFrom)

	if (!supportFrom) {
		throw new Error('Support sender missing; set RESEND_FROM or EMAIL_FROM.')
	}

	if (!supportTo) {
		throw new Error('Support recipient missing; set SUPPORT_TO_EMAIL.')
	}

	if (supportFromAddress.toLowerCase().endsWith('@gmail.com')) {
		throw new Error(
			'FROM must be a verified domain; set RESEND_FROM to support@jpvbootcamp.com.'
		)
	}

	assertStagingRecipientAllowed(supportTo)

	const safeName = escapeHtml(name)
	const safeEmail = escapeHtml(email)
	const safeQuestion = escapeHtml(question)
	const safeSource = escapeHtml(source)
	const safePage = escapeHtml(page)
	const safeSubmittedAt = escapeHtml(submittedAt)

	const text = [
		'New support request received.',
		'',
		`Name: ${name}`,
		`Email: ${email}`,
		`Question: ${question}`,
		'',
		`Submitted: ${submittedAt}`,
		`Source: ${source}`,
		`Page: ${page}`,
	].join('\n')

	const html = `
		<h2>New support request received</h2>
		<p><strong>Name:</strong> ${safeName}</p>
		<p><strong>Email:</strong> ${safeEmail}</p>
		<p><strong>Question:</strong></p>
		<p>${safeQuestion}</p>
		<p><strong>Submitted:</strong> ${safeSubmittedAt}</p>
		<p><strong>Source:</strong> ${safeSource}</p>
		<p><strong>Page:</strong> ${safePage}</p>
	`

	if (process.env.NODE_ENV !== 'production') {
		console.log('[support] emailFrom', supportFrom)
		console.log('[support] emailTo', supportTo)
		console.log('[support] emailReplyTo', email)
	}

	const resend = getResendClient()
	const { error } = await resend.emails.send({
		from: supportFrom,
		to: [supportTo],
		replyTo: email,
		subject: `${SUPPORT_SUBJECT_PREFIX}${name}`,
		text,
		html,
	})

	if (error) {
		throw error
	}
}
