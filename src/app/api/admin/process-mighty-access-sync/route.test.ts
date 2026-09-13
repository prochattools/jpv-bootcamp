import assert from 'node:assert/strict'
import test from 'node:test'

import { POST } from './route'

const originalSecret = process.env.MIGHTY_ACCESS_SYNC_WORKER_SECRET
const originalProviderEnv = process.env.MIGHTY_PROVIDER_ENV

test.afterEach(() => {
	if (originalSecret === undefined) delete process.env.MIGHTY_ACCESS_SYNC_WORKER_SECRET
	else process.env.MIGHTY_ACCESS_SYNC_WORKER_SECRET = originalSecret
	if (originalProviderEnv === undefined) delete process.env.MIGHTY_PROVIDER_ENV
	else process.env.MIGHTY_PROVIDER_ENV = originalProviderEnv
})

test('worker route fails closed when its secret is not configured', async () => {
	delete process.env.MIGHTY_ACCESS_SYNC_WORKER_SECRET

	const response = await POST(new Request('https://jpvbootcamp.com/api/admin/process-mighty-access-sync', { method: 'POST' }))
	assert.equal(response.status, 500)
	assert.deepEqual(await response.json(), { ok: false, error: 'not_configured' })
})

test('worker route rejects an invalid bearer token before processing', async () => {
	process.env.MIGHTY_ACCESS_SYNC_WORKER_SECRET = 'expected-secret'

	const response = await POST(new Request('https://jpvbootcamp.com/api/admin/process-mighty-access-sync', {
		method: 'POST',
		headers: { Authorization: 'Bearer wrong-secret' },
	}))
	assert.equal(response.status, 401)
	assert.deepEqual(await response.json(), { ok: false, error: 'unauthorized' })
})

test('worker route rejects malformed JSON before processing', async () => {
	process.env.MIGHTY_ACCESS_SYNC_WORKER_SECRET = 'expected-secret'

	const response = await POST(new Request('https://jpvbootcamp.com/api/admin/process-mighty-access-sync', {
		method: 'POST',
		headers: {
			Authorization: 'Bearer expected-secret',
			'Content-Type': 'application/json',
		},
		body: '{',
	}))
	assert.equal(response.status, 400)
	assert.deepEqual(await response.json(), { ok: false, error: 'invalid_json' })
})

test('production worker route requires an explicit email scope', async () => {
	process.env.MIGHTY_ACCESS_SYNC_WORKER_SECRET = 'expected-secret'
	process.env.MIGHTY_PROVIDER_ENV = 'production'

	const response = await POST(new Request('https://jpvbootcamp.com/api/admin/process-mighty-access-sync', {
		method: 'POST',
		headers: {
			Authorization: 'Bearer expected-secret',
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ limit: 1 }),
	}))
	assert.equal(response.status, 400)
	assert.deepEqual(await response.json(), { ok: false, error: 'scope_required' })
})

test('worker route rejects an invalid email scope before processing', async () => {
	process.env.MIGHTY_ACCESS_SYNC_WORKER_SECRET = 'expected-secret'

	const response = await POST(new Request('https://jpvbootcamp.com/api/admin/process-mighty-access-sync', {
		method: 'POST',
		headers: {
			Authorization: 'Bearer expected-secret',
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ emails: [''] }),
	}))
	assert.equal(response.status, 400)
	assert.deepEqual(await response.json(), { ok: false, error: 'invalid_scope' })
})
