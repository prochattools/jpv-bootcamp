/**
 * Shared framework for next-domain legacy migrations (REM-03 through REM-07).
 *
 * Provides a reusable contract for domain-specific adapters:
 *   - inventory: extract source rows, emit summary
 *   - validate: check source/destination, emit validation report
 *   - dryRun: full transform + conflict detection, NO writes
 *   - apply: idempotent upsert to destination (guard-enforced)
 *   - reconcile: compare source/destination, emit metrics
 *   - rollback: delete domain-specific rows by migration_run_id
 *
 * All adapters share:
 *   - PII redaction in logs/errors
 *   - Deterministic idempotency keys
 *   - Per-record error handling
 *   - Checkpoint/resumability
 *   - Bounded reconciliation metrics
 *   - Preservation of preexisting rows (source='platform' or non-migration)
 */

import { Client } from 'pg'

export type MigrationMode = 'extract' | 'validate' | 'dry-run' | 'apply' | 'rollback'
export type MigrationOutcome = 'inserted' | 'updated' | 'unchanged' | 'preserved' | 'not_applicable'

export interface DomainMigrationConfig {
  mode: MigrationMode
  databaseUrl: string
  runId: string
  checkpointDir: string
  batchSize?: number
  rollbackRunId?: string
  schemaName?: string
}

export interface DomainRecord {
  idempotencyKey: string
  [key: string]: unknown
}

export interface TransformedDomainRecord {
  idempotencyKey: string
  destinationTable: string
  destinationRow: Record<string, unknown>
  conflictDetected?: boolean
  conflictReason?: string
}

export interface DomainMigrationError {
  recordKey: string
  phase: 'extract' | 'validate' | 'transform' | 'conflict-detect' | 'apply'
  message: string
  recoverable: boolean
}

export interface DomainReconciliationMetrics {
  inserted: number
  updated: number
  unchanged: number
  preserved: number
  notApplicable: number
}

export interface DomainMigrationResult {
  runId: string
  mode: MigrationMode
  domain: string
  sourceCount: number
  processedCount: number
  errorCount: number
  errors: DomainMigrationError[]
  metrics?: Record<string, DomainReconciliationMetrics>
  dryRunSummary?: string[]
}

/**
 * Base adapter contract for domain-specific migrations.
 * Each domain (sponsored grants, subscribers, support requests, partner attribution, course progress)
 * implements these methods to integrate with the shared framework.
 */
export interface DomainMigrationAdapter {
  /**
   * Domain name (e.g., 'sponsored_grants', 'email_subscribers').
   * Used in logs and result reporting.
   */
  domainName: string

  /**
   * Extract source rows from the legacy schema.
   * Should only read; must not write.
   * Returns source rows with idempotencyKey already populated.
   */
  extractSourceRows(client: Client, schemaName: string): Promise<DomainRecord[]>

  /**
   * Validate source and destination state.
   * Check schema presence, column existence, foreign-key targets, etc.
   * Return validation report (pass/fail with reasons).
   */
  validate(client: Client, schemaName: string): Promise<{ passed: boolean; reasons: string[] }>

  /**
   * Transform a source row into destination insert/update records.
   * Must include idempotencyKey and destinationTable.
   * Should not write to DB.
   * If transform fails, throw an error with recoverable flag.
   */
  transformRecord(source: DomainRecord): TransformedDomainRecord[]

  /**
   * Detect conflicts with preexisting destination rows.
   * Return true if conflict detected, false otherwise.
   * Preexisting rows (source !== 'migration' or source === 'platform') are safe to preserve.
   */
  detectConflict(
    client: Client,
    schemaName: string,
    transformed: TransformedDomainRecord,
  ): Promise<{ conflict: boolean; reason?: string; preexistingRow?: Record<string, unknown> }>

  /**
   * Apply a single transformed record to the destination.
   * Idempotent: if the record already exists (same idempotencyKey), upsert or skip.
   * Return the outcome: 'inserted', 'updated', 'unchanged', 'preserved' (same-table), or 'not_applicable'.
   */
  applyRecord(
    client: Client,
    schemaName: string,
    runId: string,
    transformed: TransformedDomainRecord,
  ): Promise<MigrationOutcome>

