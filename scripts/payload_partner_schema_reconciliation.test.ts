import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  previewMigrationInventoryNames,
} from '../src/lib/previewMigrationInventory'
import {
  buildPartnerSchemaReconciliationMigrationDownSql,
  buildPartnerSchemaReconciliationMigrationUpSql,
} from '../src/lib/partnerSchemaReconciliationMigrationSql'

const stagingUrl = 'postgresql://user:password@db.internal:5432/app?schema=jpvbootcamp_staging'
const upSql = buildPartnerSchemaReconciliationMigrationUpSql(stagingUrl)
const downSql = buildPartnerSchemaReconciliationMigrationDownSql(stagingUrl)
const migrationSource = readFileSync('src/migrations/index.ts', 'utf8')
const migrationNames = Array.from(migrationSource.matchAll(/name:\s*'([^']+)'/g), (match) => match[1])

assert.deepEqual(previewMigrationInventoryNames().slice(-2), [
  '20260703_000000_partner_affiliate_operations',
  '20260704_090000_partner_schema_reconciliation',
])
assert.deepEqual(migrationNames.slice(-2), [
  '20260703_000000_partner_affiliate_operations',
  '20260704_090000_partner_schema_reconciliation',
])

assert.match(upSql, /"jpvbootcamp_staging"\."payload_partner_affiliates_recipient_emails"/)
assert.match(upSql, /CREATE TABLE IF NOT EXISTS/)
assert.match(upSql, /"_parent_id" integer NOT NULL/)
assert.match(upSql, /"_order" integer NOT NULL/)
assert.match(upSql, /"email" varchar NOT NULL/)
assert.match(upSql, /payload_partner_affiliates_recipient_emails_parent_id_fk/)
assert.match(upSql, /ADD COLUMN IF NOT EXISTS "partner_slug_snapshot" varchar/)
assert.match(upSql, /ADD COLUMN IF NOT EXISTS "partner_name_snapshot" varchar/)
assert.match(upSql, /ADD COLUMN IF NOT EXISTS "company_snapshot" varchar/)
assert.match(upSql, /ADD COLUMN IF NOT EXISTS "country_snapshot" varchar/)
assert.match(upSql, /ADD COLUMN IF NOT EXISTS "experience_snapshot" varchar/)
assert.match(upSql, /ADD COLUMN IF NOT EXISTS "message_snapshot" text/)
assert.match(upSql, /ADD COLUMN IF NOT EXISTS "trusted_destination_snapshot" varchar/)
assert.match(upSql, /payload_partner_applications_partner_slug_snapshot_idx/)
assert.match(upSql, /jsonb_array_elements/)
assert.match(upSql, /information_schema\.columns/)
assert.match(upSql, /IF EXISTS/)

assert.equal(/\bDELETE\s+FROM\b/i.test(upSql), false)
assert.equal(/\bTRUNCATE\b/i.test(upSql), false)
assert.equal(/\bDROP TABLE\b/i.test(upSql), false)
assert.equal(/\bDROP SCHEMA\b/i.test(upSql), false)
assert.equal(upSql.includes('"jpvbootcamp".'), false)
assert.equal(upSql.includes('"public".'), false)
assert.equal(/production/i.test(upSql), false)
assert.equal(/payload_partner_affiliates_recipient_emails/.test(upSql), true)
assert.equal(/partner_slug_snapshot/.test(upSql), true)
assert.equal(/trusted_destination_snapshot/.test(upSql), true)

assert.match(downSql, /DROP TABLE IF EXISTS/)
assert.match(downSql, /payload_partner_affiliates_recipient_emails/)

console.log('payload_partner_schema_reconciliation.test.ts passed')
