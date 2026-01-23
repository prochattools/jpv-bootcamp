import 'server-only'

import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import prisma from '@/libs/prisma'
import { getWpAppSyncToken } from '@/lib/config'
import { normalizeEmail as normalizeEmailAddress } from '@/lib/normalize-email'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getAuthToken(req: Request): string | null {
	const signature = req.headers.get('x-jpv-wp-signature')
	if (signature && signature.trim()) return signature.trim()

	const auth = req.headers.get('authorization') ?? ''
	const match = auth.match(/Bearer\s+(.*)$/i)
	if (match) return match[1].trim()
	return null
}

function safeEqual(a: string, b: string): boolean {
	const bufferA = Buffer.from(a)
	const bufferB = Buffer.from(b)
	if (bufferA.length !== bufferB.length) return false
	return timingSafeEqual(bufferA, bufferB)
}

export async function POST(req: Request) {
	let expectedToken: string
	try {
		expectedToken = getWpAppSyncToken()
	} catch (error) {
		console.error('WP deletion sync token missing', {
			message: (error as Error).message,
		})
		return NextResponse.json({ error: 'Sync token not configured.' }, { status: 500 })
	}

	const providedToken = getAuthToken(req)
	if (!providedToken || !safeEqual(providedToken, expectedToken)) {
		return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
	}

	let payload: { wp_user_id?: number; wpUserId?: number; email?: string } | null = null
	try {
		payload = (await req.json()) as typeof payload
	} catch {
		payload = null
	}

	if (!payload) {
		return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 })
	}

	const rawWpUserId = payload.wp_user_id ?? payload.wpUserId
	const numericWpUserId = Number(rawWpUserId)
	const wpUserId = Number.isFinite(numericWpUserId) && numericWpUserId > 0
		? numericWpUserId
		: null
	const email = normalizeEmailAddress(payload.email ?? null)

	if (!wpUserId && !email) {
		return NextResponse.json(
			{ error: 'wp_user_id or email is required.' },
			{ status: 400 }
		)
	}

	let record =
		email
			? await prisma.customerProvisioning.findUnique({
					where: { normalizedEmail: email },
			  })
			: null
	if (!record && wpUserId) {
		record = await prisma.customerProvisioning.findFirst({
			where: { wpUserId },
		})
	}

	if (!record) {
		console.warn('WP deletion sync: no provisioning record found', {
			wpUserId,
			email,
		})
		return NextResponse.json({ ok: true, updated: false })
	}

	const updated = await prisma.customerProvisioning.update({
		where: { id: record.id },
		data: {
			wpUserId: null,
			status: 'deleted_in_wp',
		},
	})

	console.info('WP deletion sync updated provisioning record', {
		id: updated.id,
		email: updated.email,
		stripeCustomerId: updated.stripeCustomerId,
		stripeSubscriptionId: updated.stripeSubscriptionId,
		previousWpUserId: record.wpUserId,
		status: updated.status,
	})

	return NextResponse.json({ ok: true, updated: true })
}
