import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createHmac } from 'crypto'
import { NextRequest } from 'next/server'
import { POST as postBunnyWebhook } from '@/app/api/webhook/bunny/route'

const WEBHOOK_SECRET = 'test-webhook-secret-key'

function createSignature(body: string, secret: string): string {
	return createHmac('sha256', secret).update(body).digest('hex')
}

describe('POST /api/webhook/bunny', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		process.env.BUNNY_WEBHOOK_SECRET = WEBHOOK_SECRET
	})

	it('rejects missing signature header', async () => {
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
		expect(data.error).toContain('Missing signature')
	})

	it('rejects invalid signature', async () => {
		const body = JSON.stringify({ Type: 'VideoFinishedProcessing', VideoId: 123 })
		const invalidSignature = 'invalid-signature-hash'

		const req = new NextRequest('http://localhost:3000/api/webhook/bunny', {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				'bunny-signature': invalidSignature,
			},
			body,
		})

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

		const req = new NextRequest('http://localhost:3000/api/webhook/bunny', {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				'bunny-signature': signature,
			},
			body,
		})

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

		const req = new NextRequest('http://localhost:3000/api/webhook/bunny', {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				'bunny-signature': signature,
			},
			body,
		})

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

		const req = new NextRequest('http://localhost:3000/api/webhook/bunny', {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				'bunny-signature': signature,
			},
			body,
		})

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

		const req = new NextRequest('http://localhost:3000/api/webhook/bunny', {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				'bunny-signature': signature,
			},
			body,
		})

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
				'bunny-signature': signature,
			},
			body,
		})

		const res = await postBunnyWebhook(req)

		// Should return 200 even on error to prevent webhook retries
		expect(res.status).toBe(200)
	})

	it('supports x-bunny-signature header as alternative', async () => {
		const payload = {
			Type: 'VideoFinishedProcessing',
			VideoLibraryId: 1,
			VideoId: 12349,
		}
		const body = JSON.stringify(payload)
		const signature = createSignature(body, WEBHOOK_SECRET)

		const req = new NextRequest('http://localhost:3000/api/webhook/bunny', {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				'x-bunny-signature': signature,
			},
			body,
		})

		const res = await postBunnyWebhook(req)
		const data = await res.json()

		expect(res.status).toBe(200)
		expect(data.ok).toBe(true)
	})

	it('supports BUNNY_STREAM_WEBHOOK_SECRET env var as fallback', async () => {
		process.env.BUNNY_WEBHOOK_SECRET = undefined
		process.env.BUNNY_STREAM_WEBHOOK_SECRET = WEBHOOK_SECRET

		const payload = {
			Type: 'VideoFinishedProcessing',
			VideoLibraryId: 1,
			VideoId: 12350,
		}
		const body = JSON.stringify(payload)
		const signature = createSignature(body, WEBHOOK_SECRET)

		const req = new NextRequest('http://localhost:3000/api/webhook/bunny', {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				'bunny-signature': signature,
			},
			body,
		})

		const res = await postBunnyWebhook(req)
		const data = await res.json()

		expect(res.status).toBe(200)
		expect(data.ok).toBe(true)
	})

	it('returns 503 when webhook secret not configured', async () => {
		process.env.BUNNY_WEBHOOK_SECRET = undefined
		process.env.BUNNY_STREAM_WEBHOOK_SECRET = undefined

		const body = JSON.stringify({ Type: 'VideoFinishedProcessing', VideoId: 123 })
		const signature = 'any-signature'

		const req = new NextRequest('http://localhost:3000/api/webhook/bunny', {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				'bunny-signature': signature,
			},
			body,
		})

		const res = await postBunnyWebhook(req)
		const data = await res.json()

		expect(res.status).toBe(503)
		expect(data.error).toContain('not configured')
	})
})