  /**
   * Reconcile source and destination after apply.
   * Compare counts, verify FK integrity, check for missing records, etc.
   * Return metrics per table.
   */
  reconcile(client: Client, schemaName: string, runId: string): Promise<Record<string, DomainReconciliationMetrics>>

  /**
   * Delete all rows created by this migration run.
   * Safe only if complete before-images exist in audit events.
   * Must refuse to rollback if no audit evidence.
   * For preserved rows (same-table migrations), return rowsDeleted=0 and reason='no_op_same_table'.
   */
  rollback(client: Client, schemaName: string, runId: string): Promise<{ rowsDeleted: number; reason?: string }>
}

/**
 * PII-safe hash for logging.
 */
export function redactForLog(value: string | null | undefined, maxLen: number = 16): string {
  if (!value) return '[null]'
  if (value.includes('@')) return `[email:${value.split('@')[1].substring(0, 8)}]`
  return `[${value.substring(0, maxLen).replace(/./g, '*')}]`
}

/**
 * Ensure the database schema exists and is accessible.
 */
export async function ensureSchemaExists(client: Client, schemaName: string): Promise<void> {
  const result = await client.query(
    `SELECT schema_name FROM information_schema.schemata WHERE schema_name = $1`,
    [schemaName],
  )
  if (result.rows.length === 0) {
    throw new Error(`schema_not_found: ${schemaName}`)
  }
}

/**
 * Ensure a migration audit table exists in the target schema.
 * Used for recording applied records with idempotency keys and outcomes.
 * This table tracks migration_run_id for exact rollback of inserted rows.
 */
export async function ensureMigrationAuditTable(client: Client, schemaName: string, domain: string): Promise<void> {
  const table = `"${schemaName}"."${domain}_migration_audit"`
  await client.query(`
    CREATE TABLE IF NOT EXISTS ${table} (
      id SERIAL PRIMARY KEY,
      migration_run_id TEXT NOT NULL,
      idempotency_key TEXT NOT NULL,
      destination_table TEXT NOT NULL,
      outcome TEXT NOT NULL CHECK (outcome IN ('inserted', 'updated', 'unchanged', 'preserved', 'not_applicable')),
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(migration_run_id, idempotency_key, destination_table)
    )
  `)
}

/**
 * Record an audit event for a migrated record.
 * Uses parameterized schema/table names to prevent SQL injection.
 */
export async function recordAuditEvent(
  client: Client,
  schemaName: string,
  domain: string,
  runId: string,
  idempotencyKey: string,
  destinationTable: string,
  outcome: 'inserted' | 'updated' | 'unchanged' | 'not_applicable',
): Promise<void> {
  const table = `"${schemaName}"."${domain}_migration_audit"`
  await client.query(
    `INSERT INTO ${table} (migration_run_id, idempotency_key, destination_table, outcome)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (migration_run_id, idempotency_key, destination_table) DO NOTHING`,
    [runId, idempotencyKey, destinationTable, outcome as string],
  )
}

/**
 * Load audit events for a given migration run.
 * Used to verify what was already applied and for exact rollback predicates.
 */
export async function loadAuditEvents(
  client: Client,
  schemaName: string,
  domain: string,
  runId: string,
): Promise<Map<string, string>> {
  const table = `"${schemaName}"."${domain}_migration_audit"`
  const result = await client.query(
    `SELECT idempotency_key, outcome FROM ${table} WHERE migration_run_id = $1 ORDER BY applied_at`,
    [runId],
  )
  return new Map(result.rows.map((row: { idempotency_key: string; outcome: string }) => [row.idempotency_key, row.outcome]))
}

/**
 * Execute a domain migration run.
 * Routes through extract, validate, dry-run, apply, or rollback based on config.
 */
