import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const migrationPath = join(
  __dirname,
  './20260710_214000_add_subscription_commitment_projection/migration.sql',
)
const migration = readFileSync(migrationPath, 'utf8')

assert.equal(
  /DROP\s+(TABLE|COLUMN|INDEX|CONSTRAINT)/i.test(migration.replace(/--.*$/gm, '')),
  false,
  'commitment migration must be additive',
)

const requiredColumns = [
  'stripe_subscription_schedule_id',
  'stripe_checkout_session_id',
  'billing_cadence',
  'commitment_status',
  'commitment_start_at',
  'commitment_end_at',
  'cancellation_requested_at',
  'cancellation_effective_at',
  'payment_grace_ends_at',
  'last_paid_invoice_id',
  'last_payment_failure_at',
  'contract_version',
  'contract_accepted_at',
  'immediate_access_consent_at',
  'early_termination_reason',
  'early_termination_approved_by',
]

for (const column of requiredColumns) {
  assert.ok(migration.includes(`"${column}"`), `migration must add ${column}`)
}

assert.ok(
  /ALTER\s+TABLE\s+"customer_provisioning"/i.test(migration),
  'migration must alter only customer_provisioning',
)
assert.equal(/\bUPDATE\s+/i.test(migration), false, 'migration must not rewrite data')
assert.equal(/\bDELETE\s+FROM\b/i.test(migration), false, 'migration must not delete data')
assert.equal(/\bTRUNCATE\b/i.test(migration), false, 'migration must not truncate data')
assert.ok(migration.includes('Rollback notes'), 'migration must include manual rollback notes')

console.log('subscription commitment projection migration safety test passed')
