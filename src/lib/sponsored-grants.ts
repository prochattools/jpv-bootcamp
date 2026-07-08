import 'server-only'
import prisma from '@/libs/prisma'
import type { SponsoredTier } from '@/lib/sponsored-seats'

const GRANT_DURATION_MS = 1000 * 60 * 60 * 24 * 30

export type SponsoredGrantResult = {
	ok: boolean
	reason?: string
}

export async function applySponsoredGrant(params: {
	accountId: number
	tier: SponsoredTier
	name?: string | null
}): Promise<SponsoredGrantResult> {
	console.info('sponsored_grant_recorded', {
		accountId: params.accountId,
		tier: params.tier,
		namePresent: Boolean(params.name),
	})
	return { ok: true }
}

export async function enforceSponsoredGrantStatus(
	accountId: number
): Promise<void> {
	const now = new Date()
	const activeGrant = await prisma.sponsoredGrant.findFirst({
		where: {
			accountId,
			revokedAt: null,
			endsAt: { gt: now },
		},
		orderBy: { endsAt: 'desc' },
	})
	if (activeGrant) {
		return
	}

	const expiredGrant = await prisma.sponsoredGrant.findFirst({
		where: {
			accountId,
			revokedAt: null,
			endsAt: { lte: now },
		},
		orderBy: { endsAt: 'desc' },
	})
	if (!expiredGrant) {
		return
	}

	try {
		await prisma.sponsoredGrant.update({
			where: { id: expiredGrant.id },
			data: {
				revokedAt: now,
			},
		})
		console.info('sponsored_grant_revoked', {
			accountId,
			grantId: expiredGrant.id,
		})
	} catch (error) {
		console.error('sponsored_grant_revoke_failed', {
			accountId,
			grantId: expiredGrant.id,
			message: (error as Error).message,
		})
	}
}

export function getGrantWindow(): { startsAt: Date; endsAt: Date } {
	const startsAt = new Date()
	const endsAt = new Date(startsAt.getTime() + GRANT_DURATION_MS)
	return { startsAt, endsAt }
}