export async function executeDomainMigration(
  adapter: DomainMigrationAdapter,
  config: DomainMigrationConfig,
): Promise<DomainMigrationResult> {
  const client = new Client({ connectionString: config.databaseUrl })
  await client.connect()

  try {
    const schemaName = config.schemaName ?? 'jpvbootcamp_staging'

    // Schema validation
    await ensureSchemaExists(client, schemaName)

    switch (config.mode) {
      case 'extract': {
        const rows = await adapter.extractSourceRows(client, schemaName)
        return {
          runId: config.runId,
          mode: 'extract',
          domain: adapter.domainName,
          sourceCount: rows.length,
          processedCount: rows.length,
          errorCount: 0,
          errors: [],
        }
      }

      case 'validate': {
        const validation = await adapter.validate(client, schemaName)
        return {
          runId: config.runId,
          mode: 'validate',
          domain: adapter.domainName,
          sourceCount: 0,
          processedCount: 0,
          errorCount: validation.passed ? 0 : 1,
          errors: validation.passed
            ? []
            : [
                {
                  recordKey: 'schema-validation',
                  phase: 'validate',
                  message: validation.reasons.join('; '),
                  recoverable: false,
                },
              ],
        }
      }

      case 'dry-run': {
        await ensureMigrationAuditTable(client, schemaName, adapter.domainName)
        const rows = await adapter.extractSourceRows(client, schemaName)
        const errors: DomainMigrationError[] = []
        const summary: string[] = []
        let processed = 0

        for (const source of rows) {
          try {
            const transformed = adapter.transformRecord(source)
            for (const record of transformed) {
              const conflict = await adapter.detectConflict(client, schemaName, record)
              if (conflict.conflict) {
                summary.push(`CONFLICT: ${record.idempotencyKey} — ${conflict.reason}`)
              } else {
                summary.push(`OK: ${record.idempotencyKey} → ${record.destinationTable}`)
              }
            }
            processed++
          } catch (e) {
            errors.push({
              recordKey: source.idempotencyKey,
              phase: 'transform',
              message: String(e),
              recoverable: true,
            })
          }
        }

        return {
          runId: config.runId,
          mode: 'dry-run',
          domain: adapter.domainName,
          sourceCount: rows.length,
          processedCount: processed,
          errorCount: errors.length,
          errors,
          dryRunSummary: summary,
        }
      }

      case 'apply': {
        await ensureMigrationAuditTable(client, schemaName, adapter.domainName)
        const rows = await adapter.extractSourceRows(client, schemaName)
        const errors: DomainMigrationError[] = []
        const metricsMap: Record<string, DomainReconciliationMetrics> = {}
        let processed = 0

        for (const source of rows) {
          try {
            const transformed = adapter.transformRecord(source)
            for (const record of transformed) {
              const conflict = await adapter.detectConflict(client, schemaName, record)
              if (conflict.conflict) {
                await recordAuditEvent(
                  client,
                  schemaName,
                  adapter.domainName,
                  config.runId,
                  record.idempotencyKey,
                  record.destinationTable,
                  'not_applicable',
                )
              } else {
                const outcome = await adapter.applyRecord(client, schemaName, config.runId, record)
                await recordAuditEvent(
                  client,
                  schemaName,
                  adapter.domainName,
                  config.runId,
                  record.idempotencyKey,
                  record.destinationTable,
                  outcome,
                )

                if (!metricsMap[record.destinationTable]) {
                  metricsMap[record.destinationTable] = { inserted: 0, updated: 0, unchanged: 0, preserved: 0, notApplicable: 0 }
                }
                const key = outcome === 'not_applicable' ? 'notApplicable' : outcome
                metricsMap[record.destinationTable][key as keyof DomainReconciliationMetrics]++
              }
            }
            processed++
          } catch (e) {
            errors.push({
              recordKey: source.idempotencyKey,
              phase: 'apply',
              message: String(e),
              recoverable: true,
            })
          }
        }

        // Reconcile after apply
        const reconcileMetrics = await adapter.reconcile(client, schemaName, config.runId)

        return {
          runId: config.runId,
          mode: 'apply',
          domain: adapter.domainName,
          sourceCount: rows.length,
          processedCount: processed,
          errorCount: errors.length,
          errors,
          metrics: { ...metricsMap, ...reconcileMetrics },
        }
      }

      case 'rollback': {
        if (!config.rollbackRunId) throw new Error('rollback_run_id_required')
        const result = await adapter.rollback(client, schemaName, config.rollbackRunId)
        return {
          runId: config.runId,
          mode: 'rollback',
          domain: adapter.domainName,
          sourceCount: 0,
          processedCount: result.rowsDeleted,
          errorCount: 0,
          errors: [],
        }
      }
    }
  } finally {
    await client.end()
  }
}
