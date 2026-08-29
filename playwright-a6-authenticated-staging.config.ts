import { defineConfig, devices } from '@playwright/test'

import { assertStagingOrigin } from './scripts/staging-gates/stagingPolicy'

const REQUIRED_ENVIRONMENT = [
  'STAGING_URL',
  'STAGING_MEMBER_EMAIL',
  'STAGING_MEMBER_PASSWORD',
  'STAGING_ADMIN_EMAIL',
  'STAGING_ADMIN_PASSWORD',
] as const

function requireEnvironment(name: (typeof REQUIRED_ENVIRONMENT)[number]): string {
  const value = process.env[name]
  if (!value?.trim()) {
    throw new Error(`A6-AUTH-DENIED: ${name} is required and must be nonempty`)
  }
  return name.endsWith('PASSWORD') ? value : value.trim()
}

const STAGING_BASE_URL = requireEnvironment('STAGING_URL')
for (const name of REQUIRED_ENVIRONMENT.slice(1)) requireEnvironment(name)
assertStagingOrigin(STAGING_BASE_URL)

const artifactRoot = '/tmp/jpv-a6-authenticated-staging'

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/a6-authenticated-staging.spec.ts',
  fullyParallel: false,
  forbidOnly: true,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['line'], ['junit', { outputFile: `${artifactRoot}/junit.xml` }]],
  outputDir: `${artifactRoot}/test-results`,
  use: {
    baseURL: STAGING_BASE_URL,
    // Do not retain traces, videos, screenshots, storage state, or auth headers.
    // This gate uses protected credentials and must leave only aggregate results.
    trace: 'off',
    screenshot: 'off',
    video: 'off',
    navigationTimeout: 30000,
    actionTimeout: 10000,
    serviceWorkers: 'allow',
  },
  projects: [
    {
      name: 'a6-authenticated-chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
  timeout: 120000,
})
