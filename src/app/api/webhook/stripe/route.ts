/**
 * Checklist:
 * - STRIPE_WEBHOOK_SECRET set in production
 * - Stripe webhook endpoint configured: /api/webhook/stripe
 * - After deploy, use "Resend event" in the Stripe dashboard for failed events
 * - Local test: stripe listen --forward-to http://localhost:3000/api/webhook/stripe
 */
import { handleStripeWebhook } from '@/lib/stripe-webhook-handler'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
	return handleStripeWebhook(req)
}
