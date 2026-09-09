import type Stripe from 'stripe'

import prisma from '@/libs/prisma'
import { normalizeEmail } from '@/lib/normalize-email'
import { buildMemberForgotPasswordUrl } from '@/lib/memberAuthUrls'
import { MIGHTY_STUDENT_LOGIN_URL } from './studentLogin'

import {
	createMightyAdminApi,
	MightyAdminApi,
	MightyApiError,
	type MightyMember,
} from './adminApi'
import { getMightyConfig, type MightyConfig } from './config'

export type MightyDesiredAccess = 'ALLOWED' | 'DENIED'
export type MightySyncStatus = 'pending' | 'processing' | 'succeeded' | 'failed'

type AccessSyncRow = {
	id: string
	email: string
	normalizedEmail: string
	stripeCustomerId: string | null
	stripeSubscriptionId: string | null
	lastStripeEventId: string | null
	plan: string | null
	desiredAccess: string
	mightyMemberId: string | null
	mightyPurchaseId: string | null
	welcomeRequired: boolean
	welcomeSentAt: Date | null
	attemptCount: number
}

type QueueParams = {
	email?: string | null
	stripeCustomerId?: string | null
	stripeSubscriptionId?: string | null
	stripeEventId: string
	plan?: string | null
	desiredAccess: MightyDesiredAccess
	welcomeRequired?: boolean
}

const accessSyncSelect = {
	id: true,
	email: true,
	normalizedEmail: true,
	stripeCustomerId: true,
	stripeSubscriptionId: true,
	lastStripeEventId: true,
	plan: true,
	desiredAccess: true,
	mightyMemberId: true,
	mightyPurchaseId: true,
	welcomeRequired: true,
	welcomeSentAt: true,
	attemptCount: true,
} as const

function stripeRelationFilters(params: QueueParams): Array<Record<string, string>> {
	return [
		...(params.stripeCustomerId?.trim() ? [{ stripeCustomerId: params.stripeCustomerId.trim() }] : []),
		...(params.stripeSubscriptionId?.trim() ? [{ stripeSubscriptionId: params.stripeSubscriptionId.trim() }] : []),
	]
}

async function findExistingSyncRow(
	email: string | null,
	params: QueueParams,
): Promise<AccessSyncRow | null> {
	const relationFilters = stripeRelationFilters(params)
	const [byStripeRelations, byEmail] = await Promise.all([
		relationFilters.length > 0
			? prisma.mightyAccessSync.findMany({ where: { OR: relationFilters }, select: accessSyncSelect })
			: Promise.resolve([]),
		email
			? prisma.mightyAccessSync.findUnique({ where: { normalizedEmail: email }, select: accessSyncSelect })
			: Promise.resolve(null),
	])

	if (byStripeRelations.length > 1) throw new Error('mighty_identity_conflict')
	const byStripeRelation = byStripeRelations[0] ?? null
	if (byStripeRelation && byEmail && byStripeRelation.id !== byEmail.id) {
		throw new Error('mighty_identity_conflict')
	}
	return byStripeRelation ?? byEmail
}

function relationshipId(value: unknown): string | null {
	if (typeof value === 'string' && value.trim()) return value.trim()
	if (value && typeof value === 'object' && 'id' in value) {
		const id = (value as { id?: unknown }).id
		return typeof id === 'string' && id.trim() ? id.trim() : null
	}
	return null
}

function errorCode(error: unknown): string {
	if (error instanceof MightyApiError) return error.message
	if (error instanceof Error) {
		const normalized = error.message.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
		return normalized.startsWith('mighty_') ? normalized : error.name.toLowerCase()
	}
	return 'unknown_error'
}

function isActiveStripeSubscription(subscription: Stripe.Subscription): boolean {
	return subscription.status === 'active' || subscription.status === 'trialing'
}

