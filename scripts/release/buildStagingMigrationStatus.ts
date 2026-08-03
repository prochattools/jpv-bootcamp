/**
 * buildStagingMigrationStatus.ts
 *
 * Read-only migration-state evidence command. When run with an authorized
 * staging connection, reports PII-safe migration metadata. When credentials
 * are absent or schema identity does not match, reports
 * OPERATOR_EVIDENCE_REQUIRED without executing any queries.
 *
 * Safety design:
 *  - Requires --mode=staging-read-only flag (fail closed without it)
 *  - Requires --expected-schema flag with exact schema name
 *  - Verifies database schema identity before any data query
 *  - Never prints connection strings, credentials, or arbitrary DB rows
 *  - Never applies or repairs anything
 *
 * Payload migration tracking table: payload_migrations
 *   (default for @payloadcms/db-postgres — no custom migrationTableName
 *    is set in src/payload.config.ts)
 *
 * Prisma migration tracking: _prisma_migrations
 *   (standard Prisma shadow table; confirmed by absence of override in
 *    prisma/schema.prisma and prisma/system.prisma)
 */

// ---------------------------------------------------------------------------
// Registered migrations — sourced directly from src/migrations/index.ts
// ---------------------------------------------------------------------------

export const REGISTERED_PAYLOAD_MIGRATIONS: readonly string[] = [
  '20260620_213328',
  '20260621_194424_course_system_phase1',
  '20260622_093852_course_private_media',
  '20260627_010700_structured_community_attachments',
  '20260630_100730_affiliate_reporting',
  '20260630_190000_payload_preferences_id_constraint',
  '20260701_201500_member_email_verification',
  '20260702_001500_member_account_action_purposes',
  '20260703_000000_partner_affiliate_operations',
  '20260704_090000_partner_schema_reconciliation',
  '20260707_130000_remove_table_plan_from_payload_enums',
  '20260718_103726_membership_support_schema',
  '20260718_000000_live_sessions',
  '20260718_110000_bunny_videos',
  '20260719_150000_subscription_schema_cols',
  '20260720_000000_locked_docs_rels_new_collections',
  '20260722_100000_reconcile_lockstate_vip_progress',
  '20260723_000000_singular_membership_plan',
  '20260723_000001_migrate_pro_to_membership',
  '20260724_120000_operator_content_media',
  '20260724_121000_billing_operator_actions',
  '20260724_122000_live_session_relationships',
  '20260724_123000_email_operator_actions',
  '20260727_000000_partner_applications_source_member_id',
  '20260727_100000_email_events_lease_columns',
  '20260727_200000_email_events_processing_status',
  '20260730_090000_membership_audit_relationship_columns',
  '20260730_100000_email_events_staging_guard_status',
] as const

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PayloadMigrationRow {
  name: string
  applied: boolean
  batch: number
}

export interface PrismaMigrationRow {
  migration_name: string
  finished_at: string | null
  logs: string | null
}

/**
 * Injected adapter interface. Implement with real DB queries for live use;
 * inject test doubles for unit tests.
 */
export interface MigrationQueryAdapter {
  getPayloadMigrations(): Promise<PayloadMigrationRow[]>
  getPrismaMigrations(): Promise<PrismaMigrationRow[]>
  getDatabaseSchemaIdentity(): Promise<string>
}

export interface StagingMigrationStatusReport {
  reportVersion: '1.0'
  mode: 'live' | 'dry-run'
  registeredMigrations: string[]
  appliedPayloadMigrations: string[]
  missingPayloadMigrations: string[]
  unexpectedPayloadMigrations: string[]
  prismaMigrations: Array<{ name: string; applied: boolean; failed: boolean }>
  schemaIdentityMatch: boolean | null
  overallStatus: 'VERIFIED' | 'MISMATCHES_FOUND' | 'OPERATOR_EVIDENCE_REQUIRED'
  notes: string[]
}

// ---------------------------------------------------------------------------
// Core builder — accepts optional adapter
// ---------------------------------------------------------------------------

/**
 * Build the migration status report.
 *
 * @param adapter  Live DB adapter. When null/undefined, returns an
 *                 OPERATOR_EVIDENCE_REQUIRED report without querying the DB.
 * @param expectedSchema  The exact schema name the DB must report. Required
 *                        for live mode; ignored for dry-run.
 */
