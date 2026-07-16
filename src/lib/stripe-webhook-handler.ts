import 'server-only'

import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { getStripeConfig, getStripeWebhookSecrets } from '@/lib/stripe-config'
import { hasProcessed, markProcessed } from '@/lib/idempotency'
import {
	logProvisioningDecision,
	projectInvoicePaymentState,
	provisionFromCheckoutSession,
	syncFromSubscription,
} from '@/lib/provisioning'
import { isSponsoredSeatSession, upsertSponsoredSeatFromSession } from '@/lib/sponsored-seats'
import { notifySponsoredSeatPurchase } from '@/lib/sponsored-seat-notifications'
import { getStripe } from '@/lib/stripe'
import { shouldSendMembershipEmailForEvent } from '@/lib/stripe-membership-email-gate'
import { shadowSyncStripeEventToPayload } from '@/lib/payloadCourse/stripeShadowSync'
import {
	projectAsyncCheckoutFailure,
	projectSubscriptionSchedule,
} from '@/lib/billing/commitmentProjection'

const PROVISIONING_EVENT_TYPES = new Set([
	'checkout.session.completed',
	'checkout.session.async_payment_succeeded',
	'checkout.session.async_payment_failed',
	'customer.subscription.created',
	'customer.subscription.updated',
	'customer.subscription.deleted',
	'invoice.paid',
	'invoice.payment_failed',
	'invoice.payment_action_required',
	'subscription_schedule.created',
	'subscription_schedule.updated',
	'subscription_schedule.expiring',
	'subscription_schedule.completed',
	'subscription_schedule.released',
	'subscription_schedule.canceled',
	'subscription_schedule.aborted',
])
const DEBUG_STRIPE_WEBHOOKS = process.env.DEBUG_STRIPE_WEBHOOKS === '1'
const SKIP_PREDEV = process.env.SKIP_PREDEV === '1'
let hasLoggedIdempotencyConfig = false

type WebhookDebugInfo = {
	hasSignatureHeader: boolean
	rawBodyLength: number
	method: string
	path: string
	nodeEnv?: string
}

function getRequestPath(req: Request): string {
	try {
		return new URL(req.url).pathname
	} catch {
		return req.url
	}
}

function stripeRelationshipId(value: unknown): string | null {
	if (typeof value === 'string' && value.trim()) return value
	if (value && typeof value === 'object' && 'id' in value) {
		const id = (value as { id?: unknown }).id
		return typeof id === 'string' && id.trim() ? id : null
	}
	return null
}

function stripeChargeContext(value: unknown) {
	const charge = value && typeof value === 'object'
		? value as {
			id?: unknown
			customer?: unknown
			invoice?: unknown
			payment_intent?: unknown
		}
		: null
	const invoice = charge?.invoice && typeof charge.invoice === 'object'
		? charge.invoice as { id?: unknown; subscription?: unknown }
		: null

	return {
		stripeChargeId: stripeRelationshipId(charge),
		stripeCustomerId: stripeRelationshipId(charge?.customer),
		stripeInvoiceId: stripeRelationshipId(charge?.invoice),
		stripeSubscriptionId: stripeRelationshipId(invoice?.subscription),
		stripePaymentIntentId: stripeRelationshipId(charge?.payment_intent),
	}
}

function stripeDisputeContext(dispute: Stripe.Dispute) {
	const chargeContext = stripeChargeContext(
		(dispute as Stripe.Dispute & { charge?: unknown }).charge,
	)
	return {
		...chargeContext,
		stripePaymentIntentId:
			stripeRelationshipId(
				(dispute as Stripe.Dispute & { payment_intent?: unknown }).payment_intent,
			) ?? chargeContext.stripePaymentIntentId,
	}
}

function disputeProjectionStatus(
	status: Stripe.Dispute.Status,
): 'dispute_won' | 'dispute_lost' | 'dispute_resolved' {
	if (status === 'won') return 'dispute_won'
	if (status === 'lost') return 'dispute_lost'
	return 'dispute_resolved'
}

function buildDebugInfo(params: {
	req: Request
	signature: string | null
	rawBodyLength: number
}): WebhookDebugInfo {
	const { req, signature, rawBodyLength } = params
	return {
		hasSignatureHeader: Boolean(signature),
		rawBodyLength,
		method: req.method,
		path: getRequestPath(req),
		nodeEnv: process.env.NODE_ENV,
	}
}

