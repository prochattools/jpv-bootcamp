import type { PayloadCourseAccessAPI, PayloadId } from '@/lib/payloadCourse/accessService'

type BillingAccount = {
	stripeCustomerId?: unknown
	stripeMode?: unknown
}

type StripeCustomerDeleteClient = {
	customers: {
		del(customerId: string): Promise<unknown>
		list(params: { email: string; limit: number }): Promise<{
			data: Array<{ id: string; email?: string | null }>
		}>
	}
}

export type MemberStripeDeletionResult = {
	deletedCustomerIds: string[]
	alreadyMissingCustomerIds: string[]
}

function stringValue(value: unknown): string | null {
	if (typeof value !== 'string') return null
	const trimmed = value.trim()
	return trimmed || null
}

function isMissingStripeCustomerError(error: unknown): boolean {
	if (!error || typeof error !== 'object') return false

	const candidate = error as {
		code?: unknown
		statusCode?: unknown
		message?: unknown
	}

	return candidate.code === 'resource_missing'
		|| candidate.statusCode === 404
		|| (typeof candidate.message === 'string' && candidate.message.includes('No such customer'))
}

export async function deleteStripeCustomersForMember(params: {
	payload: PayloadCourseAccessAPI
	stripe: StripeCustomerDeleteClient
	stripeEnvironment: 'test' | 'live'
	memberId: PayloadId
	memberEmail?: string | null
}): Promise<MemberStripeDeletionResult> {
	const billingAccounts = await params.payload.find({
		collection: 'payload_billing_accounts',
		where: { member: { equals: params.memberId } },
		limit: 100,
		depth: 0,
		overrideAccess: true,
	})

	const customerIds = new Set<string>()
	for (const account of billingAccounts.docs as BillingAccount[]) {
		const customerId = stringValue(account.stripeCustomerId)
		if (!customerId) continue

		const accountMode = stringValue(account.stripeMode)
		if (accountMode && accountMode !== params.stripeEnvironment) {
			throw new Error(
				`Cannot delete member billing customer ${customerId}: its Stripe mode does not match the configured ${params.stripeEnvironment} environment.`,
			)
		}

		customerIds.add(customerId)
	}

	if (customerIds.size === 0 && params.memberEmail) {
		const normalizedEmail = params.memberEmail.trim().toLowerCase()
		if (normalizedEmail) {
			const customers = await params.stripe.customers.list({
				email: normalizedEmail,
				limit: 100,
			})
			const matchingCustomers = customers.data.filter((customer) =>
				stringValue(customer.email)?.toLowerCase() === normalizedEmail,
			)

			if (matchingCustomers.length > 1) {
				throw new Error(
					`Cannot safely delete member billing: multiple Stripe customers match ${normalizedEmail}.`,
				)
			}

			const customerId = matchingCustomers[0]?.id
			if (customerId) customerIds.add(customerId)
		}
	}

	const result: MemberStripeDeletionResult = {
		deletedCustomerIds: [],
		alreadyMissingCustomerIds: [],
	}

	for (const customerId of customerIds) {
		try {
			await params.stripe.customers.del(customerId)
			result.deletedCustomerIds.push(customerId)
		} catch (error) {
			if (isMissingStripeCustomerError(error)) {
				result.alreadyMissingCustomerIds.push(customerId)
				continue
			}

			throw error
		}
	}

	return result
}
