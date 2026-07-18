import { expect, test } from '@playwright/test'

import {
  assertNoHorizontalOverflow,
  mockAuthenticatedPortal,
  mockCheckoutProvider,
} from './fixtures/launchFixtures'

test.describe('checkout start and guarded submission safety', () => {
  test('authenticated membership billing start uses only supported monthly and annual options', async ({ page }) => {
    const checkoutRequests = await mockCheckoutProvider(page)
    await mockAuthenticatedPortal(page)
    await page.goto('/portal/billing')

    await page.getByRole('button', { name: '£80/month' }).click()
    await expect(page.locator('body')).toHaveAttribute('data-checkout-status', '200')
    await page.getByRole('button', { name: '£800/year' }).click()
    await expect.poll(() => checkoutRequests.length).toBe(2)

    expect(checkoutRequests).toHaveLength(2)
    expect(checkoutRequests[0]).toContain('plan=pro')
    expect(checkoutRequests[0]).toContain('billing=monthly')
    expect(checkoutRequests[1]).toContain('billing=annual')
    for (const url of checkoutRequests) {
      expect(url).not.toMatch(/amount=|price=|returnUrl=|successUrl=|cancelUrl=/i)
      expect(new URL(url).hostname).toMatch(/^(127\.0\.0\.1|localhost)$/)
    }
  })

  test('arbitrary checkout plan, amount, and unsafe return URL are rejected without Stripe', async ({ page }) => {
    const checkoutRequests = await mockCheckoutProvider(page)
    await mockAuthenticatedPortal(page)
    await page.goto('/portal/billing')

    const status = await page.evaluate(async () => {
      const response = await fetch(
        '/api/stripe/checkout?plan=vip&billing=monthly&amount=1&returnUrl=https://evil.invalid',
        { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' },
      )
      return response.status
    })

    expect(status).toBe(400)
    expect(checkoutRequests).toHaveLength(1)
    expect(checkoutRequests[0]).toContain('evil.invalid')
    expect(checkoutRequests[0]).not.toContain('stripe.com')
  })

  test('guarded support API rejects unsafe method, content type, and origin before persistence', async ({ request, baseURL }) => {
    expect(baseURL).toBeTruthy()
    const validBody = {
      name: 'Browser Guard Test',
      email: 'guard@example.invalid',
      question: 'This request should be rejected before persistence.',
    }

    const invalidMethod = await request.get('/api/support', {
      headers: { origin: baseURL! },
    })
    expect(invalidMethod.status()).toBe(405)

    const invalidContentType = await request.post('/api/support', {
      headers: { origin: baseURL!, 'content-type': 'text/plain' },
      data: JSON.stringify(validBody),
    })
    expect(invalidContentType.status()).toBe(415)

    const invalidOrigin = await request.post('/api/support', {
      headers: { origin: 'https://cross-origin.invalid', 'content-type': 'application/json' },
      data: validBody,
    })
    expect(invalidOrigin.status()).toBe(403)

    const missingOrigin = await request.post('/api/support', {
      headers: { 'content-type': 'application/json' },
      data: validBody,
    })
    expect(missingOrigin.status()).toBe(403)

    for (const response of [invalidMethod, invalidContentType, invalidOrigin, missingOrigin]) {
      const body = await response.text()
      expect(body).not.toMatch(/guard@example\.invalid|rejected before persistence|dedupe|reference/i)
    }
  })

  test('partner referral remains preview-only and cannot display false success', async ({ page }) => {
    await mockAuthenticatedPortal(page)
    await page.goto('/portal/partner-referral')

    await expect(page.getByRole('heading', { name: 'Partner Referral' })).toBeVisible()
    await expect(page.getByText(/does not submit, create a record, send a notification, or generate a reference/i)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Submission unavailable in preview' })).toBeDisabled()
    await expect(page.locator('body')).not.toContainText(/submitted successfully|reference number|access granted/i)
    await assertNoHorizontalOverflow(page)
  })

  test('pay-it-forward submission surface stays preview-only and never grants access automatically', async ({ page }) => {
    await mockAuthenticatedPortal(page)
    await page.goto('/portal/support')

    await expect(page.getByRole('heading', { name: 'Support and pay-it-forward access' })).toBeVisible()
    await expect(page.getByText(/do not submit, create records, send notifications, generate references, or grant access/i)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Application unavailable in preview' })).toBeDisabled()
    await expect(page.locator('body')).not.toContainText(/membership active|access granted|approved automatically/i)
  })
})
