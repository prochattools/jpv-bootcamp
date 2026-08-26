import 'server-only'
import prisma from '@/libs/prisma'
import { normalizeEmail } from '@/lib/normalize-email'
import type { SponsoredTier } from '@/lib/sponsored-seats'

const GRANT_DURATION_MS = 1000 * 60 * 60 * 24 * 30

export type SponsoredGrantResult = {
	ok: boolean
	reason?: string
}

/**
 * Provisions a CustomerProvisioning record for a sponsored user so the
 * entitlement decision engine (/api/entitlements) can evaluate their plan.
 *
 * Sponsored access does not involve Stripe. A synthetic stripeCustomerId of
 * the form "sponsored:{accountId}" is written so the unique constraint is
 * satisfied without touching Stripe. The billing portal and Stripe-specific
 * lookups will not be available for these records.
 *
 * If a real CustomerProvisioning record already exists for the email (i.e. the
 * user has a Stripe subscription), the plan is upgraded only when the sponsored
 * tier exceeds the stored plan ('pro' > 'free'). An existing 'pro' subscription
 * is never downgraded.
 */
export async function applySponsoredGrant(params: {
	accountId: number
	tier: SponsoredTier
	name?: string | null
}): Promise<SponsoredGrantResult> {
	const application = await prisma.sponsoredApplication.findFirst({
		where: { accountId: params.accountId },
		orderBy: { claimedAt: 'desc' },
		select: { email: true },
	})

	const email = normalizeEmail(application?.email ?? null)
	if (!email) {
		console.warn('sponsored_grant_missing_email', {
			accountId: params.accountId,
			tier: params.tier,
		})
		return { ok: false, reason: 'missing_email' }
	}

	const plan = params.tier

	try {
		const existing = await prisma.customerProvisioning.findUnique({
			where: { normalizedEmail: email },
			select: { id: true, currentPlan: true, stripeCustomerId: true },
		})

		if (existing) {
			// Do not downgrade an existing paid Pro subscription.
			if (existing.currentPlan === 'pro') {
				console.info('sponsored_grant_skipped_existing_pro', {
					accountId: params.accountId,
					existingPlan: existing.currentPlan,
					sponsoredTier: plan,
				})
				return { ok: true }
			}

			await prisma.customerProvisioning.update({
				where: { id: existing.id },
				data: {
					plan,
					currentPlan: plan,
					status: 'active',
					accountId: params.accountId,
				},
			})
		} else {
			const syntheticCustomerId = `sponsored:${params.accountId}`
			await prisma.customerProvisioning.create({
				data: {
					email,
					normalizedEmail: email,
					stripeCustomerId: syntheticCustomerId,
					plan,
					currentPlan: plan,
					status: 'active',
					accountId: params.accountId,
				},
			})
		}

		console.info('sponsored_grant_provisioned', {
			accountId: params.accountId,
			tier: params.tier,
			plan,
			namePresent: Boolean(params.name),
		})
		return { ok: true }
	} catch (error) {
		console.error('sponsored_grant_provision_failed', {
			accountId: params.accountId,
			tier: params.tier,
			message: (error as Error).message,
		})
		return { ok: false, reason: 'provision_failed' }
	}
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
