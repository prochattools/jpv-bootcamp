import { defineConfig, devices } from '@playwright/test'

const DEFAULT_E2E_BASE_URL = 'http://127.0.0.1:3107'
const baseURL = process.env.E2E_BASE_URL ?? DEFAULT_E2E_BASE_URL
const parsedBaseURL = new URL(baseURL)

if (!['127.0.0.1', 'localhost'].includes(parsedBaseURL.hostname)) {
  throw new Error(`E2E_BASE_URL must use localhost or 127.0.0.1, received ${parsedBaseURL.hostname}`)
}
if (parsedBaseURL.protocol !== 'http:') {
  throw new Error('E2E_BASE_URL must use http for the isolated local browser server')
}

const localPort = parsedBaseURL.port || '3107'
const testEnvironment = {
  NODE_ENV: 'development',
  APP_PUBLIC_URL: baseURL,
  NEXT_PUBLIC_APP_URL: baseURL,
  DATABASE_URL: 'postgresql://e2e:e2e@127.0.0.1:9/e2e?schema=public',
  PAYLOAD_SECRET: 'e2e-local-payload-secret-not-for-production',
  STRIPE_ENV: 'test',
  STRIPE_SECRET_KEY_TEST: 'sk_test_e2e_disabled',
  STRIPE_WEBHOOK_SECRET_TEST: 'whsec_e2e_disabled',
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_TEST: 'pk_test_e2e_disabled',
  STRIPE_PRICE_PRO_TEST: 'price_e2e_monthly_disabled',
  STRIPE_PRICE_PRO_ANNUAL_TEST: 'price_e2e_annual_disabled',
  STRIPE_PRODUCT_JPV_BOOTCAMP_PRO_MEMBERSHIP_TEST: 'prod_e2e_disabled',
  STRIPE_PORTAL_CONFIGURATION_ID_TEST: 'bpc_e2e_disabled',
  STRIPE_PORTAL_COMMITMENT_CONFIGURATION_ID_TEST: 'bpc_e2e_commitment_disabled',
  RESEND_API_KEY: 're_e2e_disabled',
  EMAIL_FROM: 'e2e@example.invalid',
  EMAIL_REPLY_TO: 'e2e@example.invalid',
  SUPPORT_TO_EMAIL: 'e2e@example.invalid',
  WEBHOOK_IDEMPOTENCY_TTL_HOURS: '24',
  E2E_BROWSER_MODE: '1',
}

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  testIgnore: [
    '**/admin-responsive-staging.spec.ts',
    '**/admin-crud-staging.spec.ts',
    // This suite requires protected staging credentials and is executed only by
    // the dedicated authenticated-staging workflow job.
    '**/a6-authenticated-staging.spec.ts',
    '**/staging-smoke.spec.ts',
    '**/stripe-webhook-staging.spec.ts',
  ],
  fullyParallel: false,
  forbidOnly: Boolean(process.env.GITHUB_ACTIONS),
  retries: process.env.GITHUB_ACTIONS ? 1 : 0,
  workers: process.env.GITHUB_ACTIONS ? 1 : undefined,
  reporter: [['line'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  outputDir: 'test-results',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    serviceWorkers: 'block',
  },
  projects: [
    {
      name: 'chromium-mobile-320',
      use: {
        ...devices['Desktop Chrome'],
        browserName: 'chromium',
        viewport: { width: 320, height: 800 },
      },
    },
    {
      name: 'chromium-mobile-375',
      use: {
        ...devices['Pixel 7'],
        browserName: 'chromium',
        viewport: { width: 375, height: 812 },
      },
    },
    {
      name: 'chromium-tablet-768',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 768, height: 1024 },
      },
    },
    {
      name: 'chromium-laptop-1024',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1024, height: 768 },
      },
    },
    {
      name: 'chromium-desktop-1440',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
  webServer: {
    command: `pnpm exec next dev --hostname 127.0.0.1 --port ${localPort}`,
    url: baseURL,
    reuseExistingServer: !process.env.GITHUB_ACTIONS,
    timeout: 120_000,
    env: testEnvironment,
    stdout: 'pipe',
    stderr: 'pipe',
  },
})
