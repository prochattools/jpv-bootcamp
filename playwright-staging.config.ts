import { defineConfig, devices } from '@playwright/test'
import { assertStagingOrigin } from './scripts/staging-gates/stagingPolicy'

/**
 * Staging Smoke Test Configuration
 * Runs against https://preview.jpvbootcamp.com with jpvbootcamp_staging schema
 * No local server startup - targets external staging environment
 */

const STAGING_BASE_URL = process.env.STAGING_URL ?? 'https://preview.jpvbootcamp.com'

// Exact origin validation — rejects production, suffix domains, userinfo, HTTP, non-default ports
assertStagingOrigin(STAGING_BASE_URL.endsWith('/') ? STAGING_BASE_URL : STAGING_BASE_URL)

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
  timeout: 60000,
})
