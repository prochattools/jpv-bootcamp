/**
 * A6 Gate 1 authenticated staging acceptance.
 *
 * This suite is intentionally separate from anonymous smoke and Payload admin
 * responsive coverage. It proves that a normal member and a linked Payload
 * administrator can enter the member portal, that server-side authorization is
 * authoritative, and that the portal remains usable at every required width.
 * It is staging-only, read-only, and fails closed when any protected actor
 * secret is absent.
 */
import { expect, test, type BrowserContext, type Page } from '@playwright/test'

import { assertStagingOrigin } from '../scripts/staging-gates/stagingPolicy'

const STAGING_URL = process.env.STAGING_URL?.trim() ?? ''
const MEMBER_EMAIL = process.env.STAGING_MEMBER_EMAIL?.trim() ?? ''
const MEMBER_PASSWORD = process.env.STAGING_MEMBER_PASSWORD ?? ''
const ADMIN_EMAIL = process.env.STAGING_ADMIN_EMAIL?.trim() ?? ''
const ADMIN_PASSWORD = process.env.STAGING_ADMIN_PASSWORD ?? ''
const STAGING_ORIGIN = STAGING_URL ? new URL(STAGING_URL).origin : ''

const browserAuthTokens = new WeakMap<BrowserContext, string>()

if (STAGING_URL) assertStagingOrigin(STAGING_URL)

const VIEWPORTS = [
  { name: 'mobile-320x700', width: 320, height: 700 },
  { name: 'mobile-375x812', width: 375, height: 812 },
  { name: 'tablet-768x1024', width: 768, height: 1024 },
  { name: 'laptop-1024x768', width: 1024, height: 768 },
  { name: 'desktop-1440x900', width: 1440, height: 900 },
] as const

const MEMBER_ROUTES = [
  { path: '/portal', label: 'dashboard', heading: /dashboard|welcome/i },
  { path: '/portal/courses', label: 'courses', heading: /courses/i },
  { path: '/portal/content', label: 'updates', heading: /updates|content/i },
  { path: '/portal/community', label: 'community', heading: /community/i },
  { path: '/portal/live-sessions', label: 'live sessions', heading: /live sessions/i },
  { path: '/portal/resources', label: 'resources', heading: /resources/i },
  { path: '/portal/notifications', label: 'notifications', heading: /notifications/i },
  { path: '/portal/account', label: 'account', heading: /account/i },
  { path: '/portal/billing', label: 'billing', heading: /billing/i },
  { path: '/portal/bookmarks', label: 'bookmarks', heading: /bookmarks/i },
  { path: '/portal/members', label: 'members', heading: /members/i },
] as const

const ADMIN_ROUTES = [
  { path: '/portal', label: 'dashboard', heading: /dashboard|portal overview/i },
  { path: '/portal/courses', label: 'courses', heading: /courses/i },
  { path: '/portal/content', label: 'updates', heading: /updates|content/i },
  { path: '/portal/community', label: 'community', heading: /community/i },
  { path: '/portal/live-sessions', label: 'live sessions', heading: /live sessions/i },
  { path: '/portal/resources', label: 'resources', heading: /resources/i },
  { path: '/portal/account', label: 'account', heading: /account/i },
  { path: '/portal/billing', label: 'billing', heading: /billing/i },
] as const

type LoginCollection = 'payload_members' | 'payload_users'

function assertConfigured(): void {
  if (!STAGING_URL || !MEMBER_EMAIL || !MEMBER_PASSWORD || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error(
      'A6-AUTH-DENIED: STAGING_URL, STAGING_MEMBER_EMAIL, STAGING_MEMBER_PASSWORD, ' +
      'STAGING_ADMIN_EMAIL, and STAGING_ADMIN_PASSWORD are all required',
    )
  }
}

async function login(page: Page, collection: LoginCollection, email: string, password: string): Promise<void> {
  assertConfigured()
  await page.context().clearCookies()
  browserAuthTokens.delete(page.context())

  const response = await page.request.post(`${STAGING_URL}/api/${collection}/login`, {
    data: { email, password },
    headers: { 'Content-Type': 'application/json', Origin: STAGING_URL },
  })
  if (response.status() < 200 || response.status() >= 300) {
    throw new Error(`A6-AUTH-DENIED: ${collection} login returned HTTP ${response.status()}`)
  }

  const result = await response.json().catch((): null => null) as { token?: unknown } | null
  if (!result || typeof result.token !== 'string' || result.token.length < 20) {
    throw new Error(`A6-AUTH-DENIED: ${collection} login did not return a session token`)
  }

  browserAuthTokens.set(page.context(), result.token)

  const sessionResponse = await page.request.get(`${STAGING_URL}/api/member-session?next=%2Fportal`, {
    headers: { Authorization: `JWT ${result.token}` },
  })
  if (sessionResponse.status() !== 200) {
    throw new Error(`A6-AUTH-DENIED: ${collection} session check returned HTTP ${sessionResponse.status()}`)
  }
  const session = await sessionResponse.json().catch((): null => null) as { allowed?: unknown } | null
  if (!session || session.allowed !== true) {
    throw new Error(`A6-AUTH-DENIED: ${collection} session was not accepted by the portal`)
  }
}

