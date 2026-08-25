import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/libs/prisma'
import { getPartnerBySlug } from '@/content/partners'
import { sanitizeSessionId, getPartnerSession } from '@/lib/partners-session'
import { sanitizeRefPath } from '@/lib/partners-url'
import { getPublicBaseUrl } from '@/lib/public-base-url'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PORTAL_PARTNERS_URL = 'https://portal.jpvbootcamp.com/go/partners'
const DEFAULT_PARTNERS_URL = `${getPublicBaseUrl()}/partners`
const CLICK_DEDUPE_WINDOW_MS = 3000

function isSafeAffiliateUrl(url: string): boolean {
	if (!url) return false
	const trimmed = url.trim()
	if (!trimmed) return false
	if (/^(javascript|data):/i.test(trimmed)) return false
	return /^https:\/\//i.test(trimmed)
}

export async function GET(
	req: NextRequest,
	{ params }: { params: Promise<{ partnerSlug: string }> }
) {
	const { partnerSlug: rawSlug } = await params
	const partnerSlug = rawSlug?.toLowerCase() ?? ''
	const partner = partnerSlug ? getPartnerBySlug(partnerSlug) : null
	if (!partner || !isSafeAffiliateUrl(partner.affiliate_url)) {
		return NextResponse.redirect(DEFAULT_PARTNERS_URL)
	}

	const sessionCookie = req.cookies.get('partners_session')?.value
	const sessionId = sanitizeSessionId(sessionCookie)
	if (!sessionId) {
		return NextResponse.redirect(PORTAL_PARTNERS_URL)
	}

	const session = await getPartnerSession(sessionId)
	if (!session) {
		return NextResponse.redirect(PORTAL_PARTNERS_URL)
	}

	const now = Date.now()
	let shouldInsert = true
	const recentClick = await prisma.partnerClick.findFirst({
		where: {
			sessionId,
			partnerSlug: partner.slug,
		},
		orderBy: { createdAt: 'desc' },
	})

	if (recentClick) {
		const diff = now - recentClick.createdAt.getTime()
		if (diff >= 0 && diff < CLICK_DEDUPE_WINDOW_MS) {
			shouldInsert = false
		}
	}

	if (shouldInsert) {
		const refPath = sanitizeRefPath(req.headers.get('referer'))
		try {
			await prisma.partnerClick.create({
				data: {
					sessionId,
					wpUserId: session.wpUserId,
					partnerSlug: partner.slug,
					categorySlug: partner.category,
					refPath,
				},
			})
		} catch (error) {
			console.error('partner_click_log_failed', {
				partnerSlug: partner.slug,
				categorySlug: partner.category,
				sessionId: sessionId.slice(0, 8),
				message: (error as Error).message,
			})
		}
	}

	return NextResponse.redirect(partner.affiliate_url, { status: 302 })
}
