import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function main(): void {
  const decision = readFileSync('docs/decisions/TABLE_PLAN_TO_FREE_APPROVAL.md', 'utf8')
  const readiness = readFileSync('docs/PREVIEW_RELEASE_READINESS.md', 'utf8')
  const plans = readFileSync('src/lib/plans.ts', 'utf8')
  const checkoutConfig = readFileSync('src/lib/stripe-checkout-config.ts', 'utf8')
  const migration = readFileSync('src/migrations/20260707_130000_remove_table_plan_from_payload_enums.ts', 'utf8')

  assert.match(decision, /Decision ID: `table-plan-to-free`/)
  assert.match(decision, /Current status: `AWAITING_APPROVAL`/)
  assert.match(decision, /## Decision options/)
  assert.match(decision, /### Option A — map the existing table-plan value to canonical Free/)
  assert.match(decision, /### Option B — preserve the existing plan value as a separate legacy\/internal tier/)
  assert.match(decision, /### Option C — migrate or normalize existing records through an approved data step/)
  assert.match(decision, /### Option D — reject the change/)
  assert.match(decision, /## Approval record/)
  assert.match(readiness, /table-plan-to-Free/i)
  assert.match(readiness, /pending/i)
  assert.match(plans, /export type Plan = 'pro'/)
  assert.match(checkoutConfig, /return normalized === 'pro' \? 'pro' : null/)
  assert.match(migration, /plan = 'free'/)
  assert.doesNotMatch(decision, /Current status: `APPROVED`/)

  console.log('table_plan_to_free_decision.test.ts passed')
}

main()
