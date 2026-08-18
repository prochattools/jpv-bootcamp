/**
 * Guarded JPV legacy Payload import executor.
 *
 * Hard guards (abort before any DB write):
 *   - DATABASE_URL host must be 10.0.2.4 or 100.71.31.88
 *   - DATABASE_URL schema must be jpvbootcamp_staging
 *   - DATABASE_URL database must be jpvbootcamp
 *   - Payload migration count must be exactly 33
 *
 * Safety:
 *   - Never logs PII (email, names, raw content) — only IDs, counts, hashes
 *   - Direct SQL only — no getPayload, no Stripe, no Bunny API calls
 *   - Idempotent via jpv_import_run_ledger table
 *   - A-D schema gate blockers cleared when 33/33 verified
 *   - All other blockers cause skip with logged reason
 */

import { Client } from 'pg'

import {
  type LegacyPayloadOperationPlan,
  type ProposedPayloadOperation,
} from './legacyPayloadOperationPlan'
import { POST_MIGRATION29_FORWARD_BLOCKERS } from './postMigration29ForwardSchemaPlan'

// ─── constants ────────────────────────────────────────────────────────────────

const ALLOWED_HOSTS = ['10.0.2.4', '100.71.31.88']
const REQUIRED_SCHEMA = 'jpvbootcamp_staging'
const REQUIRED_DATABASE = 'jpvbootcamp'
const REQUIRED_MIGRATION_COUNT = 33

const AD_CLEARABLE_BLOCKERS = new Set<string>([
  POST_MIGRATION29_FORWARD_BLOCKERS.bunnyGuidFirst,
  POST_MIGRATION29_FORWARD_BLOCKERS.lessonComments,
  POST_MIGRATION29_FORWARD_BLOCKERS.spaceMedia,
  POST_MIGRATION29_FORWARD_BLOCKERS.spaceMediaTargetSpace,
  POST_MIGRATION29_FORWARD_BLOCKERS.spaceReactions,
])

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

export async function verifyPayloadMigrationCount(client: Client, schema: string): Promise<number> {
  const result = await client.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM "${schema}".payload_migrations`
  )
  return parseInt(result.rows[0]?.count ?? '0', 10)
}

// ─── blocker classification ────────────────────────────────────────────────────

export function isOperationEffectivelyBlocked(blockers: string[]): { blocked: boolean; reason: string | null } {
  if (blockers.length === 0) return { blocked: false, reason: null }
  const nonAdBlockers = blockers.filter((b) => !AD_CLEARABLE_BLOCKERS.has(b))
  if (nonAdBlockers.length === 0) return { blocked: false, reason: null }
  return { blocked: true, reason: nonAdBlockers.join(', ') }
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

export function flattenDataForSql(
  data: Record<string, unknown>,
  availableColumns: Set<string>,
): Record<string, unknown> {
  const flat: Record<string, unknown> = {}

  function walk(obj: Record<string, unknown>, prefix: string): void {
    for (const [key, value] of Object.entries(obj)) {
      const snakeKey = camelToSnake(key)
      const colName = prefix ? `${prefix}_${snakeKey}` : snakeKey

      if (typeof value === 'string' && value.startsWith('$ref:')) {
        // Already resolved by resolveRefs — shouldn't get here with raw $ref
        // If it does, record as missing
        continue
      }

      if (typeof value === 'number' && colName.endsWith('_id') && !prefix) {
        // Resolved ref: the data key was e.g. "member" but resolveRefs
        // keeps the key name as-is with numeric value. Map to _id column.
        const idCol = `${colName}`
        if (availableColumns.has(idCol)) {
          flat[idCol] = value
        }
        continue
      }

      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        // Group field — recurse with prefix
        walk(value as Record<string, unknown>, colName)
        continue
      }

      if (Array.isArray(value)) {
        if (availableColumns.has(colName)) {
          flat[colName] = JSON.stringify(value)
        }
        continue
      }

      if (availableColumns.has(colName)) {
        flat[colName] = value
      }
    }
  }

  // First pass: handle relationship refs (numeric values that were $ref resolved)
  // resolveRefs converts "$ref:X" → numeric. The key stays camelCase (e.g. "member" → 3).
  // We need to map "member" → "member_id".
  const refResolved: Record<string, unknown> = {}
  const nonRefData: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'number' && !['id', 'batch', 'sortOrder', 'libraryId', 'videoId', 'duration'].includes(key)) {
      // Likely a resolved FK ref — try {key}_id column
      const idCol = camelToSnake(`${key}Id`)
      if (availableColumns.has(idCol)) {
        refResolved[idCol] = value
        continue
      }
      // Could also be a plain numeric field
      const plainCol = camelToSnake(key)
      if (availableColumns.has(plainCol)) {
        nonRefData[key] = value
        continue
      }
      // Otherwise drop (missing column)
    } else {
      nonRefData[key] = value
    }
  }

  Object.assign(flat, refResolved)
  walk(nonRefData, '')

  // Remove 'id' column if present (auto-generated)
  delete flat['id']

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
    // Dry-run: classify operations without connecting
    const sorted = topologicalSort(config.operationPlan.operations)
    for (const op of sorted) {
      if (op.targetType === 'global') {
        result.skippedOperations += 1
        result.skippedByMissingTable += 1
        continue
      }
      const { blocked, reason } = isOperationEffectivelyBlocked(op.blockers)
      if (blocked) {
        result.skippedOperations += 1
        const key = reason ?? 'unknown_blocker'
        result.skippedByBlocker[key] = (result.skippedByBlocker[key] ?? 0) + 1
      }
      // Not counting executedOperations in dry-run — no writes
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

    const migrationCount = await verifyPayloadMigrationCount(client, schema)
    result.appliedMigrationCount = migrationCount
    if (migrationCount !== REQUIRED_MIGRATION_COUNT) {
      throw new Error(`migration_count_mismatch: expected ${REQUIRED_MIGRATION_COUNT}, got ${migrationCount}`)
    }

    await ensureLedgerTable(client, schema)
    const columnMap = await buildColumnMap(client, schema)

    const sorted = topologicalSort(config.operationPlan.operations)
    const opIdToDbId = new Map<string, number>()

    log(`[jpv-import] mode=apply schema=${schema} run-id=${config.runId} ops=${sorted.length}`)

    for (const op of sorted) {
      // Skip globals — no DB table exists
      if (op.targetType === 'global') {
        result.skippedOperations += 1
        result.skippedByMissingTable += 1
        await recordLedger(client, schema, op.operationId, config.runId, 'skipped', null, 'portal_settings_table_not_migrated')
        continue
      }

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

      // Check table exists
      const tableName = op.collection as string
      const availableColumns = columnMap.get(tableName)
      if (!availableColumns) {
        result.skippedOperations += 1
        result.skippedByMissingTable += 1
        await recordLedger(client, schema, op.operationId, config.runId, 'skipped', null, `table_not_found:${tableName}`)
        continue
      }

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

      // Flatten to SQL columns
      const beforeCount = Object.keys(resolvedData).length
      const flatData = flattenDataForSql(resolvedData, availableColumns)
      const afterCount = Object.keys(flatData).length
      result.missingColumnSkips += beforeCount - afterCount

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
