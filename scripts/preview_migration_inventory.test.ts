import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import {
  PREVIEW_MIGRATION_INVENTORY,
  assertPreviewMigrationInventoryMatch,
  previewMigrationInventoryNames,
  validatePreviewMigrationInventoryOrder,
} from '../src/lib/previewMigrationInventory'
import { REQUIRED_PAYLOAD_MIGRATIONS } from '../src/lib/previewReleasePolicy'
import { expectedPayloadMigrationOrder } from '../src/lib/previewReleasePreflight'
import { buildPreviewReleaseManifest, validatePreviewReleaseManifestInput } from '../src/lib/previewReleaseManifest'
import { PAYLOAD_MIGRATION_NAMES } from '../src/lib/payloadMigrationRegistry'

async function main(): Promise<void> {
  const legacyUserColumn = 'wp' + '_user_id'
  const names = previewMigrationInventoryNames()
  assert.equal(PREVIEW_MIGRATION_INVENTORY.length, 37)
  assert.deepEqual(names, PAYLOAD_MIGRATION_NAMES)
  assert.equal(assertPreviewMigrationInventoryMatch(names), true)
  assert.equal(validatePreviewMigrationInventoryOrder(names), true)
  assert.equal(validatePreviewMigrationInventoryOrder([...names].reverse()), false)
  assert.equal(validatePreviewMigrationInventoryOrder([...names, 'extra']), false)
  assert.equal(validatePreviewMigrationInventoryOrder(names.slice(1)), false)

  const registrySource = await readFile('src/migrations/index.ts', 'utf8')
  const payloadMigrationSource = await readFile(
    'src/migrations/20260707_130000_remove_table_plan_from_payload_enums.ts',
    'utf8',
  )
  const prismaRenameSource = await readFile(
    'prisma/migrations/20260707_120000_rename_account_identity_columns/migration.sql',
    'utf8',
  )
  assert.match(registrySource, /PAYLOAD_MIGRATION_NAMES\.map\(\(name\) =>/)
  assert.doesNotMatch(registrySource, /name:\s*'20\d{6}_/)
  assert.deepEqual(REQUIRED_PAYLOAD_MIGRATIONS, names)
  assert.deepEqual(expectedPayloadMigrationOrder(), names)
  assert.equal(names.includes('20260707_130000_remove_table_plan_from_payload_enums'), true)
  assert.match(payloadMigrationSource, /SET plan = 'free'/)
  assert.match(payloadMigrationSource, /WHERE plan::text = legacy_plan/)
  assert.match(payloadMigrationSource, /ENUM \('free', 'pro'\)/)
  assert.match(
    prismaRenameSource,
    new RegExp(`RENAME COLUMN ${legacyUserColumn} TO account_id;`),
  )
  assert.match(prismaRenameSource, /DROP INDEX IF EXISTS/)
  assert.doesNotMatch(payloadMigrationSource, /\bDROP TABLE\b/i)
  assert.doesNotMatch(prismaRenameSource, /\bDROP TABLE\b/i)

  const manifest = buildPreviewReleaseManifest({
    repository: 'prochattools/jpv-bootcamp',
    commitSha: '00d874480ef075ca8a853f9fa127e251d7b6a7ce',
    targetEnvironment: 'preview',
    startupMode: 'application-only',
    deploymentRuntime: 'docker',
    sourceDate: '2026-07-02T00:00:00Z',
  })
  assert.deepEqual(manifest.payloadMigrations, names)
  assert.equal(validatePreviewReleaseManifestInput({
    repository: 'prochattools/jpv-bootcamp',
    commitSha: '00d874480ef075ca8a853f9fa127e251d7b6a7ce',
    targetEnvironment: 'preview',
    startupMode: 'application-only',
    deploymentRuntime: 'docker',
    sourceDate: '2026-07-02T00:00:00Z',
    payloadMigrations: [...names].reverse(),
  }).errors.includes('invalid_payload_migration_order'), true)

  const policySource = await readFile('src/lib/previewReleasePolicy.ts', 'utf8')
  const preflightSource = await readFile('src/lib/previewReleasePreflight.ts', 'utf8')
  const shadowSource = await readFile('src/lib/shadowValidationReport.ts', 'utf8')
  assert.match(policySource, /previewMigrationInventoryNames\(\)/)
  assert.match(preflightSource, /previewMigrationInventoryForPayload\(\)/)
  assert.match(shadowSource, /previewMigrationInventoryNames\(\)/)
  assert.doesNotMatch(registrySource, /\bchild_process\b|\bspawn(Sync)?\b|\bexec(File|Sync)?\b/)
  const safeInventorySerialization = JSON.stringify(
    PREVIEW_MIGRATION_INVENTORY.map(({ name, system, order, requiredForPreview, rollbackRisk, authorizationCategory }) => ({
      name,
      system,
      order,
      requiredForPreview,
      rollbackRisk,
      authorizationCategory,
    })),
  )
  assert.doesNotMatch(safeInventorySerialization, /postgres(?:ql)?:\/\/|database_url|provider_(?:id|key|secret)|token|https:\/\/|customer_/i)

  console.log('preview_migration_inventory.test.ts passed')
}

main().catch((error) => {
  console.error('preview_migration_inventory.test.ts failed', error instanceof Error ? error.message : error)
  process.exitCode = 1
})