export async function buildStagingMigrationStatus(
  adapter: MigrationQueryAdapter | null | undefined,
  expectedSchema?: string,
): Promise<StagingMigrationStatusReport> {
  const registered = Array.from(REGISTERED_PAYLOAD_MIGRATIONS)
  const notes: string[] = []

  // --- No adapter: dry-run evidence required ---
  if (!adapter) {
    notes.push(
      'OPERATOR READ-ONLY MIGRATION EVIDENCE REQUIRED: no database adapter was provided. ' +
        'Run with a valid staging connection using --mode=staging-read-only ' +
        'and --expected-schema=<schema-name> to obtain live evidence.',
    )
    return {
      reportVersion: '1.0',
      mode: 'dry-run',
      registeredMigrations: registered,
      appliedPayloadMigrations: [],
      missingPayloadMigrations: [],
      unexpectedPayloadMigrations: [],
      prismaMigrations: [],
      schemaIdentityMatch: null,
      overallStatus: 'OPERATOR_EVIDENCE_REQUIRED',
      notes,
    }
  }

  // --- Schema identity guard: must match before any query ---
  const reportedSchema = await adapter.getDatabaseSchemaIdentity()

  if (!expectedSchema) {
    throw new Error(
      'schema_identity_check_required: --expected-schema must be provided for live mode',
    )
  }

  if (reportedSchema !== expectedSchema) {
    notes.push(
      `Schema identity mismatch: expected "${expectedSchema}" but database reported a different schema. ` +
        'No queries were executed. Aborting.',
    )
    return {
      reportVersion: '1.0',
      mode: 'live',
      registeredMigrations: registered,
      appliedPayloadMigrations: [],
      missingPayloadMigrations: [],
      unexpectedPayloadMigrations: [],
      prismaMigrations: [],
      schemaIdentityMatch: false,
      overallStatus: 'OPERATOR_EVIDENCE_REQUIRED',
      notes,
    }
  }

  notes.push('Schema identity: matches expected staging schema.')

  // --- Payload migration comparison ---
  const payloadRows = await adapter.getPayloadMigrations()
  const appliedPayloadNames = payloadRows.filter((r) => r.applied).map((r) => r.name)
  const appliedSet = new Set(appliedPayloadNames)
  const registeredSet = new Set(registered)

  const missingPayloadMigrations = registered.filter((name) => !appliedSet.has(name))
  const unexpectedPayloadMigrations = appliedPayloadNames.filter(
    (name) => !registeredSet.has(name),
  )

  // --- Prisma migration status ---
  const prismaRows = await adapter.getPrismaMigrations()
  const prismaMigrations = prismaRows.map((row) => ({
    name: row.migration_name,
    applied: row.finished_at !== null,
    failed: row.logs !== null && row.finished_at === null,
  }))

  const hasFailed = prismaMigrations.some((m) => m.failed)

  // --- Determine overall status ---
  const hasMismatches =
    missingPayloadMigrations.length > 0 ||
    unexpectedPayloadMigrations.length > 0 ||
    hasFailed

  const overallStatus: StagingMigrationStatusReport['overallStatus'] = hasMismatches
    ? 'MISMATCHES_FOUND'
    : 'VERIFIED'

  if (missingPayloadMigrations.length > 0) {
    notes.push(
      `${missingPayloadMigrations.length} Payload migration(s) registered but not recorded as applied in the DB.`,
    )
  }
  if (unexpectedPayloadMigrations.length > 0) {
    notes.push(
      `${unexpectedPayloadMigrations.length} Payload migration record(s) in DB not found in the registered list.`,
    )
  }
  if (hasFailed) {
    notes.push('One or more Prisma migrations have a failed state (logs present, not finished).')
  }
  if (!hasMismatches) {
    notes.push(
      `All ${registered.length} registered Payload migrations are applied. No Prisma failures detected.`,
    )
  }

  return {
    reportVersion: '1.0',
    mode: 'live',
    registeredMigrations: registered,
    appliedPayloadMigrations: appliedPayloadNames,
    missingPayloadMigrations,
    unexpectedPayloadMigrations,
    prismaMigrations,
    schemaIdentityMatch: true,
    overallStatus,
    notes,
  }
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

function parseCliArgs(argv: string[]): {
  mode: string | undefined
  expectedSchema: string | undefined
} {
  const modeIndex = argv.indexOf('--mode')
  const mode = modeIndex >= 0 ? argv[modeIndex + 1] : undefined

  const schemaFlag = argv.find((a) => a.startsWith('--expected-schema='))
  const schemaPositionalIndex = argv.indexOf('--expected-schema')
  const expectedSchema = schemaFlag
    ? schemaFlag.split('=')[1]
    : schemaPositionalIndex >= 0
      ? argv[schemaPositionalIndex + 1]
      : undefined

  return { mode, expectedSchema }
}

if (require.main === module) {
  const { mode, expectedSchema } = parseCliArgs(process.argv.slice(2))

  if (mode !== 'staging-read-only') {
    process.stderr.write(
      'ERROR: --mode=staging-read-only is required. This command is read-only evidence only.\n',
    )
    process.exit(1)
  }

  if (!expectedSchema) {
    process.stderr.write(
      'ERROR: --expected-schema=<schema-name> is required for live mode.\n',
    )
    process.exit(1)
  }

  // In CLI mode, no real adapter is wired here by default.
  // Operators must supply a real adapter via the programmatic API or
  // extend this entry point with a live pg connection.
  buildStagingMigrationStatus(null, expectedSchema)
    .then((report) => {
      process.stdout.write(JSON.stringify(report, null, 2))
      process.stdout.write('\n')
      process.exit(report.overallStatus === 'VERIFIED' ? 0 : 1)
    })
    .catch((err: unknown) => {
      process.stderr.write(`ERROR: ${err instanceof Error ? err.message : String(err)}\n`)
      process.exit(1)
    })
}
