/**
 * Authenticated Payload admin responsive layout regression tests.
 *
 * Staging-only and read-only. The suite fails closed unless the explicit
 * staging origin and administrator credentials are provided.
 */
import { expect, test, type BrowserContext, type Page, type Request } from '@playwright/test'
import { assertStagingOrigin } from '../scripts/staging-gates/stagingPolicy'

const STAGING_URL = process.env.STAGING_URL?.trim() ?? ''
const ADMIN_EMAIL = process.env.STAGING_ADMIN_EMAIL?.trim() ?? ''
const ADMIN_PASSWORD = process.env.STAGING_ADMIN_PASSWORD ?? ''

// Validate the URL only when all three values are present; assertStagingOrigin
// rejects production origins and non-HTTPS URLs with a hard throw.
if (STAGING_URL) assertStagingOrigin(STAGING_URL)

const VIEWPORTS = [
  { name: 'desktop-1440x900', width: 1440, height: 900 },
  { name: 'laptop-1024x768', width: 1024, height: 768 },
  { name: 'tablet-768x1024', width: 768, height: 1024 },
  { name: 'mobile-375x812', width: 375, height: 812 },
] as const

const ROUTES = [
  { path: '/admin', label: 'dashboard', heading: /operations|dashboard/i },
  {
    path: '/admin/collections/payload_membership_audit_history',
    label: 'membership-audit',
    heading: /membership audit/i,
  },
  {
    path: '/admin/collections/payload_courses/3',
    label: 'course-3',
    heading: /client accelerator|course/i,
  },
] as const

async function tabToVisibleFocus(page: Page, maximumTabs = 20): Promise<boolean> {
  await page.evaluate(() => {
    const active = document.activeElement as HTMLElement | null
    active?.blur()
  })

  for (let index = 0; index < maximumTabs; index += 1) {
    await page.keyboard.press('Tab')
    const state = await page.evaluate(() => {
      const element = document.activeElement as HTMLElement | null
      if (!element || element === document.body) return { visible: false, indicated: false }
      const rect = element.getBoundingClientRect()
      const style = getComputedStyle(element)
      const visible =
        rect.width > 0 &&
        rect.height > 0 &&
        rect.left >= 0 &&
        rect.right <= window.innerWidth &&
        rect.top < window.innerHeight &&
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        Number(style.opacity) > 0
      const outlineVisible = style.outlineStyle !== 'none' && Number.parseFloat(style.outlineWidth) > 0
      const shadowVisible = style.boxShadow !== 'none'
      return { visible, indicated: outlineVisible || shadowVisible }
    })
    if (state.visible && state.indicated) return true
  }

  return false
}

async function tabToExactAccount(page: Page, maximumTabs = 40): Promise<boolean> {
  await page.evaluate(() => {
    const active = document.activeElement as HTMLElement | null
    active?.blur()
  })

  for (let index = 0; index < maximumTabs; index += 1) {
    await page.keyboard.press('Tab')
    const reached = await page.evaluate(() => {
      const account = document.querySelector('.app-header__account')
      return account !== null && document.activeElement === account
    })
    if (reached) return true
  }

  return false
}

