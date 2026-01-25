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

type RedirectResult =
	| 'approved'
	| 'rejected'
	| 'expired'
	| 'invalid'
	| 'no_seats'
	| 'already_processed'
	| 'wp_failed'

function buildRedirect(req: NextRequest, result: RedirectResult) {
	const baseUrl = getPublicBaseUrl()
	return NextResponse.redirect(
		`${baseUrl}/admin/sponsored-decision?result=${result}`
	)
}

export async function GET(req: NextRequest) {
	const token = req.nextUrl.searchParams.get('token') || ''
	const secret = (process.env.SPONSORED_DECISION_SECRET || '').trim()
	if (!secret) {
		throw new Error('Missing required env var: SPONSORED_DECISION_SECRET')
	}

	const verification = verifySponsoredDecisionToken(token, secret)
	if (!verification.ok) {
		const baseUrl = getPublicBaseUrl()
		const host = (() => {
			try {
				return new URL(baseUrl).host
			} catch {
				return 'unknown'
			}
		})()
		const rawReason = 'reason' in verification ? verification.reason : 'malformed'
		const reason =
			rawReason === 'missing'
				? 'missing'
				: rawReason === 'invalid_signature'
					? 'bad_sig'
					: rawReason === 'decode_error'
						? 'decode_error'
						: rawReason === 'expired'
							? 'expired'
							: 'decode_error'
		const now = Math.floor(Date.now() / 1000)
		console.warn('sponsored_decision_token_verify_failed', {
			reason,
			now,
			iat: 'iat' in verification ? verification.iat ?? null : null,
			exp: 'exp' in verification ? verification.exp ?? null : null,
			host,
		})
		return buildRedirect(
			req,
			reason === 'expired' ? 'expired' : 'invalid'
		)
	}

	const { applicationId, action } = verification.payload
	{
		const baseUrl = getPublicBaseUrl()
		const host = (() => {
			try {
				return new URL(baseUrl).host
			} catch {
				return 'unknown'
			}
		})()
		console.info('sponsored_decision_token_verified', {
			applicationId,
			action,
			host,
		})
	}
	const application = await prisma.sponsoredApplication.findUnique({
		where: { id: applicationId },
	})

	if (!application) {
		return buildRedirect(req, 'invalid')
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
			return buildRedirect(req, 'no_seats')
		}

		console.error('sponsored_application_decision_failed', {
			applicationId,
			message,
		})
		return buildRedirect(req, 'invalid')
	}

	if (!seatId || !grantId) {
		return buildRedirect(req, 'invalid')
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
		return buildRedirect(req, 'wp_failed')
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
