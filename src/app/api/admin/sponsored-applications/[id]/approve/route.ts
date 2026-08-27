import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'

import config from '@payload-config'
import prisma from '@/libs/prisma'
import { getPartnerSession, sanitizeSessionId } from '@/lib/partners-session'
import { isSponsoredSeatsAdmin } from '@/lib/sponsored-admin'
import { grantSponsoredApplication } from '@/lib/sponsored-admin-grant'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	const sessionId = sanitizeSessionId(req.cookies.get('partners_session')?.value)
	if (!sessionId) {
		return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 })
	}

	const session = await getPartnerSession(sessionId)
	if (!session || !isSponsoredSeatsAdmin(session.accountId)) {
		return NextResponse.json({ ok: false, reason: 'forbidden' }, { status: 403 })
	}

	const { id: applicationId } = await params
	if (!applicationId) {
		return NextResponse.json({ ok: false, reason: 'missing_id' }, { status: 400 })
	}

	const application = await prisma.sponsoredApplication.findUnique({
		where: { id: applicationId },
	})
	if (!application) {
		return NextResponse.json({ ok: false, reason: 'not_found' }, { status: 404 })
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

	return NextResponse.json(result, { status: result.ok ? 200 : 400 })
}
