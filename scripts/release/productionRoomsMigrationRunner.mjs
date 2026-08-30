#!/usr/bin/env node

import crypto from 'node:crypto'
import { createRequire } from 'node:module'
import { gunzipSync } from 'node:zlib'

const require = createRequire(import.meta.url)
const { Client } = require('pg')

export const MIGRATION_NAME = '20260830_090000_member_portal_rooms'
export const MIGRATION_SOURCE_SHA256 =
  '071d47dd39d7e832117dd327c035877555542cd4ef11ec0b73050a848d496a9d'
export const HISTORICAL_BASELINE_SHA256 =
  '0fdb089ae8abdeaabb7cacd8ab7452a62d266bb5038d8f470a795e4241ea3f8c'
export const EXPECTED_PRODUCTION = Object.freeze({
  deploymentEnv: 'production',
  origin: 'https://jpvbootcamp.com',
  applicationId: 'I_2Vukga3cc3ZhaG-mUzU',
  applicationName: 'clients-jpv-bootcamp-app-tp9xrk',
  host: '10.0.2.4',
  port: '5433',
  database: 'jpvbootcamp',
  schema: 'jpvbootcamp',
  role: 'jpvbootcamp_production_app',
  systemSchema: 'public',
  systemRole: 'supabase_admin',
})
export const LEGACY_NAVIGATION = Object.freeze({ label: 'Live', href: '/portal/live-sessions' })
export const ROOMS_NAVIGATION = Object.freeze({ label: 'Rooms', href: '/portal/rooms' })
export const BASELINE_ANOMALY_INDICES = Object.freeze([47, 48, 49])

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/
const SAFE_REFERENCE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/
const SHA256 = /^[0-9a-f]{64}$/
const CRITICAL_TABLES = Object.freeze([
  'payload_members',
  'payload_users',
  'payload_courses',
  'payload_course_enrollments',
  'payload_spaces',
  'payload_space_memberships',
  'live_sessions',
  'payload_portal_nav_items',
  'payload_member_notifications',
  'payload_admin_notifications',
  'payload_email_events',
  'payload_email_actions',
  'payload_subscriptions',
  'payload_billing_accounts',
  'payload_billing_actions',
  'payload_locked_documents_rels',
])
const ROOM_TABLES = Object.freeze(['payload_room_categories', 'live_sessions_rels', 'payload_room_access'])
const ROOM_REQUIRED_COLUMNS = Object.freeze([
  ['live_sessions', 'target_group_ids'],
  ['live_sessions', 'archived'],
  ['live_sessions', 'archived_at'],
  ['payload_member_notifications', 'event_key'],
  ['payload_admin_notifications', 'event_key'],
  ['payload_locked_documents_rels', 'payload_room_categories_id'],
  ['payload_locked_documents_rels', 'payload_room_access_id'],
])
const ROOM_REQUIRED_INDEXES = Object.freeze([
  'live_sessions_archived_idx',
  'payload_room_categories_slug_unique_idx',
  'payload_room_categories_status_idx',
  'payload_room_categories_sort_order_idx',
  'live_sessions_rels_order_idx',
  'live_sessions_rels_parent_idx',
  'live_sessions_rels_path_idx',
  'live_sessions_rels_category_idx',
  'payload_room_access_room_member_unique_idx',
  'payload_room_access_event_key_unique_idx',
  'payload_room_access_room_status_idx',
  'payload_room_access_member_status_idx',
  'payload_member_notifications_event_key_unique_idx',
  'payload_admin_notifications_event_key_unique_idx',
  'payload_locked_documents_rels_room_categories_id_idx',
  'payload_locked_documents_rels_room_access_id_idx',
])
const ROOM_REQUIRED_CONSTRAINTS = Object.freeze([
  'live_sessions_rels_parent_fk',
  'live_sessions_rels_category_fk',
  'payload_room_access_room_fk',
  'payload_room_access_member_fk',
  'payload_locked_documents_rels_room_categories_fk',
  'payload_locked_documents_rels_room_access_fk',
])
const ROOM_REQUIRED_TYPES = Object.freeze([
  'enum_payload_room_categories_status',
  'enum_payload_room_access_grant_source',
  'enum_payload_room_access_status',
])

class MigrationControlError extends Error {
  constructor(code) {
    super(code)
    this.code = code
  }
}

function quoteIdentifier(value) {
  if (!IDENTIFIER.test(value)) throw new MigrationControlError('invalid_schema_identifier')
  return `"${value}"`
}

function requiredEnvironment(name) {
  const value = process.env[name]?.trim()
  if (!value) throw new MigrationControlError(`${name.toLowerCase()}_missing`)
  return value
}

function safeReference(value, code) {
  if (!value || !SAFE_REFERENCE.test(value)) throw new MigrationControlError(code)
  return value
}

