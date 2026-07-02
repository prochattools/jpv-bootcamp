import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// MIGRATION SOURCE VALIDATION TESTS

const migrationPath = join(__dirname, './20260703_120000_add_subscription_projection/migration.sql')
const migrationContent = readFileSync(migrationPath, 'utf-8')

// Test 1: Migration is additive only (no DROP statements)
assert.strictEqual(
	/DROP\s+(TABLE|COLUMN|INDEX|CONSTRAINT)/i.test(migrationContent),
	false,
	'Migration should not contain DROP statements'
)

// Test 2: Migration adds stripePriceId column
assert.ok(
	/stripe_price_id/i.test(migrationContent),
	'Migration should add stripe_price_id column'
)

// Test 3: Migration adds subscriptionStatus column
assert.ok(
	/subscription_status/i.test(migrationContent),
	'Migration should add subscription_status column'
)

// Test 4: Migration adds subscriptionCurrentPeriodEnd column
assert.ok(
	/subscription_current_period_end/i.test(migrationContent),
	'Migration should add subscription_current_period_end column'
)

// Test 5: Migration adds subscriptionCancelAtPeriodEnd column
assert.ok(
	/subscription_cancel_at_period_end/i.test(migrationContent),
	'Migration should add subscription_cancel_at_period_end column'
)

// Test 6: Migration adds subscriptionUpdatedAt column
assert.ok(
	/subscription_updated_at/i.test(migrationContent),
	'Migration should add subscription_updated_at column'
)

// Test 7: New columns are nullable
const columnLines = migrationContent.split('\n').filter(
	(line) =>
		/stripe_price_id|subscription_status|subscription_current_period_end|subscription_cancel_at_period_end|subscription_updated_at/i.test(
			line
		)
)
columnLines.forEach((line) => {
	if (!line.includes('DEFAULT')) {
		assert.strictEqual(
			/NOT\s+NULL/i.test(line),
			false,
			`Column definition should be nullable: ${line}`
		)
	}
})

// Test 8: Migration modifies only customer_provisioning table
assert.ok(
	/ALTER\s+TABLE.*customer_provisioning/i.test(migrationContent),
	'Migration should alter customer_provisioning table'
)

// Test 9: Migration contains no data modifications
assert.strictEqual(
	/UPDATE\s+/i.test(migrationContent),
	false,
	'Migration should not contain UPDATE statements'
)
assert.strictEqual(
	/DELETE\s+FROM/i.test(migrationContent),
	false,
	'Migration should not contain DELETE statements'
)

// Test 10: Migration contains no schema resets
assert.strictEqual(
	/TRUNCATE/i.test(migrationContent),
	false,
	'Migration should not contain TRUNCATE'
)
assert.strictEqual(
	/RESTART\s+IDENTITY/i.test(migrationContent),
	false,
	'Migration should not reset identities'
)
