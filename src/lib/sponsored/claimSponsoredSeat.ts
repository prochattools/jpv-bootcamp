import 'server-only'

import prisma from '@/libs/prisma'

export type SponsoredClaimResult = 'claimed' | 'already_claimed'

export type SponsoredClaimApplication = {
	status: string
	email: string | null
	accountId: number | null
	seatId: string | null
}

/**
 * Reads the application state required by the claim page. Keeping this read
 * beside the claim transaction prevents the route from owning a second
 * sponsored persistence path.
 */
export async function getSponsoredClaimApplication(
	applicationId: string,
): Promise<SponsoredClaimApplication | null> {
	return prisma.sponsoredApplication.findUnique({
		where: { id: applicationId },
		select: {
			status: true,
			email: true,
			accountId: true,
			seatId: true,
		},
	})
}

/**
 * Atomically consumes an approved sponsored seat and records its grant.
 * Token verification, authorization, and presentation stay in the route;
 * this service owns the durable claim transaction and its race handling.
 */
export async function claimSponsoredSeat(params: {
  applicationId: string
  seatId: string
  accountId: number
  now?: Date
}): Promise<SponsoredClaimResult> {
  const now = params.now ?? new Date()
  const endsAt = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 30)

  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM sponsored_seat
      WHERE id = ${params.seatId}::uuid
        AND reserved_by_application_id = ${params.applicationId}::uuid
        AND claimed_by_account_id IS NULL
      FOR UPDATE
    `

    if (locked.length === 0) {
      const application = await tx.sponsoredApplication.findUnique({
        where: { id: params.applicationId },
        select: { status: true, accountId: true },
      })
      if (application?.status === 'claimed' && application.accountId === params.accountId) {
        return 'already_claimed'
      }
      throw new Error('seat_unavailable')
    }

    await tx.sponsoredSeat.update({
      where: { id: params.seatId },
      data: {
        claimedByAccountId: params.accountId,
        claimedAt: now,
        reservedByApplicationId: null,
        reservedAt: null,
      },
    })

    await tx.sponsoredGrant.create({
      data: {
        accountId: params.accountId,
        tier: 'free',
        seatId: params.seatId,
        startsAt: now,
        endsAt,
      },
    })

    const updated = await tx.sponsoredApplication.updateMany({
      where: { id: params.applicationId, status: 'approved' },
      data: {
        status: 'claimed',
        claimedAt: now,
        accountId: params.accountId,
      },
    })
    if (updated.count !== 1) throw new Error('application_not_approved')

    return 'claimed'
  })
}
