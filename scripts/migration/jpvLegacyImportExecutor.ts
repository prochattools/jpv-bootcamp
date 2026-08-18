/**
 * Guarded JPV legacy Payload import executor.
 *
 * Hard guards (abort before any DB write):
 *   - DATABASE_URL host must be 10.0.2.4 or 100.71.31.88
 *   - DATABASE_URL schema must be jpvbootcamp_staging
 *   - DATABASE_URL database must be jpvbootcamp
 *   - Payload migration rows must exactly match the canonical registry
 *   - Planned target tables and columns must exist before any write
 *
 * Safety:
 *   - Never logs PII (email, names, raw content) — only IDs, counts, hashes
 *   - Direct SQL only — no getPayload, no Stripe, no Bunny API calls
 *   - Idempotent via jpv_import_run_ledger table
 *   - Planner owns target-capability resolution; executor never clears blockers implicitly
 *   - Missing tables/columns fail closed before ledger creation or data writes
 */

import { Client } from 'pg'

import { PAYLOAD_MIGRATION_NAMES } from '../../src/lib/payloadMigrationRegistry'
import {
  type LegacyPayloadOperationPlan,
  type ProposedPayloadOperation,
} from './legacyPayloadOperationPlan'

// ─── constants ────────────────────────────────────────────────────────────────

const ALLOWED_HOSTS = ['10.0.2.4', '100.71.31.88']
const REQUIRED_SCHEMA = 'jpvbootcamp_staging'
const REQUIRED_DATABASE = 'jpvbootcamp'

// ─── public types ─────────────────────────────────────────────────────────────

export interface JpvImportConfig {
  mode: 'dry-run' | 'apply'
  databaseUrl: string
  schema?: string
  runId: string
  operationPlan: LegacyPayloadOperationPlan
  output?: (line: string) => void
}

export interface JpvImportResult {
  ok: boolean
  runId: string
  mode: 'dry-run' | 'apply'
  schema: string
  appliedMigrationCount: number
  proposedOperations: number
  executedOperations: number
  skippedOperations: number
  failedOperations: number
  alreadyAppliedOperations: number
  skippedByBlocker: Record<string, number>
  skippedByMissingTable: number
  missingColumnSkips: number
  errors: Array<{ operationId: string; error: string }>
  durationMs: number
}

// ─── guard helpers ────────────────────────────────────────────────────────────

export function guardStagingIdentity(databaseUrl: string): { hostname: string; database: string; schema: string } {
  let parsed: URL
  try {
    parsed = new URL(databaseUrl)
  } catch {
    throw new Error('staging_guard_failed: database_url_malformed')
  }

  const hostname = parsed.hostname
  if (!ALLOWED_HOSTS.includes(hostname)) {
    throw new Error(`staging_guard_failed: host_rejected (got ${hostname}, expected one of ${ALLOWED_HOSTS.join(', ')})`)
  }

  const database = parsed.pathname.replace(/^\//, '')
  if (database !== REQUIRED_DATABASE) {
    throw new Error(`staging_guard_failed: database_rejected (got ${database}, expected ${REQUIRED_DATABASE})`)
  }

  const schemaParam = parsed.searchParams.get('schema') ?? parsed.searchParams.get('search_path') ?? REQUIRED_SCHEMA
  if (schemaParam !== REQUIRED_SCHEMA) {
    throw new Error(`staging_guard_failed: schema_rejected (got ${schemaParam}, expected ${REQUIRED_SCHEMA})`)
  }

  return { hostname, database, schema: schemaParam }
}

export async function verifyCanonicalPayloadMigrationState(client: Client, schema: string): Promise<number> {
  const result = await client.query<{ name: string }>(
    `SELECT name FROM "${schema}".payload_migrations ORDER BY id ASC`,
  )
  const names = result.rows.map((row) => row.name)
  const duplicateNames = names.filter((name, index) => names.indexOf(name) !== index)
  if (duplicateNames.length > 0) {
    throw new Error(`migration_state_duplicate_rows: ${[...new Set(duplicateNames)].join(',')}`)
  }
  if (names.length !== PAYLOAD_MIGRATION_NAMES.length) {
    throw new Error(`migration_state_count_mismatch: expected ${PAYLOAD_MIGRATION_NAMES.length}, got ${names.length}`)
  }
  const mismatchIndex = PAYLOAD_MIGRATION_NAMES.findIndex((name, index) => names[index] !== name)
  if (mismatchIndex !== -1) {
    throw new Error(
      `migration_state_order_mismatch: index=${mismatchIndex} expected=${PAYLOAD_MIGRATION_NAMES[mismatchIndex]} got=${names[mismatchIndex] ?? 'missing'}`,
    )
  }
  return names.length
}

// ─── blocker classification ────────────────────────────────────────────────────

export function isOperationEffectivelyBlocked(blockers: string[]): { blocked: boolean; reason: string | null } {
  if (blockers.length === 0) return { blocked: false, reason: null }
  return { blocked: true, reason: blockers.join(', ') }
}

// ─── ref resolution ───────────────────────────────────────────────────────────

export function resolveRefs(data: Record<string, unknown>, opIdToDbId: Map<string, number>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string' && value.startsWith('$ref:')) {
      const refId = value.slice(5)
      const dbId = opIdToDbId.get(refId)
      if (dbId === undefined) {
        throw new Error(`unresolved_ref: ${key} -> ${refId}`)
      }
      result[key] = dbId
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = resolveRefs(value as Record<string, unknown>, opIdToDbId)
    } else {
      result[key] = value
    }
  }
  return result
}

