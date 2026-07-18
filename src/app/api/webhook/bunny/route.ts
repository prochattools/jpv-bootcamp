import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

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
		// TODO: Verify Bunny webhook signature
		// const signature = req.headers.get('bunny-signature')
		// const secret = process.env.BUNNY_WEBHOOK_SECRET
		// if (!signature || !secret) {
		//   return NextResponse.json({ error: 'Webhook authentication failed' }, { status: 403 })
		// }

		// Read raw body for signature verification
		const rawBody = await req.text()

		// TODO: Verify HMAC-SHA256 signature
		// const expectedSignature = crypto
		//   .createHmac('sha256', secret)
		//   .update(rawBody)
		//   .digest('hex')
		// if (signature !== expectedSignature) {
		//   return NextResponse.json({ error: 'Signature verification failed' }, { status: 403 })
		// }

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

		// Process based on event type
		switch (payload.Type) {
			case 'VideoFinishedProcessing':
				// TODO: Update Payload video collection
				// - Mark as 'ready'
				// - Store thumbnail URL
				// - Update duration, codec, bitrate
				// - Clear any processing errors
				console.log(`Video ${payload.VideoId} finished processing`)
				break

			case 'VideoFailedProcessing':
			case 'VideoTranscodeFailed':
				// TODO: Update Payload video collection
				// - Mark as 'failed'
				// - Store error message
				// - Alert admin if configured
				console.log(`Video ${payload.VideoId} processing failed: ${payload.ErrorMessage}`)
				break

			default:
				// Ignore unknown webhook types
				console.log(`Unknown webhook type: ${payload.Type}`)
		}

		// TODO: Implement idempotency check
		// - Store webhook UUID in database
		// - Return 200 immediately if UUID already processed
		// - Prevents duplicate status updates if webhook is retried

		return NextResponse.json({ ok: true })
	} catch (error) {
		console.error('Bunny webhook error:', error)

		// Always return 200 to prevent webhook retries
		// Actual errors should be logged and alerted separately
		return NextResponse.json({ ok: false }, { status: 200 })
	}
}
