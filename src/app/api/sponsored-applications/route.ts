import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/libs/prisma'
import { normalizeEmail } from '@/lib/normalize-email'
import {
	getPartnerSession,
	sanitizeSessionId,
} from '@/lib/partners-session'
import { redactEmail } from '@/lib/log-redact'
import { signSponsoredDecisionToken } from '@/lib/sponsored-approval-token'
import { sendSponsoredApplicationAdminEmail } from '@/lib/sponsored-email'
import { getSponsoredSeatCounts, hashEmail } from '@/lib/sponsored-seats'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ApplicationPayload = {
	name?: string
	email?: string
	message?: string
}

export async function POST(req: NextRequest) {
	const sessionCookie = req.cookies.get('partners_session')?.value
	const sessionId = sanitizeSessionId(sessionCookie)
	if (!sessionId) {
		return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 })
	}

	const session = await getPartnerSession(sessionId)
	if (!session) {
		return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 })
	}

	let body: ApplicationPayload | null = null
	try {
		body = (await req.json()) as ApplicationPayload
	} catch {
		body = null
	}

	const name = (body?.name ?? '').trim()
	const emailInput = typeof body?.email === 'string' ? body?.email : ''
	const normalizedEmail = normalizeEmail(emailInput)
	const message = (body?.message ?? '').trim()

	if (!name) {
		return NextResponse.json({ ok: false, reason: 'missing_name' }, { status: 400 })
	}

	if (!normalizedEmail || !normalizedEmail.includes('@')) {
		return NextResponse.json(
			{ ok: false, reason: 'missing_email' },
			{ status: 400 }
		)
	}

	const secret = (process.env.PARTNERS_HANDOFF_SECRET || '').trim()
	const hasResendKey = Boolean((process.env.RESEND_API_KEY || '').trim())
	const hasAdminRecipients = Boolean(
		(process.env.SPONSORED_APPLICATION_ADMIN_EMAILS || '').trim()
	)
	const hasMailFrom = Boolean(
		(
			process.env.SPONSORED_MAIL_FROM ||
			process.env.RESEND_FROM ||
			process.env.EMAIL_FROM ||
			''
		).trim()
	)

	if (!secret || !hasResendKey || !hasAdminRecipients || !hasMailFrom) {
		return NextResponse.json(
			{ ok: false, reason: 'missing_env' },
			{ status: 500 }
		)
	}

	const existingPending = await prisma.sponsoredApplication.findFirst({
		where: {
			wpUserId: session.wpUserId,
			status: 'pending',
		},
		orderBy: { createdAt: 'desc' },
	})

	let action: 'insert' | 'update_legacy' | 'blocked_existing_pending' = 'insert'
	let pendingEmailNull: boolean | null = null
	let applicationId: string | null = null

	if (existingPending) {
		pendingEmailNull = !existingPending.email
		if (existingPending.email) {
			action = 'blocked_existing_pending'
			console.info('sponsored_apply_submit', {
				wpUserId: session.wpUserId,
				action,
				pendingEmailNull,
			})
			return NextResponse.json({ ok: true, alreadyPending: true })
		}

		action = 'update_legacy'
		const updated = await prisma.sponsoredApplication.update({
			where: { id: existingPending.id },
			data: {
				email: normalizedEmail,
				emailHash: hashEmail(normalizedEmail),
				name,
				message: message || null,
			},
		})
		applicationId = updated.id
	} else {
		const created = await prisma.sponsoredApplication.create({
			data: {
				status: 'pending',
				wpUserId: session.wpUserId,
				email: normalizedEmail,
				emailHash: hashEmail(normalizedEmail),
				name,
				message: message || null,
			},
		})
		applicationId = created.id
	}

	console.info('sponsored_apply_submit', {
		wpUserId: session.wpUserId,
		action,
		pendingEmailNull,
	})

	if (!applicationId) {
		return NextResponse.json(
			{ ok: false, reason: 'create_failed' },
			{ status: 500 }
		)
	}

	const appBaseUrl = (
		process.env.NEXT_PUBLIC_APP_URL ||
		process.env.APP_PUBLIC_URL ||
		'https://jpvbootcamp.com'
	)
		.trim()
		.replace(/\/$/, '')

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

	const approveUrl = `${appBaseUrl}/api/sponsored-applications/decision?token=${encodeURIComponent(
		approveToken
	)}`
	const rejectUrl = `${appBaseUrl}/api/sponsored-applications/decision?token=${encodeURIComponent(
		rejectToken
	)}`

	let counts: { pro: number; vip: number } | undefined
	try {
		counts = await getSponsoredSeatCounts()
	} catch {
		counts = undefined
	}

	try {
		await sendSponsoredApplicationAdminEmail({
			applicationId: applicationId,
			applicantName: name,
			applicantEmail: normalizedEmail,
			message: message || null,
			approveUrl,
			rejectUrl,
			counts,
		})
	} catch (error) {
		console.error('sponsored_application_admin_email_failed', {
			applicationId: applicationId,
			email: redactEmail(normalizedEmail),
			message: (error as Error).message,
		})
	}

	return NextResponse.json({ ok: true })
}
