import 'server-only'
import { Resend } from 'resend'
import { getServerConfig } from '@/lib/config'
import type { Plan } from '@/lib/plans'

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
const SUPPORT_SUBJECT_PREFIX = `JPV Bootcamp Support Request \u2014 `

function getPlanLabel(plan: Plan): string {
	return plan === 'vip' ? 'VIP' : 'Pro'
}

export async function sendWelcomeEmail({
	to,
	plan,
	resetUrl,
}: {
	to: string
	plan: Plan
	resetUrl: string
}): Promise<void> {
	const { email: emailConfig } = getServerConfig()
	const planLabel = getPlanLabel(plan)
	const text = [
		`Your ${planLabel} plan is active.`,
		'',
		`Log in here: ${emailConfig.portalUrl}`,
		`Set or reset your password here: ${resetUrl}`,
		'',
		`If you need help, reply to this email: ${emailConfig.replyTo}`,
	].join('\n')

	const html = `
		<p>Your <strong>${planLabel}</strong> plan is active.</p>
		<p><a href="${emailConfig.portalUrl}">Log in to the portal</a></p>
		<p><a href="${resetUrl}">Set or reset your password</a></p>
		<p>If you need help, reply to this email: ${emailConfig.replyTo}</p>
	`

	const resend = getResendClient()
	const { error } = await resend.emails.send({
		from: emailConfig.from,
		to: [to],
		replyTo: emailConfig.replyTo,
		subject: SUBJECT,
		text,
		html,
	})

	if (error) {
		throw error
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
