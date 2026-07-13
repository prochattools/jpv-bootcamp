import { expect, test } from '@playwright/test'

import {
  TEST_MEMBER_EMAIL,
  adminDeniedHtml,
  assertNoHorizontalOverflow,
  assertNoSeriousAccessibilityViolations,
  captureBrowserDiagnostics,
  mockAdminDenial,
  mockAnonymousPortalRedirect,
  mockAuthenticatedPortal,
  mockLoginShell,
} from './fixtures/launchFixtures'

test.describe('authentication, portal, and administrator denial', () => {
  test('login shell loads and invalid login shows a safe error', async ({ page }) => {
    const diagnostics = captureBrowserDiagnostics(page)
    await mockLoginShell(page)
    await page.route('**/api/auth/member/login', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ ok: false, error: 'invalid_credentials' }),
      })
    })

    await page.goto('/portal?mode=login')
    await expect(page.getByRole('heading', { name: 'Member sign in' })).toBeVisible()
    await page.getByLabel('Email').fill(TEST_MEMBER_EMAIL)
    await page.getByLabel('Password').fill('not-a-real-password')
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page.getByRole('alert')).toContainText(
      'The email or password provided is incorrect, or this account cannot sign in.',
    )
    await expect(page).toHaveURL(/\/portal\?mode=login/)
    expect(await page.textContent('body')).not.toContain('not-a-real-password')
    expect(diagnostics.join('\n')).not.toMatch(/not-a-real-password|member@example\.invalid/i)
    await assertNoHorizontalOverflow(page)
    await assertNoSeriousAccessibilityViolations(page)
  })

  test('unauthenticated billing route reaches the login shell', async ({ page }) => {
    await mockAnonymousPortalRedirect(page)
    await page.goto('/portal/billing')
    await expect(page.getByRole('heading', { name: 'Member sign in' })).toBeVisible()
  })

  test('logout and expired-session notices remain safe', async ({ page }) => {
    await mockLoginShell(page)
    await page.goto('/portal?mode=login&loggedOut=1')
    await expect(page.getByRole('status')).toContainText('You have been signed out.')
    await expect(page.getByLabel('Password')).toHaveValue('')
  })

  test('mocked authenticated portal shell exposes launch navigation', async ({ page }) => {
    await mockAuthenticatedPortal(page)
    await page.goto('/portal')
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Member navigation' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Billing' })).toHaveAttribute('href', '/portal/billing')
    await expect(page.getByRole('link', { name: 'Account' })).toHaveAttribute('href', '/portal/account')
    await assertNoHorizontalOverflow(page)
    await assertNoSeriousAccessibilityViolations(page)
  })

  test('mocked authenticated billing and account routes render directly', async ({ page }) => {
    await mockAuthenticatedPortal(page)

    await page.goto('/portal/billing')
    await expect(page.getByRole('heading', { name: 'Billing' })).toBeVisible()
    await expect(page.getByRole('button', { name: '£80/month' })).toBeVisible()
    await expect(page.getByRole('button', { name: '£880 annual option paid upfront' })).toBeVisible()
    await expect(page.getByText('Initial 12-month commitment.')).toBeVisible()

    await page.goto('/portal/account')
    await expect(page.getByRole('heading', { name: 'Account' })).toBeVisible()
    await expect(page.getByText('Manage your member profile.')).toBeVisible()
  })

  test('anonymous and ordinary-member operator routes are denied', async ({ page }) => {
    await mockAdminDenial(page)

    for (const route of ['/admin/review', '/operations/sponsored-applications']) {
      const response = await page.goto(route)
      expect(response?.status()).toBe(404)
      await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
      await expect(page.getByText('This administrator route is unavailable to the current user.')).toBeVisible()
      await assertNoHorizontalOverflow(page)
    }
  })
})
