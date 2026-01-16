import 'server-only'

import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { getServerConfig, getStripeWebhookSecrets } from '@/lib/config'
import { hasProcessed, markProcessed } from '@/lib/idempotency'
import { provisionFromCheckoutSession, syncFromSubscription } from '@/lib/provisioning'
import { getStripe } from '@/lib/stripe'

const PROVISIONING_EVENT_TYPES = new Set([
	'checkout.session.completed',
	'customer.subscription.updated',
	'customer.subscription.deleted',
])
const DEBUG_STRIPE_WEBHOOKS = process.env.DEBUG_STRIPE_WEBHOOKS === '1'
const SKIP_PREDEV = process.env.SKIP_PREDEV === '1'

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

function logDebugInfo(debugInfo: WebhookDebugInfo) {
	if (!DEBUG_STRIPE_WEBHOOKS) return
	console.info('Stripe webhook debug', debugInfo)
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

function getEmailDomain(email?: string | null): string | null {
	if (!email) return null
	const [, domain] = email.split('@')
	return domain ?? null
}

function getId(value?: string | { id?: string } | null): string | null {
	if (!value) return null
	return typeof value === 'string' ? value : value.id ?? null
}

function getSubscriptionIdFromEvent(event: Stripe.Event): string | null {
	switch (event.type) {
		case 'checkout.session.completed': {
			const session = event.data.object as Stripe.Checkout.Session
			return getId(session.subscription ?? null)
		}
		case 'customer.subscription.updated':
		case 'customer.subscription.deleted': {
			const subscription = event.data.object as Stripe.Subscription
			return subscription.id ?? null
		}
		case 'invoice.paid':
		case 'invoice.payment_failed':
		case 'invoice.payment_succeeded': {
			const invoice = event.data.object as Stripe.Invoice
			return getId(invoice.subscription ?? null)
		}
		default: {
			const object = event.data.object as { subscription?: string | { id?: string } }
			return getId(object.subscription ?? null)
		}
	}
}

function logEventSummary(event: Stripe.Event) {
	const type = event.type
	const object = event.data.object as {
		customer?: string | { id?: string }
		customer_email?: string | null
		customer_details?: { email?: string | null } | null
	}

	const customerId =
		typeof object.customer === 'string' ? object.customer : object.customer?.id
	const subscriptionId = getSubscriptionIdFromEvent(event)
	const email =
		'customer_email' in object
			? object.customer_email ?? object.customer_details?.email
			: null

	console.info('Stripe webhook received', {
		eventId: event.id,
		type,
		customerId,
		subscriptionId,
		emailDomain: getEmailDomain(email),
	})
}

function isEnvEnabled(value?: string): boolean {
	if (!value) return false
	return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase())
}