function parseDatabaseUrl(rawUrl, expectedSchema) {
  let parsed
  try {
    parsed = new URL(rawUrl)
  } catch {
    throw new MigrationControlError('database_url_invalid')
  }
  if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
    throw new MigrationControlError('database_url_invalid')
  }
  const database = parsed.pathname.replace(/^\//, '')
  const schemaParams = parsed.searchParams.getAll('schema')
  if (!parsed.hostname || !database || schemaParams.length !== 1 || schemaParams[0] !== expectedSchema) {
    throw new MigrationControlError('database_url_invalid')
  }
  return {
    parsed,
    database,
    schema: schemaParams[0],
    host: parsed.hostname,
    port: parsed.port || '5432',
    role: decodeURIComponent(parsed.username || ''),
  }
}

function validateProductionTarget(payload) {
  if (process.env.ROOMS_MIGRATION_TARGET !== 'production') {
    throw new MigrationControlError('production_target_required')
  }
  if (process.env.DEPLOYMENT_ENV !== EXPECTED_PRODUCTION.deploymentEnv) {
    throw new MigrationControlError('deployment_environment_mismatch')
  }
  if (payload.targetOrigin !== EXPECTED_PRODUCTION.origin) {
    throw new MigrationControlError('target_origin_mismatch')
  }
  if (payload.applicationId !== EXPECTED_PRODUCTION.applicationId || payload.applicationName !== EXPECTED_PRODUCTION.applicationName) {
    throw new MigrationControlError('dokploy_application_mismatch')
  }
  const runtimeDatabase = parseDatabaseUrl(requiredEnvironment('DATABASE_URL'), EXPECTED_PRODUCTION.schema)
  const systemDatabase = parseDatabaseUrl(requiredEnvironment('SYSTEM_DATABASE_URL'), EXPECTED_PRODUCTION.systemSchema)
  if (
    runtimeDatabase.host !== EXPECTED_PRODUCTION.host ||
    runtimeDatabase.port !== EXPECTED_PRODUCTION.port ||
    runtimeDatabase.database !== EXPECTED_PRODUCTION.database ||
    runtimeDatabase.schema !== EXPECTED_PRODUCTION.schema ||
    runtimeDatabase.role !== EXPECTED_PRODUCTION.role ||
    systemDatabase.host !== EXPECTED_PRODUCTION.host ||
    systemDatabase.port !== EXPECTED_PRODUCTION.port ||
    systemDatabase.database !== EXPECTED_PRODUCTION.database ||
    systemDatabase.schema !== EXPECTED_PRODUCTION.systemSchema ||
    systemDatabase.role !== EXPECTED_PRODUCTION.systemRole
  ) {
    throw new MigrationControlError('production_database_boundary_mismatch')
  }
  if (runtimeDatabase.database === 'jpvbootcamp_staging' || runtimeDatabase.database === 'jpvbootcamp_legacy' || systemDatabase.database === 'jpvbootcamp_staging' || systemDatabase.database === 'jpvbootcamp_legacy') {
    throw new MigrationControlError('nonproduction_database_rejected')
  }
  return systemDatabase
}

function validateRehearsalTarget(payload) {
  if (process.env.ROOMS_MIGRATION_TARGET !== 'rehearsal') {
    throw new MigrationControlError('rehearsal_target_required')
  }
  if (process.env.DEPLOYMENT_ENV !== 'rehearsal') {
    throw new MigrationControlError('rehearsal_environment_mismatch')
  }
  if (process.env.ROOMS_REHEARSAL_CONFIRMATION !== 'rehearse-rooms-production-migration-on-restored-backup') {
    throw new MigrationControlError('rehearsal_confirmation_invalid')
  }
  safeReference(process.env.ROOMS_REHEARSAL_EVIDENCE_ID, 'rehearsal_evidence_id_invalid')
  return parseDatabaseUrl(requiredEnvironment('DATABASE_URL'), EXPECTED_PRODUCTION.schema)
}

function validateTarget(payload) {
  if (payload.target === 'production') return validateProductionTarget(payload)
  if (payload.target === 'rehearsal') return validateRehearsalTarget(payload)
  throw new MigrationControlError('migration_target_invalid')
}

function decodePayload() {
  const encoded = requiredEnvironment('ROOMS_MIGRATION_PAYLOAD_B64')
  let payload
  try {
    payload = JSON.parse(gunzipSync(Buffer.from(encoded, 'base64')).toString('utf8'))
  } catch {
    throw new MigrationControlError('migration_payload_invalid')
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new MigrationControlError('migration_payload_invalid')
  }
  return payload
}

