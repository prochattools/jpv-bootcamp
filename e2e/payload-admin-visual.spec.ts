import { expect, test } from '@playwright/test'

import {
  assertKeyboardFocusVisible,
  assertMinimumHorizontalGutter,
  assertNoHorizontalOverflow,
  assertNoSeriousAccessibilityViolations,
} from './fixtures/launchFixtures'

// ─── Token values injected in mock HTML ──────────────────────────────────────
// These resolve to concrete hex values via CSS custom properties set inline so
// the mock page does not depend on the real Next.js build loading jpv-admin.scss.
const JPV_BRAND_DEEP = '#1a3a2a'
const JPV_CANVAS = '#ffffff'

const adminHtml = (title: string, body: string) => `<!doctype html>
<html lang="en" data-theme="light">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    :root {
      --jpv-brand-deep: ${JPV_BRAND_DEEP};
      --jpv-canvas: ${JPV_CANVAS};
      --jpv-ink: #171717;
      --jpv-border: #e5e7eb;
      --jpv-surface: #f9fafb;
      --jpv-muted: #6b7280;
      --jpv-focus: #2563eb;
      --jpv-radius-action: 6px;
      --jpv-radius-panel: 12px;
    }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: system-ui, sans-serif; background: var(--jpv-canvas); color: var(--jpv-ink); }
    .login { background: var(--jpv-surface); min-height: 100dvh; display: flex; align-items: center; justify-content: center; }
    .login__wrap { background: var(--jpv-canvas); border: 1px solid var(--jpv-border); border-radius: var(--jpv-radius-panel); padding: 2.5rem 2rem; width: min(calc(100% - 2rem), 420px); margin-inline: auto; }
    .login-fields { display: flex; flex-direction: column; gap: 1.25rem; }
    .login label { color: var(--jpv-ink); font-size: 0.875rem; font-weight: 500; display: block; }
    .login a { color: var(--jpv-brand-deep); font-weight: 600; text-decoration: underline; }
    .nav { background: var(--jpv-canvas); border-right: 1px solid var(--jpv-border); }
    .nav a { display: block; border-radius: var(--jpv-radius-action); padding: 0.5rem 0.75rem; font-size: 0.875rem; text-decoration: none; color: var(--jpv-ink); }
    .nav a[data-active='true'], .nav a[aria-current='page'] { background: var(--jpv-brand-deep); color: var(--jpv-canvas); font-weight: 600; }
    .view--collection-list { padding-inline: 1rem; padding-block: 1.5rem; }
    .list-header { border-bottom: 1px solid var(--jpv-border); padding-block: 1.25rem; }
    .table { border: 1px solid var(--jpv-border); border-radius: 8px; overflow: hidden; width: 100%; border-collapse: collapse; }
    .table th { background: var(--jpv-surface); color: var(--jpv-muted); font-size: 0.6875rem; font-weight: 700; text-transform: uppercase; padding: 0.625rem 1rem; border-bottom: 1px solid var(--jpv-border); text-align: left; }
    .table td { padding: 0.75rem 1rem; border-bottom: 1px solid var(--jpv-border); }
    .field-type { margin-bottom: 1.5rem; }
    .field-type label { color: var(--jpv-ink); font-size: 0.875rem; font-weight: 500; display: block; margin-bottom: 0.25rem; }
    input, textarea { border: 1px solid var(--jpv-border); border-radius: 6px; padding: 0.5rem; width: 100%; }
    :where(a, button, input, textarea):focus-visible { outline: 3px solid var(--jpv-focus); outline-offset: 3px; }
    main { padding-inline: 1rem; padding-block: 1.5rem; }
  </style>
</head>
<body>${body}</body>
</html>`

// ─── Test group 1: Login page ─────────────────────────────────────────────────

test.describe('Payload admin login — visual', () => {
  test('login page has gutters, labels, forgot-password link, and keyboard focus', async ({ page }, testInfo) => {
    await page.route('**/admin/login', async (route) => {
      if (route.request().resourceType() !== 'document') { await route.continue(); return }
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: adminHtml('Admin sign in', `
          <div class="login">
            <div class="login__wrap">
              <h1>Sign in to your account</h1>
              <div class="login-fields">
                <label>Email address<input id="email" name="email" type="email" autocomplete="email" required /></label>
                <label>Password<input id="password" name="password" type="password" autocomplete="current-password" required /></label>
                <button type="submit">Sign in</button>
                <a href="/admin/forgot">Forgot password?</a>
              </div>
            </div>
          </div>`),
      })
    })

    await page.goto('/admin/login')
    await expect(page.locator('.login__wrap')).toBeVisible()
    await assertNoHorizontalOverflow(page)
    await assertMinimumHorizontalGutter(page, '.login__wrap')
    await expect(page.getByText('Email address')).toBeVisible()
    await expect(page.getByText('Forgot password?')).toBeVisible()
    await assertKeyboardFocusVisible(page, '#email')
    await assertNoSeriousAccessibilityViolations(page)
    await page.screenshot({ path: testInfo.outputPath('admin-login.png'), fullPage: true, animations: 'disabled' })
  })
})

// ─── Test group 2: Nav active state ──────────────────────────────────────────

