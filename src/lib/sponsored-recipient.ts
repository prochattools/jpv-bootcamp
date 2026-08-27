import 'server-only'

import type Stripe from 'stripe'
import { getPayload } from 'payload'

import config from '@payload-config'
import prisma from '@/libs/prisma'
import { getStripeConfig } from '@/lib/config'
import { getPublicBaseUrl } from '@/lib/public-base-url'
import { getStripe } from '@/lib/stripe'
import { normalizeEmail } from '@/lib/normalize-email'
import { provisionMemberFromCheckout } from '@/lib/members/provisionMemberFromCheckout'
import { isSponsoredRecipientSession } from '@/lib/sponsored-seats'
import { sendSponsoredRecipientCheckoutEmail } from '@/lib/sponsored-email'
import type { PayloadDocument, PayloadCourseWriteAPI } from '@/lib/payloadCourse/accessService'

const SPONSORED_TRIAL_DAYS = 30

type MemberRecord = PayloadDocument & {
	email?: unknown
	accountStatus?: unknown
}

export type SponsoredRecipientCheckout = {
	checkoutSessionId: string
	checkoutUrl: string
}

function stringMetadata(
	metadata: Stripe.Metadata | null | undefined,
	key: string,
): string | null {
	const value = metadata?.[key]
	return typeof value === 'string' && value.trim() ? value.trim() : null
}

function accountIdForMember(member: MemberRecord): number | null {
	const value = Number(member.id)
	return Number.isSafeInteger(value) && value > 0 ? value : null
}

async function findMemberById(
	payload: PayloadCourseWriteAPI,
	memberId: string,
): Promise<MemberRecord | null> {
	try {
		return (await payload.findByID({
			collection: 'payload_members',
			id: memberId,
			depth: 0,
			overrideAccess: true,
		})) as MemberRecord | null
	} catch {
		return null
	}
}

async function findMemberByEmail(
	payload: PayloadCourseWriteAPI,
	email: string,
): Promise<MemberRecord | null> {
	const result = await payload.find({
		collection: 'payload_members',
		where: { email: { equals: email } },
		limit: 2,
		depth: 0,
		overrideAccess: true,
	})
	return (result.docs[0] as MemberRecord | undefined) ?? null
}

function buildRecipientUrls(): { successUrl: string; cancelUrl: string } {
	const baseUrl = (process.env.DEPLOYMENT_ENV?.trim().toLowerCase() === 'production'
		? 'https://jpvbootcamp.com'
		: getPublicBaseUrl()
	).replace(/\/$/, '')
	return {
		successUrl: `${baseUrl}/thank-you?session_id={CHECKOUT_SESSION_ID}`,
		cancelUrl: `${baseUrl}/sponsored?checkout=cancelled`,
	}
}

export async function createSponsoredRecipientCheckout(params: {
	applicationId: string
	seatId: string
	email: string
	name: string
	memberId?: string | null
	stripeCustomerId?: string | null
}): Promise<SponsoredRecipientCheckout> {
	const email = normalizeEmail(params.email)
	if (!email) throw new Error('invalid_recipient_email')

	const stripeConfig = getStripeConfig()
	const urls = buildRecipientUrls()
	const metadata = {
		purpose: 'sponsored_recipient',
		membership: 'jpv_bootcamp_membership',
		billingCadence: 'monthly',
		source: 'sponsored_membership',
		sponsoredApplicationId: params.applicationId,
		sponsoredSeatId: params.seatId,
		sponsoredMemberId: params.memberId ?? '',
		sponsoredTrialDays: String(SPONSORED_TRIAL_DAYS),
	}

	const session = await getStripe().checkout.sessions.create({
		mode: 'subscription',
		line_items: [{ price: stripeConfig.stripe.pricePro, quantity: 1 }],
		success_url: urls.successUrl,
		cancel_url: urls.cancelUrl,
		payment_method_collection: 'always',
		phone_number_collection: { enabled: true },
		...(params.stripeCustomerId
			? { customer: params.stripeCustomerId }
			: { customer_email: email }),
		client_reference_id: params.applicationId,
		metadata,
		subscription_data: {
			trial_period_days: SPONSORED_TRIAL_DAYS,
			metadata,
		},
	})

	if (!session.url) throw new Error('sponsored_recipient_checkout_url_missing')

	return {
		checkoutSessionId: session.id,
		checkoutUrl: session.url,
	}
}