// ─── topological sort ─────────────────────────────────────────────────────────

export function topologicalSort(operations: ProposedPayloadOperation[]): ProposedPayloadOperation[] {
  if (operations.length === 0) return []

  const opById = new Map<string, ProposedPayloadOperation>(operations.map((op) => [op.operationId, op]))
  const inDegree = new Map<string, number>(operations.map((op) => [op.operationId, 0]))
  const dependents = new Map<string, string[]>(operations.map((op): [string, string[]] => [op.operationId, []]))

  for (const op of operations) {
    for (const dep of op.dependsOn) {
      if (!opById.has(dep)) continue
      inDegree.set(op.operationId, (inDegree.get(op.operationId) ?? 0) + 1)
      dependents.get(dep)!.push(op.operationId)
    }
  }

  const queue: string[] = []
  for (const [id, degree] of inDegree) {
    if (degree === 0) queue.push(id)
  }
  queue.sort()

  const sorted: ProposedPayloadOperation[] = []
  while (queue.length > 0) {
    const id = queue.shift()!
    const op = opById.get(id)!
    sorted.push(op)
    const deps = dependents.get(id) ?? []
    deps.sort()
    for (const depId of deps) {
      const newDegree = (inDegree.get(depId) ?? 0) - 1
      inDegree.set(depId, newDegree)
      if (newDegree === 0) queue.push(depId)
    }
  }

  if (sorted.length !== operations.length) {
    throw new Error(`topological_sort_cycle_detected: sorted ${sorted.length} of ${operations.length} operations`)
  }

  return sorted
}

// ─── SQL field flattening ─────────────────────────────────────────────────────

function camelToSnake(str: string): string {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase()
}

function targetTableForOperation(operation: ProposedPayloadOperation): string {
  return operation.targetType === 'global' ? 'portal_settings' : operation.collection
}