function validatePayload(payload) {
  if (payload.version !== 1 || payload.migration !== MIGRATION_NAME) {
    throw new MigrationControlError('migration_payload_mismatch')
  }
  if (!['plan', 'apply', 'finalize'].includes(payload.mode)) {
    throw new MigrationControlError('migration_mode_invalid')
  }
  if (!['production', 'rehearsal'].includes(payload.target)) {
    throw new MigrationControlError('migration_target_invalid')
  }
  if (payload.sourceSha256 !== MIGRATION_SOURCE_SHA256 || !SHA256.test(payload.sourceSha256)) {
    throw new MigrationControlError('migration_source_checksum_mismatch')
  }
  if (!SHA256.test(payload.migrationSqlSha256)) throw new MigrationControlError('migration_sql_checksum_invalid')
  if (typeof payload.migrationSql !== 'string' || !payload.migrationSql.trim()) {
    throw new MigrationControlError('migration_sql_missing')
  }
  if (
    /\b(?:DROP\s+TABLE|DROP\s+COLUMN|DROP\s+TYPE|DELETE\s+FROM|TRUNCATE|DROP\s+DATABASE)\b/i.test(payload.migrationSql) ||
    !payload.migrationSql.includes('payload_portal_nav_items') ||
    !payload.migrationSql.includes('payload_room_access') ||
    !payload.migrationSql.includes('payload_room_categories')
  ) {
    throw new MigrationControlError('migration_sql_safety_check_failed')
  }
  if (!Array.isArray(payload.registeredPayloadMigrations) || payload.registeredPayloadMigrations.length !== 53) {
    throw new MigrationControlError('payload_registry_invalid')
  }
  if (new Set(payload.registeredPayloadMigrations).size !== payload.registeredPayloadMigrations.length) {
    throw new MigrationControlError('payload_registry_duplicate')
  }
  if (payload.registeredPayloadMigrations.at(-1) !== MIGRATION_NAME) {
    throw new MigrationControlError('payload_registry_target_mismatch')
  }
  if (!Array.isArray(payload.registeredPrismaMigrations) || payload.registeredPrismaMigrations.length === 0) {
    throw new MigrationControlError('prisma_registry_invalid')
  }
  if (payload.historicalBaselineSha256 !== HISTORICAL_BASELINE_SHA256) {
    throw new MigrationControlError('historical_baseline_checksum_mismatch')
  }
  for (const field of ['operatorId', 'backupEvidenceId', 'rehearsalEvidenceId', 'rollbackOwner', 'maintenanceWindowId']) {
    if (payload[field] !== undefined && payload[field] !== null) safeReference(String(payload[field]), `${field}_invalid`)
  }
  return payload
}

function hashRows(rows) {
  if (!Array.isArray(rows)) return null
  return crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex')
}

function normalizePayloadRows(rows) {
  const malformed = []
  const normalized = []
  for (const [index, row] of rows.entries()) {
    const id = Number(row.id)
    const batch = Number(row.batch)
    const name = typeof row.name === 'string' ? row.name : null
    if (!Number.isSafeInteger(id) || id < 1 || !Number.isSafeInteger(batch) || batch < 1 || !name || /[\x00-\x1f\x7f]/.test(name)) {
      malformed.push(index)
      continue
    }
    normalized.push({ id, name, batch })
  }
  return { normalized, malformed }
}

function migrationState(rows, registeredPayloadMigrations) {
  const normalizedResult = normalizePayloadRows(rows)
  const normalized = normalizedResult.normalized
  const names = normalized.map((row) => row.name)
  const registered = new Set(registeredPayloadMigrations)
  const seen = new Set()
  const duplicates = []
  const unexpected = []
  for (const name of names) {
    if (seen.has(name)) duplicates.push(name)
    seen.add(name)
    if (!registered.has(name)) unexpected.push(name)
  }
  const missing = registeredPayloadMigrations.filter((name) => !seen.has(name))
  const baselinePrefix = normalized.slice(0, 52)
  const baselineFingerprint = baselinePrefix.length === 52 ? hashRows(baselinePrefix) : null
  const historicalAnomalyIndices = []
  for (let index = 0; index < Math.min(52, normalized.length, registeredPayloadMigrations.length); index += 1) {
    if (normalized[index].name !== registeredPayloadMigrations[index]) historicalAnomalyIndices.push(index)
  }
  const historicalBaselineMatches = baselineFingerprint === HISTORICAL_BASELINE_SHA256
  const newOrderingAnomalies = historicalBaselineMatches ? [] : ['historical_prefix_changed']
  return {
    appliedPayloadCount: normalized.length,
    rows: normalized,
    missingPayloadMigrations: missing,
    unexpectedPayloadMigrations: unexpected,
    duplicatePayloadMigrations: duplicates,
    malformedPayloadMigrationCount: normalizedResult.malformed.length,
    malformedPayloadRowIndexes: normalizedResult.malformed,
    historicalBaselineFingerprint: baselineFingerprint,
    historicalBaselineMatches,
    historicalAnomalyIndices,
    newOrderingAnomalies,
  }
}

async function queryIdentity(client, schema) {
  const result = await client.query(
    'SELECT current_database() AS database, current_schema() AS schema, current_user AS role',
  )
  const row = result.rows[0]
  return {
    database: String(row?.database ?? ''),
    schema: String(row?.schema ?? ''),
    role: String(row?.role ?? ''),
  }
}

