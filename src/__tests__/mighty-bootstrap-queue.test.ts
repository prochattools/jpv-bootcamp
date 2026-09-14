import { beforeEach, describe, expect, it, vi } from 'vitest'

const { rows, model } = vi.hoisted(() => {
	const rows: Array<Record<string, unknown>> = []
	const model = {
	findMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) => rows.filter((row) => {
		const filters = (where.OR as Array<Record<string, unknown>> | undefined) ?? []
		return filters.some((filter) => Object.entries(filter).every(([key, value]) => row[key] === value))
	})),
	findUnique: vi.fn(async ({ where }: { where: Record<string, unknown> }) => rows.find((row) =>
		Object.entries(where).every(([key, value]) => row[key] === value)
	) ?? null),
	create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
		const row = {
			id: `sync-${rows.length + 1}`,
			...data,
		}
		rows.push(row)
		return { id: row.id }
	}),
	updateMany: vi.fn(async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
		const row = rows.find((candidate) => Object.entries(where).every(([key, value]) => candidate[key] === value))
		if (!row) return { count: 0 }
		for (const [key, value] of Object.entries(data)) if (value !== undefined) row[key] = value
		return { count: 1 }
	}),
	}
	return { rows, model }
})

vi.mock('@/libs/prisma', () => ({ default: { mightyAccessSync: model, customerProvisioning: {} } }))

import { queueMightyAccessSync } from '@/lib/mighty/accessSync'

beforeEach(() => {
	rows.length = 0
	vi.clearAllMocks()
})

describe('operator bootstrap queue persistence', () => {
	it('persists provenance without Stripe event fields and is idempotent on repeat', async () => {
		const observedAt = new Date('2026-09-14T12:00:00.000Z')
		const first = await queueMightyAccessSync({
			email: 'westhoek@hotmail.com',
			stripeCustomerId: 'cus_synthetic',
			stripeSubscriptionId: 'sub_synthetic',
			stateSource: 'operator_bootstrap',
			stateObservedAt: observedAt,
			plan: 'jpv_bootcamp_membership',
			desiredAccess: 'ALLOWED',
			welcomeRequired: false,
		})
		const second = await queueMightyAccessSync({
			email: 'westhoek@hotmail.com',
			stripeCustomerId: 'cus_synthetic',
			stripeSubscriptionId: 'sub_synthetic',
			stateSource: 'operator_bootstrap',
			stateObservedAt: observedAt,
			plan: 'jpv_bootcamp_membership',
			desiredAccess: 'ALLOWED',
			welcomeRequired: false,
		})

		expect(first).toMatchObject({ queued: true, rowId: 'sync-1' })
		expect(second).toMatchObject({ queued: false, reason: 'duplicate_operator_bootstrap', rowId: 'sync-1' })
		expect(model.create).toHaveBeenCalledOnce()
		expect(rows[0]).toMatchObject({
		stateSource: 'operator_bootstrap',
		stateObservedAt: observedAt,
		lastStripeEventId: null,
		lastStripeEventCreatedAt: null,
		lastStripeEventType: null,
		welcomeRequired: false,
	})
	})

	it('lets a newer genuine webhook supersede bootstrap while rejecting an older webhook', async () => {
		const observedAt = new Date('2026-09-14T12:00:00.000Z')
		await queueMightyAccessSync({
			email: 'westhoek@hotmail.com',
			stripeCustomerId: 'cus_synthetic',
			stripeSubscriptionId: 'sub_synthetic',
			stateSource: 'operator_bootstrap',
			stateObservedAt: observedAt,
			desiredAccess: 'ALLOWED',
		})
		const newer = await queueMightyAccessSync({
			email: 'westhoek@hotmail.com',
			stripeCustomerId: 'cus_synthetic',
			stripeSubscriptionId: 'sub_synthetic',
			stripeEventId: 'evt_newer',
			stripeEventCreatedAt: new Date('2026-09-14T12:01:00.000Z'),
			stripeEventType: 'customer.subscription.updated',
			desiredAccess: 'DENIED',
		})
		const older = await queueMightyAccessSync({
			email: 'westhoek@hotmail.com',
			stripeCustomerId: 'cus_synthetic',
			stripeSubscriptionId: 'sub_synthetic',
			stripeEventId: 'evt_older',
			stripeEventCreatedAt: new Date('2026-09-14T11:59:00.000Z'),
			stripeEventType: 'invoice.paid',
			desiredAccess: 'ALLOWED',
		})

		expect(newer).toMatchObject({ queued: true })
		expect(older).toMatchObject({ queued: false, reason: 'stale_stripe_event' })
		expect(rows[0]).toMatchObject({ stateSource: 'stripe_webhook', lastStripeEventId: 'evt_newer', desiredAccess: 'DENIED' })
	})
})