export function flattenDataForSql(
  data: Record<string, unknown>,
  availableColumns: Set<string>,
  missingColumns: Set<string> = new Set<string>(),
): Record<string, unknown> {
  const flat: Record<string, unknown> = {}

  function walk(obj: Record<string, unknown>, prefix: string): void {
    for (const [key, value] of Object.entries(obj)) {
      if (value === undefined || key === 'id') continue
      const snakeKey = camelToSnake(key)
      const colName = prefix ? `${prefix}_${snakeKey}` : snakeKey

      if (typeof value === 'string' && value.startsWith('$ref:')) {
        const idCol = camelToSnake(`${key}Id`)
        if (!prefix && availableColumns.has(idCol)) continue
        missingColumns.add(prefix ? `${colName}_id` : idCol)
        continue
      }

      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        if (availableColumns.has(colName)) {
          flat[colName] = JSON.stringify(value)
        } else {
          const groupPrefix = `${colName}_`
          const hasGroupedTargetColumns = [...availableColumns].some((column) => column.startsWith(groupPrefix))
          if (hasGroupedTargetColumns) {
            walk(value as Record<string, unknown>, colName)
          } else {
            missingColumns.add(colName)
          }
        }
        continue
      }

      if (Array.isArray(value)) {
        if (availableColumns.has(colName)) flat[colName] = JSON.stringify(value)
        else missingColumns.add(colName)
        continue
      }

      if (availableColumns.has(colName)) {
        flat[colName] = value
      } else {
        missingColumns.add(colName)
      }
    }
  }

  const normalized: Record<string, unknown> = {}
  const numericPlainFields = new Set(['batch', 'sortOrder', 'libraryId', 'videoId', 'duration'])
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || key === 'id') continue
    if (typeof value === 'number' && !numericPlainFields.has(key)) {
      const idCol = camelToSnake(`${key}Id`)
      const plainCol = camelToSnake(key)
      if (availableColumns.has(idCol)) {
        flat[idCol] = value
        continue
      }
      if (availableColumns.has(plainCol)) {
        normalized[key] = value
        continue
      }
      missingColumns.add(idCol)
      continue
    }
    normalized[key] = value
  }

  walk(normalized, '')
  return flat
}

// ─── run ledger ───────────────────────────────────────────────────────────────

async function ensureLedgerTable(client: Client, schema: string): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS "${schema}".jpv_import_run_ledger (
      id serial primary key,
      operation_id text not null,
      run_id text not null,
      db_id integer,
      status text not null check (status in ('applied', 'skipped', 'failed')),
      skip_reason text,
      error_message text,
      created_at timestamptz not null default now()
    )
  `)
}

async function lookupLedger(
  client: Client,
  schema: string,
  operationId: string,
): Promise<{ db_id: number | null } | null> {
  const result = await client.query<{ db_id: number | null }>(
    `SELECT db_id FROM "${schema}".jpv_import_run_ledger WHERE operation_id = $1 AND status = 'applied' LIMIT 1`,
    [operationId],
  )
  return result.rows[0] ?? null
}

async function recordLedger(
  client: Client,
  schema: string,
  operationId: string,
  runId: string,
  status: 'applied' | 'skipped' | 'failed',
  dbId: number | null,
  reason: string | null,
): Promise<void> {
  await client.query(
    `INSERT INTO "${schema}".jpv_import_run_ledger
       (operation_id, run_id, db_id, status, skip_reason, error_message)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [operationId, runId, dbId, status, status === 'skipped' ? reason : null, status === 'failed' ? reason : null],
  )
}

// ─── column map ───────────────────────────────────────────────────────────────

async function buildColumnMap(client: Client, schema: string): Promise<Map<string, Set<string>>> {
  const result = await client.query<{ table_name: string; column_name: string }>(
    `SELECT table_name, column_name
     FROM information_schema.columns
     WHERE table_schema = $1`,
    [schema],
  )
  const map = new Map<string, Set<string>>()
  for (const row of result.rows) {
    if (!map.has(row.table_name)) map.set(row.table_name, new Set())
    map.get(row.table_name)!.add(row.column_name)
  }
  return map
}

