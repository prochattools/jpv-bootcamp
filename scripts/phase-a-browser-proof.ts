/**
 * Phase A browser proof — takes screenshots at 390x844 (mobile) and 1280x900 (desktop)
 * of the token-hardened portal components using the real CSS from globals.scss + Tailwind.
 *
 * Renders the actual JSX output of each changed page section as static HTML,
 * injects the JPV CSS variables and compiled utility classes, and screenshots each state.
 *
 * Run: pnpm exec tsx scripts/phase-a-browser-proof.ts
 */

import { chromium } from 'playwright'
import { writeFileSync } from 'fs'
import { resolve } from 'path'

const OUT_DIR = resolve(__dirname, '../docs/phase-a-screenshots')

const JPV_VARS = `
  --jpv-brand: #2f805b;
  --jpv-brand-hover: #276e4f;
  --jpv-brand-deep: #123d2d;
  --jpv-brand-bright: #6bcf8a;
  --jpv-sunshine: #e8c65a;
  --jpv-sunshine-ink: #6f5a1f;
  --jpv-danger: #c94f4f;
  --jpv-danger-surface: #f8ece8;
  --jpv-danger-ink: #78463d;
  --jpv-canvas: #fffefa;
  --jpv-surface: #f5f3ec;
  --jpv-surface-strong: #e8ece7;
  --jpv-ink: #24332b;
  --jpv-muted: #687068;
  --jpv-inverse-muted: #c7d3cc;
  --jpv-border: #dedbd1;
  --jpv-focus: #123d2d;
  --jpv-radius-detail: 4px;
  --jpv-radius-control: 8px;
  --jpv-radius-action: 8px;
  --jpv-radius-card: 10px;
  --jpv-radius-panel: 14px;
  --jpv-radius-pill: 999px;
`

