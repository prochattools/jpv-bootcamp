import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function main(): void {
  const decision = readFileSync('docs/decisions/ACCOUNT_COLUMN_RENAME_APPROVAL.md', 'utf8')
  const prismaMigration = readFileSync('prisma/migrations/20260707_120000_rename_account_identity_columns/migration.sql', 'utf8')
  const systemSchema = readFileSync('prisma/system.prisma', 'utf8')
  const secondarySchema = readFileSync('prisma/schema.prisma', 'utf8')
  const partnerToken = readFileSync('src/lib/partners-handoff-token.ts', 'utf8')

  assert.match(decision, /Decision ID: `account-column-rename`/)
  assert.match(decision, /Current status: `AWAITING_APPROVAL`/)
  assert.match(decision, /## Current state/)
  assert.match(decision, /## Options/)
  assert.match(decision, /### Option C — direct rename migration/)
  assert.match(prismaMigration, /ALTER TABLE/i)
  assert.match(prismaMigration, /wp_/)
  assert.match(systemSchema, /accountId/)
  assert.match(systemSchema, /accountEmailHash/)
  assert.match(secondarySchema, /accountId/)
  assert.match(partnerToken, /account_id/)
  assert.doesNotMatch(systemSchema, /wpUserId/i)
  assert.doesNotMatch(secondarySchema, /wpUserId/i)
  assert.doesNotMatch(partnerToken, /wpUserId/i)

  console.log('account_column_rename_decision.test.ts passed')
}

main()

