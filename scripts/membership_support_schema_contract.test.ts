import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { PAYLOAD_MIGRATION_NAMES } from '../src/migrations/migrationRegistry'

function read(relativePath: string): string {
  return readFileSync(relativePath, 'utf8')
}

function run(): void {
  const reviewQueue = read('src/collections/membership-support/ReviewQueue.ts')
  const workflows = read('src/lib/membership-support/workflows.ts')
  const migrationPlan = read('docs/MEMBERSHIP_SUPPORT_SCHEMA_MIGRATION_PLAN.md')

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

  console.log('membership support schema contract tests passed')
}

run()