async function resolveQueueEmail(params: QueueParams): Promise<string | null> {
	const direct = normalizeEmail(params.email)
	if (direct) return direct

	const identifiers = [params.stripeCustomerId, params.stripeSubscriptionId].filter(
		(value): value is string => Boolean(value),
	)
	if (identifiers.length === 0) return null

	const record = await prisma.customerProvisioning.findFirst({
		where: {
			OR: [
				...(params.stripeCustomerId ? [{ stripeCustomerId: params.stripeCustomerId }] : []),
				...(params.stripeSubscriptionId ? [{ stripeSubscriptionId: params.stripeSubscriptionId }] : []),
			],
		},
		select: { email: true },
	})
	return normalizeEmail(record?.email)
}

/**
 * Persist the Stripe-derived desired state. This function deliberately does
 * not call Mighty; the worker owns all provider I/O and retries.
 */
export async function queueMightyAccessSync(params: QueueParams): Promise<{
	queued: boolean
	reason?: string
	rowId?: string
}> {
	const directEmail = normalizeEmail(params.email)
	let existing = await findExistingSyncRow(directEmail, params)
	const email = directEmail ?? normalizeEmail(existing?.email) ?? await resolveQueueEmail(params)
	if (!email) return { queued: false, reason: 'missing_member_email' }

	existing ??= await findExistingSyncRow(email, params)
	const welcomeRequired = existing
		? existing.welcomeRequired
		: params.welcomeRequired === true

	const data = {
		email,
		normalizedEmail: email,
		stripeCustomerId: params.stripeCustomerId?.trim() || undefined,
		stripeSubscriptionId: params.stripeSubscriptionId?.trim() || undefined,
		lastStripeEventId: params.stripeEventId,
		plan: params.plan ?? undefined,
		desiredAccess: params.desiredAccess,
		syncStatus: 'pending',
		lastError: null as string | null,
		nextAttemptAt: null as Date | null,
		leaseUntil: null as Date | null,
		welcomeRequired,
	} as const

	const row = existing
		? await prisma.mightyAccessSync.update({ where: { id: existing.id }, data, select: { id: true } })
		: await prisma.mightyAccessSync.create({
			data: {
				...data,
				stripeCustomerId: params.stripeCustomerId?.trim() ?? null,
				stripeSubscriptionId: params.stripeSubscriptionId?.trim() ?? null,
			},
			select: { id: true },
		})

	return { queued: true, rowId: row.id }
}

export async function queueMightyAccessFromStripeEvent(event: Stripe.Event): Promise<{
	queued: boolean
	reason?: string
}> {
	const object = event.data.object as unknown as Record<string, unknown>
	let email: string | null = null
	let stripeCustomerId: string | null = null
	let stripeSubscriptionId: string | null = null
	let desiredAccess: MightyDesiredAccess | null = null
	let plan: string | null = null

	switch (event.type) {
		case 'checkout.session.completed':
		case 'checkout.session.async_payment_succeeded': {
			if (object.mode !== 'subscription' || !['paid', 'no_payment_required'].includes(String(object.payment_status))) {
				return { queued: false, reason: 'checkout_payment_not_confirmed' }
			}
			email = typeof object.customer_email === 'string' ? object.customer_email : null
			stripeCustomerId = relationshipId(object.customer)
			stripeSubscriptionId = relationshipId(object.subscription)
			plan = typeof (object.metadata as Record<string, unknown> | undefined)?.membership === 'string'
				? (object.metadata as Record<string, string>).membership
				: null
			desiredAccess = 'ALLOWED'
			break
		}
		case 'customer.subscription.created':
		case 'customer.subscription.updated':
		case 'customer.subscription.deleted': {
			stripeCustomerId = relationshipId(object.customer)
			stripeSubscriptionId = typeof object.id === 'string' ? object.id : null
			plan = typeof (object.metadata as Record<string, unknown> | undefined)?.membership === 'string'
				? (object.metadata as Record<string, string>).membership
				: null
			desiredAccess = event.type === 'customer.subscription.deleted'
				? 'DENIED'
				: isActiveStripeSubscription(object as unknown as Stripe.Subscription)
					? 'ALLOWED'
					: null
			break
		}
		case 'invoice.paid': {
			email = typeof object.customer_email === 'string' ? object.customer_email : null
			stripeCustomerId = relationshipId(object.customer)
			stripeSubscriptionId = relationshipId(object.subscription)
			desiredAccess = 'ALLOWED'
			break
		}
		case 'invoice.payment_failed': {
			email = typeof object.customer_email === 'string' ? object.customer_email : null
			stripeCustomerId = relationshipId(object.customer)
			stripeSubscriptionId = relationshipId(object.subscription)
			desiredAccess = 'DENIED'
			break
		}
		default:
			return { queued: false, reason: 'event_not_mighty_access_event' }
	}

	if (!desiredAccess) return { queued: false, reason: 'subscription_not_access_active' }
	const result = await queueMightyAccessSync({
		email,
		stripeCustomerId,
		stripeSubscriptionId,
		stripeEventId: event.id,
		plan,
		desiredAccess,
		welcomeRequired: desiredAccess === 'ALLOWED',
	})
	return { queued: result.queued, reason: result.reason }
}

