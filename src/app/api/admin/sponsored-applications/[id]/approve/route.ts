import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import prisma from '@/libs/prisma'
import {
	getPartnerSession,
	sanitizeSessionId,
} from '@/lib/partners-session'
import { isSponsoredSeatsAdmin } from '@/lib/sponsored-admin'
import { normalizeSponsoredTier } from '@/lib/sponsored-seats'
import { applySponsoredGrant, getGrantWindow } from '@/lib/sponsored-grants'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ApprovePayload = {
	tier?: string
	note?: string
}

async function parsePayload(req: NextRequest): Promise<ApprovePayload> {
	const contentType = req.headers.get('content-type') || ''
	if (contentType.includes('application/json')) {
		return (await req.json()) as ApprovePayload
	}
	const form = await req.formData()
	return {
		tier: form.get('tier')?.toString(),
		note: form.get('note')?.toString(),
	}
}

export async function POST(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
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

	const { id: applicationId } = await params
	if (!applicationId) {
		return NextResponse.json({ ok: false, reason: 'missing_id' }, { status: 400 })
	}

	const payload = await parsePayload(req)
	const tier = normalizeSponsoredTier(payload.tier ?? 'pro') ?? 'pro'
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

	if (!application.wpUserId) {
		return NextResponse.json(
			{ ok: false, reason: 'missing_wp_user_id' },
			{ status: 400 }
		)
	}

	const now = new Date()
	const { startsAt, endsAt } = getGrantWindow()

	let seatId: string | null = null
	let grantId: string | null = null
	try {
		await prisma.$transaction(async (tx) => {
			const claimed = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
				UPDATE jpvbootcamp.sponsored_seats
				SET claimed_by_wp_user_id = ${application.wpUserId},
					claimed_at = ${now}
				WHERE id = (
					SELECT id
					FROM jpvbootcamp.sponsored_seats
					WHERE claimed_by_wp_user_id IS NULL
						AND tier = ${tier}
					ORDER BY created_at ASC
					FOR UPDATE SKIP LOCKED
					LIMIT 1
				)
				RETURNING id
			`)

			if (!claimed[0]?.id) {
				throw new Error('no_seat_available')
			}

			seatId = claimed[0].id

			const grant = await tx.sponsoredGrant.create({
				data: {
					wpUserId: application.wpUserId,
					tier,
					seatId: seatId,
					startsAt,
					endsAt,
				},
			})
			grantId = grant.id

			await tx.sponsoredApplication.update({
				where: { id: applicationId },
				data: {
					status: 'approved',
					reviewedByWpUserId: session.wpUserId,
					reviewedAt: now,
					decisionNote: note,
				},
			})
		})
	} catch (error) {
		const message = (error as Error).message
		return NextResponse.json(
			{ ok: false, reason: message === 'no_seat_available' ? 'no_seat' : 'failed' },
			{ status: message === 'no_seat_available' ? 409 : 500 }
		)
	}

	if (!seatId || !grantId) {
		return NextResponse.json({ ok: false, reason: 'failed' }, { status: 500 })
	}

	const grantResult = await applySponsoredGrant({
		wpUserId: application.wpUserId,
		tier,
		name: application.name,
	})

	if (!grantResult.ok) {
		return NextResponse.json(
			{ ok: false, reason: grantResult.reason ?? 'provision_failed' },
			{ status: 500 }
		)
	}

	return NextResponse.json({ ok: true, seatId, grantId })
}
