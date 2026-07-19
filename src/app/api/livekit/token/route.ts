import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { jwtVerify } from 'jose'
import { AccessToken } from 'livekit-server-sdk'
import { getLiveKitConfig, redactLiveKitSecrets, generateLiveKitRoomName, isLiveKitConfigured } from '@/lib/livekit-config'
import { resolvePayloadRequestSession } from '@/lib/auth/payloadSession'
import { evaluateMembershipEntitlement } from '@/lib/entitlements/membershipEntitlement'
import type { PayloadRequestSession } from '@/lib/auth/payloadSessionMapping'

const LIVE_SESSION_TIME_WINDOW_MINUTES = 15

async function resolveSessionWithFallback(req: NextRequest): Promise<PayloadRequestSession> {
	const session = await resolvePayloadRequestSession(req.headers)
	if (session.member?.id || session.administratorId) return session

	const authHeader = req.headers.get('Authorization')
	if (!authHeader) return session

	// Strip JWT/Bearer prefix, normalize whitespace
	const token = authHeader.replace(/^(JWT|Bearer)\s+/i, '').trim()
	if (!token) return session

	const secret = process.env.PAYLOAD_SECRET
	if (!secret) return session

	try {
		const { payload: claims } = await jwtVerify(token, new TextEncoder().encode(secret))
		const col = (claims as any).collection as string | undefined
		const id = (claims as any).id as string | number | undefined
		if (!id) return session

		if (col === 'payload_users') {
			return { ...session, administratorId: id, authenticatedCollection: 'payload_users' }
		}
		if (col === 'payload_members') {
			return {
				...session,
				member: { id, accountStatus: null, emailVerifiedAt: null },
				authenticatedCollection: 'payload_members',
			}
		}
	} catch {
		// Invalid or expired JWT — fall through to unauthenticated
	}
	return session
}

