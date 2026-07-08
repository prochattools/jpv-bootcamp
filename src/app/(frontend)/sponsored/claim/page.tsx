import prisma from '@/libs/prisma'
import { verifySponsoredClaimToken } from '@/lib/sponsored-claim-token'

export const dynamic = 'force-dynamic'

type PageProps = {
	searchParams?: Promise<{ token?: string }>
}

type ClaimOutcome =
	| 'claimed'
	| 'already_claimed'
	| 'invalid'
	| 'expired'
	| 'activation_failed'

function messageForOutcome(outcome: ClaimOutcome) {
	switch (outcome) {
		case 'claimed':
			return "You're in. Your sponsored Free access is active."
		case 'already_claimed':
			return 'Your sponsored Free access is already active.'
		case 'expired':
			return 'This claim link has expired.'
		case 'activation_failed':
			return 'We could not activate your access yet. Please contact support.'
		case 'invalid':
		default:
			return 'This claim link is invalid.'
	}
}

export default async function SponsoredClaimPage({ searchParams }: PageProps) {
	const params = await searchParams
	const token = (params?.token ?? '').trim()
	const secret = (process.env.SPONSORED_CLAIM_SECRET || '').trim()
	if (!secret) {
		throw new Error('Missing required env var: SPONSORED_CLAIM_SECRET')
	}

	const verification = verifySponsoredClaimToken(token, secret)
	if (!verification.ok) {
		const reason = 'reason' in verification ? verification.reason : 'invalid'
		console.warn('sponsored_claim_token_failed', {
			reason,
			iat: 'iat' in verification ? verification.iat ?? null : null,
			exp: 'exp' in verification ? verification.exp ?? null : null,
		})
		const outcome: ClaimOutcome = reason === 'expired' ? 'expired' : 'invalid'
		return (
			<main className="bg-jpv-gradient min-h-screen text-jpv-gray-50">
				<section className="px-6 py-24 sm:py-28">
					<div className="mx-auto max-w-3xl">
						<div className="rounded-3xl border border-jpv-gray-700/50 bg-jpv-bg-dark/60 p-8 shadow-jpv-card backdrop-blur">
							<h1 className="text-3xl font-semibold text-white sm:text-4xl">
								Sponsored claim
							</h1>
							<p className="mt-4 text-base text-jpv-gray-300">
								{messageForOutcome(outcome)}
							</p>
						</div>
					</div>
				</section>
			</main>
		)
	}

	const { applicationId, email } = verification.payload
	const application = await prisma.sponsoredApplication.findUnique({
		where: { id: applicationId },
	})

	if (!application) {
		return (
			<main className="bg-jpv-gradient min-h-screen text-jpv-gray-50">
				<section className="px-6 py-24 sm:py-28">
					<div className="mx-auto max-w-3xl">
						<div className="rounded-3xl border border-jpv-gray-700/50 bg-jpv-bg-dark/60 p-8 shadow-jpv-card backdrop-blur">
							<h1 className="text-3xl font-semibold text-white sm:text-4xl">
								Sponsored claim
							</h1>
							<p className="mt-4 text-base text-jpv-gray-300">
								{messageForOutcome('invalid')}
							</p>
						</div>
					</div>
				</section>
			</main>
		)
	}

	if (application.status === 'claimed') {
		return (
			<main className="bg-jpv-gradient min-h-screen text-jpv-gray-50">
				<section className="px-6 py-24 sm:py-28">
					<div className="mx-auto max-w-3xl">
						<div className="rounded-3xl border border-jpv-gray-700/50 bg-jpv-bg-dark/60 p-8 shadow-jpv-card backdrop-blur">
							<h1 className="text-3xl font-semibold text-white sm:text-4xl">
								Sponsored claim
							</h1>
							<p className="mt-4 text-base text-jpv-gray-300">
								{messageForOutcome('already_claimed')}
							</p>
						</div>
					</div>
				</section>
			</main>
		)
	}

	if (application.status !== 'approved') {
		return (
			<main className="bg-jpv-gradient min-h-screen text-jpv-gray-50">
				<section className="px-6 py-24 sm:py-28">
					<div className="mx-auto max-w-3xl">
						<div className="rounded-3xl border border-jpv-gray-700/50 bg-jpv-bg-dark/60 p-8 shadow-jpv-card backdrop-blur">
							<h1 className="text-3xl font-semibold text-white sm:text-4xl">
								Sponsored claim
							</h1>
							<p className="mt-4 text-base text-jpv-gray-300">
								{messageForOutcome('invalid')}
							</p>
						</div>
					</div>
				</section>
			</main>
		)
	}

	if (application.email?.trim().toLowerCase() !== email) {
		return (
			<main className="bg-jpv-gradient min-h-screen text-jpv-gray-50">
				<section className="px-6 py-24 sm:py-28">
					<div className="mx-auto max-w-3xl">
						<div className="rounded-3xl border border-jpv-gray-700/50 bg-jpv-bg-dark/60 p-8 shadow-jpv-card backdrop-blur">
							<h1 className="text-3xl font-semibold text-white sm:text-4xl">
								Sponsored claim
							</h1>
							<p className="mt-4 text-base text-jpv-gray-300">
								{messageForOutcome('invalid')}
							</p>
						</div>
					</div>
				</section>
			</main>
		)
	}

	const accountId = application.accountId ?? null
	if (!accountId || !application.seatId) {
		return (
			<main className="bg-jpv-gradient min-h-screen text-jpv-gray-50">
				<section className="px-6 py-24 sm:py-28">
					<div className="mx-auto max-w-3xl">
						<div className="rounded-3xl border border-jpv-gray-700/50 bg-jpv-bg-dark/60 p-8 shadow-jpv-card backdrop-blur">
							<h1 className="text-3xl font-semibold text-white sm:text-4xl">
								Sponsored claim
							</h1>
							<p className="mt-4 text-base text-jpv-gray-300">
								{messageForOutcome('activation_failed')}
							</p>
						</div>
					</div>
				</section>
			</main>
		)
	}

	const now = new Date()
	const endsAt = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 30)
	try {
		await prisma.$transaction(async (tx) => {
			const seatUpdate = await tx.sponsoredSeat.updateMany({
				where: {
					id: application.seatId!,
					reservedByApplicationId: applicationId,
					claimedByAccountId: null,
				},
				data: {
					claimedByAccountId: accountId!,
					claimedAt: now,
					reservedByApplicationId: null,
					reservedAt: null,
				},
			})

			if (seatUpdate.count === 0) {
				throw new Error('seat_unavailable')
			}

			await tx.sponsoredGrant.create({
				data: {
					accountId: accountId!,
					tier: 'pro',
					seatId: application.seatId!,
					startsAt: now,
					endsAt,
				},
			})

			await tx.sponsoredApplication.updateMany({
				where: { id: applicationId, status: 'approved' },
				data: {
					status: 'claimed',
					claimedAt: now,
					accountId: accountId!,
				},
			})
		})
	} catch (error) {
		console.error('sponsored_claim_finalize_failed', {
			applicationId,
			message: (error as Error).message,
		})
		return (
			<main className="bg-jpv-gradient min-h-screen text-jpv-gray-50">
				<section className="px-6 py-24 sm:py-28">
					<div className="mx-auto max-w-3xl">
						<div className="rounded-3xl border border-jpv-gray-700/50 bg-jpv-bg-dark/60 p-8 shadow-jpv-card backdrop-blur">
							<h1 className="text-3xl font-semibold text-white sm:text-4xl">
								Sponsored claim
							</h1>
							<p className="mt-4 text-base text-jpv-gray-300">
								{messageForOutcome('invalid')}
							</p>
						</div>
					</div>
				</section>
			</main>
		)
	}

	console.info('sponsored_claim_success', { applicationId })

	return (
		<main className="bg-jpv-gradient min-h-screen text-jpv-gray-50">
			<section className="px-6 py-24 sm:py-28">
				<div className="mx-auto max-w-3xl">
					<div className="rounded-3xl border border-jpv-gray-700/50 bg-jpv-bg-dark/60 p-8 shadow-jpv-card backdrop-blur">
						<h1 className="text-3xl font-semibold text-white sm:text-4xl">
							Sponsored claim
						</h1>
						<p className="mt-4 text-base text-jpv-gray-300">
							{messageForOutcome('claimed')}
						</p>
					</div>
				</div>
			</section>
		</main>
	)
}