type ReconcileInput = {
	row: AccessSyncRow
	config?: MightyConfig
	api?: MightyAdminApi
	sendWelcome?: (row: AccessSyncRow) => Promise<void>
}

export async function reconcileAccess(params: ReconcileInput): Promise<{
	mightyMemberId: string | null
	mightyPurchaseId: string | null
	welcomeSent: boolean
}> {
	const config = params.config ?? getMightyConfig()
	const api = params.api ?? createMightyAdminApi(config)
	let memberId = params.row.mightyMemberId
	let purchaseId = params.row.mightyPurchaseId

	if (params.row.desiredAccess === 'ALLOWED') {
		let member: MightyMember | null = null
		if (memberId) {
			member = { id: memberId, email: params.row.email }
		} else {
			member = await api.findMember(params.row.email)
			if (!member) {
				try {
					member = await api.createMember({ email: params.row.email })
				} catch (error) {
					if (!(error instanceof MightyApiError) || error.status !== 422) throw error
					member = await api.findMember(params.row.email)
					if (!member) throw error
				}
			}
			memberId = String(member.id)
		}

		const existingPurchases = purchaseId
			? []
			: await api.findPurchases(memberId, config.accessPlanId)
		purchaseId = purchaseId ?? (String(existingPurchases[0]?.purchase?.id ?? '') || null)
		if (!purchaseId) {
			try {
				await api.restoreAccess(memberId, config.accessPlanId)
			} catch (error) {
				if (!(error instanceof MightyApiError) || error.status !== 422) throw error
			}
			const grantedPurchases = await api.findPurchases(memberId, config.accessPlanId)
			purchaseId = String(grantedPurchases[0]?.purchase?.id ?? '') || null
		}
		if (!purchaseId) throw new Error('mighty_purchase_not_found_after_grant')

		if (params.row.welcomeRequired && !params.row.welcomeSentAt) {
			await (params.sendWelcome ?? sendMightyWelcome)(params.row)
			return { mightyMemberId: memberId, mightyPurchaseId: purchaseId, welcomeSent: true }
		}
		return { mightyMemberId: memberId, mightyPurchaseId: purchaseId, welcomeSent: false }
	}

	if (!memberId && !purchaseId) {
		const member = await api.findMember(params.row.email)
		if (!member) return { mightyMemberId: null, mightyPurchaseId: null, welcomeSent: false }
		memberId = String(member.id)
	}

	const purchaseIds = purchaseId
		? [purchaseId]
		: (await api.findPurchases(memberId as string, config.accessPlanId))
			.map((purchase) => String(purchase.purchase?.id ?? ''))
			.filter(Boolean)
	for (const matchingPurchaseId of purchaseIds) {
		await api.revokeAccess(matchingPurchaseId, { immediate: true })
	}
	return { mightyMemberId: memberId, mightyPurchaseId: null, welcomeSent: false }
}

