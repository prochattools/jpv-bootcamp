import { createHash, randomUUID } from 'crypto'
import prisma from '@/libs/prisma'
import { normalizeEmail } from '@/lib/normalize-email'
import { enforceSponsoredGrantStatus } from '@/lib/sponsored-grants'

export const PARTNERS_SESSION_COOKIE = 'partners_session'
export const PARTNERS_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7
export const PARTNERS_COOKIE_DOMAIN = 'jpvbootcamp.com'

export type PartnerSessionRecord = {
	sessionId: string
	accountId: number
	accountEmailHash: string
	accountName: string
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
	accountId: number
	accountEmail: string
	accountName: string
}): Promise<PartnerSessionRecord> {
	const now = new Date()
	const expiresAt = new Date(
		now.getTime() + PARTNERS_SESSION_MAX_AGE_SECONDS * 1000
	)
	const sessionId = randomUUID()
	const accountEmailHash = hashEmail(params.accountEmail)
	const accountName = params.accountName.trim().slice(0, 120)

	const record = await prisma.partnerSession.create({
		data: {
			sessionId,
			accountId: params.accountId,
			accountEmailHash,
			accountName,
			createdAt: now,
			expiresAt,
		},
	})

	return {
		sessionId: record.sessionId,
		accountId: record.accountId,
		accountEmailHash: record.accountEmailHash,
		accountName: record.accountName,
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
	await enforceSponsoredGrantStatus(record.accountId)
	return {
		sessionId: record.sessionId,
		accountId: record.accountId,
		accountEmailHash: record.accountEmailHash,
		accountName: record.accountName,
		createdAt: record.createdAt,
		expiresAt: record.expiresAt,
	}
}
