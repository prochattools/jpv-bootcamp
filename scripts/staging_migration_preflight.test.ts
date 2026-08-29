import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  buildStagingMigrationPreflightSteps,
  runStagingMigrationPreflight,
} from './release/stagingMigrationPreflight'

function main(): void {
  const steps = buildStagingMigrationPreflightSteps()
  const ids = steps.map((step) => step.id)
  assert.equal(new Set(ids).size, ids.length)

  const commandSteps = steps.filter((step) => step.kind === 'command')
  assert.deepEqual(
    commandSteps.map((step) => [step.executable, ...step.args].join(' ')),
    [
      'pnpm exec tsx prisma/migrations/20260712_151700_add_support_requests.test.ts',
      'pnpm exec tsx scripts/support_request_schema_contract.test.ts',
      'pnpm exec tsx scripts/preview_migration_inventory.test.ts',
      'pnpm exec tsx scripts/migration_readiness_static.test.ts',
      'pnpm exec tsx scripts/migration_rehearsal_safety.test.ts',
      'pnpm exec prisma validate --schema=prisma/system.prisma',
      'pnpm exec prisma validate --schema=prisma/schema.prisma',
    ],
  )

  for (const command of commandSteps.map((step) => [step.executable, ...step.args].join(' '))) {
    assert.doesNotMatch(command, /\bprisma migrate\b/i)
    assert.doesNotMatch(command, /\bdb:(?:reset|seed|cleanup|init|migrate)\b/i)
    assert.doesNotMatch(command, /\bdeploy\b/i)
    assert.doesNotMatch(command, /\bpayload:email:send\b/i)
    assert.doesNotMatch(command, /\bcurl\b|\bwget\b/i)
  }

  const logs: string[] = []
  const calls: string[] = []
  const summary = runStagingMigrationPreflight({
    executor(executable, args) {
      calls.push([executable, ...args].join(' '))
      return { status: 0 }
    },
    log(message) {
      logs.push(message)
    },
    branchOverride: 'feature/e1-topology',
  })
  assert.equal(summary, `STAGING MIGRATION PREFLIGHT PASSED: ${steps.length}/${steps.length}`)
  assert.equal(calls.length, commandSteps.length)
  assert.equal(logs.at(-1), summary)

  assert.throws(
    () =>
      runStagingMigrationPreflight({
        executor(executable, args) {
          const command = [executable, ...args].join(' ')
          return {
            status: command.includes('migration_readiness_static') ? 1 : 0,
            stderr: 'forced failure',
          }
        },
        log() {},
        branchOverride: 'feature/e1-topology',
      }),
    /STAGING MIGRATION PREFLIGHT FAILED/,
  )

  const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as { scripts?: Record<string, string> }
  assert.equal(
    packageJson.scripts?.['staging:migration-preflight'],
    'tsx scripts/release/stagingMigrationPreflight.ts',
  )

  console.log('staging_migration_preflight.test.ts passed')
}

main()