async function sendMightyWelcome(row: AccessSyncRow): Promise<void> {
	const { sendWelcomeEmail } = await import('@/lib/email')
	const plan = 'jpv_bootcamp_membership' as const
	const portalUrl = process.env.PORTAL_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim() || 'https://jpvbootcamp.com/portal'
	await sendWelcomeEmail({
		to: row.email,
		plan,
		resetUrl: buildMemberForgotPasswordUrl(portalUrl),
		credentials: null,
		meta: {
			templateKey: 'membership_access_ready',
			variant: 'welcome',
			eventId: row.lastStripeEventId,
			eventType: 'mighty_access_granted',
			subscriptionId: row.stripeSubscriptionId,
			customerId: row.stripeCustomerId,
			source: 'webhook',
			loginUrl: MIGHTY_STUDENT_LOGIN_URL,
			dedupeKey: `${row.stripeSubscriptionId ?? row.normalizedEmail}:mighty-welcome`,
			stackHint: 'lib/mighty/accessSync:sendMightyWelcome',
		},
	})
}

function nextAttempt(attempt: number): Date {
	const delayMs = Math.min(60 * 60 * 1000, 60 * 1000 * 2 ** Math.min(attempt, 6))
	return new Date(Date.now() + delayMs)
}

async function claimRows(limit: number): Promise<AccessSyncRow[]> {
	const now = new Date()
	const candidates = await prisma.mightyAccessSync.findMany({
		where: {
			OR: [
				{ syncStatus: 'pending', OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] },
				{ syncStatus: 'failed', OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] },
				{ syncStatus: 'processing', leaseUntil: { lt: now } },
			],
		},
		orderBy: { updatedAt: 'asc' },
		take: Math.min(Math.max(limit, 1), 100),
	})

	const claimed: AccessSyncRow[] = []
	for (const candidate of candidates) {
		const result = await prisma.mightyAccessSync.updateMany({
			where: { id: candidate.id, syncStatus: candidate.syncStatus },
			data: {
				syncStatus: 'processing',
				leaseUntil: new Date(Date.now() + 5 * 60 * 1000),
			},
		})
		if (result.count !== 1) continue
		const row = await prisma.mightyAccessSync.findUnique({ where: { id: candidate.id } })
		if (row) claimed.push(row)
	}
	return claimed
}

export async function processMightyAccessSync(limit = 25): Promise<{
	processed: number
	succeeded: number
	failed: number
	allowed: number
	denied: number
}> {
	const config = getMightyConfig()
	const api = createMightyAdminApi(config)
	const rows = await claimRows(limit)
	let succeeded = 0
	let failed = 0
	let allowed = 0
	let denied = 0

	for (const row of rows) {
		try {
			const result = await reconcileAccess({ row, config, api })
			await prisma.mightyAccessSync.update({
				where: { id: row.id },
				data: {
					syncStatus: 'succeeded',
					mightyMemberId: result.mightyMemberId,
					mightyPurchaseId: result.mightyPurchaseId,
					welcomeSentAt: result.welcomeSent ? new Date() : row.welcomeSentAt,
					lastError: null,
					lastSucceededAt: new Date(),
					lastReconciledAt: new Date(),
					nextAttemptAt: null,
					leaseUntil: null,
				},
			})
			succeeded += 1
			if (row.desiredAccess === 'ALLOWED') allowed += 1
			else denied += 1
		} catch (error) {
			const attemptCount = row.attemptCount + 1
			await prisma.mightyAccessSync.update({
				where: { id: row.id },
				data: {
					syncStatus: 'failed',
					attemptCount,
					lastError: errorCode(error),
					nextAttemptAt: nextAttempt(attemptCount),
					lastReconciledAt: new Date(),
					leaseUntil: null,
				},
			})
			failed += 1
		}
	}

	return { processed: rows.length, succeeded, failed, allowed, denied }
}