export async function sendSponsoredRecipientCheckout(params: {
	to: string
	name: string
	checkoutUrl: string
}): Promise<void> {
	await sendSponsoredRecipientCheckoutEmail(params)
}

export async function releaseSponsoredRecipientCheckout(
	session: Stripe.Checkout.Session,
): Promise<void> {
	if (!isSponsoredRecipientSession(session)) return
	const applicationId = stringMetadata(session.metadata, 'sponsoredApplicationId')
	const seatId = stringMetadata(session.metadata, 'sponsoredSeatId')
	if (!applicationId || !seatId) return

	await prisma.$transaction(async (tx) => {
		await tx.sponsoredSeat.updateMany({
			where: {
				id: seatId,
				reservedByApplicationId: applicationId,
				claimedByAccountId: null,
			},
			data: { reservedByApplicationId: null, reservedAt: null },
		})
		await tx.sponsoredApplication.updateMany({
			where: { id: applicationId, status: 'processing' },
			data: {
				status: 'pending',
				decision: null,
				seatId: null,
				decidedAt: null,
			},
		})
	})
}

/**
 * Finalizes the sponsored seat after the recipient completes the normal
 * Stripe subscription checkout. This is idempotent and deliberately runs
 * after normal membership provisioning has succeeded.
 */
export async function finalizeSponsoredRecipientCheckout(
	session: Stripe.Checkout.Session,
): Promise<{ finalized: boolean; accountId: number | null }> {
	if (!isSponsoredRecipientSession(session)) return { finalized: false, accountId: null }
	if (session.mode !== 'subscription') throw new Error('sponsored_recipient_not_subscription')
	if (session.payment_status && !['paid', 'no_payment_required'].includes(session.payment_status)) {
		throw new Error('sponsored_recipient_payment_incomplete')
	}

	const applicationId = stringMetadata(session.metadata, 'sponsoredApplicationId')
	const seatId = stringMetadata(session.metadata, 'sponsoredSeatId')
	const selectedMemberId = stringMetadata(session.metadata, 'sponsoredMemberId')
	if (!applicationId || !seatId) throw new Error('sponsored_recipient_metadata_missing')

	const application = await prisma.sponsoredApplication.findUnique({
		where: { id: applicationId },
	})
	if (!application) throw new Error('sponsored_application_not_found')

	const sessionEmail = normalizeEmail(
		session.customer_email ?? session.customer_details?.email ?? application.email,
	)
	if (!sessionEmail) throw new Error('sponsored_recipient_email_missing')

	const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null
	const subscriptionId = typeof session.subscription === 'string'
		? session.subscription
		: session.subscription?.id ?? null
	if (!customerId || !subscriptionId) throw new Error('sponsored_recipient_stripe_ids_missing')

	const payload = await getPayload({ config })
	if (application.status === 'claimed') {
		// A webhook can be retried after the database claim but before the
		// Payload projection is written. Repair that projection on retry rather
		// than treating the partially completed delivery as fully complete.
		if (application.accountId && application.seatId) {
			const claimedMember = selectedMemberId
				? await findMemberById(payload, selectedMemberId)
				: await findMemberByEmail(payload, sessionEmail)
			if (!claimedMember) throw new Error('sponsored_recipient_claimed_member_not_found')

			await syncSponsoredFundingRecord({
				payload,
				application,
				member: claimedMember,
				seatId: application.seatId,
				recipientEmail: sessionEmail,
				stripeCustomerId: customerId,
				stripeSubscriptionId: subscriptionId,
			})
		}
		return { finalized: false, accountId: application.accountId }
	}
	if (application.status !== 'processing' || application.seatId !== seatId) {
		throw new Error('sponsored_recipient_not_reserved')
	}
	let member: MemberRecord | null = selectedMemberId
		? await findMemberById(payload, selectedMemberId)
		: await findMemberByEmail(payload, sessionEmail)

	if (selectedMemberId && !member) throw new Error('sponsored_recipient_member_not_found')
	if (member) {
		const memberEmail = normalizeEmail(typeof member.email === 'string' ? member.email : null)
		if (!memberEmail || memberEmail !== sessionEmail) {
			throw new Error('sponsored_recipient_member_email_mismatch')
		}
		if (['deleted', 'blocked', 'suspended'].includes(String(member.accountStatus))) {
			throw new Error('sponsored_recipient_member_ineligible')
		}
	} else {
		const provisioned = await provisionMemberFromCheckout({
			email: sessionEmail,
			displayName: session.customer_details?.name ?? application.name,
			stripeCustomerId: typeof session.customer === 'string' ? session.customer : session.customer?.id,
			source: 'stripe_checkout',
		})
		if (!provisioned.memberId) throw new Error('sponsored_recipient_provision_failed')
		member = await findMemberById(payload, provisioned.memberId)
		if (!member) throw new Error('sponsored_recipient_member_not_found_after_provision')
	}

	if (member.accountStatus === 'pending') {
		member = await payload.update({
			collection: 'payload_members',
			id: member.id,
			data: { accountStatus: 'active' },
			overrideAccess: true,
		}) as unknown as MemberRecord
	}

	const accountId = accountIdForMember(member)
	if (!accountId) throw new Error('sponsored_recipient_member_id_invalid')

	const now = new Date()
	await prisma.$transaction(async (tx) => {
		const claimed = await tx.sponsoredSeat.updateMany({
			where: {
				id: seatId,
				reservedByApplicationId: applicationId,
				claimedByAccountId: null,
			},
			data: {
				claimedByAccountId: accountId,
				claimedAt: now,
				reservedByApplicationId: null,
				reservedAt: null,
			},
		})
		if (claimed.count !== 1) throw new Error('sponsored_recipient_seat_claim_conflict')

		await tx.sponsoredGrant.create({
			data: {
				accountId,
				tier: 'free',
				seatId,
				startsAt: now,
				endsAt: new Date(now.getTime() + SPONSORED_TRIAL_DAYS * 24 * 60 * 60 * 1000),
			},
		})
		await tx.sponsoredApplication.update({
			where: { id: applicationId },
			data: {
				status: 'claimed',
				accountId,
				claimedAt: now,
				decidedAt: now,
			},
		})
	})

	await syncSponsoredFundingRecord({
		payload,
		application,
		member,
		seatId,
		recipientEmail: sessionEmail,
		stripeCustomerId: customerId,
		stripeSubscriptionId: subscriptionId,
	})

	return { finalized: true, accountId }
}

