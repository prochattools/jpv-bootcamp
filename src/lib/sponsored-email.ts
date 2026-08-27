import 'server-only'
import { Resend } from 'resend'
import { renderBrandedEmail } from '@/lib/communications/brandedEmail'
import { redactEmail } from '@/lib/log-redact'
import { getPublicBaseUrl } from '@/lib/public-base-url'
import { formatPhoneForDisplay } from '@/lib/normalize-phone'
import { assertStagingRecipientAllowed } from '@/lib/staging-email-guard'

type SponsoredCounts = {
	available: number
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

async function getAdminRecipients(): Promise<string[]> {
	try {
		const { getPayload } = await import('payload')
		const { default: config } = await import('@/payload.config')
		const payload = await getPayload({ config })
		const settings = await payload.findGlobal({ slug: 'payItForwardSettings' })
		const fromPayload = parseEmailList(settings?.adminEmailsText ?? undefined)
		if (fromPayload.length > 0) return fromPayload
	} catch {
		// Fall through to env var
	}
	const recipients = parseEmailList(process.env.SPONSORED_APPLICATION_ADMIN_EMAILS)
	if (recipients.length === 0) {
		throw new Error('missing_admin_recipients')
	}
	return recipients
}

export function getSponsoredPortalUrl(): string {
	const raw = (process.env.SPONSORED_PORTAL_URL || '').trim()
	if (!raw) {
		return `${getPublicBaseUrl().replace(/\/$/, '')}/portal`
	}
	return raw
}

function getSponsoredPortalBaseUrl(): string {
	const raw = (process.env.SPONSORED_PORTAL_BASE_URL || '').trim()
	if (!raw) {
		return getPublicBaseUrl().replace(/\/$/, '')
	}
	return raw.replace(/\/$/, '')
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
	applicantPhone: string
	message?: string | null
	approveToken: string
	rejectToken: string
	counts?: SponsoredCounts
}): Promise<void> {
	const resend = getResendClient()
	const from = getMailFrom()
	const to = await getAdminRecipients()

	const safeName = escapeHtml(params.applicantName)
	const safeEmail = escapeHtml(params.applicantEmail)
	const safePhone = escapeHtml(formatPhoneForDisplay(params.applicantPhone))
	const safeMessage = params.message ? escapeHtml(params.message) : ''

	const countsLine = params.counts
		? `Available sponsored access seats: ${params.counts.available}`
		: null

	const baseUrl = getPublicBaseUrl()
	const host = (() => {
		try {
			return new URL(baseUrl).host
		} catch {
			return 'unknown'
		}
	})()

	console.info('sponsored_email_base_url', { host })

	const approveUrl = `${baseUrl}/api/sponsored-applications/decision?token=${encodeURIComponent(
		params.approveToken
	)}`
	const rejectUrl = `${baseUrl}/api/sponsored-applications/decision?token=${encodeURIComponent(
		params.rejectToken
	)}`

	const html = renderBrandedEmail({
		preheader: `New sponsored membership application from ${params.applicantName}.`,
		heading: 'New sponsored application',
		bodyHtml: `
			<p style="margin:0 0 12px"><strong>Requested access:</strong> Controlled Free access</p>
			<p style="margin:0 0 12px"><strong>Name:</strong> ${safeName}</p>
			<p style="margin:0 0 12px"><strong>Email:</strong> ${safeEmail}</p>
			<p style="margin:0 0 12px"><strong>Phone:</strong> ${safePhone}</p>
			${safeMessage ? `<p style="margin:0 0 12px"><strong>Message:</strong><br />${safeMessage}</p>` : ''}
			${countsLine ? `<p style="margin:0 0 12px">${escapeHtml(countsLine)}</p>` : ''}
			<p style="margin:0;font-size:12px">Application ID: ${escapeHtml(params.applicationId)}</p>
		`,
		actions: [
			{ label: 'Approve', url: approveUrl },
			{ label: 'Reject', url: rejectUrl, tone: 'danger' },
		],
	})

	const text = [
		'New sponsored membership application',
		'Requested access: Controlled Free access',
		`Name: ${params.applicantName}`,
		`Email: ${params.applicantEmail}`,
		`Phone: ${formatPhoneForDisplay(params.applicantPhone)}`,
		params.message ? `Message: ${params.message}` : null,
		countsLine ? countsLine : null,
		`Approve: ${approveUrl}`,
		`Reject: ${rejectUrl}`,
		`Application ID: ${params.applicationId}`,
	]
		.filter(Boolean)
		.join('\n')

	assertStagingRecipientAllowed(to, 'sponsored-email:sendSponsoredApplicationAdminEmail')

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

export async function sendSponsoredClaimEmail(params: {
	to: string
	claimToken: string
}): Promise<void> {
	const resend = getResendClient()
	const from = getMailFrom()
	const portalBase = getSponsoredPortalBaseUrl()
	const claimUrl = `${portalBase}/go/sponsored-claim?token=${encodeURIComponent(
		params.claimToken
	)}`

	const html = renderBrandedEmail({
		preheader: 'Your sponsored access is ready to claim.',
		heading: 'Your sponsored access is ready',
		bodyHtml: '<p style="margin:0 0 16px">A sponsored JPV Bootcamp place is ready for you.</p><p style="margin:0">This secure link expires in 7 days.</p>',
		actions: [{ label: 'Claim your sponsored access', url: claimUrl }],
	})
	const text = [
		'Your sponsored Free access is ready.',
		`Claim your sponsored access: ${claimUrl}`,
		'This link expires in 7 days.',
	].join('\n')

	assertStagingRecipientAllowed([params.to], 'sponsored-email:sendSponsoredClaimEmail')

	const { error } = await resend.emails.send({
		from,
		to: [params.to],
		subject: 'Claim your sponsored access',
		html,
		text,
	})

	if (error) {
		console.error('sponsored_claim_email_failed', {
			email: redactEmail(params.to),
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

	const html = renderBrandedEmail({
		preheader: 'Your sponsored JPV Bootcamp access is now active.',
		heading: 'Your access is active',
		bodyHtml: '<p style="margin:0">Your sponsored JPV Bootcamp access is now active. Continue to the portal when you are ready.</p>',
		actions: [{ label: 'Visit the member portal', url: portalUrl }],
	})

	const text = [
		'Your sponsored Free access is now active.',
		`Visit the JPV Bootcamp portal: ${portalUrl}`,
	].join('\n')

	assertStagingRecipientAllowed([params.to], 'sponsored-email:sendSponsoredApplicantApprovedEmail')

	const { error } = await resend.emails.send({
		from,
		to: [params.to],
		subject: 'Approved — your sponsored access is active',
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

	const html = renderBrandedEmail({
		preheader: 'An update about your sponsored membership application.',
		heading: 'Sponsored membership update',
		bodyHtml: '<p style="margin:0">Thanks for applying. You did not qualify or no seats are available right now.</p>',
	})
	const text =
		'Thanks for applying. You did not qualify or no seats are available right now.'

	assertStagingRecipientAllowed([params.to], 'sponsored-email:sendSponsoredApplicantRejectedEmail')

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

export async function sendSponsoredDonorEmail(params: {
	to: string
}): Promise<void> {
	const resend = getResendClient()
	const from = getMailFrom()

	const html = renderBrandedEmail({
		preheader: 'Thank you for helping make JPV Bootcamp access possible.',
		heading: 'Thank you for sponsoring access',
		bodyHtml: '<p style="margin:0 0 16px">Your purchase has added one sponsored access seat.</p><p style="margin:0">This contribution supports another person and does not create access for the purchaser.</p>',
	})
	const text = `Thanks for sponsoring Free access.\nYour purchase has added one sponsored access seat. You won't receive access yourself.`

	assertStagingRecipientAllowed([params.to], 'sponsored-email:sendSponsoredDonorEmail')

	const { error } = await resend.emails.send({
		from,
		to: [params.to],
		subject: 'Thanks for sponsoring access',
		html,
		text,
	})

	if (error) {
		console.error('sponsored_donor_email_failed', {
			email: redactEmail(params.to),
			message: error.message,
		})
		throw error
	}
}

export async function sendSponsoredRecipientCheckoutEmail(params: {
	to: string
	name: string
	checkoutUrl: string
}): Promise<void> {
	const resend = getResendClient()
	const from = getMailFrom()
	const safeName = escapeHtml(params.name)

	const html = renderBrandedEmail({
		preheader: 'Your sponsored JPV Bootcamp membership is ready.',
		heading: 'Your sponsored membership is ready',
		bodyHtml: `<p style="margin:0 0 16px">Hi ${safeName}, your application for sponsored JPV Bootcamp membership has been approved.</p><p style="margin:0 0 16px">The first 30 days of your membership have been funded. Continue below to enter your payment details and activate your account. Your normal membership billing will begin after the sponsored month.</p>`,
		actions: [{ label: 'Continue to membership checkout', url: params.checkoutUrl }],
	})
	const text = [
		`Hi ${params.name}, your application for sponsored JPV Bootcamp membership has been approved.`,
		'The first 30 days of your membership have been funded.',
		'Continue to membership checkout and enter your payment details. Normal membership billing begins after the sponsored month.',
		`Continue: ${params.checkoutUrl}`,
	].join('\n')

	assertStagingRecipientAllowed([params.to], 'sponsored-email:sendSponsoredRecipientCheckoutEmail')

	const { error } = await resend.emails.send({
		from,
		to: [params.to],
		subject: 'Your sponsored JPV Bootcamp membership is ready',
		html,
		text,
	})

	if (error) {
		console.error('sponsored_recipient_checkout_email_failed', {
			email: redactEmail(params.to),
			message: error.message,
		})
		throw error
	}
}

export async function sendSponsoredSeatAdminEmail(params: {
	donorEmail: string | null
	occurredAt: Date
}): Promise<void> {
	const resend = getResendClient()
	const from = getMailFrom()
	const to = await getAdminRecipients()
	const donor = params.donorEmail ? escapeHtml(params.donorEmail) : 'unknown'
	const timestamp = params.occurredAt.toISOString()

	const html = renderBrandedEmail({
		preheader: 'A sponsored access seat purchase was completed.',
		heading: 'Sponsored seat purchased',
		bodyHtml: `
			<p style="margin:0 0 12px">A sponsored seat purchase was completed.</p>
			<p style="margin:0 0 12px"><strong>Access:</strong> Controlled Free access</p>
			<p style="margin:0 0 12px"><strong>Donor email:</strong> ${donor}</p>
			<p style="margin:0"><strong>Timestamp:</strong> ${escapeHtml(timestamp)}</p>
		`,
	})
	const text = [
		'A sponsored seat purchase was completed.',
		'Access: Controlled Free access',
		`Donor email: ${params.donorEmail ?? 'unknown'}`,
		`Timestamp: ${timestamp}`,
	].join('\n')

	assertStagingRecipientAllowed(to, 'sponsored-email:sendSponsoredSeatAdminEmail')

	const { error } = await resend.emails.send({
		from,
		to,
		subject: 'Sponsored seat purchased',
		html,
		text,
	})

	if (error) {
		console.error('sponsored_seat_admin_email_failed', {
			email: params.donorEmail ? redactEmail(params.donorEmail) : null,
			message: error.message,
		})
		throw error
	}
}
