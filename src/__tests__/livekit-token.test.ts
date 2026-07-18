import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { POST as postLiveKitToken } from '@/app/api/livekit/token/route'

// Mock dependencies
vi.mock('@/lib/livekit-config', () => ({
	getLiveKitConfig: vi.fn(() => ({
		url: 'wss://livekit-staging.example.com',
		apiKey: 'test-api-key',
		apiSecret: 'test-api-secret',
	})),
	redactLiveKitSecrets: vi.fn((text: string) => text.replace(/secret/gi, '***')),
	generateLiveKitRoomName: vi.fn((courseId, moduleId, lessonId) => `course-${courseId}-module-${moduleId}-lesson-${lessonId}`),
	isLiveKitConfigured: vi.fn(() => true),
}))

vi.mock('@/lib/auth/payloadSession', () => ({
	resolvePayloadRequestSession: vi.fn(),
}))

vi.mock('@/lib/entitlements/membershipEntitlement', () => ({
	evaluateMembershipEntitlement: vi.fn(),
}))

vi.mock('payload', () => ({
	getPayload: vi.fn(),
}))

vi.mock('livekit-server-sdk', () => ({
	AccessToken: class MockAccessToken {
		identity: string = ''
		grants: any = {}

		constructor(apiKey: string, apiSecret: string) {}

		addGrant(grant: any) {
			this.grants = grant
		}

		toJwt() {
			return 'mock-jwt-token-12345'
		}
	},
}))

const { resolvePayloadRequestSession } = require('@/lib/auth/payloadSession')
const { evaluateMembershipEntitlement } = require('@/lib/entitlements/membershipEntitlement')
const { getPayload } = require('payload')

