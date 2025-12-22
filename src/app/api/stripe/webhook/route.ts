import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { config } from '@/lib/config'
import { hasProcessed, markProcessed } from '@/lib/idempotency'
import { provisionFromCheckoutSession, syncFromSubscription } from '@/lib/provisioning'
import { getStripe } from '@/lib/stripe'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getEmailDomain(email?: string | null): string | null {
	if (!email) return null
	const [, domain] = email.split('@')
	return domain ?? null
}

function logEventSummary(event: Stripe.Event) {
	const type = event.type
	const object = event.data.object as {
		customer?: string | { id?: string }
		subscription?: string | { id?: string }
		customer_email?: string | null
		customer_details?: { email?: string | null } | null
	}

	const customerId =
		typeof object.customer === 'string' ? object.customer : object.customer?.id
	const subscriptionId =
		typeof object.subscription === 'string'
			? object.subscription
			: object.subscription?.id
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

export async function POST(req: Request) {
	const signature = req.headers.get('stripe-signature')
	if (!signature) {
		return NextResponse.json({ error: 'Missing Stripe signature.' }, { status: 400 })
	}

	const stripe = getStripe()
	const rawBody = await req.arrayBuffer()
	let event: Stripe.Event

	try {
		event = stripe.webhooks.constructEvent(
			Buffer.from(rawBody),
			signature,
			config.stripe.webhookSecret
		)
	} catch (error) {
		console.error('Stripe webhook signature verification failed', {
			message: (error as Error).message,
		})
		return NextResponse.json({ error: 'Invalid Stripe signature.' }, { status: 400 })
	}

	if (await hasProcessed(event.id)) {
		console.info('Stripe webhook deduped', { eventId: event.id, type: event.type })
		return NextResponse.json({ received: true })
	}

	logEventSummary(event)

	try {
		switch (event.type) {
			case 'checkout.session.completed': {
				const session = event.data.object as Stripe.Checkout.Session
				await provisionFromCheckoutSession(session)
				break
			}
			case 'customer.subscription.updated': {
				const subscription = event.data.object as Stripe.Subscription
				await syncFromSubscription(subscription.id)
				break
			}
			case 'customer.subscription.deleted': {
				const subscription = event.data.object as Stripe.Subscription
				await syncFromSubscription(subscription.id)
				break
			}
			case 'invoice.payment_failed': {
				const invoice = event.data.object as Stripe.Invoice
				console.info('Invoice payment failed', {
					invoiceId: invoice.id,
					subscriptionId:
						typeof invoice.subscription === 'string'
							? invoice.subscription
							: invoice.subscription?.id,
				})
				break
			}
			default:
				console.info('Stripe webhook ignored', { type: event.type })
		}

		await markProcessed(event.id)
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
