import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const migration = readFileSync(
  join(__dirname, './20260826_100000_add_support_request_phone/migration.sql'),
  'utf8',
)
const executableSql = migration.replace(/--.*$/gm, '')

assert.match(executableSql, /ALTER\s+TABLE\s+IF\s+EXISTS\s+"support_requests"/i)
assert.match(executableSql, /ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+"phone"\s+TEXT/i)
assert.doesNotMatch(executableSql, /DROP\s+(TABLE|COLUMN|INDEX|CONSTRAINT)/i)
assert.doesNotMatch(executableSql, /UPDATE\s+|DELETE\s+FROM|TRUNCATE|INSERT\s+INTO/i)
assert.match(migration, /nullable|existing support requests/i)
assert.match(migration, /restore-based|forward migration/i)

console.log('support request phone migration safety test passed')
