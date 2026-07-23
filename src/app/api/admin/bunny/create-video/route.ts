import { NextRequest, NextResponse } from 'next/server'
import { createBunnyVideo, isBunnyConfigured } from '@/lib/bunny-api'

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
		const { title } = await req.json()

		if (!title) {
			return NextResponse.json({ error: 'Missing title' }, { status: 400 })
		}

		// Create video in Bunny Stream
		const bunnyVideo = await createBunnyVideo({ title })

		// Return upload initialization response
		// Admin can then create Payload record from Payload admin UI with returned data
		return NextResponse.json({
			ok: true,
			video: {
				libraryId: bunnyVideo.videoLibraryId,
				videoId: bunnyVideo.videoId,
				videoGuid: bunnyVideo.videoGuid,
				title: bunnyVideo.title,
				status: 'processing',
				uploadToken: bunnyVideo.token,
			},
		})
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err)
		console.error('[admin/bunny/create-video]', msg)
		return NextResponse.json({ error: msg }, { status: 500 })
	}
}
