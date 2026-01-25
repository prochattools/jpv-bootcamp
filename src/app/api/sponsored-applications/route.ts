import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/libs/prisma'
import {
	getPartnerSession,
	sanitizeSessionId,
} from '@/lib/partners-session'
import { hashEmail } from '@/lib/sponsored-seats'
import { getWpUserExists } from '@/lib/wp'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ApplicationPayload = {
	name?: string
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
	const message = (body?.message ?? '').trim()

	if (!name) {
		return NextResponse.json({ ok: false, reason: 'missing_name' }, { status: 400 })
	}

	const existingPending = await prisma.sponsoredApplication.findFirst({
		where: {
			wpUserId: session.wpUserId,
			status: 'pending',
		},
	})
	if (existingPending) {
		return NextResponse.json({ ok: true, alreadyPending: true })
	}

	const lookup = await getWpUserExists({ wpUserId: session.wpUserId })
	if (!lookup?.email) {
		return NextResponse.json(
			{ ok: false, reason: 'missing_email' },
			{ status: 400 }
		)
	}

	await prisma.sponsoredApplication.create({
		data: {
			status: 'pending',
			wpUserId: session.wpUserId,
			emailHash: hashEmail(lookup.email),
			name,
			message: message || null,
		},
	})

	return NextResponse.json({ ok: true })
}
