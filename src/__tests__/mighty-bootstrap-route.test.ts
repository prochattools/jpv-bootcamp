import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/stripe', () => ({ getStripe: vi.fn(() => ({ synthetic: true })) }))
vi.mock('@/lib/mighty/bootstrap', () => ({
	PHASE_A_BOOTSTRAP_EMAIL: 'westhoek@hotmail.com',
	PHASE_A_BOOTSTRAP_PLAN_ID: 2000039,
	bootstrapMightyAccessSync: vi.fn(async () => ({
		queued: true,
		rowId: 'sync_synthetic',
		desiredAccess: 'ALLOWED',
		stateSource: 'operator_bootstrap',
		stateObservedAt: new Date('2026-09-14T12:00:00.000Z'),
		stripeCustomerId: 'cus_synthetic',
		stripeSubscriptionId: 'sub_synthetic',
	})),
}))

import { getStripe } from '@/lib/stripe'
import { bootstrapMightyAccessSync } from '@/lib/mighty/bootstrap'
import { POST } from '@/app/api/admin/bootstrap-mighty-access-sync/route'

const originalEnv = { ...process.env }
const bootstrapMock = vi.mocked(bootstrapMightyAccessSync)

function request(body: unknown, token = 'worker-secret') {
	return new Request('https://jpvbootcamp.com/api/admin/bootstrap-mighty-access-sync', {
		method: 'POST',
		headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
		body: JSON.stringify(body),
	})
}

beforeEach(() => {
	vi.clearAllMocks()
	process.env.MIGHTY_ACCESS_SYNC_WORKER_SECRET = 'worker-secret'
	process.env.MIGHTY_PROVIDER_ENV = 'production'
	process.env.MIGHTY_PRODUCTION_TEST_EMAIL = 'westhoek@hotmail.com'
	process.env.MIGHTY_ACCESS_PLAN_ID = '2000039'
})

afterEach(() => {
	for (const key of Object.keys(process.env)) {
		if (!(key in originalEnv)) delete process.env[key]
	}
	for (const [key, value] of Object.entries(originalEnv)) process.env[key] = value
})

describe('Phase A bootstrap route guard', () => {
	it('requires the existing server-side worker secret', async () => {
		const response = await POST(request({ email: 'westhoek@hotmail.com' }, 'wrong'))
		expect(response.status).toBe(401)
		expect(bootstrapMock).not.toHaveBeenCalled()
	})

	it('accepts exactly the explicitly configured Westhoek email and no extra fields', async () => {
		const response = await POST(request({ email: ' WESTHOEK@HOTMAIL.COM ' }))
		expect(response.status).toBe(200)
		expect(await response.json()).toMatchObject({ ok: true, queued: true, stateSource: 'operator_bootstrap' })
		expect(bootstrapMock).toHaveBeenCalledWith({ email: ' WESTHOEK@HOTMAIL.COM ', stripe: getStripe() })

		const extraField = await POST(request({ email: 'westhoek@hotmail.com', planId: 2000039 }))
		expect(extraField.status).toBe(400)
		expect(bootstrapMock).toHaveBeenCalledOnce()
	})

	it('rejects Steve, Info, and a fourth identity without Stripe or queue access', async () => {
		for (const email of ['steve@yeshua.academy', 'info@prochat.tools', 'fourth@example.test']) {
			const response = await POST(request({ email }))
			expect(response.status).toBe(403)
		}
		expect(bootstrapMock).not.toHaveBeenCalled()
		expect(getStripe).not.toHaveBeenCalled()
	})

	it('fails closed when production target configuration is not exact', async () => {
		process.env.MIGHTY_ACCESS_PLAN_ID = '9999999'
		const response = await POST(request({ email: 'westhoek@hotmail.com' }))
		expect(response.status).toBe(503)
		expect(bootstrapMock).not.toHaveBeenCalled()
	})
})
