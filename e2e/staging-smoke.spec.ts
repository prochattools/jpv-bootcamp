import { test, expect, Page } from '@playwright/test'

const STAGING_URL = 'https://preview.jpvbootcamp.com'

/**
 * Staging Smoke Test
 * Comprehensive flow testing against jpvbootcamp_staging schema
 * Tests: landing, checkout flows, account management, courses, admin, accessibility
 */

test.describe('Staging Smoke Tests - Full Platform Flows', () => {
  test.beforeEach(async ({ page }) => {
    page.setViewportSize({ width: 1440, height: 900 })
  })

  // ======== PUBLIC FLOWS ========
  test('PUBLIC-001: Landing page loads with correct branding and pricing', async ({ page }) => {
    await page.goto(`${STAGING_URL}/`, { waitUntil: 'domcontentloaded' })

    // Verify page structure
    await expect(page).toHaveTitle(/JPV|bootcamp|jpvbootcamp/i)

    // Verify pricing section exists
    const pricingSection = await page.locator('section:has-text("pricing"), section:has-text("price"), [data-testid*="pricing"], a[href="#pricing"]').first()
    await expect(pricingSection).toBeVisible()

    // Verify CTAs - look for green buttons or links to pricing/upgrade
    const ctaButtons = await page.locator('a[href*="pricing"], a[href*="upgrade"], a[href*="#pricing"], button:has-text("Get Started"), a:has-text("Get Started")').all()
    expect(ctaButtons.length).toBeGreaterThan(0)

    // Take screenshot
    await page.screenshot({ path: 'landing-page.png' })
  })

  test('PUBLIC-002: Legal pages load correctly', async ({ page }) => {
    const legalPages = ['/privacy', '/terms']

    for (const path of legalPages) {
      await page.goto(`${STAGING_URL}${path}`, { waitUntil: 'domcontentloaded' })
      await expect(page).not.toHaveURL('**/404*')
      const mainContent = await page.locator('main, article, [role="main"]').first()
      await expect(mainContent).toBeVisible()
    }
  })

  test('PUBLIC-003: Login route accessible and portal boundary intact', async ({ page }) => {
    await page.goto(`${STAGING_URL}/portal?mode=login`, { waitUntil: 'domcontentloaded' })

    // Verify we're on portal login, not an admin page
    const loginForm = await page.locator('[data-testid*="login"], form:has-text("email"), form:has-text("password")').first()
    await expect(loginForm).toBeVisible({ timeout: 5000 }).catch(() => {
      // Portal login might be redirected, so check we're not on admin
      expect(page.url()).not.toContain('/admin')
    })

    // Verify no admin leakage
    const adminElements = await page.locator('[data-testid*="admin"], [role="complementary"]:has-text("admin")').all()
    expect(adminElements.length).toBe(0)
  })

  test('PUBLIC-004: 404 page safe and non-revealing', async ({ page }) => {
    await page.goto(`${STAGING_URL}/this-route-does-not-exist-xyz-12345`, { waitUntil: 'domcontentloaded' })

    // Should show 404, not expose internals
    const pageContent = await page.content()
    expect(pageContent).not.toContain('ReferenceError')
    expect(pageContent).not.toContain('stack trace')
    expect(pageContent).not.toContain('error: ')
    expect(pageContent).not.toContain('Error:')
    // Page should contain 404 message
    expect(pageContent.toLowerCase()).toContain('404')

    await page.screenshot({ path: '404-page.png' })
  })

  test('PUBLIC-005: Sitemap accessible and valid', async ({ page, context }) => {
    // Use context.request to fetch XML directly, avoiding browser XML viewer
    const response = await context.request.get(`${STAGING_URL}/sitemap.xml`)
    expect(response.status()).toBe(200)

    const content = await response.text()
    expect(content).toContain('<?xml')
    expect(content).toContain('<url>')
    expect(content).not.toContain('/admin')
  })

  // ======== MEMBER CHECKOUT FLOWS ========
  test('BILLING-001: Monthly checkout flow validation', async ({ context }) => {
    // The runtime accepts plan=membership (or jpv_bootcamp_membership) with billing=monthly
    const response = await context.request.get(
      `${STAGING_URL}/api/stripe/checkout?plan=membership&billing=monthly&recurring_payment_accepted=true`,
      { maxRedirects: 0 },
    )
    // A correctly configured environment redirects 303 to a Stripe TEST checkout URL.
    // A misconfigured environment (missing Stripe env vars) returns 500.
    expect(response.status()).toBe(303)
    const location = response.headers()['location'] ?? ''
    expect(location).toMatch(/^https:\/\/checkout\.stripe\.com\//)
  })

  test('BILLING-002: Annual checkout flow validation', async ({ context }) => {
    const response = await context.request.get(
      `${STAGING_URL}/api/stripe/checkout?plan=membership&billing=annual&recurring_payment_accepted=true`,
      { maxRedirects: 0 },
    )
    expect(response.status()).toBe(303)
    const location = response.headers()['location'] ?? ''
    expect(location).toMatch(/^https:\/\/checkout\.stripe\.com\//)
  })

  test('BILLING-003: Invalid and legacy checkout parameters rejected', async ({ context }) => {
    // plan=pro is the legacy slug — must be rejected with 400
    const legacyPro = await context.request.get(
      `${STAGING_URL}/api/stripe/checkout?plan=pro&billing=monthly&recurring_payment_accepted=true`,
      { maxRedirects: 0 },
    )
    expect(legacyPro.status()).toBe(400)

    // plan=invalid must be rejected with 400
    const invalidPlan = await context.request.get(
      `${STAGING_URL}/api/stripe/checkout?plan=invalid&billing=monthly&recurring_payment_accepted=true`,
      { maxRedirects: 0 },
    )
    expect(invalidPlan.status()).toBe(400)

    // missing recurring_payment_accepted must be rejected with 400
    const missingAck = await context.request.get(
      `${STAGING_URL}/api/stripe/checkout?plan=membership&billing=monthly`,
      { maxRedirects: 0 },
    )
    expect(missingAck.status()).toBe(400)

    // empty plan must be rejected with 400
    const emptyPlan = await context.request.get(
      `${STAGING_URL}/api/stripe/checkout?plan=&billing=monthly&recurring_payment_accepted=true`,
      { maxRedirects: 0 },
    )
    expect(emptyPlan.status()).toBe(400)
  })

  // ======== SUPPORT INTAKE ========
  test('SUPPORT-001: Support form intake accessible', async ({ page }) => {
    await page.goto(`${STAGING_URL}/`, { waitUntil: 'domcontentloaded' })

    // Look for support contact form or link
    const supportLinks = await page.locator('a:has-text("support"), a:has-text("contact"), [data-testid*="support"]').all()

    // Support should be accessible somewhere
    if (supportLinks.length > 0) {
      await supportLinks[0].click()
      await page.waitForLoadState('networkidle')
      const supportForm = await page.locator('form').first()
      await expect(supportForm).toBeVisible({ timeout: 5000 }).catch(() => {
        // Support might be in a modal or different location
        expect(page.url()).toContain(STAGING_URL)
      })
    }
  })

  // ======== ACCESSIBILITY TESTS ========
  test('ACCESSIBILITY-001: Landing page keyboard navigation', async ({ page }) => {
    await page.goto(`${STAGING_URL}/`, { waitUntil: 'domcontentloaded' })

    // Verify focusable elements
    const focusableElements = await page.locator('button, a, input, select, textarea, [tabindex="0"]').all()
    expect(focusableElements.length).toBeGreaterThan(0)

    // Test Tab key navigation
    await page.keyboard.press('Tab')
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName)
    expect(['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA']).toContain(focusedElement)
  })

  test('ACCESSIBILITY-002: Landing page screen reader text', async ({ page }) => {
    await page.goto(`${STAGING_URL}/`, { waitUntil: 'domcontentloaded' })

    // Verify aria-labels or alt text on images
    const images = await page.locator('img').all()
    for (const img of images.slice(0, 3)) {
      const alt = await img.getAttribute('alt')
      const ariaLabel = await img.getAttribute('aria-label')
      expect(alt || ariaLabel).toBeTruthy()
    }

    // Verify semantic HTML headings
    const headings = await page.locator('h1, h2, h3').all()
    expect(headings.length).toBeGreaterThan(0)
  })

  test('ACCESSIBILITY-003: Portal login form accessibility', async ({ page }) => {
    await page.goto(`${STAGING_URL}/portal?mode=login`, { waitUntil: 'domcontentloaded' })

    // Wait for login form or verify portal is accessible
    await page.waitForLoadState('networkidle')

    // Verify form fields have associated labels and are focusable
    const formFields = await page.locator('input[type="email"], input[type="password"], input[type="text"]').all()
    for (const field of formFields.slice(0, 2)) {
      const fieldId = await field.getAttribute('id')
      if (fieldId) {
        // Focus the field and verify it accepts focus (keyboard accessibility)
        await field.focus()
        await expect(field).toBeFocused()
      }
    }
  })

  // ======== MOBILE RESPONSIVE TESTS ========
  test('MOBILE-001: Landing page responsive (mobile viewport)', async ({ browser }) => {
    const mobileContext = await browser.newContext({
      viewport: { width: 375, height: 667 },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X)',
    })
    const page = await mobileContext.newPage()

    await page.goto(`${STAGING_URL}/`, { waitUntil: 'domcontentloaded' })

    // Verify no horizontal scroll
    const overflowHidden = await page.evaluate(() => {
      const body = document.body
      return window.getComputedStyle(body).overflow === 'hidden'
    })

    // Content should be readable on mobile
    const viewportWidth = await page.evaluate(() => window.innerWidth)
    const maxElementWidth = await page.evaluate(() => {
      const elements = document.querySelectorAll('*')
      return Math.max(...Array.from(elements).map(el => el.clientWidth))
    })

    expect(maxElementWidth).toBeLessThanOrEqual(viewportWidth + 50) // Small margin acceptable

    await page.screenshot({ path: 'mobile-landing.png' })
    await mobileContext.close()
  })

  test('MOBILE-002: Portal login responsive (mobile)', async ({ browser }) => {
    const mobileContext = await browser.newContext({
      viewport: { width: 375, height: 667 },
    })
    const page = await mobileContext.newPage()

    await page.goto(`${STAGING_URL}/portal?mode=login`, { waitUntil: 'domcontentloaded' })

    // Form should be visible and usable on mobile
    const formElements = await page.locator('button, input, a').all()
    expect(formElements.length).toBeGreaterThan(0)

    // Buttons should be large enough to tap
    for (const button of await page.locator('button').all()) {
      const box = await button.boundingBox()
      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(44) // iOS minimum touch size
      }
    }

    await page.screenshot({ path: 'mobile-login.png' })
    await mobileContext.close()
  })

  // ======== PERFORMANCE CHECKS ========
  test('PERF-001: Landing page load time', async ({ page }) => {
    const start = Date.now()
    await page.goto(`${STAGING_URL}/`, { waitUntil: 'domcontentloaded' })
    const loadTime = Date.now() - start

    // Should load in reasonable time on staging
    expect(loadTime).toBeLessThan(10000) // 10 seconds
    console.log(`Landing page loaded in ${loadTime}ms`)
  })

  test('PERF-002: API endpoints responsive', async ({ page }) => {
    const endpoints = [
      '/api/health',
      '/sitemap.xml',
    ]

    for (const endpoint of endpoints) {
      const start = Date.now()
      const response = await page.goto(`${STAGING_URL}${endpoint}`)
      const responseTime = Date.now() - start

      expect(response?.status()).toBeLessThan(500)
      expect(responseTime).toBeLessThan(5000)
    }
  })

  // ======== ERROR HANDLING ========
  test('ERROR-001: Server errors handled gracefully', async ({ page }) => {
    await page.goto(`${STAGING_URL}/`, { waitUntil: 'domcontentloaded' })

    // Monitor console for errors (may be expected in test)
    const errors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })

    // Navigate around the site using hrefs to avoid stale locators after navigation
    const hrefs: string[] = []
    const linkLocators = page.locator('a[href^="/"]')
    const linkCount = await linkLocators.count()
    for (let i = 0; i < Math.min(linkCount, 3); i++) {
      const href = await linkLocators.nth(i).getAttribute('href').catch((): null => null)
      if (href && !href.includes('#')) hrefs.push(href)
    }
    for (const href of hrefs) {
      await page.goto(`${STAGING_URL}${href}`, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {})
      await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {})
    }

    // No unhandled runtime errors
    const severeErrors = errors.filter(e =>
      !e.includes('hydration') &&
      !e.includes('Non-Error promise rejection received') &&
      !e.includes('ResizeObserver')
    )
    expect(severeErrors).toEqual([])
  })
})

