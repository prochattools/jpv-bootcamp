import assert from 'node:assert/strict'

import {
  previewMigrationInventoryNames,
} from '../src/lib/previewMigrationInventory'
import {
  buildPartnerSchemaReconciliationMigrationDownSql,
  buildPartnerSchemaReconciliationMigrationUpSql,
} from '../src/lib/partnerSchemaReconciliationMigrationSql'
import { PAYLOAD_MIGRATION_NAMES } from '../src/migrations/migrationRegistry'

const stagingUrl = 'postgresql://user:password@db.internal:5432/app?schema=jpvbootcamp_staging'
const upSql = buildPartnerSchemaReconciliationMigrationUpSql(stagingUrl)
const downSql = buildPartnerSchemaReconciliationMigrationDownSql(stagingUrl)
const inventoryNames = previewMigrationInventoryNames()
const partnerOpsIdx = inventoryNames.indexOf('20260703_000000_partner_affiliate_operations')
const partnerReconcileIdx = inventoryNames.indexOf('20260704_090000_partner_schema_reconciliation')
assert.ok(partnerOpsIdx >= 0, 'partner_affiliate_operations must be in inventory')
assert.ok(partnerReconcileIdx >= 0, 'partner_schema_reconciliation must be in inventory')
assert.ok(partnerOpsIdx < partnerReconcileIdx, 'partner_affiliate_operations must precede partner_schema_reconciliation')

const registryOpsIdx = PAYLOAD_MIGRATION_NAMES.indexOf('20260703_000000_partner_affiliate_operations')
const registryReconcileIdx = PAYLOAD_MIGRATION_NAMES.indexOf('20260704_090000_partner_schema_reconciliation')
assert.ok(registryOpsIdx >= 0, 'partner_affiliate_operations must be in migration index')
assert.ok(registryReconcileIdx >= 0, 'partner_schema_reconciliation must be in migration index')
assert.ok(registryOpsIdx < registryReconcileIdx, 'registry order: affiliate ops before schema reconciliation')

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
