import type Stripe from 'stripe'
import StripeClient from 'stripe'

import { normalizeEmail } from '../../src/lib/normalize-email'
import { createMightyAdminApi } from '../../src/lib/mighty/adminApi'
import { getMightyConfig } from '../../src/lib/mighty/config'

const AUTHORIZED_LIVE_TEST_EMAILS = [
	'westhoek@hotmail.com',
	'steve@yeshua.academy',
	'info@prochat.tools',
] as const

function assertReadOnlyProductionBoundary(): void {
	if (process.env.STRIPE_ENV !== 'live') throw new Error('mighty_integration_validation_requires_live_stripe_env')
	if (process.env.MIGHTY_PROVIDER_ENV?.trim() !== 'production') throw new Error('mighty_integration_validation_requires_production_provider_env')
}

function createLiveStripeClient(): Stripe {
	const secretKey = process.env.STRIPE_SECRET_KEY_LIVE?.trim()
	if (!secretKey || !secretKey.startsWith('sk_live_')) throw new Error('mighty_integration_validation_requires_live_stripe_key')
	return new StripeClient(secretKey, { apiVersion: '2024-06-20' })
}

function customerEmail(customer: Stripe.Customer | Stripe.DeletedCustomer | string | null): string | null {
	if (!customer || typeof customer === 'string' || 'deleted' in customer) return null
	return normalizeEmail(customer.email)
}

async function readStripeForExactEmail(stripe: Stripe, email: string) {
	const customers = (await stripe.customers.list({ email, limit: 10 })).data
	const exactCustomers = customers.filter((customer) => customerEmail(customer) === email)
	const subscriptions: Array<{ id: string; status: string }> = []
	for (const customer of exactCustomers) {
		const page = await stripe.subscriptions.list({ customer: customer.id, status: 'all', limit: 100 })
		for (const subscription of page.data) subscriptions.push({ id: subscription.id, status: subscription.status })
		if (page.has_more) throw new Error(`stripe_exact_customer_subscription_limit_exceeded:${email}`)
	}
	return {
		customerCount: exactCustomers.length,
		activeSubscriptionCount: subscriptions.filter(({ status }) => ['active', 'trialing'].includes(status)).length,
		subscriptions,
	}
}

async function main(): Promise<void> {
	assertReadOnlyProductionBoundary()
	const config = getMightyConfig()
	const stripe = createLiveStripeClient()
	const api = createMightyAdminApi(config)
	const rows = []

	for (const email of AUTHORIZED_LIVE_TEST_EMAILS) {
		const stripeState = await readStripeForExactEmail(stripe, email)
		const member = await api.findMemberByEmail(email)
		const mightyState = member
			? await Promise.all([api.getAccessState(member.id, config.accessPlanId), api.listMemberSpaces(member.id)])
			: null
		rows.push({
			email,
			stripe: stripeState,
			mighty: member
				? { memberId: String(member.id), role: member.role ?? null, accessPlanId: String(config.accessPlanId), accessState: mightyState?.[0], spaceCount: mightyState?.[1].length ?? 0 }
				: null,
		})
	}

	console.log(JSON.stringify({
		readOnly: true,
		engineeringScope: 'exactly three authorized live test identities; no population inventory',
		authorizedEmails: AUTHORIZED_LIVE_TEST_EMAILS,
		providerEnvironment: 'production',
		accessPlanId: String(config.accessPlanId),
		rows,
		mutationPerformed: false,
		interpretation: 'Exact-account integration evidence only. No migration manifest, population reconciliation, invitation, Space, profile, Stripe, or Mighty mutation is performed.',
	}, null, 2))
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : 'mighty_integration_validation_failed')
	process.exitCode = 1
})