async function queryPayloadRows(client, schema) {
  const identifier = quoteIdentifier(schema)
  const result = await client.query(
    `SELECT "id", "name", "batch" FROM ${identifier}."payload_migrations" WHERE "batch" <> -1 ORDER BY "id" ASC`,
  )
  return result.rows
}

async function queryPrismaState(client, schema, registeredPrismaMigrations) {
  const identifier = quoteIdentifier(schema)
  const result = await client.query(
    `SELECT "migration_name", "started_at", "finished_at", "rolled_back_at", "applied_steps_count" FROM ${identifier}."_prisma_migrations" ORDER BY "started_at" ASC`,
  )
  const rows = result.rows.map((row) => ({
    name: String(row.migration_name ?? ''),
    started: Boolean(row.started_at),
    finished: Boolean(row.finished_at),
    rolledBack: Boolean(row.rolled_back_at),
    steps: /^\d+$/.test(String(row.applied_steps_count ?? '')) ? Number(row.applied_steps_count) : null,
  }))
  const expected = new Set(registeredPrismaMigrations)
  const seen = new Set()
  const duplicates = []
  const unexpected = []
  const unhealthy = []
  for (const row of rows) {
    if (seen.has(row.name)) duplicates.push(row.name)
    seen.add(row.name)
    if (!expected.has(row.name)) unexpected.push(row.name)
    if (!row.started || !row.finished || row.rolledBack || row.steps === null || row.steps < 0) unhealthy.push(row.name)
  }
  return {
    count: rows.length,
    missing: registeredPrismaMigrations.filter((name) => !seen.has(name)),
    unexpected,
    duplicates,
    unhealthy,
    healthy: rows.length > 0 && unexpected.length === 0 && duplicates.length === 0 && unhealthy.length === 0 && registeredPrismaMigrations.every((name) => seen.has(name)),
  }
}

async function queryNavigation(client, schema, href = LEGACY_NAVIGATION.href) {
  const identifier = quoteIdentifier(schema)
  const result = await client.query(
    `SELECT "id", "label", "href" FROM ${identifier}."payload_portal_nav_items" WHERE "href" = $1 ORDER BY "id" ASC`,
    [href],
  )
  return result.rows.map((row) => ({
    id: Number(row.id),
    label: String(row.label ?? ''),
    href: String(row.href ?? ''),
  }))
}

async function queryIntegrity(client, schema) {
  const identifier = quoteIdentifier(schema)
  const snapshot = {}
  for (const table of CRITICAL_TABLES) {
    const exists = await client.query(
      'SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2) AS present',
      [schema, table],
    )
    if (!exists.rows[0]?.present) throw new MigrationControlError(`critical_table_missing_${table}`)
    const result = await client.query(
      `SELECT COUNT(*)::text AS count, md5(COALESCE(string_agg("id"::text, ',' ORDER BY "id"), '')) AS id_digest FROM ${identifier}."${table}"`,
    )
    snapshot[table] = {
      count: String(result.rows[0]?.count ?? ''),
      idDigest: String(result.rows[0]?.id_digest ?? ''),
    }
  }
  return snapshot
}

function integrityDifferences(before, after) {
  const differences = []
  for (const table of CRITICAL_TABLES) {
    if (JSON.stringify(before?.[table]) !== JSON.stringify(after?.[table])) differences.push(table)
  }
  return differences
}