async function readAppliedLedgerMapIfPresent(client: Client, schema: string): Promise<Map<string, number>> {
  const exists = await client.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = $1 AND table_name = 'jpv_import_run_ledger'
     ) AS exists`,
    [schema],
  )
  if (!exists.rows[0]?.exists) return new Map()
  const result = await client.query<{ operation_id: string; db_id: number | null }>(
    `SELECT operation_id, db_id FROM "${schema}".jpv_import_run_ledger WHERE status = 'applied' AND db_id IS NOT NULL`,
  )
  return new Map(result.rows.map((row) => [row.operation_id, row.db_id as number]))
}

function preflightOperationSchema(
  operations: ProposedPayloadOperation[],
  columnMap: Map<string, Set<string>>,
  alreadyApplied: Map<string, number>,
): void {
  const blockerIssues: string[] = []
  const missingTables = new Set<string>()
  const missingColumns = new Set<string>()

  for (const operation of operations) {
    if (alreadyApplied.has(operation.operationId)) continue
    if (operation.blockers.length > 0) {
      blockerIssues.push(`${operation.operationId}:${operation.blockers.join('|')}`)
      continue
    }
    const tableName = targetTableForOperation(operation)
    const columns = columnMap.get(tableName)
    if (!columns) {
      missingTables.add(tableName)
      continue
    }
    const operationMissingColumns = new Set<string>()
    flattenDataForSql(operation.data, columns, operationMissingColumns)
    for (const column of operationMissingColumns) missingColumns.add(`${tableName}.${column}`)
  }

  if (blockerIssues.length > 0) {
    throw new Error(`operation_blockers_present: count=${blockerIssues.length} examples=${blockerIssues.slice(0, 5).join(',')}`)
  }
  if (missingTables.size > 0) {
    throw new Error(`target_tables_missing: ${[...missingTables].sort().join(',')}`)
  }
  if (missingColumns.size > 0) {
    throw new Error(`target_columns_missing: ${[...missingColumns].sort().slice(0, 25).join(',')}`)
  }
}

// ─── single operation execute ─────────────────────────────────────────────────

async function executeInsert(
  client: Client,
  schema: string,
  collection: string,
  flatData: Record<string, unknown>,
): Promise<number> {
  const columns = Object.keys(flatData)
  if (columns.length === 0) throw new Error('no_columns_to_insert')

  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ')
  const colList = columns.map((c) => `"${c}"`).join(', ')
  const values = columns.map((c) => flatData[c])

  if (collection === 'payload_members') {
    // payload_members has unique email — use ON CONFLICT DO NOTHING
    const emailVal = flatData['email']
    const res = await client.query<{ id: number }>(
      `INSERT INTO "${schema}"."${collection}" (${colList}) VALUES (${placeholders})
       ON CONFLICT (email) DO NOTHING RETURNING id`,
      values,
    )
    if (res.rows.length > 0) return res.rows[0]!.id
    const existing = await client.query<{ id: number }>(
      `SELECT id FROM "${schema}"."${collection}" WHERE email = $1`,
      [emailVal],
    )
    if (existing.rows.length === 0) throw new Error('member_insert_conflict_unresolvable')
    return existing.rows[0]!.id
  }

  const res = await client.query<{ id: number }>(
    `INSERT INTO "${schema}"."${collection}" (${colList}) VALUES (${placeholders}) RETURNING id`,
    values,
  )
  if (res.rows.length === 0) throw new Error('insert_returned_no_id')
  return res.rows[0]!.id
}

// ─── main entry ───────────────────────────────────────────────────────────────

export async function runJpvLegacyImport(config: JpvImportConfig): Promise<JpvImportResult> {
  const startMs = Date.now()
  const schema = config.schema ?? REQUIRED_SCHEMA
  const log = config.output ?? ((line: string) => process.stdout.write(`${line}\n`))

  guardStagingIdentity(config.databaseUrl)

  const result: JpvImportResult = {
    ok: false,
    runId: config.runId,
    mode: config.mode,
    schema,
    appliedMigrationCount: 0,
    proposedOperations: config.operationPlan.operations.length,
    executedOperations: 0,
    skippedOperations: 0,
    failedOperations: 0,
    alreadyAppliedOperations: 0,
    skippedByBlocker: {},
    skippedByMissingTable: 0,
    missingColumnSkips: 0,
    errors: [],
    durationMs: 0,
  }

  if (config.mode === 'dry-run') {
    // Dry-run classifies planner blockers. When a real DATABASE_URL is provided, reads
    // jpv_import_run_ledger (READ-ONLY) to exclude already-applied operations from the
    // skippedOperations count — this lets Phase 4 media imports register as alreadyApplied.
    const sorted = topologicalSort(config.operationPlan.operations)
    let alreadyApplied = new Map<string, number>()
    try {
      const roClient = new Client({ connectionString: config.databaseUrl })
      await roClient.connect()
      try {
        alreadyApplied = await readAppliedLedgerMapIfPresent(roClient, schema)
      } finally {
        await roClient.end()
      }
    } catch {
      // No DB connection available (e.g. offline/test env) — proceed without ledger
    }
    result.alreadyAppliedOperations = alreadyApplied.size
    for (const op of sorted) {
      if (alreadyApplied.has(op.operationId)) {
        continue
      }
      const { blocked, reason } = isOperationEffectivelyBlocked(op.blockers)
      if (blocked) {
        result.skippedOperations += 1
        const key = reason ?? 'unknown_blocker'
        result.skippedByBlocker[key] = (result.skippedByBlocker[key] ?? 0) + 1
      }
    }
    result.ok = true
    result.durationMs = Date.now() - startMs
    return result
  }

  // Apply mode: connect and write
  const client = new Client({ connectionString: config.databaseUrl })
  await client.connect()
  try {
    await client.query(`SET search_path TO "${schema}", public`)

    const migrationCount = await verifyCanonicalPayloadMigrationState(client, schema)
    result.appliedMigrationCount = migrationCount
    const columnMap = await buildColumnMap(client, schema)
    const sorted = topologicalSort(config.operationPlan.operations)
    const existingApplied = await readAppliedLedgerMapIfPresent(client, schema)
    preflightOperationSchema(sorted, columnMap, existingApplied)

    await ensureLedgerTable(client, schema)
    const opIdToDbId = new Map<string, number>(existingApplied)

    log(`[jpv-import] mode=apply schema=${schema} run-id=${config.runId} ops=${sorted.length}`)

    for (const op of sorted) {
      // Check run ledger for idempotency
      const existing = await lookupLedger(client, schema, op.operationId)
      if (existing) {
        result.alreadyAppliedOperations += 1
        if (existing.db_id !== null) opIdToDbId.set(op.operationId, existing.db_id)
        continue
      }

      // Check effective blockers
      const { blocked, reason } = isOperationEffectivelyBlocked(op.blockers)
      if (blocked) {
        result.skippedOperations += 1
        const key = reason ?? 'unknown_blocker'
        result.skippedByBlocker[key] = (result.skippedByBlocker[key] ?? 0) + 1
        await recordLedger(client, schema, op.operationId, config.runId, 'skipped', null, key)
        continue
      }

      const tableName = targetTableForOperation(op)
      const availableColumns = columnMap.get(tableName)
      if (!availableColumns) throw new Error(`preflight_invariant_failed_missing_table:${tableName}`)

      // Resolve refs
      let resolvedData: Record<string, unknown>
      try {
        resolvedData = resolveRefs(op.data, opIdToDbId)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        result.failedOperations += 1
        result.errors.push({ operationId: op.operationId, error: `ref_resolution_failed: ${msg}` })
        await recordLedger(client, schema, op.operationId, config.runId, 'failed', null, `ref_resolution_failed: ${msg}`)
        continue
      }

      // Flatten only after preflight proved every planned target column exists.
      const missingColumns = new Set<string>()
      const flatData = flattenDataForSql(resolvedData, availableColumns, missingColumns)
      if (missingColumns.size > 0) {
        throw new Error(`preflight_invariant_failed_missing_columns:${tableName}:${[...missingColumns].sort().join(',')}`)
      }

      try {
        const dbId = await executeInsert(client, schema, tableName, flatData)
        opIdToDbId.set(op.operationId, dbId)
        result.executedOperations += 1
        await recordLedger(client, schema, op.operationId, config.runId, 'applied', dbId, null)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        result.failedOperations += 1
        result.errors.push({ operationId: op.operationId, error: msg })
        await recordLedger(client, schema, op.operationId, config.runId, 'failed', null, msg)
      }
    }

    log(`[jpv-import] executed=${result.executedOperations} skipped=${result.skippedOperations} failed=${result.failedOperations} already=${result.alreadyAppliedOperations}`)
    result.ok = result.failedOperations === 0
  } finally {
    await client.end()
  }

  result.durationMs = Date.now() - startMs
  return result
}
