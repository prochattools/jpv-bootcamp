import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function isAuthorized(provided: string, expected: string): boolean {
	if (!provided || !expected) return false
	if (provided.length !== expected.length) return false
	return timingSafeEqual(Buffer.from(provided), Buffer.from(expected))
}

export async function GET(req: NextRequest) {
	const secret = (process.env.BILLING_PORTAL_HMAC_SECRET || '').trim()
	if (!secret) {
		console.error('BILLING_PORTAL_HMAC_SECRET missing')
		return NextResponse.json(
			{ ok: false, reason: 'missing_secret' },
			{ status: 500 }
		)
	}

	const header = req.headers.get('x-jpv-health-secret') || ''
	if (!isAuthorized(header, secret)) {
		return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 })
	}

	return NextResponse.json({ ok: true }, { status: 200 })
}
