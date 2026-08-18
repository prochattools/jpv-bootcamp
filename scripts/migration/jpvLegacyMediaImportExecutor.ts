import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, unlinkSync } from 'node:fs'
import path from 'node:path'
import { Client } from 'pg'

import { PAYLOAD_MIGRATION_NAMES } from '../../src/lib/payloadMigrationRegistry'
import type { LegacyMediaExecutionEntry, LegacyMediaImportExecutionPlan } from './legacyMediaImportExecutionPlan'

const ALLOWED_HOSTS = ['10.0.2.4', '100.71.31.88']
const REQUIRED_SCHEMA = 'jpvbootcamp_staging'
const REQUIRED_DATABASE = 'jpvbootcamp'

export interface JpvLegacyMediaImportConfig {
  mode: 'dry-run' | 'apply'
  databaseUrl: string
  schema?: string
  runId: string
  executionPlan: LegacyMediaImportExecutionPlan
  sourceUploadsRoot: string
  acquiredSourcePaths?: Record<string, string>
  publicStorageDir?: string
  privateStorageDir?: string
  output?: (line: string) => void
}

export interface JpvLegacyMediaResolution {
  executionEntryId: string
  plannerOperationId: string
  targetCollection: 'payload_media' | 'payload_private_media'
  targetDocumentId: number
  storageKey: string
  sha256: string
  bytes: number
}

export interface JpvLegacyMediaImportResult {
  ok: boolean
  mode: 'dry-run' | 'apply'
  runId: string
  canonicalMigrationCount: number
  executionIntents: number
  localReady: number
  remoteAcquisitionRequired: number
  blocked: number
  applied: number
  alreadyApplied: number
  failed: number
  resolutions: JpvLegacyMediaResolution[]
  errors: Array<{ executionEntryId: string; error: string }>
}

