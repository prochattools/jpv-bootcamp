import { defineConfig, devices } from '@playwright/test'

const STAGING_URL = process.env.STAGING_URL || 'https://preview.jpvbootcamp.com'

export default defineConfig({
  testDir: './e2e',
  testMatch: ['**/staging-smoke.spec.ts', '**/portal-calls-acceptance.staging.spec.ts', '**/livekit-bunny.staging.spec.ts'],
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [['line']],
  use: {
    baseURL: STAGING_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium-laptop-1024',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1024, height: 768 },
      },
    },
  ],
})
