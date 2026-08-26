import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * POST /api/webhook/bunny
 *
 * Bunny Stream webhook endpoint for video status updates.
 * Verifies HMAC signature on raw body.
 * Persists video status, metadata, and event logs to Payload bunny_videos collection.
 * Uses canonical (libraryId, videoGuid) identity for idempotency, with numeric videoId only as legacy fallback.
 *
 * Webhook types handled:
 * - VideoFinishedProcessing
 * - VideoFailedProcessing
 * - VideoTranscodeFailed
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
	try {
		// Verify Bunny webhook signature using official protocol
		const signatureVersion = req.headers.get('x-bunnystream-signature-version') ?? req.headers.get('bunny-signature-version')
		const signatureAlgorithm = req.headers.get('x-bunnystream-signature-algorithm') ?? req.headers.get('bunny-signature-algorithm')
		const signature = req.headers.get('x-bunnystream-signature') ?? req.headers.get('bunny-signature')
		const secret = process.env.BUNNY_STREAM_WEBHOOK_SECRET

		if (!signature) {
			console.warn('Bunny webhook missing signature header')
			return NextResponse.json({ error: 'Missing signature header' }, { status: 403 })
		}

		if (signatureVersion && signatureVersion !== 'v1') {
			console.warn('Bunny webhook unsupported signature version', { version: signatureVersion })
			return NextResponse.json({ error: 'Unsupported signature version' }, { status: 403 })
		}

		if (signatureAlgorithm && signatureAlgorithm !== 'hmac-sha256') {
			console.warn('Bunny webhook unsupported signature algorithm', { algorithm: signatureAlgorithm })
			return NextResponse.json({ error: 'Unsupported signature algorithm' }, { status: 403 })
		}

		if (!secret) {
			console.error('Bunny webhook secret not configured')
			return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 })
		}

		// Read raw body for signature verification (exact bytes matter)
		const rawBody = await req.text()

		// Verify HMAC-SHA256 signature using Read-Only API key with timing-safe comparison
		const expectedSignature = createHmac('sha256', secret).update(rawBody).digest('hex')

		// Normalize both signatures to lowercase hex for comparison
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
			VideoId?: number // Legacy compatibility only; current Bunny callbacks identify videos by VideoGuid.
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
			VideoGuid?: string // UUID used in CDN delivery URLs — must be stored
			TimeCreated?: string
			ErrorMessage?: string
		}

		const videoGuid = payload.VideoGuid?.trim() || null
		const legacyVideoId = Number.isFinite(payload.VideoId) ? Number(payload.VideoId) : null
		if (!videoGuid && legacyVideoId === null) {
			return NextResponse.json({ error: 'Missing Bunny video identifier' }, { status: 400 })
		}

		const payload_inst = await getPayload({ config })

		// Build thumbnail URL using configured CDN hostname if available
		const cdnHostname = process.env.BUNNY_STREAM_HOSTNAME || 'cdn.bunnycdn.com'
		const thumbnailUrl = payload.ThumbnailFileName && videoGuid
			? `https://${cdnHostname}/${videoGuid}/${payload.ThumbnailFileName}`
			: null

		// Map webhook event type to internal status
		let videoStatus = 'processing'
		let errorMessage: string | null = null

		if (payload.Type === 'VideoFinishedProcessing') {
			videoStatus = 'ready'
		} else if (payload.Type === 'VideoFailedProcessing' || payload.Type === 'VideoTranscodeFailed') {
			videoStatus = 'failed'
			errorMessage = payload.ErrorMessage || `${payload.Type} occurred`
		}

		// Current Bunny callbacks are GUID-first. Numeric videoId remains a legacy fallback only.
		const identifierWhere = videoGuid
			? {
				and: [
					{ libraryId: { equals: payload.VideoLibraryId } },
					{ videoGuid: { equals: videoGuid } },
				],
			}
			: {
				and: [
					{ libraryId: { equals: payload.VideoLibraryId } },
					{ videoId: { equals: legacyVideoId } },
				],
			}

		let existingVideo: any = null
		try {
			const result = await payload_inst.find({
				collection: 'bunny_videos' as any,
				where: identifierWhere as any,
				limit: 1,
				overrideAccess: true,
			})
			existingVideo = result.docs?.[0]
		} catch (err) {
			console.error('Failed to query existing bunny_videos', { error: String(err) })
			// existingVideo stays null — conflict-retry path below handles this
		}

		// Build webhook event record
		const webhookEvent = {
			type: payload.Type,
			timestamp: new Date().toISOString(),
			status: videoStatus,
			...(errorMessage && { error: errorMessage }),
		}

		// Build video data, appending new event to prior event log.
		const buildVideoData = (prior: any): Record<string, unknown> => ({
			title: payload.VideoTitle || `Video ${videoGuid || legacyVideoId || 'unknown'}`,
			libraryId: payload.VideoLibraryId,
			...(videoGuid
				? { videoGuid }
				: prior?.videoGuid
					? { videoGuid: prior.videoGuid }
					: {}),
			...(legacyVideoId !== null
				? { videoId: legacyVideoId }
				: prior?.videoId !== undefined && prior?.videoId !== null
					? { videoId: prior.videoId }
					: {}),
			status: videoStatus,
			duration: payload.Duration || null,
			frameRate: payload.FrameRate || null,
			width: payload.Width || null,
			height: payload.Height || null,
			videoCodec: payload.VideoCodec || null,
			audioCodec: payload.AudioCodec || null,
			bitrate: payload.Bitrate || null,
			thumbnailUrl: thumbnailUrl || null,
			playbackUrl: null as string | null,
			errorMessage: errorMessage || null,
			webhookEvents: prior?.webhookEvents
				? [...(Array.isArray(prior.webhookEvents) ? prior.webhookEvents : []), webhookEvent]
				: [webhookEvent],
		})

		// Upsert: update if exists, create if not; retry on unique conflict
		try {
			if (existingVideo?.id) {
				await payload_inst.update({
					collection: 'bunny_videos' as any,
					id: existingVideo.id,
					data: buildVideoData(existingVideo),
					overrideAccess: true,
				})
				console.log(`Updated bunny_videos record ${existingVideo.id} for video ${videoGuid || legacyVideoId}`)
			} else {
				try {
					await payload_inst.create({
						collection: 'bunny_videos' as any,
						data: buildVideoData(null),
						overrideAccess: true,
					})
					console.log(`Created bunny_videos record for video ${videoGuid || legacyVideoId}`)
				} catch (createErr: any) {
					// Unique constraint violation — find failed silently, record already exists.
					const msg = String(createErr?.message ?? createErr ?? '')
					const isConflict =
						createErr?.code === '23505' ||
						msg.toLowerCase().includes('unique') ||
						msg.toLowerCase().includes('duplicate')

					if (!isConflict) throw createErr

					console.warn('bunny_videos create hit unique conflict; retrying as update', {
						libraryId: payload.VideoLibraryId,
						videoGuid,
						legacyVideoId,
					})

					const retry = await payload_inst.find({
						collection: 'bunny_videos' as any,
						where: identifierWhere as any,
						limit: 1,
						overrideAccess: true,
					})
					const found = retry.docs?.[0]
					if (!found?.id) throw createErr

					await payload_inst.update({
						collection: 'bunny_videos' as any,
						id: found.id,
						data: buildVideoData(found),
						overrideAccess: true,
					})
					console.log(`Conflict-resolved update for bunny_videos record ${found.id}, video ${videoGuid || legacyVideoId}`)
				}
			}
		} catch (err) {
			console.error('Failed to persist bunny_videos', { error: String(err) })
			// Return 500 so Bunny retries later
			return NextResponse.json(
				{ ok: false, error: 'Failed to persist video metadata' },
				{ status: 500 }
			)
		}

		return NextResponse.json({ ok: true })
	} catch (error) {
		console.error('Bunny webhook error:', error)

		// Return 500 for internal errors (allows Bunny to retry)
		// Parse errors, auth failures return 400/403 (no retry)
		const isRetryable = !(error instanceof SyntaxError)
		const status = isRetryable ? 500 : 400

		return NextResponse.json(
			{ ok: false, error: 'internal_error' },
			{ status }
		)
	}
}