async function queryRoomsSchema(client, schema) {
  const tables = await client.query(
    'SELECT table_name FROM information_schema.tables WHERE table_schema = $1 AND table_name = ANY($2::text[])',
    [schema, [...ROOM_TABLES]],
  )
  const presentTables = new Set(tables.rows.map((row) => String(row.table_name)))
  const columns = await client.query(
    'SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = $1 AND ((table_name = $2 AND column_name = ANY($3::text[])) OR (table_name = $4 AND column_name = ANY($5::text[])) OR (table_name = $6 AND column_name = ANY($7::text[])) OR (table_name = $8 AND column_name = ANY($9::text[])))',
    [
      schema, 'live_sessions', ['target_group_ids', 'archived', 'archived_at'],
      'payload_member_notifications', ['event_key'],
      'payload_admin_notifications', ['event_key'],
      'payload_locked_documents_rels', ['payload_room_categories_id', 'payload_room_access_id'],
    ],
  )
  const presentColumns = new Set(columns.rows.map((row) => `${row.table_name}.${row.column_name}`))
  const missingColumns = ROOM_REQUIRED_COLUMNS
    .filter(([table, column]) => !presentColumns.has(`${table}.${column}`))
    .map(([table, column]) => `${table}.${column}`)
  const indexes = await client.query(
    'SELECT indexname FROM pg_indexes WHERE schemaname = $1 AND indexname = ANY($2::text[])',
    [schema, [...ROOM_REQUIRED_INDEXES]],
  )
  const presentIndexes = new Set(indexes.rows.map((row) => String(row.indexname)))
  const missingIndexes = ROOM_REQUIRED_INDEXES.filter((name) => !presentIndexes.has(name))
  const constraints = await client.query(
    'SELECT constraint_name FROM information_schema.table_constraints WHERE table_schema = $1 AND constraint_name = ANY($2::text[])',
    [schema, [...ROOM_REQUIRED_CONSTRAINTS]],
  )
  const presentConstraints = new Set(constraints.rows.map((row) => String(row.constraint_name)))
  const missingConstraints = ROOM_REQUIRED_CONSTRAINTS.filter((name) => !presentConstraints.has(name))
  const types = await client.query(
    'SELECT typname FROM pg_type JOIN pg_namespace ON pg_namespace.oid = pg_type.typnamespace WHERE pg_namespace.nspname = $1 AND typname = ANY($2::text[])',
    [schema, [...ROOM_REQUIRED_TYPES]],
  )
  const presentTypes = new Set(types.rows.map((row) => String(row.typname)))
  const missingTypes = ROOM_REQUIRED_TYPES.filter((name) => !presentTypes.has(name))
  return {
    presentTables: [...presentTables].sort(),
    missingTables: ROOM_TABLES.filter((name) => !presentTables.has(name)),
    presentColumns: [...presentColumns].sort(),
    missingColumns,
    presentIndexes: [...presentIndexes].sort(),
    missingIndexes,
    presentConstraints: [...presentConstraints].sort(),
    missingConstraints,
    presentTypes: [...presentTypes].sort(),
    missingTypes,
    complete: ROOM_TABLES.every((name) => presentTables.has(name)) &&
      missingColumns.length === 0 && missingIndexes.length === 0 && missingConstraints.length === 0 && missingTypes.length === 0,
  }
}

function stateEvidence(state, prisma, integrity, navigation, roomsSchema) {
  return {
    appliedPayloadCount: state.appliedPayloadCount,
    missingPayloadMigrations: state.missingPayloadMigrations,
    unexpectedPayloadMigrations: state.unexpectedPayloadMigrations,
    duplicatePayloadMigrations: state.duplicatePayloadMigrations,
    malformedPayloadMigrationCount: state.malformedPayloadMigrationCount,
    historicalBaselineFingerprint: state.historicalBaselineFingerprint,
    historicalBaselineMatches: state.historicalBaselineMatches,
    historicalAnomalyIndices: state.historicalAnomalyIndices,
    newOrderingAnomalies: state.newOrderingAnomalies,
    prisma: {
      count: prisma.count,
      missing: prisma.missing,
      unexpected: prisma.unexpected,
      duplicates: prisma.duplicates,
      unhealthy: prisma.unhealthy,
      healthy: prisma.healthy,
    },
    integrity,
    legacyNavigation: navigation,
    roomsSchema,
  }
}

async function collectEvidence(client, schema, payload) {
  const runEvidenceQuery = async (phase, query) => {
    try {
      return await query()
    } catch (error) {
      if (error && typeof error === 'object') error.roomsEvidencePhase = phase
      throw error
    }
  }
  const identity = await runEvidenceQuery('identity', () => queryIdentity(client, schema))
  const payloadRows = await runEvidenceQuery('payload_ledger', () => queryPayloadRows(client, schema))
  const state = migrationState(payloadRows, payload.registeredPayloadMigrations)
  const prisma = await runEvidenceQuery('prisma', () => queryPrismaState(client, schema, payload.registeredPrismaMigrations))
  const integrity = await runEvidenceQuery('integrity', () => queryIntegrity(client, schema))
  const navigation = await runEvidenceQuery('navigation', () => queryNavigation(client, schema))
  const roomsSchema = await runEvidenceQuery('rooms_schema', () => queryRoomsSchema(client, schema))
  return { identity, state, prisma, integrity, navigation, roomsSchema }
}

function baselineBlockers(evidence, payload, expectedCount) {
  const blockers = []
  if (evidence.identity.database !== EXPECTED_PRODUCTION.database && payload.target === 'production') blockers.push('database_identity_mismatch')
  if (evidence.identity.schema !== EXPECTED_PRODUCTION.schema) blockers.push('schema_identity_mismatch')
  if (evidence.state.appliedPayloadCount !== expectedCount) blockers.push('applied_count_mismatch')
  if (evidence.state.missingPayloadMigrations.length !== 1 || evidence.state.missingPayloadMigrations[0] !== MIGRATION_NAME) blockers.push('pending_migration_mismatch')
  if (evidence.state.unexpectedPayloadMigrations.length > 0) blockers.push('unexpected_payload_migrations')
  if (evidence.state.duplicatePayloadMigrations.length > 0) blockers.push('duplicate_payload_migrations')
  if (evidence.state.malformedPayloadMigrationCount > 0) blockers.push('malformed_payload_evidence')
  if (!evidence.state.historicalBaselineMatches) blockers.push('historical_baseline_changed')
  if (JSON.stringify(evidence.state.historicalAnomalyIndices) !== JSON.stringify(BASELINE_ANOMALY_INDICES)) blockers.push('historical_anomaly_fingerprint_changed')
  if (evidence.state.newOrderingAnomalies.length > 0) blockers.push('new_ordering_anomalies')
  if (!evidence.prisma.healthy) blockers.push('prisma_not_healthy')
  if (evidence.navigation.length > 1 || (evidence.navigation.length === 1 && evidence.navigation[0].href !== LEGACY_NAVIGATION.href)) blockers.push('legacy_navigation_target_mismatch')
  if (
    evidence.roomsSchema.presentTables.length > 0 ||
    evidence.roomsSchema.presentColumns.length > 0 ||
    evidence.roomsSchema.presentIndexes.length > 0 ||
    evidence.roomsSchema.presentConstraints.length > 0 ||
    evidence.roomsSchema.presentTypes.length > 0
  ) blockers.push('rooms_schema_not_pre_migration')
  return blockers
}

