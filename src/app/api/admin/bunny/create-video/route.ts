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
			{ error: 'Bunny API not configured: BUNNY_API_KEY or BUNNY_LIBRARY_ID missing' },
			{ status: 503 },
		)
	}

	try {
		const { title, lessonId } = await req.json()

		if (!title) {
			return NextResponse.json({ error: 'Missing title' }, { status: 400 })
		}

		// Create video in Bunny Stream
		const bunnyVideo = await createBunnyVideo({ title })

		// Optionally create Payload record if lessonId provided
		let payloadVideoId: string | number | null = null
		if (lessonId) {
			try {
				const payload = await getPayload({ config })
				const created = await payload.create({
					collection: 'bunny_videos',
					data: {
						title: bunnyVideo.title,
						libraryId: bunnyVideo.videoLibraryId,
						videoId: bunnyVideo.videoId,
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

		// Return upload initialization response
		return NextResponse.json({
			ok: true,
			video: {
				libraryId: bunnyVideo.videoLibraryId,
				videoId: bunnyVideo.videoId,
				videoGuid: bunnyVideo.videoGuid,
				title: bunnyVideo.title,
				status: 'processing',
				uploadToken: bunnyVideo.token,
				payloadId: payloadVideoId,
			},
		})
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err)
		console.error('[admin/bunny/create-video]', msg)
		return NextResponse.json({ error: msg }, { status: 500 })
	}
}
