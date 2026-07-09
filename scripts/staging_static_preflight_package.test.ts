import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'

function main(): void {
  assert.ok(existsSync('package.json'), 'package.json should exist')

  const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
    scripts?: Record<string, string>
  }

  const scripts = packageJson.scripts ?? {}
  const command = scripts['staging:static-preflight'] ?? ''

  assert.ok(command, 'staging:static-preflight should exist')
  assert.match(command, /git diff --check/)
  assert.match(command, /tsc --noEmit/)
  assert.match(command, /prisma validate --schema=prisma\/system\.prisma/)
  assert.match(command, /prisma validate --schema=prisma\/schema\.prisma/)
  assert.match(command, /scripts\/evidence_artifact_automation\.test\.ts/)
  assert.match(command, /scripts\/evidence_package_scripts\.test\.ts/)
  assert.match(command, /scripts\/status_docs_consistency\.test\.ts/)
  assert.match(command, /scripts\/preview_migration_inventory\.test\.ts/)
  assert.match(command, /scripts\/migration_readiness_static\.test\.ts/)
  assert.match(command, /scripts\/migration_rehearsal_safety\.test\.ts/)
  assert.match(command, /scripts\/staging_evidence_static\.test\.ts/)
  assert.match(command, /scripts\/operator_handoff_static\.test\.ts/)
  assert.match(command, /scripts\/billing_readiness_report\.test\.ts/)
  assert.match(command, /scripts\/member_checkout\.test\.ts/)
  assert.match(command, /scripts\/frontend_content_request_static\.test\.ts/)
  assert.match(command, /pnpm toolchain:check/)
  assert.match(command, /pnpm evidence:validate/)

  assert.doesNotMatch(command, /prisma migrate/i)
  assert.doesNotMatch(command, /payload migrate/i)
  assert.doesNotMatch(command, /db push/i)
  assert.doesNotMatch(command, /evidence:create/i)
  assert.doesNotMatch(command, /fetch\(/i)
  assert.doesNotMatch(command, /\baxios\b/i)
  assert.doesNotMatch(command, /http\.request/i)
  assert.doesNotMatch(command, /https\.request/i)
  assert.doesNotMatch(command, /\.env/i)
  assert.doesNotMatch(command, /DATABASE_URL/i)
  assert.doesNotMatch(command, /\bmain\b/)

  assert.ok(
    existsSync('docs/client/evidence/.gitkeep'),
    'docs/client/evidence/.gitkeep should exist',
  )

  const evidenceFiles = readdirSync('docs/client/evidence').filter((file) =>
    file.endsWith('.md'),
  )

  for (const file of evidenceFiles) {
    const content = readFileSync(`docs/client/evidence/${file}`, 'utf8')
    assert.doesNotMatch(
      content,
      /checks passed|validation passed/i,
      `${file} should not claim checks passed in committed evidence`,
    )
  }

  console.log('staging_static_preflight_package.test.ts passed')
}

main()
