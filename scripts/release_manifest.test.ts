import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

import {
  DEFERRED_RELEASE_VALIDATIONS,
  RELEASE_TEST_CATEGORIES,
  RELEASE_TEST_MANIFEST,
  type ReleaseTestEntry,
} from './release/releaseTestManifest'
import {
  buildReleaseEnvironment,
  runReleaseManifest,
  validateReleaseManifest,
} from './release/runReleaseTests'

function commandOf(entry: ReleaseTestEntry): string {
  return [entry.command.executable, ...entry.command.args].join(' ')
}

function testManifestStructure(): void {
  validateReleaseManifest()

  const ids = RELEASE_TEST_MANIFEST.map((entry) => entry.id)
  const commands = RELEASE_TEST_MANIFEST.map(commandOf)
  assert.equal(new Set(ids).size, ids.length, 'manifest IDs must be unique')
  assert.equal(new Set(commands).size, commands.length, 'required commands must execute exactly once')
  assert.deepEqual(
    [...new Set(RELEASE_TEST_MANIFEST.map((entry) => entry.category))].sort(),
    [...RELEASE_TEST_CATEGORIES].sort(),
    'every required release category must be represented',
  )

  for (const entry of RELEASE_TEST_MANIFEST) {
    assert.equal(entry.requirement === 'required' || entry.requirement === 'conditional', true)
    assert.ok(entry.launchCriticalReason.trim(), `${entry.id} must explain launch criticality`)
    assert.ok(entry.failureMeaning.trim(), `${entry.id} must explain failure meaning`)
    assert.ok(entry.owner.trim(), `${entry.id} must have an owner`)
    if (entry.requirement === 'conditional') {
      assert.ok(entry.condition?.trim(), `${entry.id} must declare its condition`)
    }
    if (entry.testPath) {
      assert.equal(existsSync(entry.testPath), true, `${entry.id} points to missing ${entry.testPath}`)
      assert.deepEqual(entry.command.args, ['exec', 'tsx', entry.testPath])
    }
  }
}

function testPackageOwnership(): void {
  const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
    packageManager?: string
    engines?: Record<string, string>
    scripts?: Record<string, string>
  }
  assert.equal(packageJson.packageManager, 'pnpm@10.33.0')
  assert.match(packageJson.engines?.node ?? '', /^>=20\.9\.0$/)
  assert.equal(packageJson.scripts?.['test:release'], 'tsx scripts/release/runReleaseTests.ts')
  assert.ok(packageJson.scripts?.['staging:static-preflight'], 'static preflight must remain owned')
  assert.equal(packageJson.scripts?.['staging:decision-readiness'], 'tsx scripts/release/runDecisionReadiness.ts')

  for (const entry of RELEASE_TEST_MANIFEST) {
    if (entry.command.executable !== 'pnpm') continue
    const [first] = entry.command.args
    if (!first || ['exec', 'install'].includes(first)) continue
    assert.ok(packageJson.scripts?.[first], `${entry.id} points to missing package script ${first}`)
  }
}

function testMilestoneCoverage(): void {
  const requiredPackets = [
    'M0-01',
    'M0-02',
    'M0-03',
    'M0-04',
    'M0-05',
    'M0-06',
    'M0-07',
    'M0-08',
    'M0-09',
    'M1-01',
  ]
  const coverage = new Set(RELEASE_TEST_MANIFEST.flatMap((entry) => entry.covers))

  for (const packet of requiredPackets) {
    assert.equal(coverage.has(packet), true, `${packet} must have explicit release coverage`)
  }

  const commands = RELEASE_TEST_MANIFEST.map(commandOf)
  for (const expected of [
    'pnpm exec tsx scripts/support_intake_runtime.test.ts',
    'pnpm exec tsx scripts/support_request_schema_contract.test.ts',
    'pnpm exec tsx prisma/migrations/20260712_151700_add_support_requests.test.ts',
    'pnpm exec tsx scripts/public_request_guard.test.ts',
    'pnpm exec tsx scripts/public_write_route_guard_adoption.test.ts',
    'pnpm staging:provider-simulation',
  ]) {
    assert.equal(commands.includes(expected), true, `missing release command: ${expected}`)
  }
}

function testCompileSchemaAuditCoverage(): void {
  const commands = RELEASE_TEST_MANIFEST.map(commandOf)
  assert.equal(
    commands.includes('pnpm exec tsc --noEmit --pretty false --incremental false'),
    true,
  )
  assert.equal(commands.includes('pnpm build'), true)
  assert.equal(
    commands.includes('pnpm exec prisma validate --schema=prisma/system.prisma'),
    true,
  )
  assert.equal(
    commands.includes('pnpm exec prisma validate --schema=prisma/schema.prisma'),
    true,
  )
  assert.equal(
    commands.includes('pnpm exec pnpm audit --prod --audit-level high --ignore-registry-errors'),
    true,
    'production audit must fail on high or critical advisories',
  )
  assert.equal(commands.includes('pnpm staging:decision-readiness'), true)
}

