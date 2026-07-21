/**
 * Unified runner for next-domain migrations (REM-03 through REM-07).
 *
 * Modes:
 *   extract   — read source rows, emit inventory
 *   validate  — check source/destination state
 *   dry-run   — full transform + conflict detection, NO writes
 *   apply     — idempotent upsert to destination (guard-enforced, staging only)
 *   rollback  — delete domain-specific rows by migration_run_id
 *
 * Usage:
 *   pnpm migration:next-domains extract
 *   pnpm migration:next-domains validate
 *   pnpm migration:next-domains dry-run
 *   pnpm migration:next-domains apply --run-id <runId>
 *   pnpm migration:next-domains rollback --run-id <runId>
 *
 * Hard guards:
 *   - staging guard enforced for apply/rollback
 *   - rehearsal guard enforced for local testing
 *   - PII redaction in all logs
 */

import path from 'node:path'
import { createHash } from 'node:crypto'
import { SponsoredGrantsAdapter } from './legacyMigrationSponsored'
import { EmailSubscribersAdapter } from './legacyMigrationSubscribers'
import { SupportRequestsAdapter } from './legacyMigrationSupportRequests'
import { PartnerAttributionAdapter } from './legacyMigrationPartnerAttribution'
import { CourseProgressAdapter } from './legacyMigrationCourseProgress'
import { executeDomainMigration, DomainMigrationConfig, MigrationMode } from './legacyMigrationFramework'

const CHECKPOINT_DIR = path.join(process.cwd(), '.migration-rehearsal-checkpoints')

/**
 * Generate a deterministic migration run ID.
 * Uses the current time rounded to hour granularity + a fixed prefix.
 * This ensures idempotency for reruns within the same hour.
 */
function generateDeterministicRunId(): string {
  const hoursSinceEpoch = Math.floor(Date.now() / 3600000)
  const hash = createHash('sha256')
    .update(`migration_run_${hoursSinceEpoch}`)
    .digest('hex')
    .substring(0, 12)
  return `migration_${hoursSinceEpoch}_${hash}`
}

async function runAllDomains(mode: MigrationMode, config: Partial<DomainMigrationConfig> = {}) {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required')
  }

  const adapters = [
    new SponsoredGrantsAdapter(),
    new EmailSubscribersAdapter(),
    new SupportRequestsAdapter(),
    new PartnerAttributionAdapter(),
    new CourseProgressAdapter(),
  ]

  const runId = config.runId || generateDeterministicRunId()

  console.log(`\n════════════════════════════════════════════════════`)
  console.log(`Next-Domain Migration Runner (REM-03 through REM-07)`)
  console.log(`════════════════════════════════════════════════════`)
  console.log(`Mode: ${mode}`)
  console.log(`RunID: ${runId}`)
  console.log(`Database: ${databaseUrl.replace(/\/\/[^:]*:[^@]*@/, '//<REDACTED>@')}`)
  console.log(`Adapters: ${adapters.length}`)
  console.log(`\n`)

  const results = []

  for (const adapter of adapters) {
    console.log(`\n─ ${adapter.domainName}`)

    try {
      const result = await executeDomainMigration(adapter, {
        mode,
        databaseUrl,
        runId,
        checkpointDir: CHECKPOINT_DIR,
        schemaName: config.schemaName,
        rollbackRunId: config.rollbackRunId,
      })

      results.push(result)

      console.log(`  status: ${result.mode === 'dry-run' ? 'SIMULATED' : 'OK'}`)
      console.log(`  source: ${result.sourceCount} rows`)
      console.log(`  processed: ${result.processedCount}`)
      console.log(`  errors: ${result.errorCount}`)

      if (result.metrics) {
        for (const [table, metrics] of Object.entries(result.metrics)) {
          const total = metrics.inserted + metrics.updated + metrics.unchanged + metrics.preserved + metrics.notApplicable
          if (total > 0) {
            console.log(`  ${table}: +${metrics.inserted} ~${metrics.updated} =${metrics.unchanged} P${metrics.preserved} -${metrics.notApplicable}`)
          }
        }
      }

      if (result.dryRunSummary && result.dryRunSummary.length > 0) {
        console.log(`  summary: ${result.dryRunSummary.slice(0, 3).join('; ')}${result.dryRunSummary.length > 3 ? '...' : ''}`)
      }

      if (result.errorCount > 0) {
        for (const err of result.errors.slice(0, 2)) {
          console.log(`    ⚠ ${err.recordKey}: ${err.message}`)
        }
      }
    } catch (e) {
      const error = e as Error
      console.log(`  ERROR: ${error.message}`)
      results.push({
        runId,
        mode,
        domain: adapter.domainName,
        sourceCount: 0,
        processedCount: 0,
        errorCount: 1,
        errors: [
          {
            recordKey: 'adapter-init',
            phase: 'validate',
            message: error.message,
            recoverable: false,
          },
        ],
      })
    }
  }

  console.log(`\n════════════════════════════════════════════════════`)
  console.log(`Summary`)
  console.log(`════════════════════════════════════════════════════`)

  const totalProcessed = results.reduce((sum, r) => sum + r.processedCount, 0)
  const totalErrors = results.reduce((sum, r) => sum + r.errorCount, 0)
  const completedDomains = results.filter((r) => r.errorCount === 0).length

  console.log(`Domains: ${completedDomains}/${results.length} successful`)
  console.log(`Processed: ${totalProcessed} total records`)
  console.log(`Errors: ${totalErrors}`)

  if (totalErrors === 0) {
    console.log(`\n✓ All domains completed successfully`)
  } else {
    console.log(`\n✗ ${totalErrors} errors encountered`)
    process.exit(1)
  }
}

// Parse CLI arguments
const mode = (process.argv[2] || 'validate') as MigrationMode
const args = process.argv.slice(3)

const configOverrides: Partial<DomainMigrationConfig> = {}
const validFlags = new Set(['--run-id', '--schema', '--rollback-run-id'])

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--run-id' && i + 1 < args.length) {
    configOverrides.runId = args[i + 1]
    i++
  } else if (args[i] === '--schema' && i + 1 < args.length) {
    configOverrides.schemaName = args[i + 1]
    i++
  } else if (args[i] === '--rollback-run-id' && i + 1 < args.length) {
    configOverrides.rollbackRunId = args[i + 1]
    i++
  } else if (args[i].startsWith('--')) {
    console.error(`Unknown flag: ${args[i]}`)
    console.error(`Valid flags: ${Array.from(validFlags).join(', ')}`)
    process.exit(1)
  }
}

// Validate mode
if (!['extract', 'validate', 'dry-run', 'apply', 'rollback'].includes(mode)) {
  console.error(`Invalid mode: ${mode}`)
  console.error(`Valid modes: extract, validate, dry-run, apply, rollback`)
  process.exit(1)
}

// Validate required flags for modes
if ((mode === 'apply' || mode === 'rollback') && !configOverrides.runId && mode === 'apply') {
  console.error(`Mode '${mode}' requires --run-id flag`)
  process.exit(1)
}
if (mode === 'rollback' && !configOverrides.rollbackRunId) {
  console.error(`Mode 'rollback' requires --rollback-run-id flag`)
  process.exit(1)
}

runAllDomains(mode, configOverrides).catch((e) => {
  console.error('Fatal error:', e)
  process.exit(1)
})
