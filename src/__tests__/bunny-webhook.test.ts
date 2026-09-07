import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createHmac } from 'crypto'
import { NextRequest } from 'next/server'
import { POST as postBunnyWebhook } from '@/app/api/webhook/bunny/route'

vi.mock('server-only', () => ({}))
vi.mock('@payload-config', () => ({ default: {} }))

const payloadHarness = vi.hoisted(() => {
	let nextId = 1
	const records = new Map<string, Record<string, any>>()

	const keyFromWhere = (where: any): string => {
		const clauses = Array.isArray(where?.and) ? where.and : []
		const libraryId = clauses.find((clause: any) => clause?.libraryId)?.libraryId?.equals
		const videoGuid = clauses.find((clause: any) => clause?.videoGuid)?.videoGuid?.equals
		const videoId = clauses.find((clause: any) => clause?.videoId)?.videoId?.equals
		return `${libraryId}:${videoGuid ?? videoId}`
	}

	const find = vi.fn(async ({ where }: any) => {
		const record = records.get(keyFromWhere(where))
		return { docs: record ? [record] : [] }
	})

	const create = vi.fn(async ({ data }: any) => {
		const key = `${data.libraryId}:${data.videoGuid ?? data.videoId}`
		if (records.has(key)) {
			const error = new Error('duplicate key value violates unique constraint') as Error & { code?: string }
			error.code = '23505'
			throw error
		}

		const record = { id: nextId++, ...data }
		records.set(key, record)
		return record
	})

	const update = vi.fn(async ({ id, data }: any) => {
		const entry = [...records.entries()].find(([, record]) => record.id === id)
		if (!entry) throw new Error(`record ${id} not found`)
		const [oldKey, prior] = entry
		const updated = { ...prior, ...data, id }
		const newKey = `${updated.libraryId}:${updated.videoGuid ?? updated.videoId}`
		if (newKey !== oldKey) records.delete(oldKey)
		records.set(newKey, updated)
		return updated
	})

	return {
		client: { find, create, update },
		find,
		create,
		update,
		records,
		reset() {
			nextId = 1
			records.clear()
		},
	}
})

vi.mock('payload', () => ({
	getPayload: vi.fn(async () => payloadHarness.client),
}))

const WEBHOOK_SECRET = 'test-webhook-secret-key'

function createSignature(body: string, secret: string): string {
	return createHmac('sha256', secret).update(body).digest('hex')
}

function createBunnyRequest(payload: unknown, signature: string) {
	const body = JSON.stringify(payload)
	return new NextRequest('http://localhost:3000/api/webhook/bunny', {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			'x-bunnystream-signature-version': 'v1',
			'x-bunnystream-signature-algorithm': 'hmac-sha256',
			'x-bunnystream-signature': signature,
		},
		body,
	})
}

