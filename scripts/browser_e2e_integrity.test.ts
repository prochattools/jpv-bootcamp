import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

import { runBrowserTests } from './e2e/runBrowserTests'

const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
  packageManager?: string
  scripts?: Record<string, string>
  devDependencies?: Record<string, string>
}
const lockfile = readFileSync('pnpm-lock.yaml', 'utf8')
const config = readFileSync('playwright.config.ts', 'utf8')
const workflow = readFileSync('.github/workflows/deploy-preview.yml', 'utf8')
const gitignore = readFileSync('.gitignore', 'utf8')
const page = readFileSync('src/app/(frontend)/page.tsx', 'utf8')

const specs = [
  'e2e/public.spec.ts',
  'e2e/auth-portal-admin.spec.ts',
  'e2e/support.spec.ts',
  'e2e/checkout-and-submissions.spec.ts',
]
const fixtures = ['e2e/fixtures/launchFixtures.ts']
const browserFiles = [...specs, ...fixtures, 'playwright.config.ts', 'scripts/e2e/runBrowserTests.ts']
const browserSource = browserFiles.map((path) => readFileSync(path, 'utf8')).join('\n')

function testPinnedDependenciesAndScripts(): void {
  assert.equal(packageJson.packageManager, 'pnpm@10.33.0')
  assert.equal(packageJson.devDependencies?.['@playwright/test'], '1.61.1')
  assert.equal(packageJson.devDependencies?.['@axe-core/playwright'], '4.12.1')
  assert.match(lockfile, /['"]@playwright\/test['"]:\s*\n\s*specifier: 1\.61\.1/)
  assert.match(lockfile, /['"]@axe-core\/playwright['"]:\s*\n\s*specifier: 4\.12\.1/)

  assert.equal(packageJson.scripts?.['test:release'], 'tsx scripts/release/runReleaseTests.ts')
  assert.equal(packageJson.scripts?.['test:e2e'], 'tsx scripts/e2e/runBrowserTests.ts')
  assert.equal(packageJson.scripts?.['test:e2e:install'], 'playwright install chromium')
  assert.equal(packageJson.scripts?.['test:release:full'], 'pnpm test:release && pnpm test:e2e')
}

function testConfigSafety(): void {
  assert.match(config, /testDir: '\.\/e2e'/)
  assert.match(config, /testMatch: '\*\*\/\*\.spec\.ts'/)
  assert.match(config, /127\.0\.0\.1:3107/)
  assert.match(config, /\['127\.0\.0\.1', 'localhost'\]/)
  assert.match(config, /protocol !== 'http:'/)
  assert.match(config, /postgresql:\/\/e2e:e2e@127\.0\.0\.1:9\/e2e/)
  assert.match(config, /trace: 'retain-on-failure'/)
  assert.match(config, /screenshot: 'only-on-failure'/)
  assert.match(config, /video: 'retain-on-failure'/)
  assert.match(config, /chromium-desktop/)
  assert.match(config, /chromium-mobile/)
  assert.match(config, /Pixel 7/)
  assert.match(config, /next dev --hostname 127\.0\.0\.1 --port/)
  assert.doesNotMatch(config, /prisma migrate|db:reset|db:seed|deploy|stripe:check-products|payload:email:send/i)
}

function testRequiredJourneyCoverage(): void {
  for (const path of specs) assert.equal(existsSync(path), true, `missing browser spec ${path}`)

  const requiredEvidence = [
    '£80/month',
    'No minimum commitment',
    '/portal/billing',
    '/privacy-policy',
    '/sitemap.xml',
    'definitely-not-a-launch-route',
    'Member sign in',
    'invalid_credentials',
    'loggedOut=1',
    'Welcome back',
    '/portal/account',
    '/admin/review',
    '/operations/sponsored-applications',
    'Saving your request...',
    'saved for review',
    'duplicate: true',
    'support_persistence_unavailable',
    'aria-live',
    'wcag2a',
    'wcag2aa',
    'scrollWidth',
    'invalidContentType',
    'invalidOrigin',
    'Submission unavailable in preview',
    'Application unavailable in preview',
    'invalid_checkout_request',
  ]
  for (const evidence of requiredEvidence) {
    assert.ok(browserSource.includes(evidence), `missing browser coverage evidence: ${evidence}`)
  }

  assert.match(page, /aria-live="polite"/)
  assert.match(page, /aria-atomic="true"/)
  assert.match(page, /role="status"/)
}

function testNoProductionOrUnsafeCommands(): void {
  const forbidden = [
    /https:\/\/(?:www\.)?jpvbootcamp/i,
    /staging\./i,
    /STRIPE_SECRET_KEY_LIVE/i,
    /STRIPE_ENV:\s*'live'/i,
    /prisma migrate/i,
    /db:(?:reset|seed|migrate)/i,
    /payload:staging:migrate/i,
    /\bdeploy\b/i,
    /stripe:check-products/i,
    /payload:email:send/i,
    /curl\s+https?:\/\//i,
    /wget\s+https?:\/\//i,
  ]
  for (const pattern of forbidden) {
    assert.doesNotMatch(browserSource, pattern)
  }
  assert.match(browserSource, /unapplied production migration|127\.0\.0\.1:9/i)
}

function testWorkflowSafety(): void {
  assert.match(workflow, /branches:\s*\n\s*- 'feature\/\*\*'/)
  assert.match(workflow, /pull_request:/)
  assert.match(workflow, /permissions:\s*\n\s*contents: read/)
  assert.match(workflow, /cancel-in-progress: true/)
  assert.match(workflow, /node-version: '20'/)
  assert.match(workflow, /pnpm@10\.33\.0/)
  assert.match(workflow, /cache: pnpm/)
  assert.match(workflow, /pnpm install --frozen-lockfile/)
  assert.match(workflow, /pnpm test:release/)
  assert.match(workflow, /playwright install --with-deps chromium/)
  assert.match(workflow, /pnpm test:e2e/)
  assert.match(workflow, /if: failure\(\)/)
  assert.match(workflow, /actions\/upload-artifact@v4/)
  assert.match(workflow, /push: false/)
  assert.doesNotMatch(workflow, /secrets\.|prisma migrate|payload:staging:migrate|stripe:check-products|payload:email:send/i)
}

function testArtifactsIgnored(): void {
  for (const path of ['/playwright-report/', '/test-results/', '/blob-report/', '*.trace.zip']) {
    assert.ok(gitignore.includes(path), `missing browser ignore rule ${path}`)
  }
}

function testDeterministicRunner(): void {
  const calls: string[] = []
  const logs: string[] = []
  const summary = runBrowserTests({
    executor(executable, args, env) {
      calls.push([executable, ...args].join(' '))
      assert.match(env.E2E_BASE_URL ?? '', /^http:\/\/(127\.0\.0\.1|localhost)/)
      return { status: 0 }
    },
    log(message) {
      logs.push(message)
    },
    environment: { NODE_ENV: 'test' },
  })

  assert.deepEqual(calls, ['pnpm exec playwright test --config=playwright.config.ts'])
  assert.equal(summary, 'BROWSER E2E PASSED')
  assert.deepEqual(logs, ['BROWSER E2E PASSED'])

  assert.throws(
    () =>
      runBrowserTests({
        executor() {
          return { status: 1 }
        },
        log() {},
        environment: { NODE_ENV: 'test' },
      }),
    /BROWSER E2E FAILED/,
  )
}

function main(): void {
  testPinnedDependenciesAndScripts()
  testConfigSafety()
  testRequiredJourneyCoverage()
  testNoProductionOrUnsafeCommands()
  testWorkflowSafety()
  testArtifactsIgnored()
  testDeterministicRunner()
  console.log('browser E2E integrity tests passed')
}

main()