function postBlockers(evidence, payload) {
  const blockers = []
  if (evidence.identity.schema !== EXPECTED_PRODUCTION.schema) blockers.push('schema_identity_mismatch')
  if (evidence.state.appliedPayloadCount !== payload.registeredPayloadMigrations.length) blockers.push('applied_count_mismatch')
  if (evidence.state.missingPayloadMigrations.length > 0) blockers.push('pending_migrations_remain')
  if (evidence.state.unexpectedPayloadMigrations.length > 0) blockers.push('unexpected_payload_migrations')
  if (evidence.state.duplicatePayloadMigrations.length > 0) blockers.push('duplicate_payload_migrations')
  if (evidence.state.malformedPayloadMigrationCount > 0) blockers.push('malformed_payload_evidence')
  if (!evidence.state.historicalBaselineMatches) blockers.push('historical_baseline_changed')
  if (JSON.stringify(evidence.state.historicalAnomalyIndices) !== JSON.stringify(BASELINE_ANOMALY_INDICES)) blockers.push('historical_anomaly_fingerprint_changed')
  if (evidence.state.newOrderingAnomalies.length > 0) blockers.push('new_ordering_anomalies')
  if (!evidence.prisma.healthy) blockers.push('prisma_not_healthy')
  if (!evidence.roomsSchema.complete) blockers.push('rooms_schema_incomplete')
  if (evidence.navigation.length > 1 || (evidence.navigation.length === 1 && evidence.navigation[0].href !== LEGACY_NAVIGATION.href)) blockers.push('compatibility_navigation_not_held')
  return blockers
}

async function withReadOnlyEvidence(client, schema, payload) {
  await client.query('BEGIN TRANSACTION READ ONLY')
  try {
    await client.query('SET LOCAL statement_timeout = \'15000ms\'')
    return await collectEvidence(client, schema, payload)
  } finally {
    await client.query('ROLLBACK').catch(() => undefined)
  }
}

async function runPlan(client, schema, payload) {
  const evidence = await withReadOnlyEvidence(client, schema, payload)
  const blockers = baselineBlockers(evidence, payload, payload.registeredPayloadMigrations.length - 1)
  return {
    resultCode: blockers.length === 0 ? 'plan_ok' : 'plan_blocked',
    ok: blockers.length === 0,
    target: payload.target,
    migration: MIGRATION_NAME,
    sourceSha256: payload.sourceSha256,
    historicalBaselineSha256: HISTORICAL_BASELINE_SHA256,
    backupEvidenceId: payload.backupEvidenceId ?? null,
    backupSha256: payload.backupSha256 ?? null,
    rehearsalEvidenceId: payload.rehearsalEvidenceId ?? null,
    blockers,
    evidence: stateEvidence(evidence.state, evidence.prisma, evidence.integrity, evidence.navigation, evidence.roomsSchema),
  }
}

