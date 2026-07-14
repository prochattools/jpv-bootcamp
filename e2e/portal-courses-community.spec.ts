import { expect, test } from '@playwright/test'

import {
  assertNoHorizontalOverflow,
  assertNoSeriousAccessibilityViolations,
  mockAuthenticatedPortalRoutes,
  mockRemovedMemberRoutes,
} from './fixtures/launchFixtures'

test.describe('canonical portal courses and community routes', () => {
  const removedRoot = `/${'learn'}`
  const removedHrefSelector = `a[href*="${removedRoot}"]`

  test('programme preview remains explicit and non-publishable', async ({ page }) => {
    await mockAuthenticatedPortalRoutes(page)

    await page.goto('/portal/programme')
    await expect(page.getByRole('heading', { name: '8-Week Programme' })).toBeVisible()
    await expect(
      page.getByText(/preview only\. this page must not imply client-approved content or publication readiness\./i),
    ).toBeVisible()
    await expect(page.getByText(/no approved programme package is loaded in runtime/i)).toBeVisible()
    await expect(page.getByRole('link', { name: 'View Pro membership' })).toHaveAttribute('href', '/portal/billing')
    await expect(page.locator('a[href="/upgrade"]')).toHaveCount(0)
    await expect(page.locator(removedHrefSelector)).toHaveCount(0)
    await assertNoHorizontalOverflow(page)
    await assertNoSeriousAccessibilityViolations(page)
  })

  test('course index, detail, and lesson surfaces use portal ownership only', async ({ page }) => {
    await mockAuthenticatedPortalRoutes(page)

    await page.goto('/portal/courses')
    await expect(page.getByRole('heading', { name: 'Courses' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Open course' })).toHaveAttribute('href', '/portal/courses/foundations')
    await expect(page.locator(removedHrefSelector)).toHaveCount(0)
    await assertNoHorizontalOverflow(page)
    await assertNoSeriousAccessibilityViolations(page)

    await page.goto('/portal/courses/foundations')
    await expect(page.getByRole('heading', { name: 'Foundations' })).toBeVisible()
    await expect(page.getByText('1/3 lessons complete')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Open' }).first()).toHaveAttribute(
      'href',
      '/portal/courses/foundations/lessons/welcome',
    )
    await expect(page.locator(removedHrefSelector)).toHaveCount(0)
    await assertNoHorizontalOverflow(page)
    await assertNoSeriousAccessibilityViolations(page)

    await page.goto('/portal/courses/foundations/lessons/principles')
    await expect(page.getByRole('heading', { name: 'Principles' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Download' })).toHaveAttribute(
      'href',
      '/portal/resources/resource_foundations_1',
    )
    await expect(page.getByRole('button', { name: 'Mark complete' })).toBeVisible()
    await expect(page.locator(removedHrefSelector)).toHaveCount(0)
    await assertNoHorizontalOverflow(page)
    await assertNoSeriousAccessibilityViolations(page)
  })

  test('community canonical routes and protected file links use portal ownership only', async ({ page }) => {
    await mockAuthenticatedPortalRoutes(page)

    await page.goto('/portal/community')
    await expect(page.getByRole('heading', { name: /community spaces appear according to your member access/i })).toBeVisible()
    await expect(page.getByText(/shown from persisted Payload data/i)).toBeVisible()
    await expect(page.getByRole('link', { name: 'Download file' })).toHaveAttribute(
      'href',
      '/portal/community/files/file_private_visible',
    )
    await expect(page.locator(removedHrefSelector)).toHaveCount(0)
    await assertNoHorizontalOverflow(page)
    await assertNoSeriousAccessibilityViolations(page)

    await page.goto('/portal/community/private-space')
    await expect(page.getByRole('heading', { name: 'Private Space' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Read-only member view' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Open discussion' })).toHaveAttribute(
      'href',
      '/portal/community/private-space/posts/post_visible',
    )
    await expect(page.getByRole('heading', { name: 'Create a post' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Submit for review' })).toHaveCount(0)
    await expect(page.locator(removedHrefSelector)).toHaveCount(0)

    await page.goto('/portal/community/private-space/posts/post_visible')
    await expect(page.getByRole('heading', { name: 'Visible discussion' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Read-only discussion view' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Download' })).toHaveAttribute(
      'href',
      '/portal/community/files/file_document_visible',
    )
    await expect(page.getByRole('heading', { name: 'Add a comment' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Submit reply for review' })).toHaveCount(0)
    await expect(page.locator(removedHrefSelector)).toHaveCount(0)

    await page.goto('/portal/community/moderation')
    await expect(page.getByRole('heading', { name: /review pending community submissions/i })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Review protected file' })).toHaveAttribute(
      'href',
      '/portal/community/files/file_private_pending?moderation=preview',
    )

    await page.goto('/portal/community/submissions')
    await expect(page.getByRole('heading', { name: /track your community submissions/i })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Download published file' })).toHaveAttribute(
      'href',
      '/portal/community/files/file_private_visible',
    )
    await expect(page.locator(removedHrefSelector)).toHaveCount(0)
    await assertNoHorizontalOverflow(page)
    await assertNoSeriousAccessibilityViolations(page)
  })

  test('representative removed member routes stay unavailable', async ({ page }) => {
    await mockRemovedMemberRoutes(page)

    for (const route of [
      removedRoot,
      `${removedRoot}/example-course`,
      `${removedRoot}/example-course/example-lesson`,
      `${removedRoot}/resources/example-resource`,
      `${removedRoot}/community`,
    ]) {
      const response = await page.goto(route)
      expect(response?.status()).toBe(404)
      await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
    }
  })
})
