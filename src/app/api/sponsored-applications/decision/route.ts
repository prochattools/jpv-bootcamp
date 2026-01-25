import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import prisma from '@/libs/prisma'
import { redactEmail } from '@/lib/log-redact'
import { verifySponsoredDecisionToken } from '@/lib/sponsored-approval-token'
import {
	getSponsoredPortalUrl,
	sendSponsoredApplicantApprovedEmail,
	sendSponsoredApplicantRejectedEmail,
} from '@/lib/sponsored-email'
import { applySponsoredGrant, getGrantWindow } from '@/lib/sponsored-grants'
import { getPublicBaseUrl } from '@/lib/public-base-url'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RedirectResult = 'approved' | 'rejected' | 'expired' | 'already_processed'

function buildRedirect(req: NextRequest, result: RedirectResult) {
	const baseUrl = getPublicBaseUrl()
	return NextResponse.redirect(
		`${baseUrl}/admin/sponsored-decision?result=${result}`
	)
}

export async function GET(req: NextRequest) {
	const token = req.nextUrl.searchParams.get('token') || ''
	const secret = (process.env.PARTNERS_HANDOFF_SECRET || '').trim()
	if (!secret) {
		return buildRedirect(req, 'expired')
	}

	const verification = verifySponsoredDecisionToken(token, secret)
	if (!verification.ok) {
		const reason = 'reason' in verification ? verification.reason : 'expired'
		return buildRedirect(req, reason === 'expired' ? 'expired' : 'expired')
	}

	const { applicationId, action } = verification.payload
	const application = await prisma.sponsoredApplication.findUnique({
		where: { id: applicationId },
	})

	if (!application) {
		return buildRedirect(req, 'expired')
	}

	if (application.status !== 'pending') {
		return buildRedirect(req, 'already_processed')
	}

	if (action === 'reject') {
		const updated = await prisma.sponsoredApplication.updateMany({
			where: { id: applicationId, status: 'pending' },
			data: {
				status: 'rejected',
				reviewedByWpUserId: null,
				reviewedAt: new Date(),
				decisionNote: null,
			},
		})

		if (updated.count === 0) {
			return buildRedirect(req, 'already_processed')
		}

		if (application.email) {
			try {
				await sendSponsoredApplicantRejectedEmail({ to: application.email })
			} catch (error) {
				console.error('sponsored_applicant_email_failed', {
					applicationId,
					email: redactEmail(application.email),
					status: 'rejected',
					message: (error as Error).message,
				})
			}
		}

		return buildRedirect(req, 'rejected')
	}

	const now = new Date()
	const { startsAt, endsAt } = getGrantWindow()
	let seatId: string | null = null
	let grantId: string | null = null
	let wpUserId = application.wpUserId
	let applicantName = application.name
	let applicantEmail = application.email

	try {
		await prisma.$transaction(async (tx) => {
			const locked = await tx.$queryRaw<
				{
					id: string
					status: string
					wp_user_id: number
					name: string
					email: string | null
				}[]
			>(Prisma.sql`
				SELECT id, status, wp_user_id, name, email
				FROM tenant_jpvbootcamp.sponsored_applications
				WHERE id = ${applicationId}
				FOR UPDATE
			`)

			if (!locked[0] || locked[0].status !== 'pending') {
				throw new Error('already_processed')
			}

			wpUserId = locked[0].wp_user_id
			applicantName = locked[0].name
			applicantEmail = locked[0].email

			const claimed = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
				UPDATE tenant_jpvbootcamp.sponsored_seats
				SET claimed_by_wp_user_id = ${wpUserId},
					claimed_at = ${now}
				WHERE id = (
					SELECT id
					FROM tenant_jpvbootcamp.sponsored_seats
					WHERE claimed_by_wp_user_id IS NULL
						AND tier = 'pro'
					ORDER BY created_at ASC
					FOR UPDATE SKIP LOCKED
					LIMIT 1
				)
				RETURNING id
			`)

			if (!claimed[0]?.id) {
				throw new Error('no_seat_available')
			}

			seatId = claimed[0].id

			const grant = await tx.sponsoredGrant.create({
				data: {
					wpUserId,
					tier: 'pro',
					seatId: seatId,
					startsAt,
					endsAt,
				},
			})
			grantId = grant.id

			await tx.sponsoredApplication.update({
				where: { id: applicationId },
				data: {
					status: 'approved',
					reviewedByWpUserId: null,
					reviewedAt: now,
					decisionNote: null,
				},
			})
		})
	} catch (error) {
		const message = (error as Error).message
		if (message === 'already_processed') {
			return buildRedirect(req, 'already_processed')
		}

		if (message === 'no_seat_available') {
			await prisma.sponsoredApplication.updateMany({
				where: { id: applicationId, status: 'pending' },
				data: {
					status: 'rejected',
					reviewedByWpUserId: null,
					reviewedAt: new Date(),
					decisionNote: null,
				},
			})
			if (applicantEmail) {
				try {
					await sendSponsoredApplicantRejectedEmail({ to: applicantEmail })
				} catch (emailError) {
					console.error('sponsored_applicant_email_failed', {
						applicationId,
						email: redactEmail(applicantEmail),
						status: 'rejected',
						message: (emailError as Error).message,
					})
				}
			}
			return buildRedirect(req, 'rejected')
		}

		console.error('sponsored_application_decision_failed', {
			applicationId,
			message,
		})
		return buildRedirect(req, 'expired')
	}

	if (!seatId || !grantId) {
		return buildRedirect(req, 'expired')
	}

	const grantResult = await applySponsoredGrant({
		wpUserId,
		tier: 'pro',
		name: applicantName,
	})

	if (!grantResult.ok) {
		console.error('sponsored_grant_provision_failed', {
			applicationId,
			wpUserId,
			message: grantResult.reason ?? 'provision_failed',
		})
	}

	if (applicantEmail) {
		try {
			await sendSponsoredApplicantApprovedEmail({
				to: applicantEmail,
				portalUrl: getSponsoredPortalUrl(),
			})
		} catch (error) {
			console.error('sponsored_applicant_email_failed', {
				applicationId,
				email: redactEmail(applicantEmail),
				status: 'approved',
				message: (error as Error).message,
			})
		}
	}

	return buildRedirect(req, 'approved')
}
