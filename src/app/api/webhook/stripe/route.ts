/**
 * Checklist:
 * - STRIPE_WEBHOOK_SECRET_TEST / STRIPE_WEBHOOK_SECRET_LIVE set for STRIPE_ENV
 * - Stripe webhook endpoint configured: /api/webhook/stripe
 * - After deploy, use "Resend event" in the Stripe dashboard for failed events
 * - Local test: stripe listen --forward-to http://localhost:3000/api/webhook/stripe
 */
import { handleStripeWebhook } from '@/lib/stripe-webhook-handler'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CANONICAL_PATH = '/api/webhook/stripe'
let hasLoggedStartup = false

function isEnvEnabled(value?: string): boolean {
	if (!value) return false
	return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase())
}

function getProvisioningEnabled(): boolean {
	return (
		isEnvEnabled(process.env.PROVISIONING_ENABLED) ||
		isEnvEnabled(process.env.WP_PROVISION_ENABLED)
	)
}

export async function POST(req: Request) {
	if (!hasLoggedStartup) {
		console.info('Stripe webhook route active', {
			path: CANONICAL_PATH,
			provisioningEnabled: getProvisioningEnabled(),
		})
		hasLoggedStartup = true
	}
	return handleStripeWebhook(req)
}