const BASE_CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root { ${JPV_VARS} }
  html { background: var(--jpv-canvas); color-scheme: light; }
  body { background: var(--jpv-canvas); color: var(--jpv-ink); font-family: system-ui, sans-serif; font-size: 16px; line-height: 1.5; padding: 24px; }

  /* jpv-button-primary */
  .jpv-button-primary, .jpv-button-secondary {
    display: inline-flex; min-height: 44px; align-items: center; justify-content: center;
    gap: 0.5rem; border-radius: var(--jpv-radius-action); padding: 0.7rem 1.25rem;
    font-size: 0.875rem; font-weight: 700; line-height: 1.2; text-align: center;
    transition: background-color 180ms ease-out, border-color 180ms ease-out, color 180ms ease-out;
    cursor: pointer; text-decoration: none;
  }
  .jpv-button-primary {
    border: 1px solid var(--jpv-brand-deep); background: var(--jpv-brand-deep); color: var(--jpv-canvas);
  }
  .jpv-button-primary:hover { border-color: var(--jpv-brand); background: var(--jpv-brand); }
  .jpv-button-secondary {
    border: 1px solid var(--jpv-border); background: transparent; color: var(--jpv-ink);
  }
  .jpv-button-secondary:hover { border-color: var(--jpv-brand-deep); background: var(--jpv-surface); }
  .jpv-button-primary:disabled, .jpv-button-secondary:disabled { cursor: not-allowed; opacity: 0.55; }

  /* jpv-eyebrow */
  .jpv-eyebrow {
    font-size: 0.75rem; font-weight: 700; letter-spacing: 0.12em; line-height: 1.4;
    text-transform: uppercase; color: var(--jpv-brand-deep);
  }

  /* jpv-notice */
  .jpv-notice {
    border: 1px solid var(--jpv-border); border-radius: var(--jpv-radius-card);
    background: var(--jpv-surface); padding: 0.75rem 1rem; color: var(--jpv-ink);
  }
  .jpv-notice-danger {
    border-color: color-mix(in srgb, var(--jpv-danger) 38%, var(--jpv-border));
    background: color-mix(in srgb, var(--jpv-danger) 8%, var(--jpv-canvas));
    color: color-mix(in srgb, var(--jpv-danger) 82%, var(--jpv-ink));
  }

  /* Utility classes used in portal pages */
  .rounded-2xl { border-radius: 1rem; }
  .rounded-xl { border-radius: 0.75rem; }
  .rounded-full { border-radius: 9999px; }
  .rounded-lg { border-radius: 0.5rem; }
  .border { border: 1px solid var(--jpv-border); }
  .border-neutral-200 { border: 1px solid #e5e5e5; }
  .bg-white { background: #ffffff; }
  .bg-neutral-100 { background: #f5f5f5; }
  .bg-emerald-50 { background: #ecfdf5; }
  .text-emerald-700 { color: #047857; }
  .text-neutral-700 { color: #404040; }
  .text-neutral-600 { color: #525252; }
  .text-neutral-500 { color: #737373; }
  .text-neutral-950 { color: #0a0a0a; }
  .shadow-sm { box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05); }
  .p-8 { padding: 2rem; }
  .p-6 { padding: 1.5rem; }
  .p-5 { padding: 1.25rem; }
  .px-4 { padding-left: 1rem; padding-right: 1rem; }
  .py-3 { padding-top: 0.75rem; padding-bottom: 0.75rem; }
  .px-3 { padding-left: 0.75rem; padding-right: 0.75rem; }
  .py-1 { padding-top: 0.25rem; padding-bottom: 0.25rem; }
  .mt-1 { margin-top: 0.25rem; }
  .mt-2 { margin-top: 0.5rem; }
  .mt-3 { margin-top: 0.75rem; }
  .mt-4 { margin-top: 1rem; }
  .mt-5 { margin-top: 1.25rem; }
  .space-y-8 > * + * { margin-top: 2rem; }
  .space-y-4 > * + * { margin-top: 1rem; }
  .space-y-5 > * + * { margin-top: 1.25rem; }
  .flex { display: flex; }
  .inline-flex { display: inline-flex; }
  .flex-col { flex-direction: column; }
  .flex-wrap { flex-wrap: wrap; }
  .items-center { align-items: center; }
  .items-start { align-items: flex-start; }
  .justify-between { justify-content: space-between; }
  .gap-2 { gap: 0.5rem; }
  .gap-3 { gap: 0.75rem; }
  .gap-4 { gap: 1rem; }
  .gap-5 { gap: 1.25rem; }
  .shrink-0 { flex-shrink: 0; }
  .text-xl { font-size: 1.25rem; line-height: 1.75rem; }
  .text-2xl { font-size: 1.5rem; line-height: 2rem; }
  .text-3xl { font-size: 1.875rem; line-height: 2.25rem; }
  .text-lg { font-size: 1.125rem; line-height: 1.75rem; }
  .text-sm { font-size: 0.875rem; line-height: 1.25rem; }
  .text-xs { font-size: 0.75rem; line-height: 1rem; }
  .font-semibold { font-weight: 600; }
  .font-bold { font-weight: 700; }
  .font-medium { font-weight: 500; }
  .leading-6 { line-height: 1.5rem; }
  .tracking-tight { letter-spacing: -0.025em; }
  .max-w-3xl { max-width: 48rem; }
  .w-full { width: 100%; }
  .text-left { text-align: left; }
  .opacity-75 { opacity: 0.75; }
  .opacity-60 { opacity: 0.60; }
  .block { display: block; }
  .bg-\\[var\\(--jpv-brand-deep\\)\\] { background: var(--jpv-brand-deep); }
  .text-\\[var\\(--jpv-canvas\\)\\] { color: var(--jpv-canvas); }

  /* focus-visible ring */
  :where(a, button):focus-visible { outline: 3px solid var(--jpv-focus); outline-offset: 3px; }

  .section-label { font-size: 0.8rem; color: #888; font-style: italic; margin-bottom: 8px; }
  .proof-section { margin-bottom: 32px; }
`

type Scenario = {
  name: string
  html: string
}

const scenarios: Scenario[] = [
  {
    name: '1-lesson-locked-state',
    html: `
      <h2 class="section-label">Lesson page — locked/unavailable (jpv-notice-danger)</h2>
      <section class="jpv-notice jpv-notice-danger rounded-2xl p-8">
        <p class="jpv-eyebrow">Lesson unavailable</p>
        <h1 class="mt-3 text-2xl font-semibold">This lesson is currently locked</h1>
        <p class="mt-3 text-sm leading-6">Your account does not currently have access to this lesson.</p>
        <p class="jpv-notice mt-4 rounded-xl px-4 py-3 text-sm font-medium">
          Complete the previous lesson before opening this one.
        </p>
      </section>
    `,
  },
  {
    name: '2-lesson-coming-soon',
    html: `
      <h2 class="section-label">Lesson content section — coming soon (jpv-notice neutral)</h2>
      <section class="rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
        <h2 class="text-xl font-semibold">Lesson content</h2>
        <div class="jpv-notice mt-5 rounded-xl px-4 py-3">
          <p class="text-sm font-semibold">Coming soon</p>
          <p class="mt-1 text-sm">This lesson will be available shortly.</p>
        </div>
      </section>
    `,
  },
  {
    name: '3-lesson-preview-badge',
    html: `
      <h2 class="section-label">Lesson header — preview badge (emerald, not blue)</h2>
      <section class="rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
        <p class="jpv-eyebrow">Module 1: Foundations</p>
        <div class="mt-3 flex flex-col gap-5">
          <div class="max-w-3xl">
            <h1 class="text-3xl font-semibold tracking-tight">Welcome and How to Use the Bootcamp</h1>
            <p class="mt-4 text-sm leading-6 text-neutral-600">This lesson walks you through the core principles.</p>
          </div>
          <div class="flex flex-wrap gap-2 text-xs font-semibold">
            <span class="rounded-full bg-neutral-100 px-3 py-1 text-neutral-700">8 min</span>
            <span class="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">Preview</span>
            <span class="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">Complete</span>
          </div>
        </div>
      </section>
    `,
  },
  {
    name: '4-lesson-mark-complete-button',
    html: `
      <h2 class="section-label">Lesson progress section — Mark complete (jpv-button-primary)</h2>
      <section class="flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div>
          <h2 class="font-semibold">Lesson progress</h2>
          <p class="mt-1 text-sm text-neutral-600">Mark this lesson complete when you are ready to continue.</p>
        </div>
        <form>
          <button class="jpv-button-primary" type="submit">Mark complete</button>
        </form>
      </section>
      <section class="flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm mt-4">
        <div>
          <h2 class="font-semibold">Download resource</h2>
        </div>
        <a class="jpv-button-primary inline-flex shrink-0" href="#">Download</a>
      </section>
    `,
  },
  {
    name: '5-dashboard-continue-lesson-cta',
    html: `
      <h2 class="section-label">Portal dashboard — Continue lesson CTA (jpv-button-primary)</h2>
      <div class="space-y-8">
        <section>
          <p class="jpv-eyebrow">JPV Bootcamp</p>
          <h1 class="mt-3 text-3xl font-semibold tracking-tight">Welcome back</h1>
          <p class="mt-3 max-w-3xl text-sm leading-6 text-neutral-600">Continue your learning, review your available courses, and manage your member account.</p>
        </section>
        <section class="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <p class="jpv-eyebrow">Continue learning</p>
          <h2 class="mt-3 text-xl font-semibold">Welcome and How to Use the Bootcamp</h2>
          <p class="mt-2 text-sm text-neutral-600">Foundations</p>
          <a class="jpv-button-primary mt-5 inline-flex" href="#">Continue lesson</a>
        </section>
      </div>
    `,
  },
  {
    name: '6-courses-page-open-course-cta',
    html: `
      <h2 class="section-label">Courses page — Open course CTA (jpv-button-primary)</h2>
      <div class="space-y-8">
        <section>
          <p class="jpv-eyebrow">Learning</p>
          <h1 class="mt-3 text-3xl font-semibold tracking-tight">Courses</h1>
        </section>
        <article class="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <div class="flex items-start justify-between gap-4">
            <div>
              <h2 class="text-xl font-semibold">Foundations</h2>
              <p class="mt-2 text-sm leading-6 text-neutral-600">Core principles and practical foundations for the JPV approach.</p>
            </div>
            <span class="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Available</span>
          </div>
          <a class="jpv-button-primary mt-6 inline-flex" href="#">Open course</a>
        </article>
      </div>
    `,
  },
  {
    name: '7-course-detail-locked-lesson-open-button',
    html: `
      <h2 class="section-label">Course detail — lesson list: locked/coming-soon/preview badges + Open button (jpv-button-primary)</h2>
      <section>
        <article class="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <p class="jpv-eyebrow">Module 1</p>
          <h2 class="mt-2 text-xl font-semibold">Start Here</h2>
          <ol class="mt-6" style="list-style:none">
            <li class="flex items-center justify-between gap-4 py-4" style="border-bottom:1px solid #e5e5e5">
              <div>
                <p class="text-xs font-medium text-neutral-500">Lesson 1</p>
                <h3 class="mt-1 font-semibold text-neutral-950">Welcome</h3>
              </div>
              <div class="flex shrink-0 items-center gap-3">
                <span class="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Complete</span>
                <a class="jpv-button-primary" href="#">Open</a>
              </div>
            </li>
            <li class="flex items-center justify-between gap-4 py-4" style="border-bottom:1px solid #e5e5e5">
              <div>
                <p class="text-xs font-medium text-neutral-500">Lesson 2</p>
                <h3 class="mt-1 font-semibold text-neutral-950">Principles</h3>
              </div>
              <div class="flex shrink-0 items-center gap-3">
                <span class="jpv-notice jpv-notice-danger rounded-full px-3 py-1 text-xs font-semibold">Locked</span>
                <a class="jpv-button-primary" href="#">Open</a>
              </div>
            </li>
            <li class="flex items-center justify-between gap-4 py-4" style="border-bottom:1px solid #e5e5e5">
              <div>
                <p class="text-xs font-medium text-neutral-500">Lesson 3</p>
                <h3 class="mt-1 font-semibold text-neutral-950">Advanced Module</h3>
              </div>
              <div class="flex shrink-0 items-center gap-3">
                <span class="jpv-notice rounded-full px-3 py-1 text-xs font-semibold">Coming soon</span>
                <a class="jpv-button-primary" href="#">Open</a>
              </div>
            </li>
            <li class="flex items-center justify-between gap-4 py-4">
              <div>
                <p class="text-xs font-medium text-neutral-500">Lesson 4</p>
                <h3 class="mt-1 font-semibold text-neutral-950">Bonus Preview</h3>
              </div>
              <div class="flex shrink-0 items-center gap-3">
                <span class="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Preview</span>
                <a class="jpv-button-primary" href="#">Open</a>
              </div>
            </li>
          </ol>
        </article>
      </section>
    `,
  },
  {
    name: '8-billing-portal-button',
    html: `
      <h2 class="section-label">BillingPortalButton — normal and disabled states (jpv-button-primary)</h2>
      <div class="space-y-4">
        <div class="space-y-4">
          <button type="button" class="jpv-button-primary">Manage billing</button>
          <button type="button" class="jpv-button-primary" disabled>Opening...</button>
        </div>
      </div>
    `,
  },
  {
    name: '9-checkout-buttons-monthly-annual',
    html: `
      <h2 class="section-label">MemberCheckoutButtons — monthly (primary) vs annual (secondary) hierarchy</h2>
      <div class="space-y-5">
        <section class="rounded-2xl border border-neutral-200 bg-white p-5">
          <h3 class="text-lg font-semibold text-neutral-950">JPV Bootcamp Membership — Monthly</h3>
          <p class="mt-2 text-sm leading-6 text-neutral-700">£80 each month. No minimum commitment.</p>
          <button type="button" class="jpv-button-primary mt-5 w-full text-left">
            <span class="block font-semibold">Start monthly membership — pay £80 now</span>
            <span class="mt-1 block text-xs opacity-75">Monthly recurring subscription</span>
          </button>
        </section>
        <section class="rounded-2xl border border-neutral-200 bg-white p-5">
          <h3 class="text-lg font-semibold text-neutral-950">JPV Bootcamp Membership — Annual</h3>
          <p class="mt-2 text-sm leading-6 text-neutral-700">£800 upfront for 12 months.</p>
          <button type="button" class="jpv-button-secondary mt-5 w-full text-left">
            <span class="block font-semibold">Start annual membership — pay £800 now</span>
            <span class="mt-1 block text-xs opacity-60">Annual recurring subscription</span>
          </button>
        </section>
        <section class="rounded-2xl border border-neutral-200 bg-white p-5">
          <h3 class="font-semibold mb-2 text-sm text-neutral-600">Disabled states (consent not accepted)</h3>
          <div class="flex gap-3">
            <button type="button" class="jpv-button-primary" disabled>Start monthly (disabled)</button>
            <button type="button" class="jpv-button-secondary" disabled>Start annual (disabled)</button>
          </div>
        </section>
      </div>
    `,
  },
]

type ProofResult = {
  scenario: string
  mobile: string
  desktop: string
}

async function captureScreenshots(): Promise<void> {
  const browser = await chromium.launch()
  const results: ProofResult[] = []

  for (const scenario of scenarios) {
    const fullHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${scenario.name}</title>
  <style>${BASE_CSS}</style>
</head>
<body>
  <div class="proof-section">${scenario.html}</div>
</body>
</html>`

    for (const viewport of [
      { name: 'mobile', width: 390, height: 844 },
      { name: 'desktop', width: 1280, height: 900 },
    ]) {
      const page = await browser.newPage()
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await page.setContent(fullHtml, { waitUntil: 'networkidle' })

      const screenshotPath = `${OUT_DIR}/${scenario.name}-${viewport.name}.png`
      await page.screenshot({ path: screenshotPath, fullPage: true })
      console.log(`  ✓ ${screenshotPath}`)

      const existing = results.find((r) => r.scenario === scenario.name)
      if (existing) {
        existing[viewport.name as 'mobile' | 'desktop'] = screenshotPath
      } else {
        results.push({
          scenario: scenario.name,
          mobile: viewport.name === 'mobile' ? screenshotPath : '',
          desktop: viewport.name === 'desktop' ? screenshotPath : '',
        })
      }

      await page.close()
    }
  }

  await browser.close()

  // Write manifest
  const manifest = {
    captured: new Date().toISOString(),
    viewports: ['390x844 (mobile)', '1280x900 (desktop)'],
    scenarios: results.map((r) => r.scenario),
    files: results,
  }
  const manifestPath = `${OUT_DIR}/manifest.json`
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
  console.log(`\nManifest: ${manifestPath}`)
  console.log(`Screenshots: ${results.length * 2} captured`)
}

captureScreenshots().catch((err) => {
  console.error(err)
  process.exit(1)
})