/**
 * POST /api/livekit/token
 *
 * Generate a short-lived LiveKit JWT token for authenticated member.
 * Verifies LiveSession exists, member entitlement, and time window.
 * Server-side only; never expose API secret to browser.
 *
 * Request body:
 * {
 *   sessionId: string (live_sessions collection ID)
 *   role: 'host' | 'student'
 * }
 *
 * Response (on success):
 * {
 *   token: "eyJ..."
 *   url: "wss://livekit.example.com"
 *   roomName: "course-101-module-202-lesson-303"
 * }
 *
 * Response (on error):
 * { error: "error message" }
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
	try {
		if (!isLiveKitConfigured()) {
			return NextResponse.json(
				{ error: 'LiveKit is not configured for this environment' },
				{ status: 503 }
			)
		}

		const session = await resolveSessionWithFallback(req)

		// Require authenticated member OR authenticated admin (admin can host)
		if (!session.member?.id && !session.administratorId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		// Member-only: check account is active (admins skip this)
		if (session.member?.id && !session.administratorId) {
			if (session.member.accountStatus !== 'active') {
				return NextResponse.json(
					{ error: 'Member account is not active' },
					{ status: 403 }
				)
			}
		}

		const body = await req.json()
		const { sessionId, role } = body as { sessionId?: string; role?: 'host' | 'student' }

		if (!sessionId || !role) {
			return NextResponse.json(
				{ error: 'Missing required fields: sessionId, role' },
				{ status: 400 }
			)
		}

		if (role !== 'host' && role !== 'student') {
			return NextResponse.json(
				{ error: 'Invalid role: must be "host" or "student"' },
				{ status: 400 }
			)
		}

		// Host role requires admin
		if (role === 'host' && !session.administratorId) {
			return NextResponse.json(
				{ error: 'Host role requires administrator privileges' },
				{ status: 403 }
			)
		}

		const payload = await getPayload({ config })

		// Fetch LiveSession by ID
		type LiveSessionDoc = {
			id: string | number
			course?: { id: string | number } | string | number
			status?: string
			scheduledAt?: Date | string
			capacity?: number
			roomName?: string
			audit?: unknown
		}

		let liveSession: LiveSessionDoc | null = null
		try {
			// Use overrideAccess: true since we do our own entitlement check below
			liveSession = (await payload.findByID({
				collection: 'live_sessions' as any,
				id: sessionId,
				overrideAccess: true,
			})) as LiveSessionDoc
		} catch (err) {
			console.warn('Failed to load LiveSession', { sessionId, error: err })
		}

		if (!liveSession) {
			return NextResponse.json(
				{ error: 'Live session not found or access denied' },
				{ status: 404 }
			)
		}

		// Verify session status is scheduled or live
		if (liveSession.status !== 'scheduled' && liveSession.status !== 'live') {
			return NextResponse.json(
				{ error: `Session is ${liveSession.status || 'unknown'}, not available for joining` },
				{ status: 403 }
			)
		}

		// Verify session is within time window (scheduled to 15 min after scheduled time for live sessions)
		const now = new Date()
		const scheduledTime = new Date(liveSession.scheduledAt || 0)
		const windowEnd = new Date(scheduledTime.getTime() + LIVE_SESSION_TIME_WINDOW_MINUTES * 60 * 1000)

		if (liveSession.status === 'scheduled' && now < scheduledTime) {
			return NextResponse.json(
				{ error: 'Session has not started yet' },
				{ status: 403 }
			)
		}

		if (now > windowEnd) {
			return NextResponse.json(
				{ error: 'Session join window has closed' },
				{ status: 403 }
			)
		}

		// For students: verify course entitlement via payload_subscriptions
		if (role === 'student' && session.member?.id) {
			type SubscriptionDoc = {
				id: string | number
				status?: string
				currentPeriodEnd?: Date | string
				cancelAtPeriodEnd?: boolean
				fundingSource?: string
			}

			try {
				const subResult = await payload.find({
					collection: 'payload_subscriptions' as any,
					where: { member: { equals: session.member.id } },
					limit: 1,
					overrideAccess: true,
				})
				const sub = subResult.docs?.[0] as SubscriptionDoc | undefined

				if (!sub) {
					return NextResponse.json(
						{ error: 'No active membership found' },
						{ status: 403 }
					)
				}

				const entitlementResult = evaluateMembershipEntitlement({
					subscriptionStatus: sub.status || null,
					periodEnd: sub.currentPeriodEnd || null,
					cancelAtPeriodEnd: sub.cancelAtPeriodEnd ?? null,
					fundingSource: (sub.fundingSource as any) || 'direct_payment',
					now,
				})

				if (entitlementResult.decision !== 'allowed') {
					return NextResponse.json(
						{ error: `Not entitled to access courses: ${entitlementResult.reason}` },
						{ status: 403 }
					)
				}
			} catch (err) {
				console.warn('Failed to verify membership entitlement', { memberId: session.member.id, error: err })
				return NextResponse.json(
					{ error: 'Failed to verify membership' },
					{ status: 500 }
				)
			}
		}

		// Use stored roomName or generate new one
		const roomName = liveSession.roomName || generateLiveKitRoomName(
			String(liveSession.course),
			String(liveSession.id),
			'default'
		)

		const liveKitConfig = getLiveKitConfig()
		const at = new AccessToken(liveKitConfig.apiKey, liveKitConfig.apiSecret)
		// Admin host: identity is "admin:<id>"; member student: identity is member id
		at.identity = session.administratorId ? `admin:${session.administratorId}` : String(session.member!.id)
		at.ttl = 15 * 60

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
			url: liveKitConfig.url,
			roomName,
		})
	} catch (error) {
		console.error('LiveKit token error:', error)
		const message = error instanceof Error ? redactLiveKitSecrets(error.message) : 'Internal server error'
		return NextResponse.json({ error: message }, { status: 500 })
	}
}