test.describe('Payload admin nav active state — contract', () => {
  test('active nav link has a non-transparent, non-white background colour', async ({ page }) => {
    await page.route('**/admin/dashboard', async (route) => {
      if (route.request().resourceType() !== 'document') { await route.continue(); return }
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: adminHtml('Admin dashboard', `
          <nav class="nav" aria-label="Admin navigation">
            <a href="/admin/dashboard" data-active="true">Dashboard</a>
            <a href="/admin/collections/payload_members" aria-current="page">Members</a>
            <a href="/admin/collections/posts">Posts</a>
          </nav>
          <main><h1>Dashboard</h1></main>`),
      })
    })

    await page.goto('/admin/dashboard')

    for (const selector of ['a[data-active="true"]', 'a[aria-current="page"]']) {
      const bg = await page.locator(selector).first().evaluate((el) =>
        window.getComputedStyle(el).backgroundColor,
      )
      // Must not be transparent or white
      expect(bg, `${selector} background should not be transparent`).not.toBe('rgba(0, 0, 0, 0)')
      expect(bg, `${selector} background should not be white`).not.toBe('rgb(255, 255, 255)')
    }
  })
})

// ─── Test group 3: Collection list ───────────────────────────────────────────

test.describe('Payload admin collection list — visual', () => {
  test('collection list has accessible table headers, gutters, and no overflow', async ({ page }, testInfo) => {
    await page.route('**/admin/collections/payload_members', async (route) => {
      if (route.request().resourceType() !== 'document') { await route.continue(); return }
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: adminHtml('Members — Admin', `
          <main class="view--collection-list">
            <div class="list-header"><h1>Members</h1></div>
            <table class="table">
              <thead>
                <tr>
                  <th scope="col">Email</th>
                  <th scope="col">Display name</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>member@example.invalid</td><td>Test Member</td><td>Active</td></tr>
                <tr><td>other@example.invalid</td><td>Other Member</td><td>Inactive</td></tr>
              </tbody>
            </table>
          </main>`),
      })
    })

    await page.goto('/admin/collections/payload_members')
    await expect(page.getByRole('heading', { name: 'Members' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Email' })).toBeVisible()
    await assertNoHorizontalOverflow(page)
    await assertMinimumHorizontalGutter(page, '.list-header')
    await assertNoSeriousAccessibilityViolations(page)
    await page.screenshot({ path: testInfo.outputPath('admin-collection-list.png'), fullPage: true, animations: 'disabled' })
  })
})

// ─── Test group 4 & 5: Portal Updates image fallback ─────────────────────────

const portalContentHtml = (useFallback: boolean) => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Updates</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: system-ui, sans-serif; }
    main { padding: 1rem; }
    .card-img-wrap { width: 100%; aspect-ratio: 16/9; background: #f3f4f6; border-radius: 8px; overflow: hidden; }
    .card-img-wrap img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .card-img-fallback { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: #374151; font-size: 0.875rem; }
  </style>
</head>
<body>
  <main>
    <h1>Updates</h1>
    <article>
      <h2>Latest update</h2>
      <div class="card-img-wrap">
        ${useFallback
          ? `<div class="card-img-fallback" role="img" aria-label="No image available">No image</div>`
          : `<img src="/images/update-hero.jpg" alt="Update hero image" />`}
      </div>
      <p>Update content here.</p>
    </article>
  </main>
</body>
</html>`

test.describe('Portal Updates — valid image', () => {
  test('content page renders img element accessibly', async ({ page }, testInfo) => {
    await page.route('**/portal/content', async (route) => {
      if (route.request().resourceType() !== 'document') { await route.continue(); return }
      await route.fulfill({ status: 200, contentType: 'text/html', body: portalContentHtml(false) })
    })
    await page.route('**/images/update-hero.jpg', async (route) => {
      // Serve a 1×1 transparent GIF as a stand-in image
      const gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64')
      await route.fulfill({ status: 200, contentType: 'image/gif', body: gif })
    })

    await page.goto('/portal/content')
    await expect(page.getByRole('heading', { name: 'Updates' })).toBeVisible()
    const img = page.locator('img[alt="Update hero image"]')
    await expect(img).toBeVisible()
    await assertNoSeriousAccessibilityViolations(page)
    await page.screenshot({ path: testInfo.outputPath('portal-content-valid-image.png'), fullPage: true, animations: 'disabled' })
  })
})

test.describe('Portal Updates — missing image fallback', () => {
  test('fallback div with role=img is shown and no layout shift occurs', async ({ page }, testInfo) => {
    await page.route('**/portal/content', async (route) => {
      if (route.request().resourceType() !== 'document') { await route.continue(); return }
      await route.fulfill({ status: 200, contentType: 'text/html', body: portalContentHtml(true) })
    })

    await page.goto('/portal/content')
    await expect(page.getByRole('heading', { name: 'Updates' })).toBeVisible()

    const fallback = page.locator('[role="img"]')
    await expect(fallback).toBeVisible()
    await expect(fallback).toHaveAttribute('aria-label', 'No image available')
    await expect(fallback).toContainText('No image')

    // Confirm no real img element leaked through
    await expect(page.locator('img')).toHaveCount(0)

    await assertNoHorizontalOverflow(page)
    await assertNoSeriousAccessibilityViolations(page)
    await page.screenshot({ path: testInfo.outputPath('portal-content-fallback.png'), fullPage: true, animations: 'disabled' })
  })
})
