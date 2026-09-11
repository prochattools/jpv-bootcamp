import type Stripe from 'stripe'

import prisma from '@/libs/prisma'
import { normalizeEmail } from '@/lib/normalize-email'
import { buildMemberForgotPasswordUrl } from '@/lib/memberAuthUrls'
import { MIGHTY_STUDENT_LOGIN_URL } from './studentLogin'

import {
	createMightyAdminApi,
	MightyAdminApi,
	MightyApiError,
	isDuplicatePlanAssignmentError,
	type MightyMember,
} from './adminApi'
import { getMightyConfig, type MightyConfig } from './config'
import { deriveMightyDesiredAccess, type MightyDesiredAccess } from './entitlement'
import {
	assertIdentityMutationSafe,
	assertMightyMemberCreationAllowed,
	assertMightyMutationAllowed,
	assertMightyMutationRuntimeReady,
	assertMightyRecoveryAllowed,
	classifyMightyIdentity,
	getMightyMutationScope,
	MightySafetyError,
	type MightyMutationScope,
} from './mutationPolicy'

export type MightySyncStatus = 'pending' | 'processing' | 'succeeded' | 'failed'

type AccessSyncRow = {
	id: string
	email: string
	normalizedEmail: string
	stripeCustomerId: string | null
	stripeSubscriptionId: string | null
	lastStripeEventId: string | null
	lastStripeEventCreatedAt: Date | null
	lastStripeEventType: string | null
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
	stripeEventCreatedAt?: Date | null
	stripeEventType?: string | null
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
	lastStripeEventCreatedAt: true,
	lastStripeEventType: true,
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

export type MightyStripeAccessProjection = {
	email: string | null
	stripeCustomerId: string | null
	stripeSubscriptionId: string | null
	plan: string | null
	desiredAccess: MightyDesiredAccess | null
	stripeEventId: string
	stripeEventCreatedAt: Date
	stripeEventType: string
}

const EVENT_PRECEDENCE: Record<string, number> = {
	'checkout.session.completed': 10,
	'checkout.session.async_payment_succeeded': 10,
	'customer.subscription.created': 20,
	'invoice.paid': 30,
	'customer.subscription.updated': 40,
	'invoice.payment_failed': 80,
	'customer.subscription.deleted': 90,
}

function eventPrecedence(eventType: string | null | undefined): number {
	return EVENT_PRECEDENCE[eventType ?? ''] ?? 0
}

export function projectMightyAccessFromStripeEvent(event: Stripe.Event): MightyStripeAccessProjection | null {
	const object = event.data.object as unknown as Record<string, unknown>
	let email: string | null = null
	let stripeCustomerId: string | null = null
	let stripeSubscriptionId: string | null = null
	let desiredAccess: MightyDesiredAccess | null = null
	let plan: string | null = null

	switch (event.type) {
		case 'checkout.session.completed':
		case 'checkout.session.async_payment_succeeded': {
			if (object.mode !== 'subscription' || deriveMightyDesiredAccess({
				eventType: event.type,
				checkoutPaymentStatus: typeof object.payment_status === 'string' ? object.payment_status : null,
			}) !== 'ALLOWED') {
				return null
			}
			email = typeof object.customer_email === 'string' ? object.customer_email : null
			stripeCustomerId = relationshipId(object.customer)
			stripeSubscriptionId = relationshipId(object.subscription)
			plan = typeof (object.metadata as Record<string, unknown> | undefined)?.membership === 'string'
				? (object.metadata as Record<string, string>).membership
				: null
			desiredAccess = deriveMightyDesiredAccess({
				eventType: event.type,
				checkoutPaymentStatus: typeof object.payment_status === 'string' ? object.payment_status : null,
			})
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
			desiredAccess = deriveMightyDesiredAccess({
				eventType: event.type,
				subscriptionStatus: typeof object.status === 'string' ? object.status : null,
			})
			break
		}
		case 'invoice.paid': {
			email = typeof object.customer_email === 'string' ? object.customer_email : null
			stripeCustomerId = relationshipId(object.customer)
			stripeSubscriptionId = relationshipId(object.subscription)
			desiredAccess = deriveMightyDesiredAccess({ eventType: event.type })
			break
		}
		case 'invoice.payment_failed': {
			email = typeof object.customer_email === 'string' ? object.customer_email : null
			stripeCustomerId = relationshipId(object.customer)
			stripeSubscriptionId = relationshipId(object.subscription)
			desiredAccess = deriveMightyDesiredAccess({ eventType: event.type })
			break
		}
		default:
			return null
	}

	return {
		email,
		stripeCustomerId,
		stripeSubscriptionId,
		plan,
		desiredAccess,
		stripeEventId: event.id,
		stripeEventCreatedAt: new Date(event.created * 1000),
		stripeEventType: event.type,
	}
}

export type MightyStoredEventState = {
	lastStripeEventId: string | null
	lastStripeEventCreatedAt: Date | null
	lastStripeEventType: string | null
	stripeSubscriptionId: string | null
}

export function shouldApplyMightyStripeEvent(
	existing: MightyStoredEventState | null,
	incoming: {
		stripeEventId: string
		stripeEventCreatedAt: Date | null
		stripeEventType: string | null
		desiredAccess: MightyDesiredAccess
		stripeSubscriptionId: string | null
	},
): { apply: boolean; reason?: string } {
	if (!existing) return { apply: true }
	if (existing.lastStripeEventId === incoming.stripeEventId) return { apply: false, reason: 'duplicate_stripe_event' }

	const currentTime = existing.lastStripeEventCreatedAt?.getTime()
	const incomingTime = incoming.stripeEventCreatedAt?.getTime()
	if (currentTime !== undefined && incomingTime !== undefined) {
		if (incomingTime < currentTime) return { apply: false, reason: 'stale_stripe_event' }
		if (incomingTime === currentTime) {
			const precedenceDelta = eventPrecedence(incoming.stripeEventType) - eventPrecedence(existing.lastStripeEventType)
			if (precedenceDelta < 0) return { apply: false, reason: 'stale_stripe_event' }
			if (precedenceDelta === 0 && incoming.stripeEventId < (existing.lastStripeEventId ?? '')) {
				return { apply: false, reason: 'stale_stripe_event' }
			}
		}
	}

	const sameSubscription = Boolean(
		incoming.stripeSubscriptionId &&
		existing.stripeSubscriptionId &&
		incoming.stripeSubscriptionId === existing.stripeSubscriptionId,
	)
	if (sameSubscription && incoming.desiredAccess === 'ALLOWED') {
		if (existing.lastStripeEventType === 'customer.subscription.deleted') {
			return { apply: false, reason: 'ended_subscription_cannot_restore' }
		}
		if (
			existing.lastStripeEventType === 'invoice.payment_failed' &&
			incoming.stripeEventType !== 'invoice.paid' &&
			!(incoming.stripeEventType ?? '').startsWith('checkout.session.')
		) {
			return { apply: false, reason: 'payment_confirmation_required' }
		}
	}

	return { apply: true }
}

function errorCode(error: unknown): string {
	if (error instanceof MightyApiError) return error.message
	if (error instanceof MightySafetyError) return error.code
	if (error instanceof Error) {
		const normalized = error.message.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
		return normalized.startsWith('mighty_') ? normalized : error.name.toLowerCase()
	}
	return 'unknown_error'
}

function isPrismaUniqueError(error: unknown): boolean {
	return Boolean(
		error &&
		typeof error === 'object' &&
		'code' in error &&
		(error as { code?: unknown }).code === 'P2002',
	)
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
	const eventDecision = shouldApplyMightyStripeEvent(existing, {
		stripeEventId: params.stripeEventId,
		stripeEventCreatedAt: params.stripeEventCreatedAt ?? null,
		stripeEventType: params.stripeEventType ?? null,
		desiredAccess: params.desiredAccess,
		stripeSubscriptionId: params.stripeSubscriptionId?.trim() || null,
	})
	if (!eventDecision.apply) {
		return { queued: false, reason: eventDecision.reason, rowId: existing?.id }
	}
	const welcomeRequired = existing
		? existing.welcomeRequired
		: params.welcomeRequired === true

	const data = {
		email,
		normalizedEmail: email,
		stripeCustomerId: params.stripeCustomerId?.trim() || undefined,
		stripeSubscriptionId: params.stripeSubscriptionId?.trim() || undefined,
		lastStripeEventId: params.stripeEventId,
		lastStripeEventCreatedAt: params.stripeEventCreatedAt ?? undefined,
		lastStripeEventType: params.stripeEventType ?? undefined,
		plan: params.plan ?? undefined,
		desiredAccess: params.desiredAccess,
		syncStatus: 'pending',
		lastError: null as string | null,
		nextAttemptAt: null as Date | null,
		leaseUntil: null as Date | null,
		welcomeRequired,
	} as const

	if (!existing) {
		try {
			const row = await prisma.mightyAccessSync.create({
				data: {
					...data,
					lastStripeEventCreatedAt: params.stripeEventCreatedAt ?? null,
					lastStripeEventType: params.stripeEventType ?? null,
					stripeCustomerId: params.stripeCustomerId?.trim() ?? null,
					stripeSubscriptionId: params.stripeSubscriptionId?.trim() ?? null,
				},
				select: { id: true },
			})
			return { queued: true, rowId: row.id }
		} catch (error) {
			if (!isPrismaUniqueError(error)) throw error
			return queueMightyAccessSync(params)
		}
	}

	const updateResult = await prisma.mightyAccessSync.updateMany({
		where: {
			id: existing.id,
			lastStripeEventId: existing.lastStripeEventId,
			lastStripeEventCreatedAt: existing.lastStripeEventCreatedAt,
		},
		data,
	})
	if (updateResult.count !== 1) {
		return { queued: false, reason: 'stale_stripe_event', rowId: existing.id }
	}

	return { queued: true, rowId: existing.id }
}

export async function queueMightyAccessFromStripeEvent(event: Stripe.Event): Promise<{
	queued: boolean
	reason?: string
}> {
	const projection = projectMightyAccessFromStripeEvent(event)
	if (!projection) return { queued: false, reason: 'event_not_mighty_access_event' }
	if (!projection.desiredAccess) return { queued: false, reason: 'subscription_not_access_active' }
	const result = await queueMightyAccessSync({
		email: projection.email,
		stripeCustomerId: projection.stripeCustomerId,
		stripeSubscriptionId: projection.stripeSubscriptionId,
		stripeEventId: projection.stripeEventId,
		stripeEventCreatedAt: projection.stripeEventCreatedAt,
		stripeEventType: projection.stripeEventType,
		plan: projection.plan,
		desiredAccess: projection.desiredAccess,
		welcomeRequired: projection.desiredAccess === 'ALLOWED',
	})
	return { queued: result.queued, reason: result.reason }
}

type ReconcileInput = {
	row: AccessSyncRow
	config?: MightyConfig
	api?: MightyAdminApi
	sendWelcome?: (row: AccessSyncRow) => Promise<void>
	mutationScope?: MightyMutationScope
}

export async function reconcileAccess(params: ReconcileInput): Promise<{
	mightyMemberId: string | null
	mightyPurchaseId: string | null
	welcomeSent: boolean
}> {
	const config = params.config ?? getMightyConfig()
	const api = params.api ?? createMightyAdminApi(config)
	const mutationScope = params.mutationScope ?? getMightyMutationScope()
	let memberId = params.row.mightyMemberId
	let purchaseId = params.row.mightyPurchaseId

	if (params.row.desiredAccess === 'ALLOWED') {
		let member: MightyMember | null = null
		if (memberId) {
			member = typeof api.findMember === 'function'
				? await api.findMember(params.row.email)
				: { id: memberId, email: params.row.email }
			if (member && String(member.id) !== String(memberId)) throw new Error('mighty_member_identity_conflict')
		} else {
			member = await api.findMember(params.row.email)
			if (!member) {
				assertMightyMutationRuntimeReady(mutationScope)
				assertMightyMemberCreationAllowed(mutationScope, params.row.email)
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

		const currentState = await api.getAccessState(memberId, config.accessPlanId)
		purchaseId = purchaseId ?? (String(currentState.purchases[0]?.purchase?.id ?? '') || null)
		if (!currentState.hasAccess) {
			assertMightyMutationRuntimeReady(mutationScope)
			const spaces = typeof api.listMemberSpaces === 'function' ? await api.listMemberSpaces(memberId) : []
			const identityClass = classifyMightyIdentity({
				email: params.row.email,
				member,
				spaces,
				plans: currentState.plans,
				scope: mutationScope,
			})
			assertMightyMutationAllowed(mutationScope, params.row.email, 'grant_plan')
			if (mutationScope.enforce) {
				assertIdentityMutationSafe({ identityClass, desiredAccess: 'ALLOWED', mutationRequired: true })
			}
			try {
				await api.restoreAccess(memberId, config.accessPlanId)
			} catch (error) {
				if (error instanceof MightyApiError && error.status === 404) {
					assertMightyRecoveryAllowed(mutationScope, params.row.email)
					const recoveredMember = await api.createMember({ email: params.row.email })
					if (String(recoveredMember.id) !== memberId) throw new Error('mighty_member_identity_changed')
					await api.restoreAccess(memberId, config.accessPlanId)
				} else if (isDuplicatePlanAssignmentError(error)) {
					const duplicateVerification = await api.getAccessState(memberId, config.accessPlanId)
					if (!duplicateVerification.hasAccess || !duplicateVerification.memberPlanAccess) {
						throw new Error('mighty_duplicate_grant_not_verified')
					}
				} else {
					throw error
				}
			}
			const grantedState = await api.getAccessState(memberId, config.accessPlanId)
			if (!grantedState.hasAccess) throw new Error('mighty_access_not_found_after_grant')
			purchaseId = purchaseId ?? (String(grantedState.purchases[0]?.purchase?.id ?? '') || null)
		}

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

	const currentState = await api.getAccessState(memberId as string, config.accessPlanId)
	if (!currentState.hasAccess) return { mightyMemberId: memberId, mightyPurchaseId: null, welcomeSent: false }
	const member = typeof api.findMember === 'function'
		? await api.findMember(params.row.email)
		: { id: memberId, email: params.row.email }
	if (member && String(member.id) !== String(memberId)) throw new Error('mighty_member_identity_conflict')
	const spaces = typeof api.listMemberSpaces === 'function' ? await api.listMemberSpaces(memberId as string) : []
	const identityClass = classifyMightyIdentity({
		email: params.row.email,
		member,
		spaces,
		plans: currentState.plans,
		scope: mutationScope,
	})
	assertMightyMutationRuntimeReady(mutationScope)
	assertMightyMutationAllowed(mutationScope, params.row.email, 'revoke_plan')
	if (mutationScope.enforce) {
		assertIdentityMutationSafe({ identityClass, desiredAccess: 'DENIED', mutationRequired: true })
	}
	const purchaseIds = purchaseId
		? [purchaseId]
		: currentState.purchases
			.map((purchase) => String(purchase.purchase?.id ?? ''))
			.filter(Boolean)
	for (const matchingPurchaseId of purchaseIds) {
		await api.revokeAccess(matchingPurchaseId, { immediate: true })
	}
	if (currentState.memberPlanAccess) {
		await api.revokePlanAccess(memberId as string, config.accessPlanId)
	}
	const verifiedState = await api.getAccessState(memberId as string, config.accessPlanId)
	if (verifiedState.hasAccess || verifiedState.memberPlanAccess || verifiedState.purchases.length > 0) {
		throw new Error('mighty_access_present_after_revoke')
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

export function mightyRetryDelayMs(attempt: number): number {
	return Math.min(60 * 60 * 1000, 60 * 1000 * 2 ** Math.min(Math.max(attempt, 0), 6))
}

function nextAttempt(attempt: number): Date {
	const delayMs = mightyRetryDelayMs(attempt)
	return new Date(Date.now() + delayMs)
}

async function claimRows(limit: number, allowedEmails: ReadonlySet<string>): Promise<AccessSyncRow[]> {
	const now = new Date()
	const candidates = await prisma.mightyAccessSync.findMany({
		where: {
			normalizedEmail: { in: [...allowedEmails] },
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
			where: {
				id: candidate.id,
				syncStatus: candidate.syncStatus,
				leaseUntil: candidate.leaseUntil,
			},
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
	superseded: number
}> {
	const config = getMightyConfig()
	const mutationScope = getMightyMutationScope()
	assertMightyMutationRuntimeReady(mutationScope)
	const api = createMightyAdminApi(config)
	const rows = await claimRows(limit, mutationScope.allowedEmails)
	let succeeded = 0
	let failed = 0
	let allowed = 0
	let denied = 0
	let superseded = 0

	for (const row of rows) {
		try {
			const result = await reconcileAccess({ row, config, api, mutationScope })
			const finalized = await prisma.mightyAccessSync.updateMany({
				where: {
					id: row.id,
					syncStatus: 'processing',
					lastStripeEventId: row.lastStripeEventId,
				},
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
			if (finalized.count !== 1) {
				superseded += 1
				console.warn('mighty_access_sync_superseded', {
					rowId: row.id,
					desiredAccess: row.desiredAccess,
					lastStripeEventId: row.lastStripeEventId,
				})
				continue
			}
			succeeded += 1
			if (row.desiredAccess === 'ALLOWED') allowed += 1
			else denied += 1
			console.info('mighty_access_sync_reconciled', {
				rowId: row.id,
				desiredAccess: row.desiredAccess,
				mightyMemberId: result.mightyMemberId,
				outcome: 'succeeded',
				attemptCount: row.attemptCount,
			})
		} catch (error) {
			const attemptCount = row.attemptCount + 1
			const failedUpdate = await prisma.mightyAccessSync.updateMany({
				where: {
					id: row.id,
					syncStatus: 'processing',
					lastStripeEventId: row.lastStripeEventId,
				},
				data: {
					syncStatus: 'failed',
					attemptCount,
					lastError: errorCode(error),
					nextAttemptAt: nextAttempt(attemptCount),
					lastReconciledAt: new Date(),
					leaseUntil: null,
				},
			})
			if (failedUpdate.count !== 1) {
				superseded += 1
				console.warn('mighty_access_sync_failure_superseded', {
					rowId: row.id,
					desiredAccess: row.desiredAccess,
					lastStripeEventId: row.lastStripeEventId,
				})
				continue
			}
			failed += 1
			console.warn('mighty_access_sync_retry_scheduled', {
				rowId: row.id,
				desiredAccess: row.desiredAccess,
				attemptCount,
				error: errorCode(error),
			})
		}
	}

	return { processed: rows.length, succeeded, failed, allowed, denied, superseded }
}
