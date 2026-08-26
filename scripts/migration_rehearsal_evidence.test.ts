import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  buildMigrationRehearsalEvidenceMarkdown,
  runMigrationRehearsal,
} from './release/migrationRehearsal'

async function main(): Promise<void> {
  const result = await runMigrationRehearsal({
    mode: 'static',
    now: new Date('2026-07-14T20:15:00.000Z'),
    preflightRunner() {},
    log() {},
  })
  const markdown = buildMigrationRehearsalEvidenceMarkdown(result)

  assert.match(markdown, /# Migration Rehearsal Evidence/)
  assert.match(markdown, /Rehearsal mode: `static`/)
  assert.match(markdown, /Support migration executed: `no`/)
  assert.match(markdown, /Host classification: `not-requested`/)
  assert.match(markdown, /Static-only note: no database migration was executed/)
  assert.match(markdown, /No staging or production database was touched\./)
  assert.doesNotMatch(markdown, /postgresql:\/\//i)
  assert.doesNotMatch(markdown, /password|secret|token=/i)

  const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as { scripts?: Record<string, string> }
  assert.equal(
    packageJson.scripts?.['staging:migration-rehearsal:evidence'],
    'tsx scripts/release/buildMigrationRehearsalEvidence.ts',
  )

  console.log('migration_rehearsal_evidence.test.ts passed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
