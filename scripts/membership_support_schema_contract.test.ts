import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { PAYLOAD_MIGRATION_NAMES } from '../src/lib/payloadMigrationRegistry'

function read(relativePath: string): string {
  return readFileSync(relativePath, 'utf8')
}

function run(): void {
  const reviewQueue = read('src/collections/membership-support/ReviewQueue.ts')
  const workflows = read('src/lib/membership-support/workflows.ts')
  const migrationPlan = read('docs/MEMBERSHIP_SUPPORT_SCHEMA_MIGRATION_PLAN.md')
  const relationshipMigration = read('src/migrations/20260827_090000_membership_support_relationship_tables.ts')
  const productionMigrationRunner = read('scripts/release/run-production-payload-migrations.mjs')
  const productionStartup = read('scripts/release/start-production.sh')
  const productionWorkflow = read('.github/workflows/publish-root-domain-image.yml')

  assert.match(reviewQueue, /slug:\s*'payload_membership_review_queue_items'/)
  assert.match(reviewQueue, /queueState/)
  assert.match(reviewQueue, /queueReason/)
  assert.match(reviewQueue, /priority/)
  assert.match(reviewQueue, /assignedTo/)
  assert.match(workflows, /dedupeKey:\s*`review_\$\{dedupeKey\}`/)
  assert.match(workflows, /buildMembershipSupportReviewQueueProjection/)
  assert.match(migrationPlan, /Review Queue Item/)
  assert.match(migrationPlan, /dedupeKey/)
  assert.match(migrationPlan, /unique index/)
  assert.equal(reviewQueue.includes('dedupeKey'), false)
  assert.equal(PAYLOAD_MIGRATION_NAMES.includes('20260718_103726_membership_support_schema'), true)
  for (const table of [
    'payload_pay_it_forward_funding',
    'payload_membership_vouchers',
    'payload_membership_administration_actions',
  ]) {
    assert.match(relationshipMigration, new RegExp(table))
    assert.match(productionMigrationRunner, new RegExp(table))
  }
  assert.match(relationshipMigration, /const relationTable = `\$\{table\}_rels`/)
  assert.match(productionMigrationRunner, /const relationTable = `\$\{definition\.parent\}_rels`/)
  assert.match(relationshipMigration, /payload_operator_notes_id/)
  assert.match(productionMigrationRunner, /20260827_090000_membership_support_relationship_tables/)
  assert.match(productionMigrationRunner, /pg_advisory_xact_lock/)
  assert.match(productionStartup, /run-production-payload-migrations\.mjs/)
  assert.ok(
    productionStartup.indexOf('run-production-payload-migrations.mjs') <
      productionStartup.indexOf('PAYLOAD_SCHEMA_PREFLIGHT'),
    'Production schema bootstrap must run before the Payload preflight',
  )
  assert.doesNotMatch(productionWorkflow, /Apply guarded production database migrations/)
  assert.match(productionWorkflow, /Trigger root Dokploy deployment/)

  console.log('membership support schema contract tests passed')
}

run()