export function guardMediaStagingIdentity(databaseUrl: string): { hostname: string; database: string; schema: string } {
  let parsed: URL
  try { parsed = new URL(databaseUrl) } catch { throw new Error('media_staging_guard_failed: database_url_malformed') }
  if (!ALLOWED_HOSTS.includes(parsed.hostname)) throw new Error(`media_staging_guard_failed: host_rejected:${parsed.hostname}`)
  const database = parsed.pathname.replace(/^\//, '')
  if (database !== REQUIRED_DATABASE) throw new Error(`media_staging_guard_failed: database_rejected:${database}`)
  const schema = parsed.searchParams.get('schema') ?? parsed.searchParams.get('search_path') ?? REQUIRED_SCHEMA
  if (schema !== REQUIRED_SCHEMA) throw new Error(`media_staging_guard_failed: schema_rejected:${schema}`)
  return { hostname: parsed.hostname, database, schema }
}

function safeFilename(value: string): string {
  const base = path.basename(value).replace(/[^a-zA-Z0-9._-]+/g, '-')
  return base || 'legacy-media.bin'
}

function sha256File(filePath: string): string {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex')
}

function assertPathInside(root: string, candidate: string): string {
  const resolvedRoot = path.resolve(root)
  const resolved = path.resolve(candidate)
  if (resolved !== resolvedRoot && !resolved.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error(`media_source_path_escape:${resolved}`)
  }
  return resolved
}

export function resolveMediaSourcePath(
  entry: LegacyMediaExecutionEntry,
  sourceUploadsRoot: string,
  acquiredSourcePaths: Record<string, string> = {},
): string {
  if (entry.disposition === 'requires_remote_source_acquisition') {
    const acquired = acquiredSourcePaths[entry.executionEntryId]
    if (!acquired) throw new Error(`remote_source_not_acquired:${entry.executionEntryId}`)
    return path.resolve(acquired)
  }
  if (!entry.localRelativePath) throw new Error(`local_source_path_missing:${entry.executionEntryId}`)
  return assertPathInside(sourceUploadsRoot, path.join(sourceUploadsRoot, entry.localRelativePath))
}

export function deterministicMediaStorageKey(entry: LegacyMediaExecutionEntry, sha256: string, sourcePath: string): string {
  return `legacy-${sha256.slice(0, 16)}-${safeFilename(entry.sourceLocator ?? entry.localRelativePath ?? sourcePath)}`
}

async function verifyCanonicalMigrations(client: Client, schema: string): Promise<number> {
  const result = await client.query<{ name: string }>(`SELECT name FROM "${schema}".payload_migrations ORDER BY id ASC`)
  const names = result.rows.map((row) => row.name)
  if (new Set(names).size !== names.length) throw new Error('media_migration_state_duplicate_rows')
  if (names.length !== PAYLOAD_MIGRATION_NAMES.length) {
    throw new Error(`media_migration_state_count_mismatch:expected=${PAYLOAD_MIGRATION_NAMES.length}:got=${names.length}`)
  }
  const mismatch = PAYLOAD_MIGRATION_NAMES.findIndex((name, index) => names[index] !== name)
  if (mismatch !== -1) throw new Error(`media_migration_state_order_mismatch:index=${mismatch}`)
  return names.length
}

async function verifyMediaTables(client: Client, schema: string): Promise<void> {
  const result = await client.query<{ table_name: string; column_name: string }>(
    `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = ANY($2::text[])`,
    [schema, ['payload_media', 'payload_private_media']],
  )
  const map = new Map<string, Set<string>>()
  for (const row of result.rows) {
    const cols = map.get(row.table_name) ?? new Set<string>()
    cols.add(row.column_name)
    map.set(row.table_name, cols)
  }
  for (const table of ['payload_media', 'payload_private_media']) {
    const cols = map.get(table)
    if (!cols) throw new Error(`media_target_table_missing:${table}`)
    for (const column of ['id', 'alt', 'filename', 'mime_type', 'filesize', 'url', 'created_at', 'updated_at']) {
      if (!cols.has(column)) throw new Error(`media_target_column_missing:${table}.${column}`)
    }
  }
}

async function ensureMediaLedgers(client: Client, schema: string): Promise<void> {
  await client.query(`CREATE TABLE IF NOT EXISTS "${schema}".jpv_import_run_ledger (
    id serial primary key, operation_id text not null, run_id text not null, db_id integer,
    status text not null check (status in ('applied','skipped','failed')), skip_reason text,
    error_message text, created_at timestamptz not null default now()
  )`)
  await client.query(`CREATE TABLE IF NOT EXISTS "${schema}".jpv_media_import_ledger (
    id serial primary key,
    execution_entry_id text not null unique,
    planner_operation_id text not null unique,
    run_id text not null,
    target_collection text not null,
    target_document_id integer not null,
    storage_key text not null,
    sha256 text not null,
    bytes bigint not null,
    created_at timestamptz not null default now()
  )`)
}

async function lookupMediaLedger(client: Client, schema: string, executionEntryId: string): Promise<JpvLegacyMediaResolution | null> {
  const result = await client.query<{
    execution_entry_id: string; planner_operation_id: string; target_collection: 'payload_media' | 'payload_private_media';
    target_document_id: number; storage_key: string; sha256: string; bytes: string
  }>(`SELECT execution_entry_id, planner_operation_id, target_collection, target_document_id, storage_key, sha256, bytes::text AS bytes
      FROM "${schema}".jpv_media_import_ledger WHERE execution_entry_id = $1`, [executionEntryId])
  const row = result.rows[0]
  return row ? {
    executionEntryId: row.execution_entry_id,
    plannerOperationId: row.planner_operation_id,
    targetCollection: row.target_collection,
    targetDocumentId: row.target_document_id,
    storageKey: row.storage_key,
    sha256: row.sha256,
    bytes: Number(row.bytes),
  } : null
}

async function insertMediaRow(
  client: Client,
  schema: string,
  collection: 'payload_media' | 'payload_private_media',
  filename: string,
  mimeType: string,
  filesize: number,
): Promise<number> {
  const url = collection === 'payload_media' ? `/media/${filename}` : null
  const result = await client.query<{ id: number }>(
    `INSERT INTO "${schema}"."${collection}" (alt, filename, mime_type, filesize, url, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,now(),now()) RETURNING id`,
    [`Legacy migrated media ${filename}`, filename, mimeType, filesize, url],
  )
  if (!result.rows[0]) throw new Error('media_insert_returned_no_id')
  return result.rows[0].id
}

export async function runJpvLegacyMediaImport(config: JpvLegacyMediaImportConfig): Promise<JpvLegacyMediaImportResult> {
  guardMediaStagingIdentity(config.databaseUrl)
  const intents = config.executionPlan.entries.filter((entry) => entry.isUploadIntent)
  const result: JpvLegacyMediaImportResult = {
    ok: false,
    mode: config.mode,
    runId: config.runId,
    canonicalMigrationCount: 0,
    executionIntents: intents.length,
    localReady: intents.filter((entry) => entry.disposition === 'ready_after_write_authorization').length,
    remoteAcquisitionRequired: intents.filter((entry) => entry.disposition === 'requires_remote_source_acquisition').length,
    blocked: intents.filter((entry) => !['ready_after_write_authorization', 'requires_remote_source_acquisition'].includes(entry.disposition)).length,
    applied: 0,
    alreadyApplied: 0,
    failed: 0,
    resolutions: [],
    errors: [],
  }

  if (config.mode === 'dry-run') {
    result.ok = result.blocked === 0
    return result
  }

  if (result.blocked > 0) throw new Error(`media_apply_blocked_entries:${result.blocked}`)
  const client = new Client({ connectionString: config.databaseUrl })
  await client.connect()
  try {
    const schema = config.schema ?? REQUIRED_SCHEMA
    await client.query(`SET search_path TO "${schema}", public`)
    result.canonicalMigrationCount = await verifyCanonicalMigrations(client, schema)
    await verifyMediaTables(client, schema)

    const sourcePaths = new Map<string, { path: string; sha256: string; bytes: number; storageKey: string }>()
    for (const entry of intents) {
      if (!entry.plannerOperationId || !entry.targetCollection || !['payload_media', 'payload_private_media'].includes(entry.targetCollection)) {
        throw new Error(`media_execution_entry_target_invalid:${entry.executionEntryId}`)
      }
      const sourcePath = resolveMediaSourcePath(entry, config.sourceUploadsRoot, config.acquiredSourcePaths)
      if (!existsSync(sourcePath)) throw new Error(`media_source_missing:${entry.executionEntryId}`)
      const stat = statSync(sourcePath)
      if (!stat.isFile() || stat.size <= 0) throw new Error(`media_source_invalid:${entry.executionEntryId}`)
      const sha256 = sha256File(sourcePath)
      if (entry.sourceSha256 && entry.sourceSha256 !== sha256) throw new Error(`media_source_checksum_mismatch:${entry.executionEntryId}`)
      if (entry.sourceBytes !== null && entry.sourceBytes !== stat.size) throw new Error(`media_source_size_mismatch:${entry.executionEntryId}`)
      sourcePaths.set(entry.executionEntryId, {
        path: sourcePath,
        sha256,
        bytes: stat.size,
        storageKey: deterministicMediaStorageKey(entry, sha256, sourcePath),
      })
    }

    await ensureMediaLedgers(client, schema)
    for (const entry of intents) {
      const existing = await lookupMediaLedger(client, schema, entry.executionEntryId)
      if (existing) {
        result.alreadyApplied += 1
        result.resolutions.push(existing)
        continue
      }
      const source = sourcePaths.get(entry.executionEntryId)!
      const collection = entry.targetCollection as 'payload_media' | 'payload_private_media'
      const storageDir = collection === 'payload_media'
        ? path.resolve(config.publicStorageDir ?? 'public/media')
        : path.resolve(config.privateStorageDir ?? 'private/payload-course-media')
      mkdirSync(storageDir, { recursive: true })
      const destination = assertPathInside(storageDir, path.join(storageDir, source.storageKey))
      let copied = false
      await client.query('BEGIN')
      try {
        const mediaId = await insertMediaRow(client, schema, collection, source.storageKey, entry.expectedMime ?? 'application/octet-stream', source.bytes)
        if (!existsSync(destination)) {
          copyFileSync(source.path, destination)
          copied = true
        } else if (sha256File(destination) !== source.sha256) {
          throw new Error(`media_storage_collision:${entry.executionEntryId}`)
        }
        await client.query(
          `INSERT INTO "${schema}".jpv_media_import_ledger
           (execution_entry_id, planner_operation_id, run_id, target_collection, target_document_id, storage_key, sha256, bytes)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [entry.executionEntryId, entry.plannerOperationId, config.runId, collection, mediaId, source.storageKey, source.sha256, source.bytes],
        )
        await client.query(
          `INSERT INTO "${schema}".jpv_import_run_ledger (operation_id, run_id, db_id, status)
           VALUES ($1,$2,$3,'applied')`,
          [entry.plannerOperationId, config.runId, mediaId],
        )
        await client.query('COMMIT')
        result.applied += 1
        result.resolutions.push({
          executionEntryId: entry.executionEntryId,
          plannerOperationId: entry.plannerOperationId,
          targetCollection: collection,
          targetDocumentId: mediaId,
          storageKey: source.storageKey,
          sha256: source.sha256,
          bytes: source.bytes,
        })
      } catch (error) {
        await client.query('ROLLBACK')
        if (copied && existsSync(destination)) unlinkSync(destination)
        const message = error instanceof Error ? error.message : String(error)
        result.failed += 1
        result.errors.push({ executionEntryId: entry.executionEntryId, error: message })
        throw error
      }
    }
    result.ok = result.failed === 0 && result.resolutions.length === intents.length
    config.output?.(`[jpv-media-import] run-id=${config.runId} intents=${intents.length} applied=${result.applied} already=${result.alreadyApplied}`)
    return result
  } finally {
    await client.end()
  }
}
