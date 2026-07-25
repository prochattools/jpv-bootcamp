import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import { PREVIEW_MIGRATION_INVENTORY, previewMigrationInventoryNames } from '../src/lib/previewMigrationInventory'

async function main(): Promise<void> {
  const inventoryNames = previewMigrationInventoryNames()
  const legacyUserColumn = 'wp' + '_user_id'
  const legacyClaimedByColumn = 'claimed_by_' + legacyUserColumn
  const legacyPartnerIndex = ['partner_sessions', legacyUserColumn, 'idx'].join('_')
  assert.equal(PREVIEW_MIGRATION_INVENTORY.length, 23)
  assert.equal(inventoryNames.at(-1), '20260724_123000_email_operator_actions')

  const [
    migrationIndexSource,
    payloadMigrationSource,
    prismaRenameSource,
    inventoryTestSource,
    staticTestSource,
  ] = await Promise.all([
    readFile('src/migrations/index.ts', 'utf8'),
    readFile('src/migrations/20260707_130000_remove_table_plan_from_payload_enums.ts', 'utf8'),
    readFile('prisma/migrations/20260707_120000_rename_account_identity_columns/migration.sql', 'utf8'),
    readFile('scripts/preview_migration_inventory.test.ts', 'utf8'),
    readFile('scripts/migration_readiness_static.test.ts', 'utf8'),
  ])

  const reconciledIndex = migrationIndexSource.indexOf(
    "name: '20260704_090000_partner_schema_reconciliation'",
  )
  const tablePlanIndex = migrationIndexSource.indexOf(
    "name: '20260707_130000_remove_table_plan_from_payload_enums'",
  )
  assert(reconciledIndex >= 0)
  assert(tablePlanIndex > reconciledIndex)

  assert.match(payloadMigrationSource, /IF to_regclass\('\$\{schema\}\.payload_access_policies_allowed_plans'\) IS NOT NULL/)
  assert.match(payloadMigrationSource, /IF to_regclass\('\$\{schema\}\.payload_subscriptions'\) IS NOT NULL/)
  assert.match(payloadMigrationSource, /SET plan = 'free'::\$\{schema\}\.enum_payload_subscriptions_plan/)
  assert.match(payloadMigrationSource, /WHERE plan::text = legacy_plan/)
  assert.match(payloadMigrationSource, /DELETE FROM \$\{schema\}\.payload_access_policies_allowed_plans/)
  assert.match(payloadMigrationSource, /CREATE TYPE \$\{schema\}\.enum_payload_access_policies_allowed_plans AS ENUM \('free', 'pro'\)/)
  assert.match(payloadMigrationSource, /CREATE TYPE \$\{schema\}\.enum_payload_subscriptions_plan AS ENUM \('free', 'pro'\)/)
  assert.doesNotMatch(payloadMigrationSource, /\bDROP TABLE\b/i)
  assert.doesNotMatch(payloadMigrationSource, /\bTRUNCATE\b/i)

  assert.match(
    prismaRenameSource,
    new RegExp(`RENAME COLUMN ${legacyUserColumn} TO account_id;`),
  )
  assert.match(
    prismaRenameSource,
    new RegExp(`RENAME COLUMN ${legacyClaimedByColumn} TO claimed_by_account_id;`),
  )
  assert.match(
    prismaRenameSource,
    new RegExp(`DROP INDEX IF EXISTS jpvbootcamp\\.${legacyPartnerIndex};`),
  )
  assert.match(prismaRenameSource, /CREATE INDEX IF NOT EXISTS partner_sessions_account_id_idx/)
  assert.match(
    prismaRenameSource,
    /IF EXISTS \(\s+SELECT 1 FROM information_schema\.columns[\s\S]+?column_name =/,
  )
  assert.doesNotMatch(prismaRenameSource, /\bDROP TABLE\b/i)

  for (const source of [inventoryTestSource, staticTestSource]) {
    assert.doesNotMatch(source, /\bchild_process\b/)
    assert.doesNotMatch(source, /\bexec(File|Sync)?\b/)
    assert.doesNotMatch(source, /\bspawn(Sync)?\b/)
    assert.doesNotMatch(source, /\bprisma migrate\b/i)
  }

  console.log('migration readiness static tests passed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
