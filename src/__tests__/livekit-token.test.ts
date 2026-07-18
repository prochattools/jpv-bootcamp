import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
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
				courseId: '1',
				moduleId: '2',
				lessonId: '3',
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
				courseId: '1',
				// missing moduleId, lessonId, role
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
				courseId: '1',
				moduleId: '2',
				lessonId: '3',
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
				courseId: '1',
				moduleId: '2',
				lessonId: '3',
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
				courseId: '1',
				moduleId: '2',
				lessonId: '3',
				role: 'student',
			}),
		})

		const res = await postLiveKitToken(req)
		const data = await res.json()

		expect(res.status).toBe(403)
		expect(data.error).toContain('Member account is not active')
	})

	it('returns token with student permissions', async () => {
		resolvePayloadRequestSession.mockResolvedValue({
			member: { id: '123', accountStatus: 'active' },
			administratorId: null,
		})

		const req = new NextRequest('http://localhost:3000/api/livekit/token', {
			method: 'POST',
			headers: mockHeaders,
			body: JSON.stringify({
				courseId: '101',
				moduleId: '202',
				lessonId: '303',
				role: 'student',
			}),
		})

		const res = await postLiveKitToken(req)
		const data = await res.json()

		expect(res.status).toBe(200)
		expect(data.token).toBeDefined()
		expect(data.url).toBe('wss://livekit-staging.example.com')
		expect(data.roomName).toBe('course-101-module-202-lesson-303')
	})

	it('returns token with host permissions for admin', async () => {
		resolvePayloadRequestSession.mockResolvedValue({
			member: { id: '999', accountStatus: 'active' },
			administratorId: 'admin-123',
		})

		const req = new NextRequest('http://localhost:3000/api/livekit/token', {
			method: 'POST',
			headers: mockHeaders,
			body: JSON.stringify({
				courseId: '101',
				moduleId: '202',
				lessonId: '303',
				role: 'host',
			}),
		})

		const res = await postLiveKitToken(req)
		const data = await res.json()

		expect(res.status).toBe(200)
		expect(data.token).toBeDefined()
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
				courseId: '1',
				moduleId: '2',
				lessonId: '3',
				role: 'student',
			}),
		})

		const res = await postLiveKitToken(req)
		const data = await res.json()

		expect(res.status).toBe(503)
		expect(data.error).toContain('not configured')
	})
})
