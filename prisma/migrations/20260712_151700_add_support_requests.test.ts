import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const migrationPath = join(
  __dirname,
  './20260712_151700_add_support_requests/migration.sql',
)
const migration = readFileSync(migrationPath, 'utf8')
const executableSql = migration.replace(/--.*$/gm, '')

assert.ok(
  /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+"support_requests"/i.test(migration),
  'migration must create only the dedicated support_requests table',
)

for (const forbidden of [
  /ALTER\s+TABLE/i,
  /UPDATE\s+/i,
  /DELETE\s+FROM/i,
  /TRUNCATE/i,
  /INSERT\s+INTO/i,
  /DROP\s+(TABLE|COLUMN|INDEX|CONSTRAINT)/i,
]) {
  assert.equal(
    forbidden.test(executableSql),
    false,
    `migration must remain additive and data-preserving: ${forbidden}`,
  )
}

const requiredColumns = [
  'id',
  'created_at',
  'updated_at',
  'normalized_email',
  'name',
  'question',
  'source',
  'page',
  'dedupe_key',
  'review_status',
  'notification_status',
  'notification_attempt_count',
  'notification_last_attempt_at',
  'notification_next_attempt_at',
  'notification_last_error_code',
  'reviewed_at',
  'reviewed_by_account_id',
]

for (const column of requiredColumns) {
  assert.ok(migration.includes(`"${column}"`), `migration must include ${column}`)
}

assert.match(
  migration,
  /CREATE\s+UNIQUE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+"support_requests_dedupe_key_key"/i,
  'dedupe key must be enforced by a unique database index',
)
assert.match(
  migration,
  /"review_status"\s+TEXT\s+NOT\s+NULL\s+DEFAULT\s+'pending'/i,
  'new requests must default to pending review',
)
assert.match(
  migration,
  /"notification_status"\s+TEXT\s+NOT\s+NULL\s+DEFAULT\s+'pending'/i,
  'new requests must default to pending notification state',
)
assert.match(
  migration,
  /"notification_attempt_count"\s+INTEGER\s+NOT\s+NULL\s+DEFAULT\s+0/i,
  'notification attempts must start at zero',
)
assert.equal(/REFERENCES\s+/i.test(executableSql), false, 'schema packet must add no access relation')
assert.equal(/sponsored|grant|entitlement/i.test(executableSql), false, 'schema must not couple support to sponsored access')
assert.ok(migration.includes('Rollback notes'), 'migration must include manual rollback notes')
assert.ok(
  migration.includes('DROP TABLE IF EXISTS "support_requests"'),
  'rollback notes must identify the dedicated table',
)

console.log('support request migration safety test passed')
