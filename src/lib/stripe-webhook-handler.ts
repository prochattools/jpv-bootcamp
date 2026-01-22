import 'server-only'

import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { getServerConfig } from '@/lib/config'
import { getStripeConfig, getStripeWebhookSecrets } from '@/lib/stripe-config'
import { hasProcessed, markProcessed } from '@/lib/idempotency'
import { logProvisioningDecision, provisionFromCheckoutSession, syncFromSubscription } from '@/lib/provisioning'
import { getStripe } from '@/lib/stripe'

const PROVISIONING_EVENT_TYPES = new Set([
	'checkout.session.completed',
	'customer.subscription.created',
	'customer.subscription.updated',
	'customer.subscription.deleted',
	'invoice.paid',
])
const DEBUG_STRIPE_WEBHOOKS = process.env.DEBUG_STRIPE_WEBHOOKS === '1'
const SKIP_PREDEV = process.env.SKIP_PREDEV === '1'
let hasLoggedIdempotencyConfig = false

type WebhookDebugInfo = {
	hasSignatureHeader: boolean
	signaturePrefix: string | null
	rawBodyLength: number
	method: string
	path: string
	nodeEnv?: string
	secretPrefix: string | null
}

function isMissingEnvError(error: unknown): boolean {
	return (
		error instanceof Error && error.message.startsWith('Missing required env var:')
	)
}

function getRequestPath(req: Request): string {
	try {
		return new URL(req.url).pathname
	} catch {
		return req.url
	}
}

function buildDebugInfo(params: {
	req: Request
	signature: string | null
	rawBodyLength: number
	secret: string | null
}): WebhookDebugInfo {
	const { req, signature, rawBodyLength, secret } = params
	return {
		hasSignatureHeader: Boolean(signature),
		signaturePrefix: signature ? signature.slice(0, 16) : null,
		rawBodyLength,
		method: req.method,
		path: getRequestPath(req),
		nodeEnv: process.env.NODE_ENV,
		secretPrefix: secret ? secret.slice(0, 6) : null,
	}
}

function debugErrorPayload(message: string, debugInfo: WebhookDebugInfo) {
	return DEBUG_STRIPE_WEBHOOKS ? { error: message, debug: debugInfo } : { error: message }
}

function getSignaturePrefix(signature: string | null): string | null {
	if (!signature) return null
	const parts = signature.split(',')
	const prefix = parts.slice(0, 2).join(',')
	return prefix.length > 80 ? prefix.slice(0, 80) : prefix
}

function getSecretPrefix(secret: string): string {
	return secret.slice(0, 6)
}