function testForbiddenCommands(): void {
  const commands = RELEASE_TEST_MANIFEST.map(commandOf)
  const forbidden = [
    /prisma migrate/i,
    /payload:staging:migrate/i,
    /db:(?:migrate|reset|seed|init|cleanup)/i,
    /migrate-db/i,
    /\bdeploy\b/i,
    /stripe:check-products/i,
    /payload:email:send/i,
    /mcp:provision/i,
    /\bcurl\b/i,
    /\bwget\b/i,
    /bash -c/i,
    /sh -c/i,
    /--no-frozen-lockfile/i,
    /--lockfile-only/i,
    /evidence:create/i,
    /playwright|cypress/i,
  ]

  for (const command of commands) {
    for (const pattern of forbidden) {
      assert.doesNotMatch(command, pattern, `${command} violates ${pattern}`)
    }
  }

  const runner = readFileSync('scripts/release/runReleaseTests.ts', 'utf8')
  assert.match(runner, /spawnSync/)
  assert.match(runner, /shell: false/)
  assert.doesNotMatch(runner, /execSync|execFileSync/)
  assert.match(runner, /Release tests changed tracked or untracked repository paths/)
}

function testDeferredOwnership(): void {
  const browser = DEFERRED_RELEASE_VALIDATIONS.find((entry) => entry.id === 'browser-e2e')
  assert.ok(browser)
  assert.equal(browser.owner, 'M1-03')
  assert.match(browser.reason, /explicitly deferred to M1-03/)

  for (const deferredId of [
    'support-request-migration-apply',
    'live-provider-smoke',
    'deployment-and-production-smoke',
  ]) {
    assert.ok(DEFERRED_RELEASE_VALIDATIONS.some((entry) => entry.id === deferredId))
  }
}

function testDecisionCoverage(): void {
  for (const expected of [
    'decision.table-plan-to-free',
    'decision.account-column-rename',
    'decision.staging-migration-approval',
    'decision.rollback-readiness',
    'decision.programme-content-publication',
    'evidence.decision-manifest',
    'evidence.decision-runner',
    'evidence.decision-readiness',
    'evidence.provider-verification-approval',
    'evidence.staging-smoke-approval',
    'evidence.core-go-live-decision',
  ]) {
    assert.ok(RELEASE_TEST_MANIFEST.some((entry) => entry.id === expected), `missing release coverage: ${expected}`)
  }
}

function testEnvironmentSentinels(): void {
  const env = buildReleaseEnvironment({ NODE_ENV: 'test', EXISTING: 'kept' })
  assert.equal(env.EXISTING, 'kept')
  assert.equal(env.CI, '1')
  assert.equal(env.RELEASE_TEST_MODE, '1')
  assert.match(env.DATABASE_URL ?? '', /127\.0\.0\.1:9/)
  assert.match(env.STRIPE_SECRET_KEY ?? '', /release_validation_disabled/)
  assert.match(env.RESEND_API_KEY ?? '', /release_validation_disabled/)
  assert.match(env.DOKPLOY_API_KEY ?? '', /release-validation-disabled/)
}

function testDeterministicSuccessfulRun(): void {
  const entries = RELEASE_TEST_MANIFEST.slice(0, 4)
  const calls: string[] = []
  const logs: string[] = []
  const summary = runReleaseManifest({
    entries,
    executor(executable, args) {
      calls.push([executable, ...args].join(' '))
      return { status: 0 }
    },
    log(message) {
      logs.push(message)
    },
    environment: { NODE_ENV: 'test' },
  })

  assert.deepEqual(calls, entries.map(commandOf))
  assert.equal(summary, 'RELEASE TESTS PASSED: 4/4')
  assert.equal(logs.at(-2)?.trim(), 'RELEASE TESTS PASSED: 4/4')
  assert.match(logs.at(-1) ?? '', /browser-e2e \(M1-03\)/)
}

function testFailFastAndAuditFailure(): void {
  const entries = RELEASE_TEST_MANIFEST.slice(0, 3)
  const calls: string[] = []
  assert.throws(
    () =>
      runReleaseManifest({
        entries,
        executor(executable, args) {
          calls.push([executable, ...args].join(' '))
          return { status: calls.length === 2 ? 1 : 0 }
        },
        log() {},
        environment: { NODE_ENV: 'test' },
      }),
    /RELEASE TEST FAILED/,
  )
  assert.equal(calls.length, 2, 'runner must stop immediately after a required failure')

  const audit = RELEASE_TEST_MANIFEST.find((entry) => entry.id === 'audit.production-high')
  assert.ok(audit)
  assert.throws(
    () =>
      runReleaseManifest({
        entries: [audit],
        executor() {
          return { status: 1 }
        },
        log() {},
        environment: { NODE_ENV: 'test' },
      }),
    /audit\.production-high/,
  )
}

function main(): void {
  testManifestStructure()
  testPackageOwnership()
  testMilestoneCoverage()
  testCompileSchemaAuditCoverage()
  testForbiddenCommands()
  testDeferredOwnership()
  testDecisionCoverage()
  testEnvironmentSentinels()
  testDeterministicSuccessfulRun()
  testFailFastAndAuditFailure()
  console.log('release manifest tests passed')
}

main()
