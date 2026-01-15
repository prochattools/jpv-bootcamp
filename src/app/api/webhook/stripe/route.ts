import { handleStripeWebhook } from '@/lib/stripeWebhookHandler'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
	return handleStripeWebhook(req)
}
