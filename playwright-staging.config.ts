import { defineConfig, devices } from '@playwright/test'

/**
 * Staging Smoke Test Configuration
 * Runs against https://preview.jpvbootcamp.com with jpvbootcamp_staging schema
 * No local server startup - targets external staging environment
 */

const STAGING_BASE_URL = process.env.STAGING_URL ?? 'https://preview.jpvbootcamp.com'

if (STAGING_BASE_URL.includes('jpvbootcamp.com') && !STAGING_BASE_URL.includes('preview.')) {
  throw new Error(`STAGING_URL must be the staging/preview domain, not production. Got: ${STAGING_BASE_URL.replace(/\/\/.*@/, '//[redacted]@')}`)
}

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/staging-smoke.spec.ts',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ['line'],
    ['html', { outputFolder: 'playwright-report-staging', open: 'never' }],
    ['junit', { outputFile: 'test-results/staging-smoke-results.xml' }],
  ],
  outputDir: 'test-results/staging-smoke',
  use: {
    baseURL: STAGING_BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    serviceWorkers: 'allow',
    navigationTimeout: 30000,
    actionTimeout: 10000,
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: 'chromium-mobile',
      use: {
        ...devices['Pixel 7'],
        browserName: 'chromium',
      },
    },
  ],
  timeout: 60000,
})