function authenticatedRequestHeaders(page: Page): { Authorization: string } {
  const token = browserAuthTokens.get(page.context())
  if (!token) throw new Error('A6-AUTH-DENIED: browser authorization token is not available')
  return { Authorization: `JWT ${token}` }
}

async function installBrowserAuthRoute(context: BrowserContext): Promise<void> {
  await context.route('**/*', async (route) => {
    const token = browserAuthTokens.get(context)
    const request = route.request()
    const headers = { ...request.headers() }

    if (token && new URL(request.url()).origin === STAGING_ORIGIN) {
      headers.authorization = `JWT ${token}`
    }

    await route.continue({ headers })
  })
}

async function assertVisibleFocus(page: Page, maximumTabs = 30): Promise<void> {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
  for (let index = 0; index < maximumTabs; index += 1) {
    await page.keyboard.press('Tab')
    const state = await page.evaluate(() => {
      const element = document.activeElement as HTMLElement | null
      if (!element || element === document.body) return { visible: false, indicated: false }
      const rect = element.getBoundingClientRect()
      const style = getComputedStyle(element)
      const visible = rect.width > 0 && rect.height > 0 && rect.left >= 0 && rect.right <= window.innerWidth && rect.top < window.innerHeight && style.visibility !== 'hidden' && Number(style.opacity) > 0
      const indicated = style.outlineStyle !== 'none' && Number.parseFloat(style.outlineWidth) > 0 || style.boxShadow !== 'none'
      return { visible, indicated }
    })
    if (state.visible && state.indicated) return
  }
  throw new Error('A6-UX-DENIED: keyboard navigation did not reach a visible focus indicator')
}

