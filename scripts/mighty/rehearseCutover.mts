import type Stripe from 'stripe'
import StripeClient from 'stripe'

import { normalizeEmail } from '../../src/lib/normalize-email'
import { createMightyAdminApi, type MightyMember, type MightyPurchase } from '../../src/lib/mighty/adminApi'
import { getMightyConfig } from '../../src/lib/mighty/config'
import { buildCutoverManifestRow, summarizeCutoverManifest, type CutoverManifestRow } from '../../src/lib/mighty/cutoverManifest'

const OPERATOR_ROLE_OVERRIDES: Record<string, 'ORDINARY' | 'PRIVILEGED'> = {
	'westhoek@hotmail.com': 'ORDINARY',
	'steve@yeshua.academy': 'PRIVILEGED',
	'info@yeshua.academy': 'PRIVILEGED',
}

function assertReadOnlyProductionBoundary(): void {
	if (process.env.STRIPE_ENV !== 'live') throw new Error('mighty_cutover_rehearsal_requires_live_stripe_env')
	if (process.env.MIGHTY_PROVIDER_ENV?.trim() !== 'production') throw new Error('mighty_cutover_rehearsal_requires_production_provider_env')
}

function createLiveStripeClient(): Stripe {
	const secretKey = process.env.STRIPE_SECRET_KEY_LIVE?.trim()
	if (!secretKey || !secretKey.startsWith('sk_live_')) throw new Error('mighty_cutover_rehearsal_requires_live_stripe_key')
	return new StripeClient(secretKey, { apiVersion: '2024-06-20' })
}

function customerEmail(customer: Stripe.Customer | Stripe.DeletedCustomer | string | null): string | null {
	if (!customer || typeof customer === 'string' || 'deleted' in customer) return null
	return normalizeEmail(customer.email)
}

function customerName(customer: Stripe.Customer | Stripe.DeletedCustomer | string | null): string | null {
	if (!customer || typeof customer === 'string' || 'deleted' in customer) return null
	return customer.name?.trim() || null
}

async function listActiveSubscriptions(stripe: Stripe): Promise<Array<{ id: string; email: string; name: string | null; status: string }>> {
	const rows: Array<{ id: string; email: string; name: string | null; status: string }> = []
	let startingAfter: string | undefined
	do {
		const page = await stripe.subscriptions.list({ status: 'all', limit: 100, starting_after: startingAfter, expand: ['data.customer'] })
		for (const subscription of page.data) {
			if (!['active', 'trialing'].includes(subscription.status)) continue
			const email = customerEmail(subscription.customer)
			if (!email) throw new Error(`stripe_active_subscription_missing_customer_email:${subscription.id}`)
			rows.push({ id: subscription.id, email, name: customerName(subscription.customer), status: subscription.status })
		}
		startingAfter = page.has_more ? page.data.at(-1)?.id : undefined
		if (page.has_more && !startingAfter) throw new Error('stripe_subscription_inventory_checkpoint_missing')
	} while (startingAfter)
	return rows
}

function normalizedName(value: string | null | undefined): string {
	return (value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function hasNameCollision(member: MightyMember, name: string | null): boolean {
	const providerName = normalizedName(`${member.first_name ?? ''} ${member.last_name ?? ''}`)
	return Boolean(providerName && name && providerName === normalizedName(name))
}

function purchasesForMember(purchases: MightyPurchase[], member: MightyMember): MightyPurchase[] {
	return purchases.filter((purchase) => String(purchase.member_id) === String(member.id))
}

async function main(): Promise<void> {
	assertReadOnlyProductionBoundary()
	const config = getMightyConfig()
	const stripe = createLiveStripeClient()
	const api = createMightyAdminApi(config)
	const [subscriptions, members, purchases] = await Promise.all([
		listActiveSubscriptions(stripe),
		api.listMembers(),
		api.findAllPurchases(),
	])
	const rows: CutoverManifestRow[] = []
	for (const subscription of subscriptions) {
		const member = await api.findMember(subscription.email)
		let matchState: 'EXACT_EMAIL' | 'NO_EXACT_EMAIL' | 'AMBIGUOUS_PROVIDER_IDENTITY' = member ? 'EXACT_EMAIL' : 'NO_EXACT_EMAIL'
		let identityReviewReason: string | null = null
		if (!member) {
			const nameCollision = members.find((candidate) => !normalizeEmail(candidate.email) && hasNameCollision(candidate, subscription.name))
			if (nameCollision) {
				matchState = 'AMBIGUOUS_PROVIDER_IDENTITY'
				identityReviewReason = `blank-email Mighty member ${String(nameCollision.id)} matches the Stripe profile name; operator must resolve identity`
			}
		}
		const [plans, spaces] = member
			? await Promise.all([api.listMemberPlans(member.id), api.listMemberSpaces(member.id)])
			: [[], []]
		rows.push(buildCutoverManifestRow({
			email: subscription.email,
			stripeEntitled: true,
			stripeSubscriptionId: subscription.id,
			member,
			matchState,
			identityReviewReason,
			operatorRoleClass: OPERATOR_ROLE_OVERRIDES[subscription.email],
			plans,
			purchases: member ? purchasesForMember(purchases, member) : [],
			spaces,
			targetPlanId: config.accessPlanId,
		}))
	}

	const summary = summarizeCutoverManifest(rows)
	console.log(JSON.stringify({
		readOnly: true,
		stripeMode: 'live',
		providerEnvironment: 'production',
		accessPlanId: String(config.accessPlanId),
		stripeActiveSubscriptions: subscriptions.length,
		mightyMemberCount: members.length,
		mightyPurchaseCount: purchases.length,
		...summary,
		rows: rows.sort((left, right) => left.email.localeCompare(right.email)),
		mutationPerformed: false,
		interpretation: 'This is a complete live read-only rehearsal. No Mighty create, grant, revoke, invitation, Space, profile, or Stripe mutation is performed.',
	}, null, 2))
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : 'mighty_cutover_rehearsal_failed')
	process.exitCode = 1
})
