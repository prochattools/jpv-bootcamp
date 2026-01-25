import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/libs/prisma'
import {
	getPartnerSession,
	sanitizeSessionId,
} from '@/lib/partners-session'
import { isSponsoredSeatsAdmin } from '@/lib/sponsored-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RejectPayload = {
	note?: string
}

async function parsePayload(req: NextRequest): Promise<RejectPayload> {
	const contentType = req.headers.get('content-type') || ''
	if (contentType.includes('application/json')) {
		return (await req.json()) as RejectPayload
	}
	const form = await req.formData()
	return {
		note: form.get('note')?.toString(),
	}
}

export async function POST(
	req: NextRequest,
	{ params }: { params: { id: string } }
) {
	const sessionCookie = req.cookies.get('partners_session')?.value
	const sessionId = sanitizeSessionId(sessionCookie)
	if (!sessionId) {
		return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 })
	}

	const session = await getPartnerSession(sessionId)
	if (!session || !isSponsoredSeatsAdmin(session.wpUserId)) {
		return NextResponse.json({ ok: false, reason: 'forbidden' }, { status: 403 })
	}

	const applicationId = params.id
	if (!applicationId) {
		return NextResponse.json({ ok: false, reason: 'missing_id' }, { status: 400 })
	}

	const payload = await parsePayload(req)
	const note = payload.note?.trim() ?? null

	const application = await prisma.sponsoredApplication.findUnique({
		where: { id: applicationId },
	})
	if (!application || application.status !== 'pending') {
		return NextResponse.json(
			{ ok: false, reason: 'not_pending' },
			{ status: 400 }
		)
	}

	await prisma.sponsoredApplication.update({
		where: { id: applicationId },
		data: {
			status: 'rejected',
			reviewedByWpUserId: session.wpUserId,
			reviewedAt: new Date(),
			decisionNote: note,
		},
	})

	return NextResponse.json({ ok: true })
}
