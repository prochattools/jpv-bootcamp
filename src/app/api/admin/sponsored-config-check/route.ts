import { createHash } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getPartnerSession, sanitizeSessionId } from '@/lib/partners-session'
import { isSponsoredSeatsAdmin } from '@/lib/sponsored-admin'
import { getPublicBaseUrl } from '@/lib/public-base-url'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function hashPrefix(value: string | undefined): string | null {
	if (!value) return null
	const trimmed = value.trim()
	if (!trimmed) return null
	const hash = createHash('sha256').update(trimmed).digest('hex')
	return hash.slice(0, 8)
}

export async function GET(req: NextRequest) {
	const sessionCookie = req.cookies.get('partners_session')?.value
	const sessionId = sanitizeSessionId(sessionCookie)
	if (!sessionId) {
		return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 })
	}

	const session = await getPartnerSession(sessionId)
	if (!session || !isSponsoredSeatsAdmin(session.accountId)) {
		return NextResponse.json({ ok: false, reason: 'forbidden' }, { status: 403 })
	}

	const baseUrl = getPublicBaseUrl()
	let host = 'unknown'
	try {
		host = new URL(baseUrl).host
	} catch {
		host = 'unknown'
	}

	return NextResponse.json({
		ok: true,
		appBaseUrlHost: host,
		decisionSecretHashPrefix: hashPrefix(process.env.SPONSORED_DECISION_SECRET),
		claimSecretHashPrefix: hashPrefix(process.env.SPONSORED_CLAIM_SECRET),
		stripeEnv: (process.env.STRIPE_ENV || '').trim() || 'unknown',
	})
}