function debugErrorPayload(message: string, debugInfo: WebhookDebugInfo) {
	return DEBUG_STRIPE_WEBHOOKS ? { error: message, debug: debugInfo } : { error: message }
}

function getBuildId(): string | null {
	return process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.APP_BUILD_ID ?? null
}

type WebhookOutcome = 'processed' | 'deduped' | 'skipped' | 'rejected' | 'error'

function logWebhookEvent(params: {
	message?: string
	eventId: string | null
	type: string | null
	verified: boolean
	outcome: WebhookOutcome
	reason?: string
	meta?: Record<string, unknown>
	debugInfo?: WebhookDebugInfo
}) {
	const { message, eventId, type, verified, outcome, reason, meta, debugInfo } = params
	const payload: Record<string, unknown> = {
		eventId,
		type,
		verified,
		outcome,
	}
	if (reason) payload.reason = reason
	if (meta) Object.assign(payload, meta)
	if (DEBUG_STRIPE_WEBHOOKS && debugInfo) {
		payload.debug = debugInfo
	}

	const label = message ?? 'Stripe webhook event'
	if (outcome === 'error' || outcome === 'rejected') {
		console.error(label, payload)
		return
	}
	if (outcome === 'skipped' || outcome === 'deduped') {
		console.warn(label, payload)
		return
	}
	console.info(label, payload)
}

function logProvisioningSkip(event: Stripe.Event, reason: string) {
	let customerId: string | null = null
	let subscriptionId: string | null = null
	let email: string | null = null
	let incomingPlan: string | null = null

	switch (event.type) {
		case 'checkout.session.completed': {
			const session = event.data.object as Stripe.Checkout.Session
			customerId =
				typeof session.customer === 'string'
					? session.customer
					: session.customer?.id ?? null
			subscriptionId =
				typeof session.subscription === 'string'
					? session.subscription
					: session.subscription?.id ?? null
			email = session.customer_email ?? session.customer_details?.email ?? null
			incomingPlan =
				typeof session.metadata?.plan === 'string' ? session.metadata.plan : null
			break
		}
		case 'customer.subscription.created':
		case 'customer.subscription.updated':
		case 'customer.subscription.deleted': {
			const subscription = event.data.object as Stripe.Subscription
			customerId =
				typeof subscription.customer === 'string'
					? subscription.customer
					: subscription.customer?.id ?? null
			subscriptionId = subscription.id ?? null
			incomingPlan =
				typeof subscription.metadata?.plan === 'string' ? subscription.metadata.plan : null
			break
		}
		case 'invoice.paid': {
			const invoice = event.data.object as Stripe.Invoice
			customerId =
				typeof invoice.customer === 'string'
					? invoice.customer
					: invoice.customer?.id ?? null
			subscriptionId =
				typeof invoice.subscription === 'string'
					? invoice.subscription
					: invoice.subscription?.id ?? null
			email = invoice.customer_email ?? null
			break
		}
		default:
			break
	}

		logProvisioningDecision({
		eventId: event.id,
		type: event.type,
		livemode: event.livemode,
		customerId,
		subscriptionId,
		email,
		incomingPlan,
		decision: 'skip',
		reason,
	})
}

