import 'server-only'

import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { getServerConfig, getStripeWebhookSecret } from '@/lib/config'
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

export async function handleStripeWebhook(req: Request) {
	const signature = req.headers.get('stripe-signature')
	const rawBody = await req.text()
	let webhookSecret: string | null = null
	let webhookSecretError: string | null = null

	try {
		webhookSecret = getStripeWebhookSecret()
	} catch (error) {
		webhookSecretError = (error as Error).message
	}

	const debugInfo = buildDebugInfo({
		req,
		signature,
		rawBodyLength: Buffer.byteLength(rawBody),
		secret: webhookSecret,
	})
	logDebugInfo(debugInfo)
	console.info('Stripe webhook request', {
		path: debugInfo.path,
		hasSignature: debugInfo.hasSignatureHeader,
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

	if (!webhookSecret) {
		console.error('Stripe webhook secret missing', {
			message: webhookSecretError ?? 'Unknown error',
		})
		return NextResponse.json(
			debugErrorPayload('Missing Stripe webhook secret.', debugInfo),
			{ status: 500 }
		)
	}

	const stripe = getStripe()
	let event: Stripe.Event

	try {
		event = stripe.webhooks.constructEvent(
			rawBody,
			signature,
			webhookSecret
		)
	} catch (error) {
		console.error('Stripe webhook signature verification failed', {
			message: (error as Error).message,
			path: debugInfo.path,
			hasSignature: debugInfo.hasSignatureHeader,
		})
		return NextResponse.json(
			debugErrorPayload('Invalid Stripe signature.', debugInfo),
			{ status: 400 }
		)
	}

	if (DEBUG_STRIPE_WEBHOOKS) {
		console.info('Stripe webhook signature verified', {
			eventId: event.id,
			type: event.type,
		})
	}
	console.info('Stripe webhook verified', { eventId: event.id, type: event.type })

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
	let provisioningEnabled = true

	if (requiresProvisioning) {
		try {
			getServerConfig()
		} catch (error) {
			if (isMissingEnvError(error)) {
				console.warn('Provisioning config missing; skipping provisioning.', {
					eventId: event.id,
					type: event.type,
					env: process.env.NODE_ENV,
				})
				provisioningEnabled = false
				// Continue without provisioning; do not fail webhook.
			} else {
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
