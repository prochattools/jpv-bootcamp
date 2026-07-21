import { expect, test } from '@playwright/test'

import {
  assertNoHorizontalOverflow,
  assertNoSeriousAccessibilityViolations,
  captureBrowserDiagnostics,
  mockSafePublicDependencies,
} from './fixtures/launchFixtures'

test.beforeEach(async ({ page }) => {
  await mockSafePublicDependencies(page)
})

test.describe('public launch routes', () => {
  test('landing shows approved pricing, commitment, and authenticated billing CTA', async ({ page }) => {
    const diagnostics = captureBrowserDiagnostics(page)
    await page.goto('/')

    await expect(page).toHaveTitle(/JPV|Jesus Property Venture/i)
    await expect(page.locator('[data-contract-price="£80/month"]')).toBeVisible()
    await expect(page.getByText('No minimum commitment', { exact: false })).toBeVisible()
    await expect(page.locator('[data-contract-price="£800/year"]')).toBeVisible()

    const proBillingLinks = page.locator('a[href="/upgrade"]')
    await expect(proBillingLinks.first()).toBeVisible()
    await expect(proBillingLinks.first()).toHaveAttribute('href', '/upgrade')

    await assertNoHorizontalOverflow(page)
    await assertNoSeriousAccessibilityViolations(page)
    expect(diagnostics.join('\n')).not.toMatch(/password|dedupe|secret|sk_live|whsec_/i)
  })

  for (const route of ['/privacy', '/privacy-policy', '/terms']) {
    test(`legal route ${route} loads without horizontal overflow`, async ({ page }) => {
      await page.goto(route)
      await expect(page.getByRole('main').first()).toBeVisible()
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
      await assertNoHorizontalOverflow(page)
      await assertNoSeriousAccessibilityViolations(page)
    })
  }

test('sitemap contains canonical launch routes', async ({ request }) => {
    let response = null
    let lastError: unknown = null

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        response = await request.get('/sitemap.xml')
        break
      } catch (error) {
        lastError = error
      }
    }

    if (!response) {
      throw lastError instanceof Error ? lastError : new Error('Unable to fetch /sitemap.xml')
    }

    expect(response.ok()).toBe(true)
    const sitemap = await response.text()
    expect(sitemap).toContain('/privacy')
    expect(sitemap).toContain('/terms')
    expect(sitemap).not.toContain('/admin/review')
    expect(sitemap).not.toContain('/operations/')
  })

  test('legacy privacy route resolves to canonical public content', async ({ page }) => {
    await page.goto('/privacy')
    await expect(page.getByRole('main').first()).toBeVisible()
    await expect(page.locator('h1')).toContainText(/privacy/i)
    expect(new URL(page.url()).hostname).toMatch(/^(127\.0\.0\.1|localhost)$/)
  })

  test('unknown public route returns not-found behavior', async ({ page }) => {
    const response = await page.goto('/definitely-not-a-launch-route')
    expect(response?.status()).toBe(404)
    await assertNoHorizontalOverflow(page)
  })
})
