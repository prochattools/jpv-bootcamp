import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, type Route } from '@playwright/test'

export const TEST_MEMBER_EMAIL = 'member@example.invalid'
export const TEST_SUPPORT_EMAIL = 'supporter@example.invalid'
export const TEST_SUPPORT_QUESTION = 'How can I access the current programme safely?'

const html = (title: string, body: string) => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: system-ui, sans-serif; color: #171717; }
    header, main { width: min(100% - 2rem, 72rem); margin-inline: auto; }
    header { display: flex; flex-wrap: wrap; gap: 1rem; padding-block: 1rem; }
    main { padding-block: 2rem; }
    nav { display: flex; flex-wrap: wrap; gap: 1rem; }
    a, button { min-height: 44px; display: inline-flex; align-items: center; }
    .notice { border: 1px solid #d4d4d4; padding: 1rem; border-radius: .5rem; }
  </style>
</head>
<body>${body}</body>
</html>`

export function portalPageHtml(section: 'home' | 'billing-checkout' | 'billing-active' | 'account' | 'referral' | 'support'): string {
  const content = {
    home: '<h1>Welcome back</h1><p>Your courses and member navigation are available.</p>',
    'billing-checkout': '<h1>Billing</h1><p>Choose a supported Pro billing option.</p><button data-billing="monthly">£80/month</button><button data-billing="annual">£880 annual option paid upfront</button><p>Initial 12-month commitment.</p><section><h2>Billing projection summary</h2><p>Projected plan: Free</p></section>',
    'billing-active': '<h1>Billing</h1><p>Manage your subscription, invoices, and payment methods through our secure billing portal.</p><section><h2>Subscription status</h2><p>Current plan</p><p>Pro</p><p>Billing cadence</p><p>Monthly commitment</p><p>Commitment state</p><p>Active</p></section><section><h2>Manage subscription</h2><button type="button">Manage billing</button><button type="button">Request end-of-term cancellation</button></section><section><h2>Billing projection summary</h2><p>Projected plan: Pro</p><p>Projected subscription status: Active</p></section>',
    account: '<h1>Account</h1><p>Manage your member profile.</p><section><h2>Profile</h2><label>Display name<input name="displayName" type="text" /></label><button type="button">Save profile</button></section><section><h2>Security</h2><label>Current password<input name="currentPassword" type="password" /></label><label>New password<input name="newPassword" type="password" /></label><button type="button">Change password</button></section><section><h2>Change email address</h2><label>New email address<input name="newEmail" type="email" /></label><button type="button">Request email change</button></section><section><h2>Access plans</h2><p>Pro</p></section><section><h2>Access groups</h2><p>Pro Courses</p></section><section><h2>Billing projection</h2><p>Status: Active</p></section>',
    referral: '<h1>Partner Referral</h1><div class="notice">Preview only — this form does not submit, create a record, send a notification, or generate a reference.</div><button disabled>Submission unavailable in preview</button>',
    support: '<h1>Support and Free access</h1><div class="notice">Preview only — these forms do not submit, create records, send notifications, generate references, or grant access.</div><form aria-label="Free access application preview"><label>Reason<textarea disabled></textarea></label><button disabled>Application unavailable in preview</button></form>',
  }[section]
  const billingScript = section === 'billing-checkout'
    ? `<script>document.addEventListener('click', async (event) => { const target = event.target; if (!(target instanceof HTMLButtonElement) || !target.dataset.billing) return; const response = await fetch('/api/stripe/checkout?plan=pro&billing=' + encodeURIComponent(target.dataset.billing), { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }); document.body.dataset.checkoutStatus = String(response.status); });</script>`
    : ''

  return html(
    `Portal ${section}`,
    `<header><nav aria-label="Member navigation"><a href="/portal">Portal</a><a href="/portal/billing">Billing</a><a href="/portal/account">Account</a><a href="/portal/support">Support</a><a href="/portal/partner-referral">Partner referral</a><a href="/logout">Log out</a></nav></header><main>${content}</main>${billingScript}`,
  )
}

export function loginPageHtml(loggedOut = false): string {
  return html(
    'Member sign in',
    `<main><h1>Member sign in</h1>${loggedOut ? '<p role="status">You have been signed out.</p>' : ''}<form id="login-form"><label>Email<input name="email" type="email" autocomplete="email" required /></label><label>Password<input name="password" type="password" autocomplete="current-password" required /></label><button type="submit">Sign in</button><p id="login-error" role="alert" hidden></p></form><script>document.getElementById('login-form').addEventListener('submit', async (event) => { event.preventDefault(); const form = event.currentTarget; const response = await fetch('/api/auth/member/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: form.email.value, password: form.password.value }) }); if (!response.ok) { const error = document.getElementById('login-error'); error.hidden = false; error.textContent = 'The email or password provided is incorrect, or this account cannot sign in.'; form.password.value = ''; } });</script></main>`,
  )
}

export async function mockLoginShell(page: Page): Promise<void> {
  await page.route('**/portal**', async (route) => {
    const url = new URL(route.request().url())
    if (
      route.request().resourceType() !== 'document' ||
      url.pathname !== '/portal' ||
      url.searchParams.get('mode') !== 'login'
    ) {
      await route.continue()
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: loginPageHtml(url.searchParams.get('loggedOut') === '1'),
    })
  })
}

export function adminDeniedHtml(): string {
  return html(
    'Not found',
    '<main><h1>Page not found</h1><p>This administrator route is unavailable to the current user.</p><a href="/portal">Return to portal</a></main>',
  )
}

export async function mockAuthenticatedPortal(
  page: Page,
  options: { billingState?: 'checkout' | 'active' } = {},
): Promise<void> {
  const billingState = options.billingState ?? 'checkout'
  await page.route('**/portal', async (route) => fulfillPortalDocument(route, 'home'))
  await page.route('**/portal/billing', async (route) =>
    fulfillPortalDocument(route, billingState === 'active' ? 'billing-active' : 'billing-checkout'),
  )
  await page.route('**/portal/account', async (route) => fulfillPortalDocument(route, 'account'))
  await page.route('**/portal/support', async (route) => fulfillPortalDocument(route, 'support'))
  await page.route('**/portal/partner-referral', async (route) => fulfillPortalDocument(route, 'referral'))
}

async function fulfillPortalDocument(
  route: Route,
  section: 'home' | 'billing-checkout' | 'billing-active' | 'account' | 'referral' | 'support',
): Promise<void> {
  if (route.request().resourceType() !== 'document') {
    await route.continue()
    return
  }
  await route.fulfill({ status: 200, contentType: 'text/html', body: portalPageHtml(section) })
}

export async function mockAnonymousPortalRedirect(page: Page): Promise<void> {
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (route.request().resourceType() !== 'document') {
      await route.continue()
      return
    }
    if (url.pathname !== '/portal/billing') {
      await route.continue()
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: loginPageHtml(),
    })
  })
}

