/**
 * Phase 9 — LiveKit Portal Browser Acceptance (staging)
 *
 * Verifies the full user journey through /portal/community/[spaceSlug]/calls
 * and /portal/community/[spaceSlug]/calls/[sessionId] against the staging
 * environment.
 *
 * Staging test data required:
 *   - live_session id=1, room=space-1-staging-qa-001, status=live, space_id=1
 *   - Space slug: start-here (id=1)
 *   - QA member: STAGING_QA_MEMBER_EMAIL / STAGING_QA_MEMBER_PASSWORD
 *     (member id=51, active account, space membership id=113)
 *
 * Full WebRTC two-person AV call cannot be verified in headless Playwright.
 * See HUMAN_VALIDATION_REQUIRED note at the end of this file.
 */

import { test, expect, type Page } from '@playwright/test'

const STAGING_URL = (
  process.env.STAGING_URL || process.env.E2E_BASE_URL || 'http://127.0.0.1:3107'
).replace(/\/$/, '')

const QA_SPACE_SLUG = 'start-here'
const QA_SESSION_ID = '1'
const QA_SESSION_TITLE = 'Staging QA LiveKit Test Session'
const QA_ROOM_NAME = 'space-1-staging-qa-001'

async function loginQaMember(page: Page): Promise<void> {
  const email = process.env.STAGING_QA_MEMBER_EMAIL ?? process.env.STAGING_MEMBER_EMAIL
  const password = process.env.STAGING_QA_MEMBER_PASSWORD ?? process.env.STAGING_MEMBER_PASSWORD
  if (!email || !password) {
    throw new Error(
      'LiveKit acceptance requires STAGING_QA_MEMBER_EMAIL + STAGING_QA_MEMBER_PASSWORD ' +
      '(or STAGING_MEMBER_EMAIL + STAGING_MEMBER_PASSWORD) env vars',
    )
  }

  await page.goto(`${STAGING_URL}/`, { waitUntil: 'domcontentloaded' })

  const loginRes = await page.request.post(`${STAGING_URL}/api/payload_members/login`, {
    data: { email, password },
    headers: { 'Content-Type': 'application/json', Origin: STAGING_URL },
  })
  const loginData = await loginRes.json()
  const token: string | undefined = loginData.token
  if (!token) {
    throw new Error(`loginQaMember: login failed — ${JSON.stringify(loginData.errors ?? loginData)}`)
  }

  await page.context().addCookies([{
    name: 'payload-token',
    value: token,
    domain: new URL(STAGING_URL).hostname,
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
  }])
}

