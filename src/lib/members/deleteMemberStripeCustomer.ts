import type { PayloadCourseAccessAPI, PayloadId } from '@/lib/payloadCourse/accessService'
import { getPayloadMigrationSchema, quotePgIdentifier } from '@/lib/payloadMigrationSchema'

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

type StripeCleanupError = {
	code?: unknown
	statusCode?: unknown
}

type QueryResult = {
	rows?: Array<Record<string, unknown>>
}

type QueryClient = {
	query(sql: string, values?: readonly unknown[]): Promise<QueryResult>
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

function resolveDirectPayloadQueryClient(payload: PayloadCourseAccessAPI): QueryClient | null {
	const database = (payload as unknown as { db?: { pool?: unknown } }).db
	const directPool = database?.pool
	if (directPool && typeof directPool === 'object' && 'query' in directPool) {
		return directPool as QueryClient
	}

	return null
}

async function findBillingAccounts(params: {
	payload: PayloadCourseAccessAPI
	memberId: PayloadId
}): Promise<BillingAccount[]> {
	const directClient = resolveDirectPayloadQueryClient(params.payload)
	if (!directClient) {
		const result = await params.payload.find({
			collection: 'payload_billing_accounts',
			where: { member: { equals: params.memberId } },
			limit: 100,
			depth: 0,
			overrideAccess: true,
		})
		return result.docs as BillingAccount[]
	}

	const schema = quotePgIdentifier(getPayloadMigrationSchema())
	const table = `${schema}.${quotePgIdentifier('payload_billing_accounts')}`
	const result = await directClient.query(
		`SELECT ${quotePgIdentifier('stripe_customer_id')} AS ${quotePgIdentifier('stripeCustomerId')}, ${quotePgIdentifier('stripe_mode')} AS ${quotePgIdentifier('stripeMode')} FROM ${table} WHERE ${quotePgIdentifier('member_id')} = $1`,
		[params.memberId],
	)
	return (result.rows ?? []) as BillingAccount[]
}

export async function getMemberEmailForStripeCleanup(
	payload: PayloadCourseAccessAPI,
	memberId: PayloadId,
): Promise<string | null> {
	const directClient = resolveDirectPayloadQueryClient(payload)
	if (!directClient) return null

	const schema = quotePgIdentifier(getPayloadMigrationSchema())
	const table = `${schema}.${quotePgIdentifier('payload_members')}`
	const result = await directClient.query(
		`SELECT ${quotePgIdentifier('email')} FROM ${table} WHERE ${quotePgIdentifier('id')} = $1`,
		[memberId],
	)
	return stringValue(result.rows?.[0]?.email)
}

export async function deleteStripeCustomersForMember(params: {
	payload: PayloadCourseAccessAPI
	stripe: StripeCustomerDeleteClient
	stripeEnvironment: 'test' | 'live'
	memberId: PayloadId
	memberEmail?: string | null
}): Promise<MemberStripeDeletionResult> {
	const billingAccounts = await findBillingAccounts({
		payload: params.payload,
		memberId: params.memberId,
	})

	const customerIds = new Set<string>()
	for (const account of billingAccounts) {
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

/**
 * Stripe cleanup is an external side effect and must not poison Payload's
 * member-delete transaction. The strict helper above remains fail-closed for
 * callers that need to make a guarded billing decision; the delete hook uses
 * this boundary so local member deletion can complete when Stripe has drifted
 * or is temporarily unavailable.
 */
export async function deleteStripeCustomersForMemberBestEffort(params: {
	payload: PayloadCourseAccessAPI
	stripe: StripeCustomerDeleteClient
	stripeEnvironment: 'test' | 'live'
	memberId: PayloadId
	memberEmail?: string | null
}): Promise<MemberStripeDeletionResult | null> {
	try {
		return await deleteStripeCustomersForMember(params)
	} catch (error) {
		const stripeError = (error && typeof error === 'object' ? error : {}) as StripeCleanupError
		console.error('member_stripe_cleanup_failed', {
			memberId: String(params.memberId),
			code: typeof stripeError.code === 'string' ? stripeError.code : undefined,
			statusCode: typeof stripeError.statusCode === 'number' ? stripeError.statusCode : undefined,
		})
		return null
	}
}
