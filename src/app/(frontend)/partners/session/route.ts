import { NextRequest, NextResponse } from 'next/server'
import { sanitizePartnersToken } from '@/lib/partners-token-sanitize'
import { verifyPartnersHandoffToken } from '@/lib/partners-handoff-token'
import {
	PARTNERS_DEFAULT_PATH,
	sanitizePathOnly,
} from '@/lib/partners-url'
import {
	buildSessionCookieOptions,
	createPartnerSession,
	PARTNERS_SESSION_COOKIE,
} from '@/lib/partners-session'
import { redactEmail } from '@/lib/log-redact'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PARTNERS_URL = '/partners'

export async function GET(req: NextRequest) {
	const tokenParam = req.nextUrl.searchParams.get('token')
	const token = sanitizePartnersToken(tokenParam)
	const nextParam = req.nextUrl.searchParams.get('next')
	const nextPath = sanitizePathOnly(nextParam, PARTNERS_DEFAULT_PATH)
	if (!token) {
		return NextResponse.redirect(new URL(PARTNERS_URL, req.nextUrl.origin))
	}

	const secret = (process.env.PARTNERS_HANDOFF_SECRET || '').trim()
	if (!secret) {
		console.error('partners_handoff_secret_missing')
		return NextResponse.redirect(new URL(PARTNERS_URL, req.nextUrl.origin))
	}

	const verification = verifyPartnersHandoffToken(token, secret)
	if (!verification.ok) {
		const reason = 'reason' in verification ? verification.reason : 'invalid'
		console.warn('partners_handoff_invalid', {
			reason,
		})
		return NextResponse.redirect(new URL(PARTNERS_URL, req.nextUrl.origin))
	}

	try {
		const session = await createPartnerSession({
			accountId: verification.payload.account_id,
			accountEmail: verification.payload.account_email,
			accountName: verification.payload.account_name,
		})

		const response = NextResponse.redirect(new URL(nextPath, req.nextUrl.origin))
		response.cookies.set(
			PARTNERS_SESSION_COOKIE,
			session.sessionId,
			buildSessionCookieOptions()
		)
		console.info('partners_session_created', {
			sessionId: session.sessionId.slice(0, 8),
			accountId: session.accountId,
			accountEmail: redactEmail(verification.payload.account_email),
			expiresAt: session.expiresAt.toISOString(),
		})
		return response
	} catch (error) {
		console.error('partners_session_create_failed', {
			message: (error as Error).message,
		})
		return NextResponse.redirect(new URL(PARTNERS_URL, req.nextUrl.origin))
	}
}
