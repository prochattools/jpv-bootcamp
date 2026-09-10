import assert from 'node:assert/strict'
import test from 'node:test'

import { POST } from './route'

const originalSecret = process.env.MIGHTY_ACCESS_SYNC_WORKER_SECRET

test.afterEach(() => {
	if (originalSecret === undefined) delete process.env.MIGHTY_ACCESS_SYNC_WORKER_SECRET
	else process.env.MIGHTY_ACCESS_SYNC_WORKER_SECRET = originalSecret
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
