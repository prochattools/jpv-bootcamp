import assert from 'node:assert/strict'

import {
	deleteStripeCustomersForMember,
	deleteStripeCustomersForMemberBestEffort,
} from './deleteMemberStripeCustomer'

type FakeStripe = {
	customers: {
		del: (customerId: string) => Promise<unknown>
		list: (params: { email: string; limit: number }) => Promise<{
			data: Array<{ id: string; email?: string | null }>
		}>
	}
}

async function testAlreadyMissingCustomerIsIdempotent(): Promise<void> {
	const deleted: string[] = []
	const stripe: FakeStripe = {
		customers: {
			list: async () => ({ data: [] }),
			del: async (customerId) => {
				deleted.push(customerId)
				const error = Object.assign(new Error(`No such customer: ${customerId}`), {
					code: 'resource_missing',
				})
				throw error
			},
		},
	}

	const result = await deleteStripeCustomersForMember({
		payload: {
			find: async () => ({
				docs: [{ stripeCustomerId: 'cus_already_deleted', stripeMode: 'live' }],
			}),
		},
		stripe,
		stripeEnvironment: 'live',
		memberId: 54,
	})

	assert.deepEqual(deleted, ['cus_already_deleted'])
	assert.deepEqual(result, {
		deletedCustomerIds: [],
		alreadyMissingCustomerIds: ['cus_already_deleted'],
	})
}

async function testDuplicateAccountsDeleteOnce(): Promise<void> {
	const deleted: string[] = []
	const stripe: FakeStripe = {
		customers: {
			list: async () => ({ data: [] }),
			del: async (customerId) => {
				deleted.push(customerId)
			},
		},
	}

	const result = await deleteStripeCustomersForMember({
		payload: {
			find: async () => ({
				docs: [
					{ stripeCustomerId: 'cus_duplicate', stripeMode: 'live' },
					{ stripeCustomerId: 'cus_duplicate', stripeMode: 'live' },
				],
			}),
		},
		stripe,
		stripeEnvironment: 'live',
		memberId: 54,
	})

	assert.deepEqual(deleted, ['cus_duplicate'])
	assert.deepEqual(result, {
		deletedCustomerIds: ['cus_duplicate'],
		alreadyMissingCustomerIds: [],
	})
}

async function testMismatchedModeFailsClosed(): Promise<void> {
	let called = false
	const stripe: FakeStripe = {
		customers: {
			list: async () => ({ data: [] }),
			del: async () => {
				called = true
			},
		},
	}

	await assert.rejects(
		deleteStripeCustomersForMember({
			payload: {
				find: async () => ({
					docs: [{ stripeCustomerId: 'cus_test', stripeMode: 'test' }],
				}),
			},
			stripe,
			stripeEnvironment: 'live',
			memberId: 54,
		}),
		/Stripe mode does not match/,
	)

	assert.equal(called, false)
}

async function testUnlinkedExactEmailCustomerIsDeleted(): Promise<void> {
	const deleted: string[] = []
	const stripe: FakeStripe = {
		customers: {
			list: async () => ({
				data: [{ id: 'cus_unlinked', email: 'member@example.com' }],
			}),
			del: async (customerId) => {
				deleted.push(customerId)
			},
		},
	}

	const result = await deleteStripeCustomersForMember({
		payload: {
			find: async () => ({ docs: [] }),
		},
		stripe,
		stripeEnvironment: 'live',
		memberId: 54,
		memberEmail: ' Member@Example.com ',
	})

	assert.deepEqual(deleted, ['cus_unlinked'])
	assert.deepEqual(result, {
		deletedCustomerIds: ['cus_unlinked'],
		alreadyMissingCustomerIds: [],
	})
}

async function testAmbiguousEmailFailsClosed(): Promise<void> {
	let called = false
	const stripe: FakeStripe = {
		customers: {
			list: async () => ({
				data: [
					{ id: 'cus_one', email: 'member@example.com' },
					{ id: 'cus_two', email: 'member@example.com' },
				],
			}),
			del: async () => {
				called = true
			},
		},
	}

	await assert.rejects(
		deleteStripeCustomersForMember({
			payload: {
				find: async () => ({ docs: [] }),
			},
			stripe,
			stripeEnvironment: 'live',
			memberId: 54,
			memberEmail: 'member@example.com',
		}),
		/multiple Stripe customers match/,
	)

	assert.equal(called, false)
}

async function testBestEffortCleanupDoesNotAbortMemberDelete(): Promise<void> {
	const originalConsoleError = console.error
	console.error = () => undefined

	try {
		const result = await deleteStripeCustomersForMemberBestEffort({
			payload: {
				find: async () => ({
					docs: [{ stripeCustomerId: 'cus_test', stripeMode: 'test' }],
				}),
			},
			stripe: {
				list: async () => ({ data: [] }),
				del: async () => undefined,
			},
			stripeEnvironment: 'live',
			memberId: 54,
		})

		assert.equal(result, null)
	} finally {
		console.error = originalConsoleError
	}
}

async function testBestEffortCleanupHandlesStripeApiFailure(): Promise<void> {
	const originalConsoleError = console.error
	console.error = () => undefined

	try {
		const result = await deleteStripeCustomersForMemberBestEffort({
			payload: {
				find: async () => ({
					docs: [{ stripeCustomerId: 'cus_remote_failure', stripeMode: 'live' }],
				}),
			},
			stripe: {
				list: async () => ({ data: [] }),
				del: async () => {
					throw Object.assign(new Error('Stripe temporarily unavailable'), { code: 'api_error' })
				},
			},
			stripeEnvironment: 'live',
			memberId: 54,
		})

		assert.equal(result, null)
	} finally {
		console.error = originalConsoleError
	}
}

await testAlreadyMissingCustomerIsIdempotent()
await testDuplicateAccountsDeleteOnce()
await testMismatchedModeFailsClosed()
await testUnlinkedExactEmailCustomerIsDeleted()
await testAmbiguousEmailFailsClosed()
await testBestEffortCleanupDoesNotAbortMemberDelete()
await testBestEffortCleanupHandlesStripeApiFailure()
console.log('deleteMemberStripeCustomer tests passed')