export async function mockAdminDenial(page: Page): Promise<void> {
  for (const pattern of ['**/admin/review', '**/operations/sponsored-applications']) {
    await page.route(pattern, async (route) => {
      if (route.request().resourceType() !== 'document') {
        await route.continue()
        return
      }
      await route.fulfill({ status: 404, contentType: 'text/html', body: adminDeniedHtml() })
    })
  }
}

export async function mockSafePublicDependencies(page: Page): Promise<void> {
  await page.route('**/api/sponsored-seats/available', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, counts: { total: 0, used: 0, available: 0 } }),
    })
  })
  await page.route('**/api/sponsored-seats/checkout', async (route) => {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ ok: false, error: 'provider_disabled_in_e2e' }),
    })
  })
}

export async function mockCheckoutProvider(page: Page): Promise<string[]> {
  const requests: string[] = []
  await page.route('**/api/stripe/checkout**', async (route) => {
    const requestUrl = new URL(route.request().url())
    requests.push(requestUrl.toString())
    const billing = requestUrl.searchParams.get('billing')
    const plan = requestUrl.searchParams.get('plan')
    const unsafeKeys = ['amount', 'price', 'returnUrl', 'successUrl', 'cancelUrl']
    const unsafe = unsafeKeys.some((key) => requestUrl.searchParams.has(key))

    if (plan !== 'pro' || !['monthly', 'annual'].includes(billing ?? '') || unsafe) {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ ok: false, error: 'invalid_checkout_request' }),
      })
      return
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, url: '/portal/billing?checkout=mocked' }),
    })
  })
  return requests
}

export async function assertNoSeriousAccessibilityViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze()
  const serious = results.violations.filter((violation) =>
    ['serious', 'critical'].includes(violation.impact ?? ''),
  )
  expect(serious, JSON.stringify(serious, null, 2)).toEqual([])
}

export async function assertNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
  expect(overflow).toBe(false)
}

export function captureBrowserDiagnostics(page: Page): string[] {
  const diagnostics: string[] = []
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) diagnostics.push(message.text())
  })
  page.on('pageerror', (error) => diagnostics.push(error.message))
  return diagnostics
}
