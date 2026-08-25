import { createHash, randomUUID } from 'crypto'
import prisma from '@/libs/prisma'
import { normalizeEmail } from '@/lib/normalize-email'
import { enforceSponsoredGrantStatus } from '@/lib/sponsored-grants'

export const PARTNERS_SESSION_COOKIE = 'partners_session'
export const PARTNERS_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7
export const PARTNERS_COOKIE_DOMAIN =
	process.env.NEXT_PUBLIC_APP_DOMAIN?.trim() || 'jpvbootcamp.com'

export type PartnerSessionRecord = {
	sessionId: string
	wpUserId: number
	wpEmailHash: string
	wpName: string
	createdAt: Date
	expiresAt: Date
}

function hashSha256(value: string): string {
	return createHash('sha256').update(value).digest('hex')
}

export function hashEmail(value: string): string {
	const normalized = normalizeEmail(value) ?? ''
	return hashSha256(normalized)
}

export function sanitizeSessionId(raw?: string | null): string | null {
	if (!raw) return null
	const trimmed = raw.trim().replace(/[\r\n]/g, '')
	if (!trimmed) return null
	if (trimmed.length > 128) return null
	return trimmed
}

export function buildSessionCookieOptions() {
	return {
		httpOnly: true,
		secure: true,
		sameSite: 'lax' as const,
		path: '/',
		domain: PARTNERS_COOKIE_DOMAIN,
		maxAge: PARTNERS_SESSION_MAX_AGE_SECONDS,
	}
}

export async function createPartnerSession(params: {
	wpUserId: number
	wpEmail: string
	wpName: string
}): Promise<PartnerSessionRecord> {
	const now = new Date()
	const expiresAt = new Date(
		now.getTime() + PARTNERS_SESSION_MAX_AGE_SECONDS * 1000
	)
	const sessionId = randomUUID()
	const wpEmailHash = hashEmail(params.wpEmail)
	const wpName = params.wpName.trim().slice(0, 120)

	const record = await prisma.partnerSession.create({
		data: {
			sessionId,
			wpUserId: params.wpUserId,
			wpEmailHash,
			wpName,
			createdAt: now,
			expiresAt,
		},
	})

	return {
		sessionId: record.sessionId,
		wpUserId: record.wpUserId,
		wpEmailHash: record.wpEmailHash,
		wpName: record.wpName,
		createdAt: record.createdAt,
		expiresAt: record.expiresAt,
	}
}

export async function getPartnerSession(
	sessionId: string
): Promise<PartnerSessionRecord | null> {
	const record = await prisma.partnerSession.findUnique({
		where: { sessionId },
	})
	if (!record) return null
	if (record.expiresAt.getTime() <= Date.now()) {
		try {
			await prisma.partnerSession.delete({ where: { sessionId } })
		} catch {
			// ignore cleanup failures
		}
		return null
	}
	await enforceSponsoredGrantStatus(record.wpUserId)
	return {
		sessionId: record.sessionId,
		wpUserId: record.wpUserId,
		wpEmailHash: record.wpEmailHash,
		wpName: record.wpName,
		createdAt: record.createdAt,
		expiresAt: record.expiresAt,
	}
}
