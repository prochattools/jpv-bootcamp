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
  mockRemovedMemberRoutes,
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

  test('removed member routes return not-found behavior', async ({ page }) => {
    await mockRemovedMemberRoutes(page)

    const removedRoot = `/${'learn'}`
    for (const route of [removedRoot, `${removedRoot}/account`, `${removedRoot}/billing`, `${removedRoot}/login`]) {
      const response = await page.goto(route)
      expect(response?.status()).toBe(404)
      await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
      await expect(page.getByText('This route is no longer available.')).toBeVisible()
    }
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
    await expect(page.getByRole('heading', { name: 'Billing', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: '£80/month' })).toBeVisible()
    await expect(page.getByRole('button', { name: '£800/year' })).toBeVisible()
    await expect(page.getByText('No minimum commitment.')).toBeVisible()

    await page.goto('/portal/account')
    await expect(page.getByRole('heading', { name: 'Account' })).toBeVisible()
    await expect(page.getByText('Manage your member profile.')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Security' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Change email address' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Access plans' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Access groups' })).toBeVisible()
    await page.getByRole('textbox', { name: 'Display name' }).focus()
    await expect(page.getByRole('textbox', { name: 'Display name' })).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(page.getByRole('button', { name: 'Save profile' })).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(page.getByLabel('Current password')).toBeFocused()
    await assertNoHorizontalOverflow(page)
    await assertNoSeriousAccessibilityViolations(page)
  })

  test('mocked authenticated billing route exposes portal and cancellation controls when active', async ({ page }) => {
    await mockAuthenticatedPortal(page, { billingState: 'active' })

    await page.goto('/portal/billing')
    await expect(page.getByRole('heading', { name: 'Billing', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Subscription status' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Manage subscription' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Manage billing' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Request end-of-term cancellation' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Billing projection summary' })).toBeVisible()
    await assertNoHorizontalOverflow(page)
    await assertNoSeriousAccessibilityViolations(page)
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
