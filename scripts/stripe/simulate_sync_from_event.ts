import prisma from '../../src/libs/prisma'
import { provisionFromCheckoutSession, syncFromSubscription } from '../../src/lib/provisioning'
import type Stripe from 'stripe'

async function run(): Promise<void> {
	const eventId = process.argv[2]
	if (!eventId) {
		console.error('Usage: tsx scripts/stripe/simulate_sync_from_event.ts <event_id>')
		process.exit(1)
	}

	process.env.DRY_RUN_MEMBERSHIP_SYNC = process.env.DRY_RUN_MEMBERSHIP_SYNC || '1'

	const record = await prisma.stripeWebhookEvent.findUnique({
		where: { eventId },
	})

	if (!record || !record.payload) {
		console.error('Webhook event not found:', eventId)
		process.exit(1)
	}

	const event = record.payload as unknown as Stripe.Event

	const allowEmail = event.type === 'customer.subscription.updated'

	switch (event.type) {
		case 'checkout.session.completed': {
			const session = event.data.object as Stripe.Checkout.Session
			const summary = await provisionFromCheckoutSession(
				session,
				event.id,
				event.type,
				{ dryRun: true, allowEmail }
			)
			console.log(JSON.stringify(summary))
			break
		}
		case 'customer.subscription.created':
		case 'customer.subscription.updated':
		case 'customer.subscription.deleted': {
			const subscription = event.data.object as Stripe.Subscription
			const summary = await syncFromSubscription(
				subscription.id,
				event.id,
				event.type,
				{ dryRun: true, allowEmail }
			)
			console.log(JSON.stringify(summary))
			break
		}
		case 'invoice.paid': {
			const invoice = event.data.object as Stripe.Invoice
			const subscriptionId =
				typeof invoice.subscription === 'string'
					? invoice.subscription
					: invoice.subscription?.id ?? null
			if (!subscriptionId) {
				console.error('invoice.paid missing subscription id', { eventId })
				process.exit(1)
			}
			const summary = await syncFromSubscription(
				subscriptionId,
				event.id,
				event.type,
				{ dryRun: true, allowEmail }
			)
			console.log(JSON.stringify(summary))
			break
		}
		default:
			console.error('Unsupported event type for simulation:', event.type)
			process.exit(1)
	}
}

run().catch((error) => {
	console.error('Simulation failed', {
		message: (error as Error).message ?? 'unknown_error',
	})
	process.exit(1)
})
