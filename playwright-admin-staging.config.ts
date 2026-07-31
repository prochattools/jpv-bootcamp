import { defineConfig, devices } from '@playwright/test'
import { assertStagingOrigin } from './scripts/staging-gates/stagingPolicy'

/**
 * Authenticated admin responsive tests — staging only.
 * Requires STAGING_URL, STAGING_ADMIN_EMAIL, STAGING_ADMIN_PASSWORD.
 */

const STAGING_BASE_URL = process.env.STAGING_URL ?? 'https://preview.jpvbootcamp.com'

assertStagingOrigin(STAGING_BASE_URL)

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/admin-responsive-staging.spec.ts',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['line']],
  outputDir: 'test-results/admin-responsive',
  use: {
    baseURL: STAGING_BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    navigationTimeout: 30000,
    actionTimeout: 10000,
  },
  projects: [
    {
      name: 'admin-responsive',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
  timeout: 90000,
})
