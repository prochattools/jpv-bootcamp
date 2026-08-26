import { expect, test, type Page } from '@playwright/test'

import {
  TEST_SUPPORT_EMAIL,
  TEST_SUPPORT_QUESTION,
  assertNoHorizontalOverflow,
  assertNoSeriousAccessibilityViolations,
  captureBrowserDiagnostics,
  mockSafePublicDependencies,
} from './fixtures/launchFixtures'

test.beforeEach(async ({ page }) => {
  await mockSafePublicDependencies(page)
})

async function openSupportForm(page: Page): Promise<void> {
  await page.goto('/')
  const trigger = page.getByRole('button', { name: 'Support', exact: true })
  await trigger.scrollIntoViewIfNeeded()
  await trigger.click()
  await expect(page.getByRole('dialog', { name: 'Support' })).toBeVisible()
}

async function fillSupportForm(page: Page): Promise<void> {
  await page.getByLabel('Name').fill('Support Tester')
  await page.getByLabel('Email address').fill(TEST_SUPPORT_EMAIL)
  await page.getByLabel('How can we help?').fill(TEST_SUPPORT_QUESTION)
}

test.describe('durable support intake browser behavior', () => {
  test('required fields validate before a support request is sent', async ({ page }) => {
    let requestCount = 0
    await page.route('**/api/support', async (route) => {
      requestCount += 1
      await route.abort()
    })
    await openSupportForm(page)

    await page.getByRole('button', { name: 'Send question' }).click()
    await expect(page.getByLabel('Name')).toBeFocused()
    expect(await page.getByLabel('Name').evaluate((input: HTMLInputElement) => input.validity.valueMissing)).toBe(true)
    expect(requestCount).toBe(0)
  })

  test('pending submission prevents double submit and accepted request is saved for review', async ({ page }) => {
    const diagnostics = captureBrowserDiagnostics(page)
    let releaseResponse: (() => void) | undefined
    const responseGate = new Promise<void>((resolve) => {
      releaseResponse = resolve
    })
    let requestCount = 0

    await page.route('**/api/support', async (route) => {
      requestCount += 1
      await responseGate
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, accepted: true, duplicate: false }),
      })
    })

    await openSupportForm(page)
    await fillSupportForm(page)
    await page.getByRole('button', { name: 'Send question' }).click()

    await expect(page.getByRole('button', { name: 'Sending question…' })).toBeDisabled()
    await expect(page.getByRole('status')).toContainText('Saving your request…')
    await page.getByRole('button', { name: 'Sending question…' }).click({ force: true })
    expect(requestCount).toBe(1)

    releaseResponse?.()
    await expect(page.getByRole('status')).toContainText('Thanks. Your request has been saved for review.')
    await expect(page.getByLabel('Email address')).toHaveValue('')
    await expect(page.getByLabel('How can we help?')).toHaveValue('')

    const visibleText = await page.locator('body').innerText()
    const currentUrl = page.url()
    const diagnosticsText = diagnostics.join('\n')
    for (const forbidden of [
      TEST_SUPPORT_EMAIL,
      TEST_SUPPORT_QUESTION,
      'dedupe_key',
      'support-request-notification:',
      'internal-id',
      'reference',
      'email was delivered',
    ]) {
      expect(visibleText).not.toContain(forbidden)
      expect(currentUrl).not.toContain(forbidden)
      expect(diagnosticsText).not.toContain(forbidden)
    }
    await assertNoHorizontalOverflow(page)
    await assertNoSeriousAccessibilityViolations(page)
  })

  test('accepted duplicate displays the same safe durable success', async ({ page }) => {
    await page.route('**/api/support', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, accepted: true, duplicate: true }),
      })
    })

    await openSupportForm(page)
    await fillSupportForm(page)
    await page.getByRole('button', { name: 'Send question' }).click()
    await expect(page.getByRole('status')).toContainText('Thanks. Your request has been saved for review.')
    await expect(page.getByRole('status')).not.toContainText(/reference|email delivered/i)
  })

  test('retryable persistence failure displays safe retry wording', async ({ page }) => {
    await page.route('**/api/support', async (route) => {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: false,
          error: 'support_persistence_unavailable',
          retryable: true,
        }),
      })
    })

    await openSupportForm(page)
    await fillSupportForm(page)
    await page.getByRole('button', { name: 'Send question' }).click()
    await expect(page.getByRole('status')).toContainText(
      'We could not save your request. Please try again shortly.',
    )
    await expect(page.getByLabel('Email address')).toHaveValue(TEST_SUPPORT_EMAIL)
    await expect(page.getByLabel('How can we help?')).toHaveValue(TEST_SUPPORT_QUESTION)
    await expect(page.getByRole('status')).not.toContainText(/provider|database|dedupe|reference/i)
  })

  test('keyboard focus reaches support controls and status is announced', async ({ page }) => {
    await page.route('**/api/support', async (route) => {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ ok: false, error: 'support_persistence_unavailable', retryable: true }),
      })
    })
    await openSupportForm(page)

    await page.getByLabel('Name').focus()
    await expect(page.getByLabel('Name')).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(page.getByLabel('Email address')).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(page.getByLabel('How can we help?')).toBeFocused()

    await fillSupportForm(page)
    await page.getByRole('button', { name: 'Send question' }).click()
    const status = page.getByRole('status')
    await expect(status).toHaveAttribute('aria-live', 'polite')
    await expect(status).toHaveAttribute('aria-atomic', 'true')
  })
})
