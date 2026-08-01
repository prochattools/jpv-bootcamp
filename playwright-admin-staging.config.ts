import { defineConfig, devices } from '@playwright/test'
import { assertStagingOrigin } from './scripts/staging-gates/stagingPolicy'

function requireEnvironment(name: 'STAGING_URL' | 'STAGING_ADMIN_EMAIL' | 'STAGING_ADMIN_PASSWORD'): string {
  const value = process.env[name]
  if (!value?.trim()) {
    throw new Error(`ADMIN-RESPONSIVE-DENIED: ${name} is required and must be nonempty`)
  }
  return name === 'STAGING_ADMIN_PASSWORD' ? value : value.trim()
}

const STAGING_BASE_URL = requireEnvironment('STAGING_URL')
requireEnvironment('STAGING_ADMIN_EMAIL')
requireEnvironment('STAGING_ADMIN_PASSWORD')
assertStagingOrigin(STAGING_BASE_URL)

const artifactRoot = '/tmp/jpv-admin-regression-hardening'

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/admin-responsive-staging.spec.ts',
  fullyParallel: false,
  forbidOnly: true,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['line']],
  outputDir: `${artifactRoot}/test-results`,
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