test.describe('Phase 9 — Portal Calls Browser Acceptance', () => {
  test.skip(!process.env.STAGING_URL, 'Portal calls acceptance requires STAGING_URL to be explicitly set')

  test('CALLS-001: Unauthenticated calls list redirects to login', async ({ page }) => {
    await page.context().clearCookies()
    const response = await page.goto(
      `${STAGING_URL}/portal/community/${QA_SPACE_SLUG}/calls`,
      { waitUntil: 'domcontentloaded' },
    )
    await page.waitForLoadState('networkidle', { timeout: 15000 })

    // Must redirect to login — never expose authenticated call data to anonymous
    const url = page.url()
    const isLoginBoundary =
      url.includes('mode=login') ||
      (await page.locator('#member-email').isVisible().catch(() => false))
    expect(isLoginBoundary).toBe(true)
    expect(response?.status()).not.toBe(500)
  })

  test('CALLS-002: Authenticated calls list loads and shows live session', async ({ page }) => {
    await loginQaMember(page)

    await page.goto(
      `${STAGING_URL}/portal/community/${QA_SPACE_SLUG}/calls`,
      { waitUntil: 'domcontentloaded' },
    )
    await page.waitForLoadState('networkidle', { timeout: 20000 })

    // Must remain authenticated — not redirected to login
    expect(page.url()).not.toMatch(/mode=login/)
    expect(page.url()).toContain('/portal')

    // Page must render without 500
    const title = await page.title()
    expect(title).not.toMatch(/500|error/i)

    // Live session entry must be present
    await expect(page.getByText(QA_SESSION_TITLE)).toBeVisible({ timeout: 10000 })

    // "Live now" status badge visible
    await expect(page.getByText('Live now').first()).toBeVisible({ timeout: 5000 })

    // "Join call" link must be present (canJoin=true because status=live)
    await expect(page.getByRole('link', { name: /join call/i })).toBeVisible({ timeout: 5000 })

    await page.screenshot({ path: 'evidence-portal-community-calls-list.png' })
  })

  test('CALLS-003: Join call page renders LiveCallRoom for live session', async ({ page }) => {
    await loginQaMember(page)

    await page.goto(
      `${STAGING_URL}/portal/community/${QA_SPACE_SLUG}/calls/${QA_SESSION_ID}`,
      { waitUntil: 'domcontentloaded' },
    )
    await page.waitForLoadState('networkidle', { timeout: 20000 })

    // Must remain authenticated
    expect(page.url()).not.toMatch(/mode=login/)
    expect(page.url()).toContain('/portal')

    // Session header
    await expect(page.getByRole('heading', { name: QA_SESSION_TITLE })).toBeVisible({ timeout: 10000 })

    // "Live now" badge
    await expect(page.getByText('Live now').first()).toBeVisible({ timeout: 5000 })

    // LiveCallRoom renders with "Join call" button (idle state)
    await expect(page.getByRole('button', { name: /join call/i })).toBeVisible({ timeout: 10000 })

    // No page-level JS errors (excluding ResizeObserver noise)
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.waitForTimeout(1500)
    expect(errors.filter((e) => !e.includes('ResizeObserver'))).toHaveLength(0)

    await page.screenshot({ path: 'evidence-portal-community-calls-join.png' })
  })

  test('CALLS-004: Join call button fetches valid LiveKit token from API', async ({ page }) => {
    await loginQaMember(page)

    await page.goto(
      `${STAGING_URL}/portal/community/${QA_SPACE_SLUG}/calls/${QA_SESSION_ID}`,
      { waitUntil: 'domcontentloaded' },
    )
    await page.waitForLoadState('networkidle', { timeout: 20000 })

    // Intercept the token request before clicking
    const tokenRequest = page.waitForResponse(
      (resp) => resp.url().includes('/api/livekit/token'),
      { timeout: 15000 },
    )

    await page.getByRole('button', { name: /join call/i }).click()

    const tokenResponse = await tokenRequest
    expect(tokenResponse.status()).toBe(200)

    const body = await tokenResponse.json()
    expect(body.ok).toBe(true)
    expect(typeof body.token).toBe('string')
    expect(body.token.length).toBeGreaterThan(50)
    expect(body.wsUrl).toContain('livekit')
    expect(body.roomName).toBe(QA_ROOM_NAME)

    // After token received, LiveCallRoom transitions to CallStage —
    // component container with LiveKitRoom renders
    await expect(page.getByText('Live now').first()).toBeVisible({ timeout: 5000 })
    // Room label appears in the call stage footer
    await expect(page.getByText(QA_ROOM_NAME)).toBeVisible({ timeout: 5000 })

    await page.screenshot({ path: 'evidence-portal-community-calls-connected.png' })
  })

  test('CALLS-005: Unauthenticated join call page redirects to login', async ({ page }) => {
    await page.context().clearCookies()
    const response = await page.goto(
      `${STAGING_URL}/portal/community/${QA_SPACE_SLUG}/calls/${QA_SESSION_ID}`,
      { waitUntil: 'domcontentloaded' },
    )
    await page.waitForLoadState('networkidle', { timeout: 15000 })

    const url = page.url()
    const isLoginBoundary =
      url.includes('mode=login') ||
      (await page.locator('#member-email').isVisible().catch(() => false))
    expect(isLoginBoundary).toBe(true)
    expect(response?.status()).not.toBe(500)
  })
})

/**
 * HUMAN_VALIDATION_REQUIRED — items that cannot be verified in headless Playwright:
 *
 * 1. Actual WebRTC audio/video stream: microphone and camera access require
 *    a real browser with device permissions. Test CALLS-004 verifies the token
 *    is issued and the LiveKitRoom component mounts, but the AV stream itself
 *    must be confirmed by a human tester with two devices or two browser tabs.
 *
 * 2. Two-participant simultaneous call: requires two authenticated sessions in
 *    the same LiveKit room. CALLS-004 verifies single participant token issuance.
 *    Confirm two participants join and see each other's tiles manually.
 *
 * 3. Leave call: the LiveKit SDK handles disconnect on page unload. Verify
 *    manually that the participant count drops to 0 in the LiveKit dashboard
 *    after leaving.
 */