async function applyMigration(client, schema, payload) {
  let transactionOpen = false
  let committed = false
  try {
    await client.query('BEGIN')
    transactionOpen = true
    await client.query('SET LOCAL statement_timeout = \'30000ms\'')
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [MIGRATION_NAME])
    const before = await collectEvidence(client, schema, payload)
    const preBlockers = baselineBlockers(before, payload, payload.registeredPayloadMigrations.length - 1)
    if (preBlockers.length > 0) throw new MigrationControlError(`pre_apply_${preBlockers[0]}`)
    const navigationBefore = before.navigation
    const navigationIds = navigationBefore.map((row) => row.id)

    const sqlChecksum = crypto.createHash('sha256').update(payload.migrationSql).digest('hex')
    if (sqlChecksum !== payload.migrationSqlSha256) throw new MigrationControlError('migration_sql_checksum_mismatch')
    await client.query(payload.migrationSql)

    const identifier = quoteIdentifier(schema)
    if (navigationBefore.length > 0) {
      const restored = await client.query(
        `UPDATE ${identifier}."payload_portal_nav_items" SET "label" = $1, "href" = $2 WHERE "id" = ANY($3::integer[])`,
        [navigationBefore[0].label, navigationBefore[0].href, navigationIds],
      )
      if (Number(restored.rowCount) !== navigationBefore.length) throw new MigrationControlError('compatibility_navigation_restore_failed')
    }

    const batch = await client.query(
      `SELECT COALESCE(MAX("batch"), 0) + 1 AS next_batch, COALESCE(MAX("id"), 0) + 1 AS next_id FROM ${identifier}."payload_migrations" WHERE "batch" <> -1`,
    )
    const nextBatch = Number(batch.rows[0]?.next_batch)
    const nextId = Number(batch.rows[0]?.next_id)
    if (nextBatch !== 20 || nextId !== 53) throw new MigrationControlError('migration_ledger_append_position_unexpected')
    await client.query(
      `INSERT INTO ${identifier}."payload_migrations" ("name", "batch", "updated_at", "created_at") VALUES ($1, $2, NOW(), NOW())`,
      [MIGRATION_NAME, nextBatch],
    )
    await client.query('COMMIT')
    transactionOpen = false
    committed = true

    const after = await withReadOnlyEvidence(client, schema, payload)
    const blockers = postBlockers(after, payload)
    const integrityChanges = integrityDifferences(before.integrity, after.integrity)
    if (integrityChanges.length > 0) blockers.push(`critical_integrity_changed:${integrityChanges.join(',')}`)
    if (JSON.stringify(before.navigation) !== JSON.stringify(after.navigation)) blockers.push('legacy_navigation_values_changed')
    if (after.state.rows.length !== 53 || after.state.rows[52]?.name !== MIGRATION_NAME || after.state.rows[52]?.batch !== 20) blockers.push('rooms_migration_not_appended')
    if (blockers.length > 0) {
      return {
        resultCode: 'uncertain',
        ok: false,
        target: payload.target,
        migration: MIGRATION_NAME,
        sourceSha256: payload.sourceSha256,
        blockers,
        preApply: stateEvidence(before.state, before.prisma, before.integrity, before.navigation, before.roomsSchema),
        postApply: stateEvidence(after.state, after.prisma, after.integrity, after.navigation, after.roomsSchema),
      }
    }
    return {
      resultCode: 'applied',
      ok: true,
      target: payload.target,
      migration: MIGRATION_NAME,
      sourceSha256: payload.sourceSha256,
      historicalBaselineSha256: HISTORICAL_BASELINE_SHA256,
      blockers: [],
      preApply: stateEvidence(before.state, before.prisma, before.integrity, before.navigation, before.roomsSchema),
      postApply: stateEvidence(after.state, after.prisma, after.integrity, after.navigation, after.roomsSchema),
      compatibilityHold: {
        restoredRows: navigationBefore.map((row) => ({ id: row.id, label: row.label, href: row.href })),
      },
    }
  } catch (error) {
    if (transactionOpen) await client.query('ROLLBACK').catch(() => undefined)
    if (committed) {
      return {
        resultCode: 'uncertain',
        ok: false,
        target: payload.target,
        migration: MIGRATION_NAME,
        sourceSha256: payload.sourceSha256,
        blockers: ['post_commit_verification_failed'],
      }
    }
    throw error
  }
}

async function finalizeNavigation(client, schema, payload) {
  const before = await withReadOnlyEvidence(client, schema, payload)
  const blockers = postBlockers(before, payload)
  if (before.state.rows.length !== 53 || before.state.rows[52]?.name !== MIGRATION_NAME || before.state.rows[52]?.batch !== 20) blockers.push('rooms_migration_not_verified')
  if (blockers.length > 0) {
    return {
      resultCode: 'finalize_blocked',
      ok: false,
      target: payload.target,
      migration: MIGRATION_NAME,
      blockers,
      evidence: stateEvidence(before.state, before.prisma, before.integrity, before.navigation, before.roomsSchema),
    }
  }
  if (before.navigation.length === 0) {
    const after = await withReadOnlyEvidence(client, schema, payload)
    const roomsNavigation = await queryNavigation(client, schema, ROOMS_NAVIGATION.href)
    return {
      resultCode: 'navigation_finalized',
      ok: true,
      target: payload.target,
      migration: MIGRATION_NAME,
      blockers: [],
      navigationFinalization: 'no_persisted_navigation_row_default_is_authoritative',
      beforeNavigation: [],
      afterNavigation: roomsNavigation,
      evidence: stateEvidence(after.state, after.prisma, after.integrity, roomsNavigation, after.roomsSchema),
    }
  }
  if (before.navigation.length !== 1) throw new MigrationControlError('finalize_navigation_target_count_invalid')
  const nav = before.navigation[0]
  const identifier = quoteIdentifier(schema)
  await client.query('BEGIN')
  try {
    await client.query('SET LOCAL statement_timeout = \'15000ms\'')
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [MIGRATION_NAME])
    const updated = await client.query(
      `UPDATE ${identifier}."payload_portal_nav_items" SET "label" = $1, "href" = $2 WHERE "id" = $3 AND "href" = $4`,
      [ROOMS_NAVIGATION.label, ROOMS_NAVIGATION.href, nav.id, LEGACY_NAVIGATION.href],
    )
    if (Number(updated.rowCount) !== 1) throw new MigrationControlError('finalize_navigation_update_failed')
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw error
  }
  const after = await withReadOnlyEvidence(client, schema, payload)
  const finalNavigation = await queryNavigation(client, schema, ROOMS_NAVIGATION.href)
  if (finalNavigation.length !== 1 || finalNavigation[0].id !== nav.id || finalNavigation[0].label !== ROOMS_NAVIGATION.label) {
    return {
      resultCode: 'uncertain',
      ok: false,
      target: payload.target,
      migration: MIGRATION_NAME,
      blockers: ['finalize_navigation_postcheck_failed'],
      evidence: stateEvidence(after.state, after.prisma, after.integrity, finalNavigation, after.roomsSchema),
    }
  }
  return {
    resultCode: 'navigation_finalized',
    ok: true,
    target: payload.target,
    migration: MIGRATION_NAME,
    blockers: [],
    beforeNavigation: [{ id: nav.id, label: nav.label, href: nav.href }],
    afterNavigation: finalNavigation,
    evidence: stateEvidence(after.state, after.prisma, after.integrity, finalNavigation, after.roomsSchema),
  }
}

