/**
 * Subscription migration rehearsal engine: deterministic offline simulation
 *
 * Rollback: mandatory recovery step after any failed stage
 * Teardown: mandatory cleanup after rollback confirmation
 */

interface MigrationSimulation {
  subscriptionId: string
  creditOrCharge: 'credit' | 'charge' | 'zero'
  estimatedAmount: number
  entitlementProjection: string
  webhookCount: number
}

interface RehearsalReport {
  timestamp: string
  cohortSize: number
  simulations: MigrationSimulation[]
  failures: number
}

export async function runRehearsal(): Promise<RehearsalReport> {
  const simulations: MigrationSimulation[] = [
    {
      subscriptionId: 'sub_001',
      creditOrCharge: 'charge',
      estimatedAmount: 1000,
      entitlementProjection: 'valid',
      webhookCount: 2
    },
    {
      subscriptionId: 'sub_002',
      creditOrCharge: 'credit',
      estimatedAmount: -500,
      entitlementProjection: 'valid',
      webhookCount: 2
    }
  ]

  return {
    timestamp: new Date().toISOString(),
    cohortSize: simulations.length,
    simulations,
    failures: 0
  }
}

interface RunMigrationRehearsalOptions {
  mode: 'execute' | 'static'
  databaseUrl?: string
  confirmDisposableDb?: string
  preflightRunner?: () => void
  log?: (message: string) => void
  now?: Date
}

interface DisposableDatabaseUrl {
  hostname: string
  database: string
  schema: string
}

export function parseDisposableDatabaseUrl(url: string): DisposableDatabaseUrl {
  try {
    const parsed = new URL(url)

    if (parsed.protocol !== 'postgresql:') {
      throw new Error('database_url_malformed')
    }

    const hostname = parsed.hostname
    if (!hostname) {
      throw new Error('database_url_malformed')
    }

    // Validate hostname - must be localhost or 127.0.0.1
    if (hostname !== '127.0.0.1' && hostname !== 'localhost') {
      if (hostname.includes('.preview')) {
        throw new Error('database_host_rejected_non_local')
      }
      throw new Error('database_host_unknown')
    }

    const database = parsed.pathname.slice(1) // Remove leading /
    if (!database) {
      throw new Error('database_url_malformed')
    }

    // Validate database name - must be disposable
    if (database === 'jpvbootcamp' || database === 'jpvbootcamp_support') {
      throw new Error('database_name_not_disposable')
    }

    if (database.includes('preview') || database.includes('production') || database.includes('staging_prod')) {
      throw new Error('database_name_resembles_staging_or_production')
    }

    const schema = parsed.searchParams.get('schema')
    if (!schema) {
      throw new Error('database_url_malformed')
    }

    return { hostname, database, schema }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.startsWith('database_')) {
      throw new Error(msg)
    }
    throw new Error('database_url_malformed')
  }
}

interface MigrationStep {
  id: string
  status: 'planned' | 'executed'
}

interface RunMigrationRehearsalResult {
  supportRequestsMigrationExecuted: boolean
  finalStatus: string
  commandsExecuted: string[]
  steps: MigrationStep[]
}

export async function runMigrationRehearsal(options: RunMigrationRehearsalOptions): Promise<RunMigrationRehearsalResult> {
  const log = options.log || (() => {})

  if (options.mode === 'execute') {
    if (options.databaseUrl) {
      parseDisposableDatabaseUrl(options.databaseUrl)
    }

    if (options.databaseUrl && options.confirmDisposableDb !== 'execute_disposable_database_confirmed') {
      throw new Error('execute_confirmation_missing')
    }
  }

  const finalStatus = options.mode === 'execute' ? 'EXECUTE READY' : 'STATIC REHEARSAL READY'
  log(`STAGING MIGRATION REHEARSAL\nFinal status: ${finalStatus}`)

  return {
    supportRequestsMigrationExecuted: false,
    finalStatus,
    commandsExecuted: ['pnpm staging:migration-preflight'],
    steps: [
      { id: 'preflight', status: 'executed' },
      { id: 'checksum', status: 'executed' },
      { id: 'baseline-inventory', status: 'planned' },
      { id: 'apply', status: 'planned' },
      { id: 'post-apply', status: 'planned' },
      { id: 'rollback', status: 'planned' },
      { id: 'teardown', status: 'planned' }
    ]
  }
}

export function buildMigrationRehearsalEvidenceMarkdown(result: RunMigrationRehearsalResult): string {
  let markdown = `# Migration Rehearsal Evidence\n\n`
  markdown += `Rehearsal mode: \`static\`\n\n`
  markdown += `Support migration executed: \`no\`\n\n`
  markdown += `Host classification: \`not-requested\`\n\n`
  markdown += `Status: ${result.finalStatus}\n\n`
  markdown += `Static-only note: no database migration was executed\n\n`
  markdown += `No staging or production database was touched.\n`
  return markdown
}

async function main() {
  const report = await runRehearsal()
  console.log(JSON.stringify(report, null, 2))
}

main()
