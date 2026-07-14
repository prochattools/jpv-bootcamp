import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  parseDisposableDatabaseUrl,
  runMigrationRehearsal,
} from './release/migrationRehearsal'

async function main(): Promise<void> {
  const accepted = parseDisposableDatabaseUrl(
    'postgresql://rehearsal_user:local_rehearsal_secret@127.0.0.1:5432/jpvbootcamp_support_rehearsal?schema=rehearsal',
  )
  assert.equal(accepted.hostname, '127.0.0.1')
  assert.equal(accepted.database, 'jpvbootcamp_support_rehearsal')
  assert.equal(accepted.schema, 'rehearsal')
  assert.equal(JSON.stringify(accepted).includes('postgresql://'), false)
  assert.equal(JSON.stringify(accepted).includes('local_rehearsal_secret'), false)

  for (const [input, pattern] of [
    ['postgresql://user:test@db.preview.internal:5432/jpvbootcamp_rehearsal?schema=rehearsal', /database_host_rejected_non_local/],
    ['postgresql://user:test@db.internal:5432/jpvbootcamp_rehearsal?schema=rehearsal', /database_host_unknown/],
    ['postgresql://user:test@127.0.0.1:5432/jpvbootcamp?schema=rehearsal', /database_name_not_disposable/],
    ['postgresql://user:test@127.0.0.1:5432/jpvbootcamp_preview?schema=rehearsal', /database_name_resembles_staging_or_production/],
    ['not-a-url', /database_url_malformed/],
  ] as const) {
    assert.throws(() => parseDisposableDatabaseUrl(input), pattern)
  }

  await assert.rejects(
    () =>
      runMigrationRehearsal({
        mode: 'execute',
        databaseUrl: 'postgresql://rehearsal_user:local_rehearsal_secret@127.0.0.1:5432/jpvbootcamp_support_rehearsal?schema=rehearsal',
        confirmDisposableDb: 'wrong-sentinel',
        preflightRunner() {},
        log() {},
      }),
    /execute_confirmation_missing/,
  )

  const logs: string[] = []
  const result = await runMigrationRehearsal({
    mode: 'static',
    now: new Date('2026-07-14T20:00:00.000Z'),
    preflightRunner() {},
    log(message) {
      logs.push(message)
    },
  })

  assert.equal(result.supportRequestsMigrationExecuted, false)
  assert.equal(result.finalStatus, 'STATIC REHEARSAL READY')
  assert.equal(result.commandsExecuted.includes('pnpm staging:migration-preflight'), true)
  assert.equal(result.steps.map((step) => step.id).join(','), 'preflight,checksum,baseline-inventory,apply,post-apply,rollback,teardown')
  assert.equal(result.steps.filter((step) => step.status === 'planned').map((step) => step.id).join(','), 'baseline-inventory,apply,post-apply,rollback,teardown')
  assert.match(logs[0] ?? '', /STAGING MIGRATION REHEARSAL/)
  assert.match(logs[0] ?? '', /Final status: STATIC REHEARSAL READY/)
  assert.doesNotMatch(logs[0] ?? '', /postgresql:\/\//i)

  const source = readFileSync('scripts/release/migrationRehearsal.ts', 'utf8')
  assert.match(source, /rollback.*mandatory/i)
  assert.match(source, /teardown.*mandatory/i)
  assert.doesNotMatch(source, /\bdeploy\b/)

  const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as { scripts?: Record<string, string> }
  assert.equal(
    packageJson.scripts?.['staging:migration-rehearsal'],
    'tsx scripts/release/migrationRehearsal.ts',
  )

  console.log('staging_migration_rehearsal.test.ts passed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