export async function handleStripeWebhook(req: Request) {
	const signature = req.headers.get('stripe-signature')
	const rawBody = await req.arrayBuffer()
	const rawBuffer = Buffer.from(rawBody)
	let stripeConfig
	try {
		stripeConfig = getStripeConfig()
	} catch (error) {
		console.error('Stripe webhook config missing', {
			message: (error as Error).message,
		})
		return NextResponse.json(
			{ received: true, skipped: 'config_missing' },
			{ status: 200 }
		)
	}

	const webhookSecrets = getStripeWebhookSecrets()
	const buildId = getBuildId()

	const debugInfo = buildDebugInfo({
		req,
		signature,
		rawBodyLength: rawBuffer.length,
	})

	if (!hasLoggedIdempotencyConfig) {
		console.info('Stripe webhook idempotency config', {
			model: 'StripeWebhookEvent',
			table: 'stripe_webhook_events',
			fields: {
				eventId: 'event_id',
				type: 'type',
				livemode: 'livemode',
				receivedAt: 'received_at',
				processedAt: 'processed_at',
				payload: 'payload',
			},
		})
		hasLoggedIdempotencyConfig = true
	}

	if (!signature) {
		logWebhookEvent({
			message: 'Stripe webhook verification failed meta',
			eventId: null,
			type: null,
			verified: false,
			outcome: 'rejected',
			reason: 'missing_signature',
			meta: {
				path: debugInfo.path,
				hasSignature: debugInfo.hasSignatureHeader,
				rawBodyLength: rawBuffer.length,
				buildId,
			},
			debugInfo,
		})
		return NextResponse.json(
			debugErrorPayload('Missing Stripe signature.', debugInfo),
			{ status: 400 }
		)
	}

	if (webhookSecrets.length === 0) {
		logWebhookEvent({
			eventId: null,
			type: null,
			verified: false,
			outcome: 'error',
			reason: 'missing_webhook_secret',
			meta: {
				path: debugInfo.path,
				hasWebhookSecret: false,
				buildId,
			},
			debugInfo,
		})
		return NextResponse.json(
			{ received: true, skipped: 'missing_webhook_secret' },
			{ status: 200 }
		)
	}

	const stripe = getStripe()
	let event: Stripe.Event | null = null
	let matchedSecretIndex = -1
	const failedIndices: number[] = []
	let firstError: Error | null = null

	for (let i = 0; i < webhookSecrets.length; i += 1) {
		try {
			event = stripe.webhooks.constructEvent(rawBuffer, signature, webhookSecrets[i])
			matchedSecretIndex = i
			break
		} catch (error) {
			if (!firstError) {
				firstError = error as Error
			}
			failedIndices.push(i)
		}
	}

	if (!event) {
		logWebhookEvent({
			message: 'Stripe webhook verification failed meta',
			eventId: null,
			type: null,
			verified: false,
			outcome: 'rejected',
			reason: 'invalid_signature',
			meta: {
				path: debugInfo.path,
				hasSignature: debugInfo.hasSignatureHeader,
				numberOfSecretsTried: webhookSecrets.length,
				failedIndices,
				rawBodyLength: rawBuffer.length,
				buildId,
				message: firstError?.message ?? 'Signature verification failed.',
			},
			debugInfo,
		})
		return NextResponse.json(
			debugErrorPayload('Invalid Stripe signature.', debugInfo),
			{ status: 400 }
		)
	}

	const expectedLivemode = stripeConfig.env === 'live'
	if (event.livemode !== expectedLivemode) {
		const idempotencyResult = await markProcessed({
			eventId: event.id,
			eventType: event.type,
			livemode: event.livemode,
			payload: event as unknown as Record<string, unknown>,
		})
		if (idempotencyResult.dbAttempted && !idempotencyResult.dbSuccess) {
			console.warn('Stripe webhook idempotency write failed', {
				table: 'jpvbootcamp.stripe_webhook_events',
				keys: { eventId: event.id, type: event.type },
				message: idempotencyResult.error,
			})
		}

		logWebhookEvent({
			eventId: event.id,
			type: event.type,
			verified: true,
			outcome: 'skipped',
			reason: 'livemode_mismatch',
			meta: {
				path: debugInfo.path,
				buildId,
				expectedEnv: stripeConfig.env,
				eventLivemode: event.livemode,
			},
			debugInfo,
		})
		return NextResponse.json({ received: true, skipped: 'livemode_mismatch' })
	}

	if (SKIP_PREDEV) {
		logWebhookEvent({
			eventId: event.id,
			type: event.type,
			verified: true,
			outcome: 'skipped',
			reason: 'skip_predev',
			meta: {
				path: debugInfo.path,
				buildId,
			},
			debugInfo,
		})
		return NextResponse.json({ received: true, skipped: 'db' })
	}

	if (await hasProcessed(event.id)) {
		logWebhookEvent({
			message: 'webhook_duplicate_ignored',
			eventId: event.id,
			type: event.type,
			verified: true,
			outcome: 'deduped',
			reason: 'already_processed',
			meta: {
				path: debugInfo.path,
				buildId,
			},
			debugInfo,
		})
		return NextResponse.json({ received: true })
	}

	const requiresProvisioning = PROVISIONING_EVENT_TYPES.has(event.type)
	const provisioningStatus: 'enabled' | 'not_applicable' = requiresProvisioning
		? 'enabled'
		: 'not_applicable'

	try {
		const allowMembershipEmail = shouldSendMembershipEmailForEvent(event.type)

		switch (String(event.type)) {
			case 'checkout.session.completed':
			case 'checkout.session.async_payment_succeeded': {
				const session = event.data.object as Stripe.Checkout.Session
				if (event.type === 'checkout.session.completed') {
					const sponsoredTier = isSponsoredSeatSession(session)
					if (sponsoredTier) {
						const seatResult = await upsertSponsoredSeatFromSession({
							session,
							tier: sponsoredTier,
						})
						console.info('sponsored_seat_created', {
							tier: sponsoredTier,
							seatId: seatResult.seatId ?? null,
							created: seatResult.created,
							eventId: event.id,
						})
						if (seatResult.seatId) {
							const donorEmail =
								session.customer_details?.email ?? session.customer_email ?? null
							await notifySponsoredSeatPurchase({
								seatId: seatResult.seatId,
								donorEmail,
							})
						}
					}
				}
				await provisionFromCheckoutSession(session, event.id, event.type, {
					allowEmail: allowMembershipEmail,
					eventLivemode: event.livemode,
				})
				break
			}
			case 'checkout.session.async_payment_failed': {
				const session = event.data.object as Stripe.Checkout.Session
				const projected = await projectAsyncCheckoutFailure({
					session,
					eventId: event.id,
					occurredAt: new Date(event.created * 1000),
				})
				if (!projected) {
					console.warn('monthly_commitment_async_payment_failure_unmatched', {
						eventId: event.id,
						checkoutSessionId: session.id,
					})
				}
				break
			}
			case 'customer.subscription.created': {
				const subscription = event.data.object as Stripe.Subscription
				await syncFromSubscription(subscription.id, event.id, event.type, {
					allowEmail: allowMembershipEmail,
					eventLivemode: event.livemode,
				})
				break
			}
			case 'customer.subscription.updated': {
				const subscription = event.data.object as Stripe.Subscription
				await syncFromSubscription(subscription.id, event.id, event.type, {
					allowEmail: allowMembershipEmail,
					eventLivemode: event.livemode,
				})
				break
			}
			case 'customer.subscription.deleted': {
				const subscription = event.data.object as Stripe.Subscription
				await syncFromSubscription(subscription.id, event.id, event.type, {
					allowEmail: allowMembershipEmail,
					eventLivemode: event.livemode,
				})
				break
			}
			case 'invoice.paid': {
				const invoice = event.data.object as Stripe.Invoice
				const subscriptionId = stripeRelationshipId(
					(invoice as Stripe.Invoice & { subscription?: unknown }).subscription,
				)
				await projectInvoicePaymentState({
					stripeCustomerId: stripeRelationshipId(invoice.customer),
					stripeSubscriptionId: subscriptionId,
					stripeInvoiceId: invoice.id,
					stripePaymentIntentId: stripeRelationshipId(
						(invoice as Stripe.Invoice & { payment_intent?: unknown }).payment_intent,
					),
					eventId: event.id,
					paymentStatus: 'paid',
					occurredAt: new Date(event.created * 1000),
				})
				if (subscriptionId) {
					await syncFromSubscription(subscriptionId, event.id, event.type, {
						allowEmail: allowMembershipEmail,
						eventLivemode: event.livemode,
					})
				} else {
					logProvisioningSkip(event, 'missing_subscription_id')
				}
				break
			}
			case 'invoice.payment_failed': {
				const invoice = event.data.object as Stripe.Invoice
				await projectInvoicePaymentState({
					stripeCustomerId: stripeRelationshipId(invoice.customer),
					stripeSubscriptionId: stripeRelationshipId(
						(invoice as Stripe.Invoice & { subscription?: unknown }).subscription,
					),
					stripeInvoiceId: invoice.id,
					stripePaymentIntentId: stripeRelationshipId(
						(invoice as Stripe.Invoice & { payment_intent?: unknown }).payment_intent,
					),
					eventId: event.id,
					paymentStatus: 'failed',
					occurredAt: new Date(event.created * 1000),
				})
				break
			}
			case 'invoice.payment_action_required': {
				const invoice = event.data.object as Stripe.Invoice
				await projectInvoicePaymentState({
					stripeCustomerId: stripeRelationshipId(invoice.customer),
					stripeSubscriptionId: stripeRelationshipId(
						(invoice as Stripe.Invoice & { subscription?: unknown }).subscription,
					),
					stripeInvoiceId: invoice.id,
					stripePaymentIntentId: stripeRelationshipId(
						(invoice as Stripe.Invoice & { payment_intent?: unknown }).payment_intent,
					),
					eventId: event.id,
					paymentStatus: 'action_required',
					occurredAt: new Date(event.created * 1000),
				})
				break
			}
			case 'subscription_schedule.created':
			case 'subscription_schedule.updated':
			case 'subscription_schedule.expiring':
			case 'subscription_schedule.completed':
			case 'subscription_schedule.released':
			case 'subscription_schedule.canceled':
			case 'subscription_schedule.aborted': {
				const eventSchedule = event.data.object as Stripe.SubscriptionSchedule
				const retrieveCurrentState =
					event.type === 'subscription_schedule.created' ||
					event.type === 'subscription_schedule.updated' ||
					event.type === 'subscription_schedule.expiring'
				const schedule = retrieveCurrentState
					? await getStripe().subscriptionSchedules.retrieve(eventSchedule.id)
					: eventSchedule
				const projected = await projectSubscriptionSchedule({
					schedule,
					eventId: event.id,
					eventType: event.type,
				})
				if (!projected.updated) {
					console.warn('subscription_schedule_projection_unmatched', {
						eventId: event.id,
						type: event.type,
						scheduleId: eventSchedule.id,
					})
				}
				break
			}
			case 'refund.created':
			case 'refund.updated':
			case 'refund.failed': {
				const refund = event.data.object as Stripe.Refund
				console.info('stripe_refund_lifecycle_observed', {
					eventId: event.id,
					type: event.type,
					refundId: refund.id,
					status: refund.status ?? null,
					chargeId: stripeRelationshipId(refund.charge),
					paymentIntentId: stripeRelationshipId(refund.payment_intent),
				})
				break
			}
			case 'charge.refunded': {
				const context = stripeChargeContext(event.data.object)
				await projectInvoicePaymentState({
					...context,
					eventId: event.id,
					paymentStatus: 'refunded',
					occurredAt: new Date(event.created * 1000),
				})
				break
			}
			case 'charge.dispute.created':
			case 'charge.dispute.updated': {
				const dispute = event.data.object as Stripe.Dispute
				await projectInvoicePaymentState({
					...stripeDisputeContext(dispute),
					disputeStatus: dispute.status,
					eventId: event.id,
					paymentStatus: 'disputed',
					occurredAt: new Date(event.created * 1000),
				})
				break
			}
			case 'charge.dispute.closed': {
				const dispute = event.data.object as Stripe.Dispute
				await projectInvoicePaymentState({
					...stripeDisputeContext(dispute),
					disputeStatus: dispute.status,
					eventId: event.id,
					paymentStatus: disputeProjectionStatus(dispute.status),
					occurredAt: new Date(event.created * 1000),
				})
				break
			}
			default:
				break
		}

		try {
			const shadowResult = await shadowSyncStripeEventToPayload(event)
			if (shadowResult.enabled) {
				console.info('payload_billing_shadow_sync_result', {
					eventId: event.id,
					type: event.type,
					processed: shadowResult.processed,
					deduped: shadowResult.deduped,
					actions: shadowResult.actions,
				})
			}
		} catch (error) {
			console.error('payload_billing_shadow_sync_failed', {
				eventId: event.id,
				type: event.type,
				message: (error as Error).message,
			})
		}

		const idempotencyResult = await markProcessed({
			eventId: event.id,
			eventType: event.type,
			livemode: event.livemode,
			payload: event as unknown as Record<string, unknown>,
		})

		if (idempotencyResult.dbAttempted && !idempotencyResult.dbSuccess) {
			console.warn('Stripe webhook idempotency write failed', {
				table: 'jpvbootcamp.stripe_webhook_events',
				keys: { eventId: event.id, type: event.type },
				message: idempotencyResult.error,
			})
		}

		logWebhookEvent({
			eventId: event.id,
			type: event.type,
			verified: true,
			outcome: 'processed',
			meta: {
				path: debugInfo.path,
				buildId,
				secretIndexMatched: matchedSecretIndex,
				provisioning: provisioningStatus,
			},
			debugInfo,
		})
		return NextResponse.json({ received: true })
	} catch (error) {
		logWebhookEvent({
			eventId: event.id,
			type: event.type,
			verified: true,
			outcome: 'error',
			reason: 'handler_failed',
			meta: {
				path: debugInfo.path,
				buildId,
				message: (error as Error).message,
			},
			debugInfo,
		})
		return NextResponse.json({ received: true, skipped: 'handler_failed' })
	}
}
