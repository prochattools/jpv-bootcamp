import 'server-only'
import { Resend } from 'resend'
import { redactEmail } from '@/lib/log-redact'

type SponsoredCounts = {
	pro: number
	vip: number
}

let resendClient: Resend | null = null

function getResendClient(): Resend {
	if (!resendClient) {
		const apiKey = (process.env.RESEND_API_KEY || '').trim()
		if (!apiKey) {
			throw new Error('missing_resend_api_key')
		}
		resendClient = new Resend(apiKey)
	}
	return resendClient
}

function getMailFrom(): string {
	const from = (
		process.env.SPONSORED_MAIL_FROM ||
		process.env.RESEND_FROM ||
		process.env.EMAIL_FROM ||
		''
	).trim()
	if (!from) {
		throw new Error('missing_mail_from')
	}
	return from
}

function parseEmailList(raw: string | undefined): string[] {
	if (!raw) return []
	return raw
		.split(',')
		.map((value) => value.trim())
		.filter((value) => value && value.includes('@'))
}

function getAdminRecipients(): string[] {
	const recipients = parseEmailList(process.env.SPONSORED_APPLICATION_ADMIN_EMAILS)
	if (recipients.length === 0) {
		throw new Error('missing_admin_recipients')
	}
	return recipients
}

export function getSponsoredPortalUrl(): string {
	const raw = (process.env.SPONSORED_PORTAL_URL || '').trim()
	if (!raw) {
		return 'https://portal.jpvbootcamp.com/community/'
	}
	return raw
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

export async function sendSponsoredApplicationAdminEmail(params: {
	applicationId: string
	applicantName: string
	applicantEmail: string
	message?: string | null
	approveUrl: string
	rejectUrl: string
	counts?: SponsoredCounts
}): Promise<void> {
	const resend = getResendClient()
	const from = getMailFrom()
	const to = getAdminRecipients()

	const safeName = escapeHtml(params.applicantName)
	const safeEmail = escapeHtml(params.applicantEmail)
	const safeMessage = params.message ? escapeHtml(params.message) : ''

	const countsLine = params.counts
		? `Available seats: ${params.counts.pro} Pro / ${params.counts.vip} VIP`
		: null

	const html = `
		<h2>New sponsored membership application</h2>
		<p><strong>Name:</strong> ${safeName}</p>
		<p><strong>Email:</strong> ${safeEmail}</p>
		${safeMessage ? `<p><strong>Message:</strong><br/>${safeMessage}</p>` : ''}
		${countsLine ? `<p>${escapeHtml(countsLine)}</p>` : ''}
		<p>
			<a href="${params.approveUrl}" style="display:inline-block;padding:10px 16px;background:#0f172a;color:#ffffff;text-decoration:none;border-radius:6px;margin-right:8px;">
				Approve
			</a>
			<a href="${params.rejectUrl}" style="display:inline-block;padding:10px 16px;background:#ef4444;color:#ffffff;text-decoration:none;border-radius:6px;">
				Reject
			</a>
		</p>
		<p style="font-size:12px;color:#6b7280;">Application ID: ${escapeHtml(
			params.applicationId
		)}</p>
	`

	const text = [
		'New sponsored membership application',
		`Name: ${params.applicantName}`,
		`Email: ${params.applicantEmail}`,
		params.message ? `Message: ${params.message}` : null,
		countsLine ? countsLine : null,
		`Approve: ${params.approveUrl}`,
		`Reject: ${params.rejectUrl}`,
		`Application ID: ${params.applicationId}`,
	]
		.filter(Boolean)
		.join('\n')

	const { error } = await resend.emails.send({
		from,
		to,
		subject: 'Sponsored membership application',
		html,
		text,
	})

	if (error) {
		console.error('sponsored_application_admin_email_failed', {
			applicationId: params.applicationId,
			email: redactEmail(params.applicantEmail),
			message: error.message,
		})
		throw error
	}
}

export async function sendSponsoredApplicantApprovedEmail(params: {
	to: string
	portalUrl: string
}): Promise<void> {
	const resend = getResendClient()
	const from = getMailFrom()
	const portalUrl = params.portalUrl

	const html = `
		<p>Your sponsored month is now active.</p>
		<p><a href="${portalUrl}">Visit the JPV Bootcamp portal</a></p>
	`

	const text = [
		'Your sponsored month is now active.',
		`Visit the JPV Bootcamp portal: ${portalUrl}`,
	].join('\n')

	const { error } = await resend.emails.send({
		from,
		to: [params.to],
		subject: 'Approved — your sponsored month is active',
		html,
		text,
	})

	if (error) {
		console.error('sponsored_applicant_email_failed', {
			email: redactEmail(params.to),
			status: 'approved',
			message: error.message,
		})
		throw error
	}
}

export async function sendSponsoredApplicantRejectedEmail(params: {
	to: string
}): Promise<void> {
	const resend = getResendClient()
	const from = getMailFrom()

	const html = `
		<p>Thanks for applying. You did not qualify or no seats are available right now.</p>
	`
	const text =
		'Thanks for applying. You did not qualify or no seats are available right now.'

	const { error } = await resend.emails.send({
		from,
		to: [params.to],
		subject: 'Sponsored membership update',
		html,
		text,
	})

	if (error) {
		console.error('sponsored_applicant_email_failed', {
			email: redactEmail(params.to),
			status: 'rejected',
			message: error.message,
		})
		throw error
	}
}
