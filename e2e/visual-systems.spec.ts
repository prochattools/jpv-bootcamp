import { expect, test, type Page, type TestInfo } from '@playwright/test'

import {
  assertNoHorizontalOverflow,
  assertNoSeriousAccessibilityViolations,
  mockAuthenticatedPortal,
  mockAuthenticatedPortalRoutes,
  mockLoginShell,
  mockSafePublicDependencies,
} from './fixtures/launchFixtures'

async function assertVisualSurface(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  await expect(page.getByRole('main').first()).toBeVisible()
  await assertNoHorizontalOverflow(page)
  await assertNoSeriousAccessibilityViolations(page)

  const firstInteractive = page.locator('a:visible, button:visible, input:visible, textarea:visible, select:visible').first()
  if (await firstInteractive.count()) {
    await firstInteractive.focus()
    await expect(firstInteractive).toBeFocused()
  }

  await page.screenshot({
    path: testInfo.outputPath(`${name}.png`),
    fullPage: true,
    animations: 'disabled',
  })
}

test.describe('cross-surface visual system', () => {
  test('public and authentication surfaces remain responsive and accessible', async ({ page }, testInfo) => {
    await mockSafePublicDependencies(page)

    for (const [route, name] of [
      ['/', 'public-home'],
      ['/privacy', 'privacy'],
      ['/terms', 'terms'],
    ] as const) {
      await page.goto(route)
      await assertVisualSurface(page, testInfo, name)
    }

    await mockLoginShell(page)
    await page.goto('/portal?mode=login')
    await expect(page.getByRole('heading', { name: 'Member sign in' })).toBeVisible()
    await assertVisualSurface(page, testInfo, 'member-login')
  })

  test('member portal shells remain responsive and accessible', async ({ page }, testInfo) => {
    await mockAuthenticatedPortal(page)

    for (const [route, name] of [
      ['/portal', 'portal-home'],
      ['/portal/billing', 'portal-billing'],
      ['/portal/account', 'portal-account'],
      ['/portal/support', 'portal-support'],
      ['/portal/partner-referral', 'portal-partner-referral'],
    ] as const) {
      await page.goto(route)
      await assertVisualSurface(page, testInfo, name)
    }
  })

  test('course and community shells remain responsive and accessible', async ({ page }, testInfo) => {
    await mockAuthenticatedPortalRoutes(page)

    for (const [route, name] of [
      ['/portal/programme', 'portal-programme'],
      ['/portal/courses', 'portal-courses'],
      ['/portal/courses/foundations', 'portal-course-detail'],
      ['/portal/courses/foundations/lessons/principles', 'portal-lesson'],
      ['/portal/community', 'portal-community'],
      ['/portal/community/private-space', 'portal-community-space'],
      ['/portal/community/private-space/posts/post_visible', 'portal-community-post'],
      ['/portal/community/moderation', 'portal-community-moderation'],
      ['/portal/community/submissions', 'portal-community-submissions'],
    ] as const) {
      await page.goto(route)
      await assertVisualSurface(page, testInfo, name)
    }
  })
})
