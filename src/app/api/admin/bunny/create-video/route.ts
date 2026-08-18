import { NextRequest, NextResponse } from 'next/server'
import { createBunnyVideo, isBunnyConfigured } from '@/lib/bunny-api'
import { getPayload } from 'payload'
import config from '@/payload.config'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
	// Admin-only gate: Simple token-based auth for admin API
	const authHeader = req.headers.get('authorization') || ''
	if (!authHeader.startsWith('Bearer ')) {
		return NextResponse.json({ error: 'Missing auth token' }, { status: 401 })
	}

	if (!isBunnyConfigured()) {
		return NextResponse.json(
			{ error: 'Bunny API not configured: provide BUNNY_API_KEY/BUNNY_LIBRARY_ID or BUNNY_STREAM_API_KEY/BUNNY_STREAM_LIBRARY_ID' },
			{ status: 503 },
		)
	}

	try {
		const { title, lessonId } = await req.json()

		if (!title) {
			return NextResponse.json({ error: 'Missing title' }, { status: 400 })
		}

		// Create video object in Bunny Stream. Bunny returns a GUID as the canonical identifier.
		const bunnyVideo = await createBunnyVideo({ title })

		// Optionally create Payload record if lessonId provided.
		let payloadVideoId: string | number | null = null
		if (lessonId) {
			try {
				const payload = await getPayload({ config })
				const created = await payload.create({
					collection: 'bunny_videos',
					data: {
						title: bunnyVideo.title,
						libraryId: bunnyVideo.videoLibraryId,
						videoGuid: bunnyVideo.videoGuid,
						lesson: lessonId,
						status: 'processing',
						webhookEvents: [
							{
								timestamp: new Date().toISOString(),
								type: 'video_created',
								event: 'Admin video creation',
							},
						],
					},
				})
				payloadVideoId = String(created.id)
			} catch (err) {
				console.warn('[admin/bunny/create-video] Payload record creation failed (video still created in Bunny)', err)
			}
		}

		// Keep `videoId` as a response alias for older callers, but its value is the canonical GUID.
		return NextResponse.json({
			ok: true,
			video: {
				libraryId: bunnyVideo.videoLibraryId,
				videoId: bunnyVideo.videoGuid,
				videoGuid: bunnyVideo.videoGuid,
				title: bunnyVideo.title,
				status: 'processing',
				uploadToken: null,
				payloadId: payloadVideoId,
			},
		})
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err)
		console.error('[admin/bunny/create-video]', msg)
		return NextResponse.json({ error: msg }, { status: 500 })
	}
}