export async function handleStripeWebhook(req: Request) {
	const signature = req.headers.get('stripe-signature')
	const rawBody = await req.arrayBuffer()
	const rawBuffer = Buffer.from(rawBody)
	const webhookSecrets = getStripeWebhookSecrets()
	const webhookSecretPrefix = webhookSecrets.length > 0 ? getSecretPrefix(webhookSecrets[0]) : null
	const webhookSecretFingerprints = webhookSecrets.map(getSecretFingerprint)
	const buildId = getBuildId()

	const debugInfo = buildDebugInfo({
		req,
		signature,
		rawBodyLength: rawBuffer.length,
		secret: webhookSecretPrefix,
	})
	logDebugInfo(debugInfo)
	console.info('Stripe webhook request', {
		handler: 'src/lib/stripe-webhook-handler.ts',
		path: debugInfo.path,
		hasSignature: debugInfo.hasSignatureHeader,
		hasWebhookSecret: webhookSecrets.length > 0,
		secretFingerprints: webhookSecretFingerprints,
		buildId,
	})

	if (!signature) {
		console.error('Stripe webhook missing signature', {
			path: debugInfo.path,
		})
		return NextResponse.json(
			debugErrorPayload('Missing Stripe signature.', debugInfo),
			{ status: 400 }
		)
	}

	if (webhookSecrets.length === 0) {
		console.error('Stripe webhook secret missing', {
			message: 'No webhook secrets configured',
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
		console.error('Stripe webhook signature verification failed', {
			message: firstError?.message ?? 'Signature verification failed.',
			verified: false,
			path: debugInfo.path,
			hasSignature: debugInfo.hasSignatureHeader,
			numberOfSecretsTried: webhookSecrets.length,
			failedIndices,
			rawBodyLength: rawBuffer.length,
			signaturePrefix: getSignaturePrefix(signature),
			secretFingerprints: webhookSecretFingerprints,
			buildId,
		})
		console.error('Stripe webhook verification failed meta', {
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
		})
		return NextResponse.json(
			debugErrorPayload('Invalid Stripe signature.', debugInfo),
			{ status: 400 }
		)
	}

	console.info('Stripe webhook verification result', {
		verified: true,
		eventId: event.id,
		type: event.type,
		secretIndexMatched: matchedSecretIndex,
		secretPrefix: matchedSecretPrefix,
		secretFingerprint: matchedSecretFingerprint,
		buildId,
	})

	logEventSummary(event)

	if (SKIP_PREDEV) {
		console.warn('Stripe webhook DB skipped (SKIP_PREDEV=1)', {
			eventId: event.id,
			type: event.type,
		})
		return NextResponse.json({ received: true, skipped: 'db' })
	}

	if (await hasProcessed(event.id)) {
		console.info('Stripe webhook deduped', { eventId: event.id, type: event.type })
		return NextResponse.json({ received: true })
	}

	const requiresProvisioning = PROVISIONING_EVENT_TYPES.has(event.type)
	const provisioningFlag =
		isEnvEnabled(process.env.PROVISIONING_ENABLED) ||
		isEnvEnabled(process.env.WP_PROVISION_ENABLED)
	let provisioningEnabled = false

	if (requiresProvisioning) {
		if (!provisioningFlag) {
			console.warn('Provisioning disabled; skipping provisioning.', {
				eventId: event.id,
				type: event.type,
				env: process.env.NODE_ENV,
				reason: 'PROVISIONING_ENABLED not set',
			})
		} else {
			try {
				getServerConfig()
				provisioningEnabled = true
			} catch (error) {
				if (isMissingEnvError(error)) {
					console.error('Provisioning enabled but config missing.', {
						eventId: event.id,
						type: event.type,
						env: process.env.NODE_ENV,
						error: (error as Error).message,
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
		switch (event.type) {
			case 'checkout.session.completed': {
				if (provisioningEnabled) {
					const session = event.data.object as Stripe.Checkout.Session
					await provisionFromCheckoutSession(session)
				}
				break
			}
			case 'customer.subscription.updated': {
				if (provisioningEnabled) {
					const subscription = event.data.object as Stripe.Subscription
					await syncFromSubscription(subscription.id)
				}
				break
			}
			case 'customer.subscription.deleted': {
				if (provisioningEnabled) {
					const subscription = event.data.object as Stripe.Subscription
					await syncFromSubscription(subscription.id)
				}
				break
			}
			case 'invoice.paid': {
				const invoice = event.data.object as Stripe.Invoice
				console.info('Invoice paid', {
					invoiceId: invoice.id,
					subscriptionId: getId(invoice.subscription ?? null),
				})
				break
			}
			case 'invoice.payment_failed': {
				const invoice = event.data.object as Stripe.Invoice
				console.info('Invoice payment failed', {
					invoiceId: invoice.id,
					subscriptionId: getId(invoice.subscription ?? null),
				})
				break
			}
			default:
				console.info('Stripe webhook ignored', { type: event.type })
		}

		await markProcessed({
			eventId: event.id,
			eventType: event.type,
			livemode: event.livemode,
			payload: event as unknown as Record<string, unknown>,
		})
		return NextResponse.json({ received: true })
	} catch (error) {
		console.error('Stripe webhook handler failed', {
			eventId: event.id,
			type: event.type,
			message: (error as Error).message,
		})
		return NextResponse.json(
			{ error: 'Stripe webhook handler failed.' },
			{ status: 500 }
		)
	}
}
