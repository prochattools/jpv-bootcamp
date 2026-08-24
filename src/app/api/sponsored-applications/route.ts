import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/libs/prisma'
import { guardPublicRequest } from '@/lib/publicRequestGuard'
import {
	getPublicRequestApplicationOrigin,
	logPublicRequestGuard,
	publicRequestFailureResponse,
	publicRequestRateLimiter,
	trustPublicRequestProxyHeaders,
} from '@/lib/publicRequestRoute'
import { isValidInternationalPhone, normalizePhone } from '@/lib/normalize-phone'
import { signSponsoredDecisionToken } from '@/lib/sponsored-approval-token'
import { sendSponsoredApplicationAdminEmail } from '@/lib/sponsored-email'
import {
	getSponsoredSeatCounts,
	hashEmail,
} from '@/lib/sponsored-seats'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const sponsoredApplicationFields = {
	name: { type: 'string', required: true, minLength: 2, maxLength: 120 },
	email: { type: 'email', required: true, maxLength: 320 },
	phone: { type: 'string', required: true, minLength: 7, maxLength: 40 },
	message: { type: 'string', maxLength: 2_000 },
} as const

const SPONSORED_APPLICATION_MAX_BYTES = 12 * 1024
const ADMIN_EMAIL_THROTTLE_MS = 1000 * 60 * 15

export async function POST(req: NextRequest) {
	const guarded = await guardPublicRequest(req, {
		namespace: 'public-sponsored-applications',
		methods: ['POST'],
		bodyType: 'json',
		fields: sponsoredApplicationFields,
		applicationOrigin: getPublicRequestApplicationOrigin(),
		missingOrigin: 'reject',
		maxBytes: SPONSORED_APPLICATION_MAX_BYTES,
		allowUnknownFields: false,
		trustProxyHeaders: trustPublicRequestProxyHeaders(),
		rateLimit: {
			limiter: publicRequestRateLimiter,
			limit: 3,
			windowMs: 15 * 60_000,
			identityField: 'email',
			backendFailure: 'deny',
		},
		logger: logPublicRequestGuard,
	})

	if (guarded.ok === false) {
		return publicRequestFailureResponse(guarded)
	}

	const { name, email: normalizedEmail, phone: phoneInput, message } = guarded.data
	const phone = normalizePhone(phoneInput)

	if (!phone || !isValidInternationalPhone(phone)) {
		return NextResponse.json(
			{ ok: false, reason: 'invalid_phone' },
			{ status: 400 }
		)
	}

	const secret = (process.env.SPONSORED_DECISION_SECRET || '').trim()
	const hasResendKey = Boolean((process.env.RESEND_API_KEY || '').trim())
	const hasMailFrom = Boolean(
		(
			process.env.SPONSORED_MAIL_FROM ||
			process.env.RESEND_FROM ||
			process.env.EMAIL_FROM ||
			''
		).trim()
	)

	if (!secret || !hasResendKey || !hasMailFrom) {
		return NextResponse.json(
			{ ok: false, reason: 'missing_env' },
			{ status: 500 }
		)
	}

	const existingPending = await prisma.sponsoredApplication.findFirst({
		where: {
			email: normalizedEmail,
		},
		orderBy: { createdAt: 'desc' },
	})

	let outcome:
		| 'created_new'
		| 'updated_existing_pending'
		| 'already_approved'
		| 'already_rejected'
		| 'already_claimed' = 'created_new'
	let applicationId: string | null = null
	let shouldSendAdminEmail = true

	if (existingPending) {
		if (existingPending.status !== 'pending') {
			if (existingPending.status === 'approved') {
				outcome = 'already_approved'
			} else if (existingPending.status === 'claimed') {
				outcome = 'already_claimed'
			} else {
				outcome = 'already_rejected'
			}
			shouldSendAdminEmail = false
			applicationId = existingPending.id
		} else {
			outcome = 'updated_existing_pending'
			const lastSent = existingPending.lastAdminEmailSentAt
			if (lastSent) {
				const elapsed = Date.now() - lastSent.getTime()
				shouldSendAdminEmail = elapsed >= ADMIN_EMAIL_THROTTLE_MS
			}

			const updated = await prisma.sponsoredApplication.update({
				where: { id: existingPending.id },
				data: {
					email: normalizedEmail,
					emailHash: hashEmail(normalizedEmail),
					name,
					phone,
					message: message || null,
					tier: 'free',
				},
			})
			applicationId = updated.id
		}
	} else {
		const created = await prisma.sponsoredApplication.create({
			data: {
				status: 'pending',
				email: normalizedEmail,
				emailHash: hashEmail(normalizedEmail),
				name,
				phone,
				message: message || null,
				tier: 'free',
			},
		})
		applicationId = created.id
	}

	console.info('sponsored_apply_submit', {
		applicationId,
		outcome,
	})

	if (!applicationId) {
		return NextResponse.json(
			{ ok: false, reason: 'create_failed' },
			{ status: 500 }
		)
	}

	const now = Math.floor(Date.now() / 1000)
	const exp = now + 60 * 60 * 48
	const approveToken = signSponsoredDecisionToken(
		{
			applicationId: applicationId,
			action: 'approve',
			iat: now,
			exp,
			nonce: randomUUID(),
		},
		secret
	)
	const rejectToken = signSponsoredDecisionToken(
		{
			applicationId: applicationId,
			action: 'reject',
			iat: now,
			exp,
			nonce: randomUUID(),
		},
		secret
	)

	let counts: { available: number } | undefined
	try {
		counts = await getSponsoredSeatCounts()
	} catch {
		counts = undefined
	}

	if (shouldSendAdminEmail) {
		try {
			await sendSponsoredApplicationAdminEmail({
				applicationId: applicationId,
				applicantName: name,
				applicantEmail: normalizedEmail,
				applicantPhone: phone,
				message: message || null,
				approveToken,
				rejectToken,
				counts,
			})
			await prisma.sponsoredApplication.updateMany({
				where: { id: applicationId },
				data: { lastAdminEmailSentAt: new Date() },
			})
		} catch (error) {
			console.error('sponsored_application_admin_email_failed', {
				applicationId,
				errorName: error instanceof Error ? error.name : 'unknown',
			})
		}
	}

	return NextResponse.json({ ok: true, outcome })
}
