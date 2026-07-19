import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { resolvePayloadRequestSession } from '@/lib/auth/payloadSession'
import {
	resolveBunnyProtectedPlayback,
	InMemoryBunnyProtectedMediaAdapter,
	type BunnyProtectedVideo,
} from '@/lib/payloadCourse/bunnyProtectedMedia'

/**
 * GET /api/bunny/video?lessonId=<id>
 *
 * Generate a server-signed Bunny Stream playback token for an authenticated member.
 * Verifies membership entitlement, looks up the video record, and returns signed playback credentials.
 * Server-side only; never expose API secret to browser.
 *
 * Query:
 *   lessonId: string (lesson collection ID for the course lesson)
 *
 * Response (on success):
 * {
 *   available: true
 *   provider: "bunny_stream"
 *   status: "ready"
 *   lessonId: string
 *   videoId: string
 *   libraryId: string
 *   playbackAssetId: string
 *   thumbnailUrl: string | null
 *   expiresAt: string (ISO8601)
 *   token: string (hex-encoded signing token)
 * }
 *
 * Response (on entitlement/availability issues):
 * {
 *   available: false
 *   provider: "bunny_stream"
 *   status: "denied" | "missing" | "processing" | "failed" | "misconfigured" | "expired"
 *   lessonId?: string
 *   diagnostics?: Record<string, unknown>
 * }
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
	try {
		const session = await resolvePayloadRequestSession(req.headers)

		// Require authenticated member
		if (!session.member?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		// Member account must be active
		if (session.member.accountStatus !== 'active') {
			return NextResponse.json(
				{ error: 'Member account is not active' },
				{ status: 403 },
			)
		}

		const { searchParams } = new URL(req.url)
		const lessonId = searchParams.get('lessonId')

		if (!lessonId) {
			return NextResponse.json(
				{ error: 'Missing required query parameter: lessonId' },
				{ status: 400 },
			)
		}

		const payload = await getPayload({ config })
		const now = new Date()

		// Fetch subscription for entitlement check
		type SubscriptionDoc = {
			id: string | number
			status?: string
			currentPeriodEnd?: Date | string
			cancelAtPeriodEnd?: boolean
			fundingSource?: string
		}

		let subscription: SubscriptionDoc | null = null
		try {
			const subResult = await payload.find({
				collection: 'payload_subscriptions' as any,
				where: { member: { equals: session.member.id } },
				limit: 1,
				overrideAccess: true,
			})
			subscription = (subResult.docs?.[0] as SubscriptionDoc) ?? null
		} catch (err) {
			console.warn('Failed to fetch subscription for entitlement', {
				memberId: session.member.id,
				error: err,
			})
		}

		// Build entitlement input
		const status = subscription?.status ?? null
		const lifecycleState: 'active' | 'past_due' | 'cancelled' | null =
			status === 'active' || status === 'trialing'
				? 'active'
				: status === 'past_due'
					? 'past_due'
					: status === 'canceled'
						? 'cancelled'
						: null

		// Fetch video by lesson ID
		type BunnyVideoDoc = {
			id: string | number
			videoId: string | number
			libraryId: string | number
			lessonId: string | number
			status: 'processing' | 'ready' | 'failed'
			title: string
			playbackAssetId: string
			thumbnailUrl: string | null
			errorMessage?: string | null
		}

		let video: BunnyVideoDoc | null = null
		try {
			const videoResult = await payload.find({
				collection: 'bunny_videos' as any,
				where: { lessonId: { equals: lessonId } },
				limit: 1,
				overrideAccess: true,
			})
			video = (videoResult.docs?.[0] as BunnyVideoDoc) ?? null
		} catch (err) {
			console.warn('Failed to fetch bunny_videos by lesson', { lessonId, error: err })
		}

		// Prepare Bunny config from environment
		const config_bunny = {
			streamHostname: process.env.BUNNY_STREAM_HOSTNAME || null,
			signingKey: process.env.BUNNY_STREAM_SIGNING_KEY || null,
			tokenTtlSeconds: process.env.BUNNY_STREAM_TOKEN_TTL_SECONDS
				? parseInt(process.env.BUNNY_STREAM_TOKEN_TTL_SECONDS, 10)
				: 900,
		}

		// Build a test adapter with the video if found (or empty list if not)
		const videoList: BunnyProtectedVideo[] = video
			? [
					{
						provider: 'bunny_stream' as const,
						videoId: String(video.videoId),
						libraryId: String(video.libraryId),
						lessonId: String(video.lessonId),
						title: video.title,
						playbackAssetId: video.playbackAssetId,
						thumbnailUrl: video.thumbnailUrl,
						status: video.status,
					},
				]
			: []

		const adapter = new InMemoryBunnyProtectedMediaAdapter({
			videos: videoList,
			signingKey: config_bunny.signingKey || '',
		})

		// Resolve playback using the same logic as server-side rendering
		const projection = await resolveBunnyProtectedPlayback({
			adapter,
			config: config_bunny,
			lessonId,
			memberId: String(session.member.id),
			entitlement: {
				subscriptionStatus: status,
				lifecycleState,
				periodEnd: subscription?.currentPeriodEnd || null,
				cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? null,
				fundingSource: (subscription?.fundingSource as any) || 'direct_payment',
			},
			now,
		})

		// Return projection directly (may be available: true or false with diagnostic info)
		return NextResponse.json(projection)
	} catch (error) {
		console.error('Bunny video playback error:', error)
		const message = error instanceof Error ? error.message : 'Internal server error'
		return NextResponse.json({ error: message }, { status: 500 })
	}
}
