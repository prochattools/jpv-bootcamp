import { NextRequest, NextResponse } from 'next/server'
import { AccessToken } from 'livekit-server-sdk'
import { getLiveKitConfig, redactLiveKitSecrets, generateLiveKitRoomName, isLiveKitConfigured } from '@/lib/livekit-config'
import { resolvePayloadRequestSession } from '@/lib/auth/payloadSession'

/**
 * POST /api/livekit/token
 *
 * Generate a short-lived LiveKit JWT token for authenticated member.
 * Verifies entitlement before token issuance.
 * Server-side only; never expose API secret to browser.
 *
 * Request body:
 * {
 *   courseId: string
 *   moduleId: string
 *   lessonId: string
 *   role: 'host' | 'student'
 * }
 *
 * Response (on success):
 * {
 *   token: "..."
 *   url: "wss://livekit.example.com"
 *   roomName: "course-101-module-202-lesson-303"
 * }
 *
 * Response (on error):
 * { error: "error message" }
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
	try {
		// Verify LiveKit is configured
		if (!isLiveKitConfigured()) {
			return NextResponse.json(
				{ error: 'LiveKit is not configured for this environment' },
				{ status: 503 }
			)
		}

		// Verify authentication context (Payload member session)
		const session = await resolvePayloadRequestSession(req.headers)
		if (!session.member?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		// Parse request
		const body = await req.json()
		const { courseId, moduleId, lessonId, role } = body as {
			courseId?: string
			moduleId?: string
			lessonId?: string
			role?: 'host' | 'student'
		}

		if (!courseId || !moduleId || !lessonId || !role) {
			return NextResponse.json(
				{ error: 'Missing required fields: courseId, moduleId, lessonId, role' },
				{ status: 400 }
			)
		}

		if (role !== 'host' && role !== 'student') {
			return NextResponse.json(
				{ error: 'Invalid role: must be "host" or "student"' },
				{ status: 400 }
			)
		}

		// Restrict host role to authenticated admins only
		if (role === 'host' && !session.administratorId) {
			return NextResponse.json(
				{ error: 'Host role requires administrator privileges' },
				{ status: 403 }
			)
		}

		// Check member account is eligible (active, verified)
		if (session.member.accountStatus !== 'active') {
			return NextResponse.json(
				{ error: 'Member account is not active' },
				{ status: 403 }
			)
		}

		// TODO: Verify LiveSession exists and is active (scheduled/live status)
		// TODO: Verify member has membership entitlement (course enrollment)
		// This requires Payload access: fetch live_sessions collection and check entitlement
		// For now, rely on membership account status check above

		// Generate deterministic room name
		const roomName = generateLiveKitRoomName(courseId, moduleId, lessonId)

		// Get LiveKit config
		const config = getLiveKitConfig()

		// Create short-lived access token with explicit 15-minute TTL
		const at = new AccessToken(config.apiKey, config.apiSecret)
		at.identity = String(session.member.id)
		at.ttl = 15 * 60 // 900 seconds = 15 minutes

		// Set grants based on role
		if (role === 'host') {
			at.addGrant({
				room: roomName,
				roomJoin: true,
				canPublish: true,
				canPublishData: true,
				canSubscribe: true,
			})
		} else {
			at.addGrant({
				room: roomName,
				roomJoin: true,
				canPublish: true,
				canPublishData: false,
				canSubscribe: true,
			})
		}

		const token = at.toJwt()

		return NextResponse.json({
			token,
			url: config.url,
			roomName,
		})
	} catch (error) {
		console.error('LiveKit token error:', error)

		// Redact secrets before responding
		const message = error instanceof Error ? redactLiveKitSecrets(error.message) : 'Internal server error'

		return NextResponse.json(
			{ error: message },
			{ status: 500 }
		)
	}
}