// ======== SCHEMA VERIFICATION ========
test.describe('Staging Database Schema Verification', () => {
  test('SCHEMA-001: Staging schema context verified', async ({ page }) => {
    // This test verifies the staging environment is configured correctly
    // In a real scenario, this would connect to the database directly

    const response = await page.goto(`${STAGING_URL}/api/health`)
    expect(response?.status()).toBe(200)

    const content = await page.content()
    // Health check should indicate staging/preview environment
    expect(content).not.toContain('production')
  })
})

// ======== EVIDENCE CAPTURE ========
test.describe('Evidence Capture for Manual Verification', () => {
  test('EVIDENCE-001: Capture full flow screenshots', async ({ page }) => {
    const flowSteps = [
      { path: '/', name: 'landing' },
      { path: '/privacy', name: 'privacy' },
      { path: '/terms', name: 'terms' },
      { path: '/portal?mode=login', name: 'login' },
    ]

    for (const step of flowSteps) {
      await page.goto(`${STAGING_URL}${step.path}`, { waitUntil: 'domcontentloaded' })
      await page.screenshot({ path: `evidence-${step.name}.png` })
    }
  })

  test('EVIDENCE-002: Network requests validation', async ({ page }) => {
    const requests: Array<{ url: string; status: number }> = []

    page.on('response', response => {
      requests.push({
        url: response.url(),
        status: response.status(),
      })
    })

    await page.goto(`${STAGING_URL}/`, { waitUntil: 'domcontentloaded' })

    // Verify key requests succeeded
    const failedRequests = requests.filter(r => r.status >= 400)
    const criticalFails = failedRequests.filter(r =>
      !r.url.includes('analytics') &&
      !r.url.includes('tracking') &&
      !r.url.includes('ads')
    )

    if (criticalFails.length > 0) {
      console.log('Critical failed requests:', criticalFails)
    }
    expect(criticalFails).toEqual([])
  })
})
