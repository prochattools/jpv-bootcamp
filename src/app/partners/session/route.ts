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

const PORTAL_PARTNERS_URL = 'https://portal.jpvbootcamp.com/go/partners'

export async function GET(req: NextRequest) {
	const tokenParam = req.nextUrl.searchParams.get('token')
	const token = sanitizePartnersToken(tokenParam)
	const nextParam = req.nextUrl.searchParams.get('next')
	const nextPath = sanitizePathOnly(nextParam, PARTNERS_DEFAULT_PATH)
	if (!token) {
		return NextResponse.redirect(PORTAL_PARTNERS_URL)
	}

	const secret = (process.env.PARTNERS_HANDOFF_SECRET || '').trim()
	if (!secret) {
		console.error('partners_handoff_secret_missing')
		return NextResponse.redirect(PORTAL_PARTNERS_URL)
	}

	const verification = verifyPartnersHandoffToken(token, secret)
	if (!verification.ok) {
		console.warn('partners_handoff_invalid', {
			reason: verification.reason,
		})
		return NextResponse.redirect(PORTAL_PARTNERS_URL)
	}

	try {
		const session = await createPartnerSession({
			wpUserId: verification.payload.wp_user_id,
			wpEmail: verification.payload.wp_email,
			wpName: verification.payload.wp_name,
		})

		const response = NextResponse.redirect(new URL(nextPath, req.nextUrl.origin))
		response.cookies.set(
			PARTNERS_SESSION_COOKIE,
			session.sessionId,
			buildSessionCookieOptions()
		)
		console.info('partners_session_created', {
			sessionId: session.sessionId.slice(0, 8),
			wpUserId: session.wpUserId,
			wpEmail: redactEmail(verification.payload.wp_email),
			expiresAt: session.expiresAt.toISOString(),
		})
		return response
	} catch (error) {
		console.error('partners_session_create_failed', {
			message: (error as Error).message,
		})
		return NextResponse.redirect(PORTAL_PARTNERS_URL)
	}
}
