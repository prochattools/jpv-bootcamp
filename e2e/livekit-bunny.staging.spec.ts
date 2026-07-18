import { test, expect } from '@playwright/test'

const STAGING_URL = process.env.E2E_BASE_URL || 'http://127.0.0.1:3107'

test.describe('LiveKit and Bunny Staging Integration', () => {
  // LiveKit E2E Tests
  test.describe('LiveKit Token Generation', () => {
    test('LIVEKIT-001: Member can request student token', async ({ request }) => {
      // Test data: typical session ID and member role
      const sessionId = 'test-session-001'
      const response = await request.post(`${STAGING_URL}/api/livekit/token`, {
        data: {
          sessionId,
          role: 'student',
        },
      })

      // Should return 200 or 403 (depends on auth/entitlement, but not 500)
      if (response.status() === 200) {
        const body = await response.json()
        expect(body).toHaveProperty('token')
        expect(body).toHaveProperty('url')
        expect(body).toHaveProperty('roomName')
        expect(body.url).toContain('livekit')
        expect(body.roomName).toMatch(/course-\d+-module-\d+-lesson-\d+/)
      } else if (response.status() === 401 || response.status() === 403) {
        // Expected if not authenticated or not entitled
        const body = await response.json()
        expect(body.error).toBeDefined()
      } else {
        throw new Error(`Unexpected status ${response.status()}`)
      }
    })

    test('LIVEKIT-002: Host role requires admin privileges', async ({ request }) => {
      const response = await request.post(`${STAGING_URL}/api/livekit/token`, {
        data: {
          sessionId: 'test-session-002',
          role: 'host',
        },
      })

      // Should reject with 401/403 (no admin auth)
      expect([401, 403]).toContain(response.status())
      const body = await response.json()
      expect(body.error).toBeDefined()
    })

    test('LIVEKIT-003: Missing required fields rejected', async ({ request }) => {
      const response = await request.post(`${STAGING_URL}/api/livekit/token`, {
        data: {
          sessionId: 'test-session-003',
          // missing role
        },
      })

      expect(response.status()).toBe(400)
      const body = await response.json()
      expect(body.error).toContain('Missing required fields')
    })

    test('LIVEKIT-004: Invalid role rejected', async ({ request }) => {
      const response = await request.post(`${STAGING_URL}/api/livekit/token`, {
        data: {
          sessionId: 'test-session-004',
          role: 'invalid',
        },
      })

      expect(response.status()).toBe(400)
      const body = await response.json()
      expect(body.error).toContain('Invalid role')
    })
  })

  // Bunny Webhook E2E Tests
  test.describe('Bunny Webhook Handling', () => {
    test('BUNNY-001: Valid VideoFinishedProcessing webhook accepted', async ({ request }) => {
      const payload = {
        Type: 'VideoFinishedProcessing',
        VideoLibraryId: 1,
        VideoId: 99999,
        VideoTitle: 'E2E Test Video',
        Duration: 300,
        VideoCodec: 'h264',
      }

      const secret = process.env.BUNNY_WEBHOOK_SECRET || 'test-secret'
      const crypto = require('crypto')
      const body = JSON.stringify(payload)
      const signature = crypto.createHmac('sha256', secret).update(body).digest('hex')

      const response = await request.post(`${STAGING_URL}/api/webhook/bunny`, {
        headers: {
          'content-type': 'application/json',
          'bunny-signature': signature,
        },
        data: payload,
      })

      expect(response.status()).toBe(200)
      const result = await response.json()
      expect(result.ok).toBe(true)
    })

    test('BUNNY-002: Missing signature rejected with 403', async ({ request }) => {
      const payload = {
        Type: 'VideoFinishedProcessing',
        VideoLibraryId: 1,
        VideoId: 99998,
      }

      const response = await request.post(`${STAGING_URL}/api/webhook/bunny`, {
        headers: { 'content-type': 'application/json' },
        data: payload,
      })

      expect(response.status()).toBe(403)
      const body = await response.json()
      expect(body.error).toContain('signature')
    })

    test('BUNNY-003: Invalid signature rejected with 403', async ({ request }) => {
      const payload = {
        Type: 'VideoFinishedProcessing',
        VideoLibraryId: 1,
        VideoId: 99997,
      }

      const response = await request.post(`${STAGING_URL}/api/webhook/bunny`, {
        headers: {
          'content-type': 'application/json',
          'bunny-signature': 'invalid-signature-hash',
        },
        data: payload,
      })

      expect(response.status()).toBe(403)
      const body = await response.json()
      expect(body.error).toContain('Signature verification failed')
    })

    test('BUNNY-004: Malformed JSON handled gracefully', async ({ request }) => {
      const secret = process.env.BUNNY_WEBHOOK_SECRET || 'test-secret'
      const crypto = require('crypto')
      const body = 'not valid json'
      const signature = crypto.createHmac('sha256', secret).update(body).digest('hex')

      const response = await request.post(`${STAGING_URL}/api/webhook/bunny`, {
        headers: {
          'content-type': 'application/json',
          'bunny-signature': signature,
        },
        data: body,
      })

      // Should return 200 to prevent webhook retries
      expect(response.status()).toBe(200)
    })
  })

  // UI Navigation Tests
  test.describe('LiveKit and Bunny UI Pages', () => {
    test('LIVEKIT-UI-001: Join session page loads', async ({ page }) => {
      await page.goto(`${STAGING_URL}/courses/101/sessions/session-001/join`, {
        waitUntil: 'domcontentloaded',
      })

      await expect(page.locator('text=Join Live Session')).toBeVisible()
      await expect(page.locator('select')).toBeVisible() // Role selector
    })

    test('BUNNY-UI-001: Video page loads', async ({ page }) => {
      await page.goto(`${STAGING_URL}/courses/101/videos/video-001`, {
        waitUntil: 'domcontentloaded',
      })

      // Page should load without errors
      const response = await page.goto(`${STAGING_URL}/courses/101/videos/video-001`)
      expect(response?.status()).not.toBe(500)
    })
  })
})
