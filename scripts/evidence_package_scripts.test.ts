import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'

function main(): void {
  assert.ok(existsSync('package.json'), 'package.json should exist')

  const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
    scripts?: Record<string, string>
  }

  const scripts = packageJson.scripts ?? {}

  assert.equal(
    scripts['evidence:create'],
    'tsx scripts/create_staging_evidence_artifacts.ts',
    'evidence:create should call the local evidence artifact generator',
  )
  assert.equal(
    scripts['evidence:validate'],
    'tsx scripts/validate_staging_evidence_artifacts.ts',
    'evidence:validate should call the local evidence artifact validator',
  )

  assert.match(
    scripts['evidence:create'] ?? '',
    /create_staging_evidence_artifacts\.ts/,
    'evidence:create should reference the generator script',
  )
  assert.match(
    scripts['evidence:validate'] ?? '',
    /validate_staging_evidence_artifacts\.ts/,
    'evidence:validate should reference the validator script',
  )

  for (const value of Object.values(scripts)) {
    if (!/evidence:(create|validate|test)/.test(value)) continue
    assert.doesNotMatch(value, /prisma migrate/i)
    assert.doesNotMatch(value, /payload migrate/i)
    assert.doesNotMatch(value, /db push/i)
    assert.doesNotMatch(value, /fetch\(/i)
    assert.doesNotMatch(value, /\baxios\b/i)
    assert.doesNotMatch(value, /http\.request/i)
    assert.doesNotMatch(value, /https\.request/i)
    assert.doesNotMatch(value, /\.env/i)
    assert.doesNotMatch(value, /DATABASE_URL/i)
  }

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

  console.log('evidence_package_scripts.test.ts passed')
}

main()