function markerFor(result) {
  if (result.resultCode === 'plan_ok') return 'JPV_ROOMS_MIGRATION_PLAN_OK'
  if (result.resultCode === 'plan_blocked') return 'JPV_ROOMS_MIGRATION_PLAN_BLOCKED'
  if (result.resultCode === 'applied') return 'JPV_ROOMS_MIGRATION_APPLIED'
  if (result.resultCode === 'navigation_finalized') return 'JPV_ROOMS_NAV_FINALIZED'
  if (result.resultCode === 'uncertain') return 'JPV_ROOMS_MIGRATION_UNCERTAIN'
  return 'JPV_ROOMS_MIGRATION_FAILED'
}

async function main() {
  let client
  try {
    const payload = validatePayload(decodePayload())
    const target = validateTarget(payload)
    if (payload.target === 'production' && payload.mode === 'finalize' && process.env.ROOMS_MIGRATION_EXPECTED_RELEASE_SHA !== process.env.EXPECTED_DEPLOYMENT_SHA) {
      throw new MigrationControlError('finalize_release_sha_missing')
    }
    const connectionString = payload.target === 'production' ? requiredEnvironment('SYSTEM_DATABASE_URL') : requiredEnvironment('DATABASE_URL')
    client = new Client({ connectionString })
    await client.connect()
    const schema = payload.target === 'production' ? EXPECTED_PRODUCTION.schema : target.schema
    await client.query(`SET search_path TO ${quoteIdentifier(schema)}`)
    if (payload.mode === 'plan') {
      const result = await runPlan(client, schema, payload)
      process.stdout.write(`${markerFor(result)} ${JSON.stringify(result)}\n`)
      process.exitCode = result.ok ? 0 : 1
      return
    }
    if (payload.mode === 'apply') {
      const result = await applyMigration(client, schema, payload)
      process.stdout.write(`${markerFor(result)} ${JSON.stringify(result)}\n`)
      process.exitCode = result.ok ? 0 : 1
      return
    }
    const result = await finalizeNavigation(client, schema, payload)
    process.stdout.write(`${markerFor(result)} ${JSON.stringify(result)}\n`)
    process.exitCode = result.ok ? 0 : 1
  } catch (error) {
    const databaseCode = error && typeof error === 'object' && /^[0-9A-Z]{5}$/.test(String(error.code ?? ''))
      ? `database_error_${String(error.code).toLowerCase()}`
      : null
    const runtimeName = error && typeof error === 'object' && /^[A-Za-z]+$/.test(String(error.name ?? ''))
      ? `runtime_error_${String(error.name).toLowerCase()}`
      : null
    const evidencePhase = error && typeof error === 'object' && /^[a-z_]+$/.test(String(error.roomsEvidencePhase ?? ''))
      ? String(error.roomsEvidencePhase)
      : null
    const code = error instanceof MigrationControlError && /^[a-z0-9_:-]+$/.test(error.code)
      ? error.code
      : databaseCode ? `${databaseCode}${evidencePhase ? `:${evidencePhase}` : ''}` : runtimeName ?? 'guard_failed'
    process.stdout.write(`JPV_ROOMS_MIGRATION_FAILED ${JSON.stringify({ version: 1, ok: false, resultCode: 'blocked', blockers: [code] })}\n`)
    process.exitCode = 1
  } finally {
    await client?.end().catch(() => undefined)
  }
}

if (process.env.ROOMS_RUNNER_TEST !== '1') void main()

export {
  hashRows,
  migrationState,
  normalizePayloadRows,
  parseDatabaseUrl,
  validatePayload,
}