function getSecretFingerprint(secret: string): string {
	return createHash('sha256').update(secret).digest('hex').slice(0, 8)
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

function isEnvEnabled(value?: string): boolean {
	if (!value) return false
	return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase())
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
		customerId,
		subscriptionId,
		email,
		incomingPlan,
		dbWpUserId: null,
		wpExists: 'unknown',
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
			{ error: 'Stripe webhook configuration missing.' },
			{ status: 500 }
		)
	}

	const webhookSecrets = getStripeWebhookSecrets()
	const webhookSecretFingerprints = webhookSecrets.map(getSecretFingerprint)
	const buildId = getBuildId()

	const debugInfo = buildDebugInfo({
		req,
		signature,
		rawBodyLength: rawBuffer.length,
		secret: webhookSecrets.length > 0 ? getSecretPrefix(webhookSecrets[0]) : null,
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
				signaturePrefix: getSignaturePrefix(signature),
				rawBodyLength: rawBuffer.length,
				secretFingerprints: webhookSecretFingerprints,
				buildId,
				userAgent: req.headers.get('user-agent'),
				contentType: req.headers.get('content-type'),
				xForwardedFor: req.headers.get('x-forwarded-for'),
				cfConnectingIp: req.headers.get('cf-connecting-ip'),
				xRealIp: req.headers.get('x-real-ip'),
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
			debugErrorPayload('Missing Stripe webhook secret.', debugInfo),
			{ status: 500 }
		)
	}

	const stripe = getStripe()
	let event: Stripe.Event | null = null
	let matchedSecretIndex = -1
	let matchedSecretPrefix: string | null = null
	let matchedSecretFingerprint: string | null = null
	const failedIndices: number[] = []
	let firstError: Error | null = null

	for (let i = 0; i < webhookSecrets.length; i += 1) {
		const secret = webhookSecrets[i]
		try {
			event = stripe.webhooks.constructEvent(rawBuffer, signature, secret)
			matchedSecretIndex = i
			matchedSecretPrefix = getSecretPrefix(secret)
			matchedSecretFingerprint = getSecretFingerprint(secret)
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
				signaturePrefix: getSignaturePrefix(signature),
				secretFingerprints: webhookSecretFingerprints,
				buildId,
				message: firstError?.message ?? 'Signature verification failed.',
				userAgent: req.headers.get('user-agent'),
				contentType: req.headers.get('content-type'),
				xForwardedFor: req.headers.get('x-forwarded-for'),
				cfConnectingIp: req.headers.get('cf-connecting-ip'),
				xRealIp: req.headers.get('x-real-ip'),
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
				table: 'tenant_jpvbootcamp.stripe_webhook_events',
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
	const provisioningFlag =
		isEnvEnabled(process.env.PROVISIONING_ENABLED) ||
		isEnvEnabled(process.env.WP_PROVISION_ENABLED)
	let provisioningEnabled = false
	let provisioningStatus: 'enabled' | 'skipped' | 'not_applicable' = 'not_applicable'

	if (requiresProvisioning) {
		if (!provisioningFlag) {
			provisioningStatus = 'skipped'
		} else {
			try {
				getServerConfig()
				provisioningEnabled = true
				provisioningStatus = 'enabled'
			} catch (error) {
				if (isMissingEnvError(error)) {
					logWebhookEvent({
						eventId: event.id,
						type: event.type,
						verified: true,
						outcome: 'error',
						reason: 'provisioning_config_missing',
						meta: {
							path: debugInfo.path,
							buildId,
							message: (error as Error).message,
						},
						debugInfo,
					})
					return NextResponse.json(
						{ error: 'Provisioning enabled but configuration is missing.' },
						{ status: 500 }
					)
				}
				throw error
			}
		}
	}

	try {
		if (requiresProvisioning && !provisioningEnabled) {
			logProvisioningSkip(event, 'provisioning_disabled')
		}

		switch (event.type) {
			case 'checkout.session.completed': {
				if (provisioningEnabled) {
					const session = event.data.object as Stripe.Checkout.Session
					await provisionFromCheckoutSession(session, event.id, event.type)
				}
				break
			}
			case 'customer.subscription.created': {
				if (provisioningEnabled) {
					const subscription = event.data.object as Stripe.Subscription
					await syncFromSubscription(subscription.id, event.id, event.type)
				}
				break
			}
			case 'customer.subscription.updated': {
				if (provisioningEnabled) {
					const subscription = event.data.object as Stripe.Subscription
					await syncFromSubscription(subscription.id, event.id, event.type)
				}
				break
			}
			case 'customer.subscription.deleted': {
				if (provisioningEnabled) {
					const subscription = event.data.object as Stripe.Subscription
					await syncFromSubscription(subscription.id, event.id, event.type)
				}
				break
			}
			case 'invoice.paid': {
				if (provisioningEnabled) {
					const invoice = event.data.object as Stripe.Invoice
					const subscriptionId =
						typeof invoice.subscription === 'string'
							? invoice.subscription
							: invoice.subscription?.id ?? null
					if (subscriptionId) {
						await syncFromSubscription(subscriptionId, event.id, event.type)
					} else {
						logProvisioningSkip(event, 'missing_subscription_id')
					}
				}
				break
			}
			case 'invoice.payment_failed': {
				break
			}
			default:
				break
		}

		const idempotencyResult = await markProcessed({
			eventId: event.id,
			eventType: event.type,
			livemode: event.livemode,
			payload: event as unknown as Record<string, unknown>,
		})

		if (idempotencyResult.dbAttempted && !idempotencyResult.dbSuccess) {
			console.warn('Stripe webhook idempotency write failed', {
				table: 'tenant_jpvbootcamp.stripe_webhook_events',
				keys: { eventId: event.id, type: event.type },
				message: idempotencyResult.error,
			})
		}

		const reason =
			provisioningStatus === 'skipped' && requiresProvisioning
				? 'provisioning_disabled'
				: undefined

		logWebhookEvent({
			eventId: event.id,
			type: event.type,
			verified: true,
			outcome: 'processed',
			reason,
			meta: {
				path: debugInfo.path,
				buildId,
				secretIndexMatched: matchedSecretIndex,
				secretPrefix: matchedSecretPrefix,
				secretFingerprint: matchedSecretFingerprint,
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
		return NextResponse.json(
			{ error: 'Stripe webhook handler failed.' },
			{ status: 500 }
		)
	}
}
