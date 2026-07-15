import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function main(): void {
  const decision = readFileSync('docs/decisions/STAGING_MIGRATION_APPROVAL.md', 'utf8')
  const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as { scripts?: Record<string, string> }
  const runner = readFileSync('scripts/release/runDecisionReadiness.ts', 'utf8')

  assert.match(decision, /Decision ID: `staging-migration-approval`/)
  assert.match(decision, /Current status: `NOT_APPROVED`/)
  assert.match(decision, /## Identity/)
  assert.match(decision, /## Preconditions/)
  assert.match(decision, /## Approval/)
  assert.match(decision, /## Abort conditions/)
  assert.match(decision, /Rollback owner role: `Rollback owner`/)
  assert.equal(packageJson.scripts?.['staging:decision-readiness'], 'tsx scripts/release/runDecisionReadiness.ts')
  assert.doesNotMatch(runner, /prisma migrate/i)
  assert.doesNotMatch(runner, /payload:staging:migrate/i)
  assert.doesNotMatch(runner, /deploy/i)
  assert.doesNotMatch(runner, /fetch\(/)

  console.log('staging_migration_approval.test.ts passed')
}

main()