describe('POST /api/livekit/token', () => {
	const mockHeaders = new Headers({
		'content-type': 'application/json',
	})

	beforeEach(() => {
		vi.clearAllMocks()
	})

	it('returns 401 when member not authenticated', async () => {
		resolvePayloadRequestSession.mockResolvedValue({
			member: null,
			administratorId: null,
		})

		const req = new NextRequest('http://localhost:3000/api/livekit/token', {
			method: 'POST',
			headers: mockHeaders,
			body: JSON.stringify({
				sessionId: '1',
				role: 'student',
			}),
		})

		const res = await postLiveKitToken(req)
		const data = await res.json()

		expect(res.status).toBe(401)
		expect(data.error).toBe('Unauthorized')
	})

	it('returns 400 when missing required fields', async () => {
		resolvePayloadRequestSession.mockResolvedValue({
			member: { id: '123', accountStatus: 'active' },
			administratorId: null,
		})

		const req = new NextRequest('http://localhost:3000/api/livekit/token', {
			method: 'POST',
			headers: mockHeaders,
			body: JSON.stringify({
				sessionId: '1',
				// missing role
			}),
		})

		const res = await postLiveKitToken(req)
		const data = await res.json()

		expect(res.status).toBe(400)
		expect(data.error).toContain('Missing required fields')
	})

	it('returns 400 when role is invalid', async () => {
		resolvePayloadRequestSession.mockResolvedValue({
			member: { id: '123', accountStatus: 'active' },
			administratorId: null,
		})

		const req = new NextRequest('http://localhost:3000/api/livekit/token', {
			method: 'POST',
			headers: mockHeaders,
			body: JSON.stringify({
				sessionId: '1',
				role: 'invalid-role',
			}),
		})

		const res = await postLiveKitToken(req)
		const data = await res.json()

		expect(res.status).toBe(400)
		expect(data.error).toContain('Invalid role')
	})

	it('returns 403 when member tries to request host role', async () => {
		resolvePayloadRequestSession.mockResolvedValue({
			member: { id: '123', accountStatus: 'active' },
			administratorId: null, // not an admin
		})

		const req = new NextRequest('http://localhost:3000/api/livekit/token', {
			method: 'POST',
			headers: mockHeaders,
			body: JSON.stringify({
				sessionId: '1',
				role: 'host',
			}),
		})

		const res = await postLiveKitToken(req)
		const data = await res.json()

		expect(res.status).toBe(403)
		expect(data.error).toContain('Host role requires administrator privileges')
	})

	it('returns 403 when member account is not active', async () => {
		resolvePayloadRequestSession.mockResolvedValue({
			member: { id: '123', accountStatus: 'suspended' },
			administratorId: null,
		})

		const req = new NextRequest('http://localhost:3000/api/livekit/token', {
			method: 'POST',
			headers: mockHeaders,
			body: JSON.stringify({
				sessionId: '1',
				role: 'student',
			}),
		})

		const res = await postLiveKitToken(req)
		const data = await res.json()

		expect(res.status).toBe(403)
		expect(data.error).toContain('Member account is not active')
	})

	it('returns 404 when live session not found', async () => {
		resolvePayloadRequestSession.mockResolvedValue({
			member: { id: '123', accountStatus: 'active' },
			administratorId: null,
		})

		const mockPayload = {
			findByID: vi.fn().mockRejectedValue(new Error('Not found')),
		}
		getPayload.mockResolvedValue(mockPayload)

		const req = new NextRequest('http://localhost:3000/api/livekit/token', {
			method: 'POST',
			headers: mockHeaders,
			body: JSON.stringify({
				sessionId: '999',
				role: 'student',
			}),
		})

		const res = await postLiveKitToken(req)
		const data = await res.json()

		expect(res.status).toBe(404)
		expect(data.error).toContain('Live session not found')
	})

	it('returns 403 when session is not scheduled/live', async () => {
		resolvePayloadRequestSession.mockResolvedValue({
			member: { id: '123', accountStatus: 'active' },
			administratorId: null,
		})

		const mockPayload = {
			findByID: vi.fn().mockResolvedValue({
				id: '1',
				status: 'completed',
				course: '101',
				scheduledAt: new Date().toISOString(),
			}),
		}
		getPayload.mockResolvedValue(mockPayload)

		const req = new NextRequest('http://localhost:3000/api/livekit/token', {
			method: 'POST',
			headers: mockHeaders,
			body: JSON.stringify({
				sessionId: '1',
				role: 'student',
			}),
		})

		const res = await postLiveKitToken(req)
		const data = await res.json()

		expect(res.status).toBe(403)
		expect(data.error).toContain('not available for joining')
	})

	it('returns token with student permissions when member is entitled', async () => {
		const now = new Date()
		resolvePayloadRequestSession.mockResolvedValue({
			member: { id: '123', accountStatus: 'active' },
			administratorId: null,
		})

		const mockPayload = {
			findByID: vi.fn()
				.mockResolvedValueOnce({
					id: '1',
					status: 'live',
					course: '101',
					roomName: 'course-101-module-202-lesson-303',
					scheduledAt: new Date(now.getTime() - 5 * 60000).toISOString(),
				})
				.mockResolvedValueOnce({
					id: '123',
					membership: {
						lifecycleState: 'active',
						subscriptionStatus: 'active',
					},
				}),
		}
		getPayload.mockResolvedValue(mockPayload)

		evaluateMembershipEntitlement.mockReturnValue({
			decision: 'allowed',
			reason: 'active_direct_membership',
		})

		const req = new NextRequest('http://localhost:3000/api/livekit/token', {
			method: 'POST',
			headers: mockHeaders,
			body: JSON.stringify({
				sessionId: '1',
				role: 'student',
			}),
		})

		const res = await postLiveKitToken(req)
		const data = await res.json()

		expect(res.status).toBe(200)
		expect(data.token).toBe('mock-jwt-token-12345')
		expect(data.url).toBe('wss://livekit-staging.example.com')
		expect(data.roomName).toBe('course-101-module-202-lesson-303')
	})

	it('returns token with host permissions for admin', async () => {
		const now = new Date()
		resolvePayloadRequestSession.mockResolvedValue({
			member: { id: '999', accountStatus: 'active' },
			administratorId: 'admin-123',
		})

		const mockPayload = {
			findByID: vi.fn().mockResolvedValue({
				id: '1',
				status: 'scheduled',
				course: '101',
				roomName: 'course-101-module-202-lesson-303',
				scheduledAt: new Date(now.getTime() + 2 * 60000).toISOString(),
			}),
		}
		getPayload.mockResolvedValue(mockPayload)

		const req = new NextRequest('http://localhost:3000/api/livekit/token', {
			method: 'POST',
			headers: mockHeaders,
			body: JSON.stringify({
				sessionId: '1',
				role: 'host',
			}),
		})

		const res = await postLiveKitToken(req)
		const data = await res.json()

		expect(res.status).toBe(200)
		expect(data.token).toBe('mock-jwt-token-12345')
		expect(data.roomName).toBe('course-101-module-202-lesson-303')
	})

	it('returns 503 when LiveKit not configured', async () => {
		const { isLiveKitConfigured } = require('@/lib/livekit-config')
		isLiveKitConfigured.mockReturnValueOnce(false)

		resolvePayloadRequestSession.mockResolvedValue({
			member: { id: '123', accountStatus: 'active' },
			administratorId: null,
		})

		const req = new NextRequest('http://localhost:3000/api/livekit/token', {
			method: 'POST',
			headers: mockHeaders,
			body: JSON.stringify({
				sessionId: '1',
				role: 'student',
			}),
		})

		const res = await postLiveKitToken(req)
		const data = await res.json()

		expect(res.status).toBe(503)
		expect(data.error).toContain('not configured')
	})

	it('returns 403 when member has no entitlement', async () => {
		const now = new Date()
		resolvePayloadRequestSession.mockResolvedValue({
			member: { id: '123', accountStatus: 'active' },
			administratorId: null,
		})

		const mockPayload = {
			findByID: vi.fn()
				.mockResolvedValueOnce({
					id: '1',
					status: 'live',
					course: '101',
					roomName: 'course-101-module-202-lesson-303',
					scheduledAt: new Date(now.getTime() - 5 * 60000).toISOString(),
				})
				.mockResolvedValueOnce({
					id: '123',
					membership: {
						lifecycleState: 'cancelled',
						subscriptionStatus: 'cancelled',
					},
				}),
		}
		getPayload.mockResolvedValue(mockPayload)

		evaluateMembershipEntitlement.mockReturnValue({
			decision: 'denied',
			reason: 'cancelled_after_period_end',
		})

		const req = new NextRequest('http://localhost:3000/api/livekit/token', {
			method: 'POST',
			headers: mockHeaders,
			body: JSON.stringify({
				sessionId: '1',
				role: 'student',
			}),
		})

		const res = await postLiveKitToken(req)
		const data = await res.json()

		expect(res.status).toBe(403)
		expect(data.error).toContain('Not entitled')
	})
})