async function syncSponsoredFundingRecord(params: {
	payload: PayloadCourseWriteAPI
	application: { id: string; name: string; email: string | null; seatId: string | null }
	member: MemberRecord
	seatId: string
	recipientEmail: string
	stripeCustomerId: string
	stripeSubscriptionId: string
}): Promise<void> {
	const seat = await prisma.sponsoredSeat.findUnique({ where: { id: params.seatId } })
	if (!seat) throw new Error('sponsored_recipient_seat_not_found')

	const bySession = await params.payload.find({
		collection: 'payload_pay_it_forward_funding',
		where: { stripeCheckoutSessionId: { equals: seat.stripeCheckoutSessionId } },
		limit: 1,
		depth: 0,
		overrideAccess: true,
	})
	const byTransaction = bySession.docs[0]
		? null
		: await params.payload.find({
				collection: 'payload_pay_it_forward_funding',
				where: { stripePaymentIntentId: { equals: seat.stripePaymentIntentId } },
				limit: 1,
				depth: 0,
				overrideAccess: true,
			})
	const record = (bySession.docs[0] ?? byTransaction?.docs[0]) as PayloadDocument | undefined
	const data = {
		seatStatus: 'redeemed' as const,
		approvalState: 'issued' as const,
		member: params.member.id,
		memberEmail: params.recipientEmail,
		redeemedByName: params.application.name,
		redeemedByEmail: params.recipientEmail,
		stripeCustomerId: params.stripeCustomerId,
		stripeSubscriptionId: params.stripeSubscriptionId,
		issuedAt: new Date().toISOString(),
		redeemedAt: new Date().toISOString(),
		approvalReference: `sponsored-application:${params.application.id}`,
	}

	if (record) {
		await params.payload.update({
			collection: 'payload_pay_it_forward_funding',
			id: record.id,
			data,
			overrideAccess: true,
		})
		return
	}

	await params.payload.create({
		collection: 'payload_pay_it_forward_funding',
		data: {
			displayName: `Pay it forward — ${params.application.email ?? params.recipientEmail} — ${seat.createdAt.toISOString().slice(0, 10)}`,
			stripeCheckoutSessionId: seat.stripeCheckoutSessionId,
			stripePaymentIntentId: seat.stripePaymentIntentId,
			amountPaidMinor: 8000,
			purchasedAt: seat.createdAt.toISOString(),
			...data,
		},
		overrideAccess: true,
	})
}
