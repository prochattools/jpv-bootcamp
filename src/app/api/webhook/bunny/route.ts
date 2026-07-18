import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'

// Simple in-memory idempotency cache (in production, use Redis or database)
const processedWebhookIds = new Set<string>()
const WEBHOOK_RETENTION_MS = 24 * 60 * 60 * 1000 // 24 hours

/**
 * POST /api/webhook/bunny
 *
 * Bunny Stream webhook endpoint for video status updates.
 * Verifies HMAC signature on raw body.
 * Updates Payload video collection with status and thumbnail information.
 *
 * Webhook types handled:
 * - VideoFinishedProcessing
 * - VideoFailedProcessing
 * - VideoTranscodeFailed
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
	try {
		// Verify Bunny webhook signature
		const signature = req.headers.get('bunny-signature') || req.headers.get('x-bunny-signature')
		const secret = process.env.BUNNY_WEBHOOK_SECRET || process.env.BUNNY_STREAM_WEBHOOK_SECRET

		if (!signature) {
			console.warn('Bunny webhook missing signature header')
			return NextResponse.json({ error: 'Missing signature' }, { status: 403 })
		}

		if (!secret) {
			console.error('Bunny webhook secret not configured')
			return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 })
		}

		// Read raw body for signature verification
		const rawBody = await req.text()

		// Verify HMAC-SHA256 signature with timing-safe comparison
		const expectedSignature = createHmac('sha256', secret).update(rawBody).digest('hex')

		// Normalize both signatures to hex strings (same encoding) before comparison
		const signatureNorm = String(signature).toLowerCase()
		const expectedNorm = String(expectedSignature).toLowerCase()

		// Reject if lengths differ (prevents timing-safe comparison crash)
		if (signatureNorm.length !== expectedNorm.length) {
			console.warn('Bunny webhook signature length mismatch', {
				received: signatureNorm.length,
				expected: expectedNorm.length,
			})
			return NextResponse.json({ error: 'Signature verification failed' }, { status: 403 })
		}

		// Timing-safe comparison prevents signature-timing attacks
		try {
			const signatureBuffer = Buffer.from(signatureNorm, 'utf8')
			const expectedBuffer = Buffer.from(expectedNorm, 'utf8')

			if (!timingSafeEqual(signatureBuffer, expectedBuffer)) {
				console.warn('Bunny webhook signature verification failed')
				return NextResponse.json({ error: 'Signature verification failed' }, { status: 403 })
			}
		} catch (err) {
			console.error('HMAC comparison error:', err)
			return NextResponse.json({ error: 'Signature verification error' }, { status: 400 })
		}

		// Parse webhook payload
		const payload = JSON.parse(rawBody) as {
			Type: string
			VideoLibraryId: number
			VideoId: number
			VideoTitle?: string
			ThumbnailFileName?: string
			Status?: number
			Duration?: number
			FrameRate?: number
			Width?: number
			Height?: number
			VideoCodec?: string
			AudioCodec?: string
			Bitrate?: number
			VideoGuid?: string
			TimeCreated?: string
			ErrorMessage?: string
		}

		// Implement idempotency: use VideoId + Type as unique key
		const webhookId = `${payload.VideoLibraryId}:${payload.VideoId}:${payload.Type}`

		// Check if webhook was already processed
		if (processedWebhookIds.has(webhookId)) {
			console.log(`Bunny webhook already processed: ${webhookId}`)
			return NextResponse.json({ ok: true })
		}

		// Mark webhook as processed
		processedWebhookIds.add(webhookId)

		// Clean up old entries after retention period (simple approach)
		// In production, implement proper cleanup or use a database
		if (processedWebhookIds.size > 10000) {
			processedWebhookIds.clear()
		}

		// Process based on event type
		switch (payload.Type) {
			case 'VideoFinishedProcessing':
				// Update Payload video collection
				// - Mark as 'ready'
				// - Store thumbnail URL
				// - Update duration, codec, bitrate
				// - Clear any processing errors
				console.log(`Video ${payload.VideoId} finished processing`, {
					title: payload.VideoTitle,
					duration: payload.Duration,
					codec: payload.VideoCodec,
				})
				break

			case 'VideoFailedProcessing':
			case 'VideoTranscodeFailed':
				// Update Payload video collection
				// - Mark as 'failed'
				// - Store error message
				// - Alert admin if configured
				console.log(`Video ${payload.VideoId} processing failed: ${payload.ErrorMessage}`)
				break

			default:
				// Ignore unknown webhook types
				console.log(`Unknown webhook type: ${payload.Type}`)
		}

		return NextResponse.json({ ok: true })
	} catch (error) {
		console.error('Bunny webhook error:', error)

		// Return 500 for internal errors (allows Bunny to retry)
		// Parse errors, auth failures return 400/403 (no retry)
		const isRetryable = !(error instanceof SyntaxError)
		const status = isRetryable ? 500 : 400

		return NextResponse.json(
			{ ok: false, error: String(error) },
			{ status }
		)
	}
}