async function assertRoute(page: Page, path: string, heading: RegExp, role: 'member' | 'admin'): Promise<void> {
  const pageErrors: string[] = []
  const consoleErrors: string[] = []
  const disallowedHosts = new Set<string>()
  const onPageError = (error: Error) => pageErrors.push(error.message)
  const onConsole = (message: import('@playwright/test').ConsoleMessage) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  }
  const onRequest = (request: import('@playwright/test').Request) => {
    const hostname = new URL(request.url()).hostname
    if (hostname === 'preview.jpvbootcamp.com') disallowedHosts.add(hostname)
  }
  page.on('pageerror', onPageError)
  page.on('console', onConsole)
  page.on('request', onRequest)

  try {
    // Some portal routes intentionally keep background requests active (for
    // example live-session state and notification polling). DOM readiness is
    // the stable route-entry signal; the assertions below still verify the
    // rendered page and capture page/console failures without waiting for an
    // impossible network-idle state.
    const response = await page.goto(`${STAGING_URL}${path}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    expect(response?.status(), `${role} ${path} must not return an HTTP error`).toBeLessThan(500)

    const current = new URL(page.url())
    expect(current.origin, `${role} ${path} must remain on staging`).toBe(STAGING_URL)
    expect(current.search, `${role} ${path} must not enter portal login mode`).not.toContain('mode=login')
    await expect(page.locator('input#member-email:visible, input[name="email"]:visible')).toHaveCount(0)
    expect(disallowedHosts, `${role} ${path} must not request the retired preview hostname`).toEqual(new Set())

    const dimensions = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }))
    expect(dimensions.scrollWidth, `${role} ${path} must not overflow horizontally`).toBeLessThanOrEqual(dimensions.clientWidth)
    await expect(page.locator('h1:visible, h2:visible, h3:visible').filter({ hasText: heading }).first()).toBeVisible({ timeout: 10000 })

    if (role === 'member') {
      await expect(page.getByRole('button', { name: /turn admin mode off/i })).toHaveCount(0)
      await expect(page.getByText(/create (a )?course/i).first()).toHaveCount(0)
    } else {
      await expect(page.getByRole('button', { name: 'Turn admin mode off' })).toBeVisible()
    }

    await assertVisibleFocus(page)
    expect(pageErrors, `${role} ${path} must have no uncaught page errors`).toHaveLength(0)
    const unexpectedConsole = consoleErrors.filter((message) => !message.includes('Failed to load resource') && !message.toLowerCase().includes('favicon'))
    expect(unexpectedConsole, `${role} ${path} must have no unexpected console errors`).toHaveLength(0)
  } finally {
    page.removeListener('pageerror', onPageError)
    page.removeListener('console', onConsole)
    page.removeListener('request', onRequest)
  }
}

async function firstPortalHref(page: Page, pattern: RegExp): Promise<string> {
  const hrefs = await page.locator('a[href]').evaluateAll((anchors) => anchors.map((anchor) => (anchor as HTMLAnchorElement).getAttribute('href')).filter((href): href is string => Boolean(href)))
  const href = hrefs.find((candidate) => pattern.test(candidate))
  if (!href) throw new Error(`A6-DATA-DENIED: no portal link matched ${pattern.source}`)
  return href
}

test.describe('A6 Gate 1 authenticated member acceptance', () => {
  test.describe.configure({ mode: 'serial' })
  let context: BrowserContext
  let page: Page

  test.beforeAll(async ({ browser }) => {
    assertConfigured()
    context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    await installBrowserAuthRoute(context)
    page = await context.newPage()
    await page.goto(`${STAGING_URL}/portal?mode=login`, { waitUntil: 'networkidle' })
    await expect(page.locator('input[type="email"], input[name="email"], input#member-email').first()).toBeVisible()
    await login(page, 'payload_members', MEMBER_EMAIL, MEMBER_PASSWORD)
  })

  test.afterAll(async () => { await context?.close() })

  test('member session is a normal non-admin portal actor', async () => {
    const response = await page.request.get(`${STAGING_URL}/api/portal/live-sessions`, {
      headers: authenticatedRequestHeaders(page),
    })
    expect(response.status()).toBe(403)
    await expect(page.getByRole('button', { name: /turn admin mode off/i })).toHaveCount(0)
  })

  for (const route of MEMBER_ROUTES) {
    test(`${route.label} route matrix`, async () => {
      for (const viewport of VIEWPORTS) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height })
        await assertRoute(page, route.path, route.heading, 'member')
      }
    })
  }

  test('member course/module/lesson navigation and progress surface', async () => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`${STAGING_URL}/portal/courses`, { waitUntil: 'networkidle' })
    const courseHref = await firstPortalHref(page, /^\/portal\/courses\/[^/]+$/)
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await assertRoute(page, courseHref, /course/i, 'member')
    }

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`${STAGING_URL}${courseHref}`, { waitUntil: 'networkidle' })
    const lessonHref = await firstPortalHref(page, /^\/portal\/courses\/[^/]+\/lessons\/[^/]+$/)
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await assertRoute(page, lessonHref, /lesson|content/i, 'member')
    }
  })

  test('member community space and post engagement surface', async () => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`${STAGING_URL}/portal/community`, { waitUntil: 'networkidle' })
    const spaceHref = await firstPortalHref(page, /^\/portal\/community\/[^/]+$/)
    await page.goto(`${STAGING_URL}${spaceHref}`, { waitUntil: 'networkidle' })
    const postHref = await firstPortalHref(page, /^\/portal\/community\/[^/]+\/posts\/[^/]+$/)
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await assertRoute(page, postHref, /discussion|post/i, 'member')
      for (const label of ['Helpful', 'Insightful', 'Celebrate', 'Bookmark', 'Share']) {
        await expect(page.locator('button, a').filter({ hasText: new RegExp(`^${label}`, 'i') }).first(), `${label} control must be rendered`).toBeVisible()
      }
    }
  })
})

test.describe('A6 Gate 1 authenticated creator/admin acceptance', () => {
  test.describe.configure({ mode: 'serial' })
  let context: BrowserContext
  let page: Page

  test.beforeAll(async ({ browser }) => {
    assertConfigured()
    context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    await installBrowserAuthRoute(context)
    page = await context.newPage()
    await login(page, 'payload_users', ADMIN_EMAIL, ADMIN_PASSWORD)
  })

  test.afterAll(async () => { await context?.close() })

  test('administrator session is server-authorized and linked to a member-facing portal identity', async () => {
    const liveSessions = await page.request.get(`${STAGING_URL}/api/portal/live-sessions`, {
      headers: authenticatedRequestHeaders(page),
    })
    expect(liveSessions.status()).toBe(200)
    const payload = await liveSessions.json().catch((): null => null) as { ok?: unknown } | null
    expect(payload?.ok).toBe(true)

    for (const path of ['/portal/members', '/portal/notifications']) {
      await page.goto(`${STAGING_URL}${path}`, { waitUntil: 'networkidle' })
      expect(new URL(page.url()).origin).toBe(STAGING_URL)
      expect(new URL(page.url()).search).not.toContain('mode=login')
    }
  })

  for (const route of ADMIN_ROUTES) {
    test(`${route.label} creator/admin route matrix`, async () => {
      for (const viewport of VIEWPORTS) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height })
        await assertRoute(page, route.path, route.heading, 'admin')
      }
    })
  }

  test('administrator can toggle Admin Mode without losing server authorization', async () => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`${STAGING_URL}/portal/courses`, { waitUntil: 'networkidle' })
    const adminOn = page.getByRole('button', { name: 'Turn admin mode off' })
    await expect(adminOn).toBeVisible()
    await adminOn.click()
    await expect(page.getByRole('button', { name: 'Turn admin mode on' })).toBeVisible()
    await expect(page.getByRole('button', { name: /create (a )?course/i })).toHaveCount(0)

    const stillAuthorized = await page.request.get(`${STAGING_URL}/api/portal/live-sessions`, {
      headers: authenticatedRequestHeaders(page),
    })
    expect(stillAuthorized.status()).toBe(200)

    await page.getByRole('button', { name: 'Turn admin mode on' }).click()
    await expect(page.getByRole('button', { name: 'Turn admin mode off' })).toBeVisible()
    await expect(page.getByRole('button', { name: /create (a )?course/i })).toBeVisible()
  })
})
