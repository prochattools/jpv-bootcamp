import prisma from '../../src/libs/prisma'
import type Stripe from 'stripe'

type EventSummary = {
	eventId: string
	type: string
	receivedAt: string
	customerId: string | null
	subscriptionId: string | null
	email: string | null
	priceId: string | null
}

function extractSummary(payload: Stripe.Event | null, fallback: EventSummary): EventSummary {
	if (!payload) return fallback
	const data = payload.data?.object as unknown as Record<string, unknown> | undefined
	const type = payload.type ?? fallback.type

	const customerId =
		typeof data?.customer === 'string'
			? (data?.customer as string)
			: ((data?.customer as { id?: string })?.id ?? null)

	const subscriptionId =
		typeof data?.subscription === 'string'
			? (data?.subscription as string)
			: ((data?.subscription as { id?: string })?.id ?? null) ??
			  (typeof data?.id === 'string' && type.startsWith('customer.subscription')
					? (data?.id as string)
					: null)

	const email =
		(typeof data?.customer_email === 'string' && data.customer_email) ||
		(typeof data?.email === 'string' && data.email) ||
		(typeof (data?.customer_details as { email?: string })?.email === 'string'
			? (data?.customer_details as { email?: string }).email ?? null
			: null)

	const items = (data?.items as { data?: Array<Record<string, unknown>> })?.data ?? []
	const priceFromItem = items[0]?.price as { id?: string } | undefined
	const priceId = priceFromItem?.id ?? null

	return {
		...fallback,
		type,
		customerId: customerId ?? fallback.customerId,
		subscriptionId: subscriptionId ?? fallback.subscriptionId,
		email: email ?? fallback.email,
		priceId: priceId ?? fallback.priceId,
	}
}

async function run(): Promise<void> {
	const events = await prisma.stripeWebhookEvent.findMany({
		orderBy: { receivedAt: 'desc' },
		take: 10,
	})

	if (events.length === 0) {
		console.log('No webhook events found.')
		return
	}

	for (const event of events) {
		const fallback: EventSummary = {
			eventId: event.eventId,
			type: event.type ?? 'unknown',
			receivedAt: event.receivedAt.toISOString(),
			customerId: null,
			subscriptionId: null,
			email: null,
			priceId: null,
		}

		const payload = event.payload as Stripe.Event | null
		const summary = extractSummary(payload, fallback)
		console.log(JSON.stringify(summary))
	}
}

run().catch((error) => {
	console.error('Failed to dump webhook events', {
		message: (error as Error).message ?? 'unknown_error',
	})
	process.exit(1)
})