describe('POST /api/webhook/bunny', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		payloadHarness.reset()
		process.env.BUNNY_STREAM_WEBHOOK_SECRET = WEBHOOK_SECRET
	})

	it('rejects missing signature headers', async () => {
		const body = JSON.stringify({ Type: 'VideoFinishedProcessing', VideoId: 123 })

		const req = new NextRequest('http://localhost:3000/api/webhook/bunny', {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
			},
			body,
		})

		const res = await postBunnyWebhook(req)
		const data = await res.json()

		expect(res.status).toBe(403)
		expect(data.error).toContain('Missing signature header')
	})

	it('rejects wrong signature version', async () => {
		const payload = { Type: 'VideoFinishedProcessing', VideoId: 123 }
		const body = JSON.stringify(payload)
		const signature = createSignature(body, WEBHOOK_SECRET)

		const req = new NextRequest('http://localhost:3000/api/webhook/bunny', {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				'x-bunnystream-signature-version': 'v2',
				'x-bunnystream-signature-algorithm': 'hmac-sha256',
				'x-bunnystream-signature': signature,
			},
			body,
		})

		const res = await postBunnyWebhook(req)
		const data = await res.json()

		expect(res.status).toBe(403)
		expect(data.error).toContain('Unsupported signature version')
	})

	it('rejects wrong signature algorithm', async () => {
		const payload = { Type: 'VideoFinishedProcessing', VideoId: 123 }
		const body = JSON.stringify(payload)
		const signature = createSignature(body, WEBHOOK_SECRET)

		const req = new NextRequest('http://localhost:3000/api/webhook/bunny', {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				'x-bunnystream-signature-version': 'v1',
				'x-bunnystream-signature-algorithm': 'hmac-sha512',
				'x-bunnystream-signature': signature,
			},
			body,
		})

		const res = await postBunnyWebhook(req)
		const data = await res.json()

		expect(res.status).toBe(403)
		expect(data.error).toContain('Unsupported signature algorithm')
	})

	it('rejects invalid signature', async () => {
		const payload = { Type: 'VideoFinishedProcessing', VideoId: 123 }
		const invalidSignature = 'invalid-signature-hash'

		const req = createBunnyRequest(payload, invalidSignature)

		const res = await postBunnyWebhook(req)
		const data = await res.json()

		expect(res.status).toBe(403)
		expect(data.error).toContain('Signature verification failed')
	})

	it('accepts valid VideoFinishedProcessing webhook', async () => {
		const payload = {
			Type: 'VideoFinishedProcessing',
			VideoLibraryId: 1,
			VideoId: 12345,
			VideoTitle: 'Test Video',
			Duration: 300,
			VideoCodec: 'h264',
			ThumbnailFileName: 'thumb.jpg',
		}
		const body = JSON.stringify(payload)
		const signature = createSignature(body, WEBHOOK_SECRET)

		const req = createBunnyRequest(payload, signature)

		const res = await postBunnyWebhook(req)
		const data = await res.json()

		expect(res.status).toBe(200)
		expect(data.ok).toBe(true)
	})

	it('accepts VideoFailedProcessing webhook', async () => {
		const payload = {
			Type: 'VideoFailedProcessing',
			VideoLibraryId: 1,
			VideoId: 12346,
			ErrorMessage: 'Codec not supported',
		}
		const body = JSON.stringify(payload)
		const signature = createSignature(body, WEBHOOK_SECRET)

		const req = createBunnyRequest(payload, signature)

		const res = await postBunnyWebhook(req)
		const data = await res.json()

		expect(res.status).toBe(200)
		expect(data.ok).toBe(true)
	})

	it('accepts VideoTranscodeFailed webhook', async () => {
		const payload = {
			Type: 'VideoTranscodeFailed',
			VideoLibraryId: 1,
			VideoId: 12347,
			ErrorMessage: 'Transcode timeout',
		}
		const body = JSON.stringify(payload)
		const signature = createSignature(body, WEBHOOK_SECRET)

		const req = createBunnyRequest(payload, signature)

		const res = await postBunnyWebhook(req)
		const data = await res.json()

		expect(res.status).toBe(200)
		expect(data.ok).toBe(true)
	})

	it('ignores unknown webhook types', async () => {
		const payload = {
			Type: 'UnknownEventType',
			VideoLibraryId: 1,
			VideoId: 12348,
		}
		const body = JSON.stringify(payload)
		const signature = createSignature(body, WEBHOOK_SECRET)

		const req = createBunnyRequest(payload, signature)

		const res = await postBunnyWebhook(req)
		const data = await res.json()

		expect(res.status).toBe(200)
		expect(data.ok).toBe(true)
	})

	it('handles malformed JSON gracefully', async () => {
		const body = 'not valid json'
		const signature = createSignature(body, WEBHOOK_SECRET)

		const req = new NextRequest('http://localhost:3000/api/webhook/bunny', {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				'x-bunnystream-signature-version': 'v1',
				'x-bunnystream-signature-algorithm': 'hmac-sha256',
				'x-bunnystream-signature': signature,
			},
			body,
		})

		const res = await postBunnyWebhook(req)

		// Should return 400 for malformed JSON since signature was valid
		expect(res.status).toBe(400)
	})

	it('rejects duplicate webhooks idempotently', async () => {
		const payload = {
			Type: 'VideoFinishedProcessing',
			VideoLibraryId: 1,
			VideoId: 12350,
		}
		const body = JSON.stringify(payload)
		const signature = createSignature(body, WEBHOOK_SECRET)

		const req = createBunnyRequest(payload, signature)

		const res1 = await postBunnyWebhook(req)
		const data1 = await res1.json()

		expect(res1.status).toBe(200)
		expect(data1.ok).toBe(true)

		// Second identical webhook should also succeed (idempotent)
		const req2 = createBunnyRequest(payload, signature)
		const res2 = await postBunnyWebhook(req2)
		const data2 = await res2.json()

		expect(res2.status).toBe(200)
		expect(data2.ok).toBe(true)
		expect(payloadHarness.create).toHaveBeenCalledTimes(1)
		expect(payloadHarness.update).toHaveBeenCalledTimes(1)
		const persisted = [...payloadHarness.records.values()][0]
		expect(persisted.webhookEvents).toHaveLength(2)
	})

	it('returns 503 when webhook secret not configured', async () => {
		delete process.env.BUNNY_STREAM_WEBHOOK_SECRET

		const payload = { Type: 'VideoFinishedProcessing', VideoId: 123 }
		const body = JSON.stringify(payload)
		const signature = 'any-signature'

		const req = createBunnyRequest(payload, signature)

		const res = await postBunnyWebhook(req)
		const data = await res.json()

		expect(res.status).toBe(503)
		expect(data.error).toContain('not configured')
	})
})
