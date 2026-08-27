import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'

import config from '@payload-config'
import prisma from '@/libs/prisma'
import { redactEmail } from '@/lib/log-redact'
import { verifySponsoredDecisionToken } from '@/lib/sponsored-approval-token'
import { sendSponsoredApplicantRejectedEmail } from '@/lib/sponsored-email'
import { getPublicBaseUrl } from '@/lib/public-base-url'
import { isSponsoredSeatsAdmin } from '@/lib/sponsored-admin'
import { grantSponsoredApplication } from '@/lib/sponsored-admin-grant'
import { getPartnerSession, sanitizeSessionId, PARTNERS_SESSION_COOKIE } from '@/lib/partners-session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RedirectResult =
	| 'checkout_sent'
	| 'rejected'
	| 'expired'
	| 'invalid'
	| 'no_seats'
	| 'already_processed'

function buildRedirect(result: RedirectResult) {
	const baseUrl = getPublicBaseUrl()
	return NextResponse.redirect(
		`${baseUrl}/operations/sponsored-decision?result=${result}`,
	)
}

function redirectForGrantFailure(reason: string): RedirectResult {
	if (reason === 'no_seat_available') return 'no_seats'
	if (reason === 'not_pending' || reason === 'in_progress') return 'already_processed'
	return 'invalid'
}

export async function GET(req: NextRequest) {
	const token = req.nextUrl.searchParams.get('token') || ''
	const secret = (process.env.SPONSORED_DECISION_SECRET || '').trim()
	if (!secret) throw new Error('Missing required env var: SPONSORED_DECISION_SECRET')

	const verification = verifySponsoredDecisionToken(token, secret)
	if (!verification.ok) {
		return buildRedirect('expired')
	}

	const { applicationId, action } = verification.payload
	const sessionId = sanitizeSessionId(req.cookies.get(PARTNERS_SESSION_COOKIE)?.value)
	if (!sessionId) return buildRedirect('invalid')

	const session = await getPartnerSession(sessionId)
	if (!session || !isSponsoredSeatsAdmin(session.accountId)) return buildRedirect('invalid')

	const application = await prisma.sponsoredApplication.findUnique({
		where: { id: applicationId },
	})
	if (!application) return buildRedirect('invalid')

	if (action === 'reject') {
		if (application.status !== 'pending') return buildRedirect('already_processed')
		const updated = await prisma.sponsoredApplication.updateMany({
			where: { id: applicationId, status: 'pending' },
			data: {
				status: 'rejected',
				decision: 'rejected',
				decidedAt: new Date(),
				reviewedByAccountId: session.accountId,
				reviewedAt: new Date(),
			},
		})
		if (updated.count === 0) return buildRedirect('already_processed')

		if (application.email) {
			try {
				await sendSponsoredApplicantRejectedEmail({ to: application.email })
			} catch (error) {
				console.error('sponsored_applicant_email_failed', {
					applicationId,
					email: redactEmail(application.email),
					status: 'rejected',
					message: error instanceof Error ? error.message : 'unknown_error',
				})
			}
		}
		return buildRedirect('rejected')
	}

	const payload = await getPayload({ config })
	const existing = application.email
		? await payload.find({
				collection: 'payload_members',
				where: { email: { equals: application.email } },
				limit: 1,
				depth: 0,
				overrideAccess: true,
			})
		: null
	const existingMemberId = existing?.docs[0]?.id
	const result = await grantSponsoredApplication({
		payload,
		applicationId,
		mode: existingMemberId ? 'existing' : 'new',
		memberId: existingMemberId ? String(existingMemberId) : null,
		administratorId: session.accountId,
	})

	if (result.ok === false) return buildRedirect(redirectForGrantFailure(result.reason))
	return buildRedirect('checkout_sent')
}
