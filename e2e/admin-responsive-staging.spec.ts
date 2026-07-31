/**
 * Authenticated Payload admin responsive layout regression tests.
 *
 * Validates that admin views render without horizontal overflow, critical
 * controls remain visible, keyboard focus reaches interactive elements,
 * and no page/console errors occur — across four viewports.
 *
 * Requires: STAGING_URL, STAGING_ADMIN_EMAIL, STAGING_ADMIN_PASSWORD.
 * Read-only: no data mutation occurs.
 */
import { test, expect, Page, BrowserContext } from '@playwright/test'
import { assertStagingOrigin } from '../scripts/staging-gates/stagingPolicy'

const STAGING_URL = process.env.STAGING_URL ?? 'https://preview.jpvbootcamp.com'

assertStagingOrigin(STAGING_URL)

test.describe('Admin responsive layout', () => {
  test.skip(
    !process.env.STAGING_ADMIN_EMAIL || !process.env.STAGING_ADMIN_PASSWORD,
    'Requires STAGING_ADMIN_EMAIL and STAGING_ADMIN_PASSWORD'
  )

  const ADMIN_EMAIL = process.env.STAGING_ADMIN_EMAIL!
  const ADMIN_PASSWORD = process.env.STAGING_ADMIN_PASSWORD!

  const VIEWPORTS = [
    { name: 'desktop-1440x900', width: 1440, height: 900 },
    { name: 'laptop-1024x768', width: 1024, height: 768 },
    { name: 'tablet-768x1024', width: 768, height: 1024 },
    { name: 'mobile-375x812', width: 375, height: 812 },
  ] as const

  const ROUTES = [
    { path: '/admin', label: 'dashboard', heading: /operations|dashboard/i },
    { path: '/admin/collections/payload_membership_audit_history', label: 'membership-audit', heading: /membership audit/i },
    { path: '/admin/collections/payload_courses/3', label: 'course-3', heading: /client accelerator|course/i },
  ] as const

  let context: BrowserContext
  let page: Page

  test.beforeAll(async ({ browser }) => {
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
    for (const vp of VIEWPORTS) {
      test(`${route.label} @ ${vp.name}: no overflow, visible controls, focus, no errors`, async () => {
        await page.setViewportSize({ width: vp.width, height: vp.height })

        const pageErrors: string[] = []
        const consoleErrors: string[] = []

        const onPageError = (err: Error) => pageErrors.push(err.message)
        const onConsole = (msg: import('@playwright/test').ConsoleMessage) => {
          if (msg.type() === 'error') consoleErrors.push(msg.text())
        }

        page.on('pageerror', onPageError)
        page.on('console', onConsole)

        try {
          await page.goto(`${STAGING_URL}${route.path}`, { waitUntil: 'networkidle', timeout: 30000 })
          await page.waitForTimeout(1500)

          // --- Overflow assertion ---
          const dims = await page.evaluate(() => ({
            scrollWidth: document.documentElement.scrollWidth,
            clientWidth: document.documentElement.clientWidth,
          }))

          expect(
            dims.scrollWidth,
            `scrollWidth (${dims.scrollWidth}) must be <= clientWidth (${dims.clientWidth}) at ${vp.name}`
          ).toBeLessThanOrEqual(dims.clientWidth)

          // --- Critical heading/controls visible ---
          const heading = page.locator('h1, h2, [class*="header"]').first()
          await expect(heading).toBeVisible({ timeout: 5000 })

          // --- Keyboard focus reaches visible element within 5 tabs ---
          let focusedVisible = false
          for (let i = 0; i < 5; i++) {
            await page.keyboard.press('Tab')
            focusedVisible = await page.evaluate(() => {
              const el = document.activeElement as HTMLElement | null
              if (!el || el === document.body) return false
              const rect = el.getBoundingClientRect()
              return rect.width > 0 && rect.height > 0
            })
            if (focusedVisible) break
          }
          expect(focusedVisible, 'Tab should reach a visible element within 5 presses').toBe(true)

          // --- No page errors ---
          expect(pageErrors, 'No uncaught page errors').toHaveLength(0)

          // --- Console errors: allow known benign patterns ---
          const unexpectedConsole = consoleErrors.filter(
            msg => !msg.includes('Failed to load resource') && !msg.includes('favicon')
          )
          expect(unexpectedConsole, 'No unexpected console errors').toHaveLength(0)
        } finally {
          page.removeListener('pageerror', onPageError)
          page.removeListener('console', onConsole)
        }
      })
    }
  }

  test('course-3 @ mobile-375x812: doc-controls meta within viewport', async () => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto(`${STAGING_URL}/admin/collections/payload_courses/3`, {
      waitUntil: 'networkidle',
      timeout: 30000,
    })
    await page.waitForTimeout(1500)

    const metaCheck = await page.evaluate(() => {
      const meta = document.querySelector('.doc-controls__meta') as HTMLElement | null
      if (!meta) return { exists: false, withinViewport: true, right: 0 }
      const rect = meta.getBoundingClientRect()
      return {
        exists: true,
        withinViewport: rect.right <= window.innerWidth,
        right: Math.round(rect.right),
      }
    })

    if (metaCheck.exists) {
      expect(
        metaCheck.withinViewport,
        `.doc-controls__meta right edge (${metaCheck.right}) must be <= 375`
      ).toBe(true)
    }
  })

  test('course-3 @ mobile-375x812: account or mobile nav control visible and keyboard reachable', async () => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto(`${STAGING_URL}/admin/collections/payload_courses/3`, {
      waitUntil: 'networkidle',
      timeout: 30000,
    })
    await page.waitForTimeout(1500)

    // On mobile, Payload may show the account avatar or the hamburger nav toggle.
    // Either satisfies the requirement for user access to navigation/settings.
    const controlCheck = await page.evaluate(() => {
      const candidates = [
        document.querySelector('.app-header__account'),
        document.querySelector('.app-header__mobile-nav-toggler'),
        document.querySelector('.nav-toggler:not([style*="display: none"])'),
      ].filter(Boolean) as HTMLElement[]

      for (const el of candidates) {
        const rect = el.getBoundingClientRect()
        if (rect.width > 0 && rect.height > 0 && rect.left >= 0 && rect.left < window.innerWidth) {
          return {
            found: true,
            visible: true,
            reachable: true,
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            left: Math.round(rect.left),
            selector: el.className,
          }
        }
      }
      return { found: candidates.length > 0, visible: false, reachable: false, width: 0, height: 0, left: 0, selector: '' }
    })

    expect(controlCheck.found, 'Account or mobile nav control must exist').toBe(true)
    expect(controlCheck.visible, 'Control must have nonzero dimensions and left edge within viewport').toBe(true)

    // Keyboard reachability: Tab until we reach an interactive header control
    let reached = false
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('Tab')
      const isHeaderControl = await page.evaluate(() => {
        const el = document.activeElement
        if (!el) return false
        return el.closest('.app-header') !== null
      })
      if (isHeaderControl) { reached = true; break }
    }
    expect(reached, 'A header control must be keyboard reachable within 20 tabs').toBe(true)
  })

  test('course-3: authenticated API returns 200, id=3, accessBadge=manual', async () => {
    const response = await page.request.get(`${STAGING_URL}/api/payload_courses/3`)
    expect(response.status()).toBe(200)

    const body = await response.json()
    expect(body.id).toBe(3)
    expect(body.accessBadge).toBe('manual')
  })
})
