/**
 * CLI entry point for the legacy data migration.
 *
 * Usage:
 *   pnpm migration:legacy -- --mode <extract|validate|dry-run|apply|rollback> [--rollback-run-id <id>]
 *
 * Environment:
 *   DATABASE_URL  — must point to 100.71.31.88/jpvbootcamp_staging (guard enforced)
 *
 * Hard guards enforced before any DB write:
 *   - host must be 100.71.31.88
 *   - schema must be jpvbootcamp_staging
 */

import { randomBytes } from 'node:crypto'
import path from 'node:path'

import { assertStagingGuard, runMigration, type MigrationMode } from './legacyMigration'

function parseArgs(argv: string[]): { mode: MigrationMode; rollbackRunId?: string } {
  const modeIdx = argv.indexOf('--mode')
  const mode = modeIdx >= 0 ? argv[modeIdx + 1] : undefined
  if (!mode || !['extract', 'validate', 'dry-run', 'apply', 'rollback'].includes(mode)) {
    throw new Error('USAGE: --mode <extract|validate|dry-run|apply|rollback>')
  }

  const rollbackIdx = argv.indexOf('--rollback-run-id')
  const rollbackRunId = rollbackIdx >= 0 ? argv[rollbackIdx + 1] : undefined

  if (mode === 'rollback' && !rollbackRunId) {
    throw new Error('rollback requires --rollback-run-id <id>')
  }

  return { mode: mode as MigrationMode, rollbackRunId }
}

async function main(): Promise<void> {
  const { mode, rollbackRunId } = parseArgs(process.argv.slice(2))

  const databaseUrl = process.env['DATABASE_URL']
  if (!databaseUrl) {
    console.error('ABORT: DATABASE_URL is not set')
    process.exitCode = 1
    return
  }

  // Guard runs before connecting — fast fail if wrong target
  try {
    assertStagingGuard(databaseUrl)
  } catch (err) {
    console.error('ABORT:', err instanceof Error ? err.message : String(err))
    process.exitCode = 1
    return
  }

  const runId = `migration_${mode}_${randomBytes(4).toString('hex')}_${Date.now()}`
  const checkpointDir = path.join(process.cwd(), '.migration-checkpoints')

  const result = await runMigration(
    {
      mode,
      databaseUrl,
      runId,
      checkpointDir,
      rollbackRunId,
    },
    (message) => console.log(message),
  )

  console.log(JSON.stringify({
    runId: result.runId,
    mode: result.mode,
    sourceCount: result.sourceCount,
    processedCount: result.processedCount,
    skippedCount: result.skippedCount,
    errorCount: result.errorCount,
    errors: result.errors,
    checkpointPath: `.migration-checkpoints/checkpoint_${result.runId}.json`,
  }, null, 2))

  if (result.errorCount > 0) {
    process.exitCode = 1
  }
}

main().catch((err) => {
  console.error('FATAL:', err instanceof Error ? err.message : String(err))
  process.exitCode = 1
})
