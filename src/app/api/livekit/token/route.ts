import { NextRequest, NextResponse } from 'next/server'
// import { AccessToken } from 'livekit-server-sdk' // Install when implementing: pnpm add livekit-server-sdk
import { getLiveKitConfig, redactLiveKitSecrets, generateLiveKitRoomName, isLiveKitConfigured } from '@/lib/livekit-config'

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
 *   token: "eyJhbGci..."
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

		// TODO: Verify authentication context (Clerk or Payload auth)
		// const session = await getSession(req)
		// if (!session?.user?.id) {
		//   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		// }

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

		// TODO: Verify member entitlement
		// - Check member is active (not suspended/deleted)
		// - Check member has access to this course
		// - Check member is enrolled in this lesson
		// const entitlement = await verifyMemberEntitlement(session.user.id, courseId, lessonId)
		// if (!entitlement.hasAccess) {
		//   return NextResponse.json({ error: 'Access denied' }, { status: 403 })
		// }

		// Generate room name
		const roomName = generateLiveKitRoomName(courseId, moduleId, lessonId)

		// Get LiveKit config
		const config = getLiveKitConfig()

		// Create short-lived token
		// TODO: Uncomment when livekit-server-sdk is installed
		// const at = new AccessToken(config.apiKey, config.apiSecret)

		// TODO: Set member identity
		// at.identity = session.user.id

		// TODO: Set grants based on role
		// if (role === 'host') {
		//   at.addGrant({
		//     room: roomName,
		//     roomJoin: true,
		//     canPublish: true,
		//     canPublishData: true,
		//     canSubscribe: true,
		//   })
		// } else {
		//   at.addGrant({
		//     room: roomName,
		//     roomJoin: true,
		//     canPublish: true, // students can share audio/video
		//     canPublishData: false, // no direct data channel
		//     canSubscribe: true,
		//   })
		// }

		// Set expiry (15 minutes for safety)
		// TODO: Uncomment when livekit-server-sdk is installed
		// const token = at.toJwt()
		const token = 'placeholder-token' // TODO: Remove placeholder

		// TODO: Audit token issuance
		// await auditLiveKitToken({
		//   userId: session.user.id,
		//   sessionId: roomName,
		//   timestamp: new Date(),
		//   action: 'token_issued',
		//   role,
		// })

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
