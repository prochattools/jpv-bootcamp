import 'server-only'
import { Resend } from 'resend'
import { config } from '@/lib/config'
import type { Plan } from '@/lib/plans'

// Canonical Resend helpers live in this module; server routes call these functions to send email.
const resend = new Resend(config.email.resendApiKey)

const SUBJECT = 'Your JPV Bootcamp access is ready'
const SUPPORT_SUBJECT_PREFIX = `JPV Bootcamp Support Request \u2014 `

function getPlanLabel(plan: Plan): string {
	return plan === 'vip' ? 'VIP' : 'Pro'
}

export async function sendWelcomeEmail({
	to,
	plan,
}: {
	to: string
	plan: Plan
}): Promise<void> {
	const planLabel = getPlanLabel(plan)
	const text = [
		`Your ${planLabel} plan is active.`,
		'',
		`Log in here: ${config.email.portalLoginUrl}`,
		`Set or reset your password here: ${config.email.portalSetPasswordUrl}`,
		'',
		`If you need help, reply to this email: ${config.email.replyTo}`,
	].join('\n')

	const html = `
		<p>Your <strong>${planLabel}</strong> plan is active.</p>
		<p><a href="${config.email.portalLoginUrl}">Log in to the portal</a></p>
		<p><a href="${config.email.portalSetPasswordUrl}">Set or reset your password</a></p>
		<p>If you need help, reply to this email: ${config.email.replyTo}</p>
	`

	const { error } = await resend.emails.send({
		from: config.email.from,
		to: [to],
		replyTo: config.email.replyTo,
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
	// Support sender/recipient resolve from env-backed config (RESEND_FROM/EMAIL_FROM, SUPPORT_TO_EMAIL).
	const supportFrom = config.email.from
	const supportTo = config.email.supportTo
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
