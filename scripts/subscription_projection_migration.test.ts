import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

async function main() {
  const sql = await readFile(
    'prisma/migrations/20260703_120000_add_subscription_projection/migration.sql',
    'utf8',
  )

  assert.match(sql, /ALTER TABLE "customer_provisioning"/)
  for (const column of [
    'stripe_price_id',
    'subscription_status',
    'subscription_current_period_end',
    'subscription_cancel_at_period_end',
    'subscription_updated_at',
  ]) {
    assert.match(sql, new RegExp(`ADD COLUMN IF NOT EXISTS "${column}"`))
  }

  assert.doesNotMatch(sql, /\bDROP\b/i)
  assert.doesNotMatch(sql, /\bDELETE\b/i)
  assert.doesNotMatch(sql, /\bUPDATE\b/i)
  assert.doesNotMatch(sql, /\bTRUNCATE\b/i)

  console.log('subscription projection migration tests passed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