test.describe('Admin responsive layout', () => {
  test.describe.configure({ mode: 'serial' })

  let context: BrowserContext
  let page: Page

  test.beforeAll(async ({ browser }) => {
    // Hard fail inside beforeAll for CI: if the skip guard above did not fire
    // but a variable is empty, surface a clear error rather than a confusing
    // login failure.
    if (!STAGING_URL || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
      throw new Error('ADMIN-RESPONSIVE-DENIED: STAGING_URL, STAGING_ADMIN_EMAIL, and STAGING_ADMIN_PASSWORD are all required')
    }

    context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      ignoreHTTPSErrors: true,
    })
    page = await context.newPage()

    await page.goto(`${STAGING_URL}/admin/login`, { waitUntil: 'networkidle' })
    await page.fill('input[name="email"], input[id="field-email"]', ADMIN_EMAIL)
    await page.fill('input[name="password"], input[id="field-password"]', ADMIN_PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/admin(?!\/login)/, { timeout: 15000 })
  })

  test.afterAll(async () => {
    await context?.close()
  })

  for (const route of ROUTES) {
    for (const viewport of VIEWPORTS) {
      test(`${route.label} @ ${viewport.name}: contained, accessible, and error-free`, async () => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height })

        const pageErrors: string[] = []
        const consoleErrors: string[] = []
        const mutationRequests: string[] = []

        const onPageError = (error: Error) => pageErrors.push(error.message)
        const onConsole = (message: import('@playwright/test').ConsoleMessage) => {
          if (message.type() === 'error') consoleErrors.push(message.text())
        }
        const onRequest = (request: Request) => {
          const url = new URL(request.url())
          if (
            url.origin === new URL(STAGING_URL).origin &&
            url.pathname.startsWith('/api/') &&
            ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method())
          ) {
            mutationRequests.push(`${request.method()} ${url.pathname}`)
          }
        }

        page.on('pageerror', onPageError)
        page.on('console', onConsole)
        page.on('request', onRequest)

        try {
          await page.goto(`${STAGING_URL}${route.path}`, {
            waitUntil: 'networkidle',
            timeout: 30000,
          })
          await page.waitForTimeout(1000)

          const dimensions = await page.evaluate(() => ({
            scrollWidth: document.documentElement.scrollWidth,
            clientWidth: document.documentElement.clientWidth,
          }))
          expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth)

          const heading = page.locator('h1, h2').filter({ hasText: route.heading }).first()
          await expect(heading).toBeVisible({ timeout: 5000 })

          expect(await tabToVisibleFocus(page), 'Tab must reach a visible focus indicator').toBe(true)
          expect(pageErrors, 'No uncaught page errors').toHaveLength(0)

          const unexpectedConsole = consoleErrors.filter(
            (message) =>
              !message.includes('Failed to load resource') &&
              !message.toLowerCase().includes('favicon'),
          )
          expect(unexpectedConsole, 'No unexpected console errors').toHaveLength(0)
          expect(mutationRequests, 'Responsive review must not mutate API records').toHaveLength(0)

          console.log(
            JSON.stringify({
              type: 'admin-responsive-measurement',
              route: route.path,
              viewport: viewport.name,
              scrollWidth: dimensions.scrollWidth,
              clientWidth: dimensions.clientWidth,
            }),
          )
        } finally {
          page.removeListener('pageerror', onPageError)
          page.removeListener('console', onConsole)
          page.removeListener('request', onRequest)
        }
      })
    }
  }

  test('course-3 @ mobile-375x812: metadata and exact account control are contained', async () => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto(`${STAGING_URL}/admin/collections/payload_courses/3`, {
      waitUntil: 'networkidle',
      timeout: 30000,
    })
    await page.waitForTimeout(1000)

    const metadata = page.locator('.doc-controls__meta')
    await expect(metadata).toBeVisible()
    const metadataBox = await metadata.boundingBox()
    expect(metadataBox, 'Document metadata must have geometry').not.toBeNull()
    expect(metadataBox!.x).toBeGreaterThanOrEqual(0)
    expect(metadataBox!.x + metadataBox!.width).toBeLessThanOrEqual(375)

    const account = page.locator('.app-header__account')
    await expect(account).toHaveCount(1)
    await expect(account).toBeVisible()
    const accountBox = await account.boundingBox()
    expect(accountBox, 'Account control must have geometry').not.toBeNull()
    expect(accountBox!.x).toBeGreaterThanOrEqual(0)
    expect(accountBox!.x + accountBox!.width).toBeLessThanOrEqual(375)
    expect(accountBox!.width).toBeGreaterThanOrEqual(44)
    expect(accountBox!.height).toBeGreaterThanOrEqual(44)

    const accountStyle = await account.evaluate((element) => {
      const style = getComputedStyle(element)
      return {
        display: style.display,
        visibility: style.visibility,
        opacity: Number(style.opacity),
      }
    })
    expect(accountStyle.display).not.toBe('none')
    expect(accountStyle.visibility).not.toBe('hidden')
    expect(accountStyle.opacity).toBeGreaterThan(0)
    expect(await tabToExactAccount(page), 'Tab must reach .app-header__account exactly').toBe(true)

    console.log(
      JSON.stringify({
        type: 'admin-account-measurement',
        left: Math.round(accountBox!.x),
        right: Math.round(accountBox!.x + accountBox!.width),
        width: Math.round(accountBox!.width),
        height: Math.round(accountBox!.height),
      }),
    )
  })

  test('course-3: authenticated API returns safe expected fields', async () => {
    const response = await page.request.get(`${STAGING_URL}/api/payload_courses/3`)
    expect(response.status()).toBe(200)

    const body = (await response.json()) as { id?: unknown; accessBadge?: unknown }
    expect(body.id).toBe(3)
    expect(body.accessBadge).toBe('manual')

    console.log(
      JSON.stringify({
        type: 'admin-course-api-result',
        status: response.status(),
        id: body.id,
        accessBadge: body.accessBadge,
      }),
    )
  })
})
