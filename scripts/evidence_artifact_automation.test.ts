import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'

async function main(): Promise<void> {
  const [
    generatorScript,
    validatorScript,
  ] = await Promise.all([
    readFile('scripts/create_staging_evidence_artifacts.ts', 'utf8'),
    readFile('scripts/validate_staging_evidence_artifacts.ts', 'utf8'),
  ])

  // File existence checks
  assert.ok(
    existsSync('scripts/create_staging_evidence_artifacts.ts'),
    'create_staging_evidence_artifacts.ts should exist'
  )
  assert.ok(
    existsSync('scripts/validate_staging_evidence_artifacts.ts'),
    'validate_staging_evidence_artifacts.ts should exist'
  )
  assert.ok(
    existsSync('docs/client/evidence/.gitkeep'),
    'docs/client/evidence/.gitkeep should exist'
  )

  // Generator script checks
  assert.match(
    generatorScript,
    /STAGING_SMOKE_TEMPLATE/,
    'Generator should reference STAGING_SMOKE_TEMPLATE'
  )
  assert.match(
    generatorScript,
    /STAGING_SMOKE_EVIDENCE_TEMPLATE\.md/,
    'Generator should reference STAGING_SMOKE_EVIDENCE_TEMPLATE.md'
  )
  assert.match(
    generatorScript,
    /PROVIDER_EMAIL_TEMPLATE/,
    'Generator should reference PROVIDER_EMAIL_TEMPLATE'
  )
  assert.match(
    generatorScript,
    /PROVIDER_EMAIL_EVIDENCE_TEMPLATE\.md/,
    'Generator should reference PROVIDER_EMAIL_EVIDENCE_TEMPLATE.md'
  )
  assert.match(
    generatorScript,
    /EVIDENCE_DIR.*docs\/client\/evidence/,
    'Generator should write only to docs/client/evidence/'
  )
  assert.match(
    generatorScript,
    /Migrations applied: No/,
    'Generator should include "Migrations applied: No"'
  )
  assert.match(
    generatorScript,
    /feature\/course-branding-and-preview/,
    'Generator should include feature branch name'
  )
  assert.match(
    generatorScript,
    /secret/i,
    'Generator should include secret warning'
  )
  assert.match(
    generatorScript,
    /main/,
    'Generator should warn about main branch'
  )
  assert.doesNotMatch(
    generatorScript,
    /prisma\.\w+\.(findUnique|create|update)/,
    'Generator should not contain database connection patterns'
  )
  assert.doesNotMatch(
    generatorScript,
    /fetch\(|axios\.|http\.get|https\.get/,
    'Generator should not contain network-fetch patterns'
  )

  // Validator script checks
  assert.match(
    validatorScript,
    /sk_live_/,
    'Validator should check for sk_live_'
  )
  assert.match(
    validatorScript,
    /sk_test_/,
    'Validator should check for sk_test_'
  )
  assert.match(
    validatorScript,
    /pk_live_/,
    'Validator should check for pk_live_'
  )
  assert.match(
    validatorScript,
    /pk_test_/,
    'Validator should check for pk_test_'
  )
  assert.match(
    validatorScript,
    /whsec_/,
    'Validator should check for whsec_'
  )
  assert.match(
    validatorScript,
    /dokploy_/,
    'Validator should check for dokploy_'
  )
  assert.match(
    validatorScript,
    /api_key/i,
    'Validator should check for api_key'
  )
  assert.match(
    validatorScript,
    /password/i,
    'Validator should check for password'
  )
  assert.match(
    validatorScript,
    /evidence may not exist yet/,
    'Validator should allow empty evidence folder'
  )
  assert.match(
    validatorScript,
    /approved migration/i,
    'Validator should check for approved migration record'
  )
  assert.match(
    validatorScript,
    /hasMigrationsApplied/,
    'Validator should check migration state'
  )
  assert.doesNotMatch(
    validatorScript,
    /prisma\.\w+\.(findUnique|create|update)/,
    'Validator should not contain database connection patterns'
  )
  assert.doesNotMatch(
    validatorScript,
    /fetch\(|axios\.|http\.get|https\.get/,
    'Validator should not contain network-fetch patterns'
  )

  console.log('✓ All evidence artifact automation tests passed')
}

main().catch((err) => {
  console.error('✗ Test failed:', err)
  process.exit(1)
})
