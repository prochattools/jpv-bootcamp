import 'server-only'
import prisma from '@/libs/prisma'
import { getWpUserExists, provisionWpUser, updateWpMembershipLevel } from '@/lib/wp'
import { redactEmail } from '@/lib/log-redact'
import { normalizeSponsoredTier, type SponsoredTier } from '@/lib/sponsored-seats'

const GRANT_DURATION_MS = 1000 * 60 * 60 * 24 * 30

export type SponsoredGrantResult = {
	ok: boolean
	reason?: string
}

export async function applySponsoredGrant(params: {
	wpUserId: number
	tier: SponsoredTier
	name?: string | null
}): Promise<SponsoredGrantResult> {
	const lookup = await getWpUserExists({ wpUserId: params.wpUserId })
	if (!lookup?.exists || !lookup.email) {
		return { ok: false, reason: 'wp_user_not_found' }
	}

	try {
		await provisionWpUser({
			email: lookup.email,
			plan: params.tier,
			name: params.name ?? null,
		})
		return { ok: true }
	} catch (error) {
		console.error('sponsored_grant_provision_failed', {
			wpUserId: params.wpUserId,
			email: redactEmail(lookup.email),
			tier: params.tier,
			message: (error as Error).message,
		})
		return { ok: false, reason: 'provision_failed' }
	}
}

export async function enforceSponsoredGrantStatus(
	wpUserId: number
): Promise<void> {
	const now = new Date()
	const activeGrant = await prisma.sponsoredGrant.findFirst({
		where: {
			wpUserId,
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
			wpUserId,
			revokedAt: null,
			endsAt: { lte: now },
		},
		orderBy: { endsAt: 'desc' },
	})
	if (!expiredGrant) {
		return
	}

	const tier = normalizeSponsoredTier(expiredGrant.tier)
	if (!tier) {
		return
	}

	try {
		const lookup = await getWpUserExists({ wpUserId })
		if (lookup?.email) {
			await updateWpMembershipLevel({
				email: lookup.email,
				plan: 'free',
			})
		}
		await prisma.sponsoredGrant.update({
			where: { id: expiredGrant.id },
			data: {
				revokedAt: now,
			},
		})
		console.info('sponsored_grant_revoked', {
			wpUserId,
			grantId: expiredGrant.id,
		})
	} catch (error) {
		console.error('sponsored_grant_revoke_failed', {
			wpUserId,
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
