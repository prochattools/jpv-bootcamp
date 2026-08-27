'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { Client } = require('pg')

function loadCanonicalMigrationNames(
  registryPath = path.resolve(__dirname, '../../src/lib/payloadMigrationRegistry.ts'),
) {
  try {
    const source = fs.readFileSync(registryPath, 'utf8')
    const array = source.match(/export const PAYLOAD_MIGRATION_NAMES\s*=\s*\[([\s\S]*?)\]\s*as const/)
    if (!array) throw new Error('invalid_registry')
    const names = [...array[1].matchAll(/'([^']+)'/g)].map((match) => match[1])
    const residue = array[1].replace(/'[^']+'/g, '').replace(/[\s,]/g, '')
    if (residue || names.length === 0 || new Set(names).size !== names.length) {
      throw new Error('invalid_registry')
    }
    return Object.freeze(names)
  } catch {
    throw new Error('migration_registry_unavailable')
  }
}

const REQUIRED_PAYLOAD_MIGRATIONS = loadCanonicalMigrationNames()

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/
const REQUIRED_AUDIT_HISTORY_COLUMNS = [
  'membership_support_id',
  'voucher_id',
  'funding_source_id',
  'reconciliation_id',
]
const REQUIRED_PAYLOAD_RELATION_TABLES = [
  {
    table: 'payload_pay_it_forward_funding_rels',
    columns: ['id', 'order', 'parent_id', 'path', 'payload_operator_notes_id'],
  },
  {
    table: 'payload_membership_vouchers_rels',
    columns: ['id', 'order', 'parent_id', 'path', 'payload_operator_notes_id'],
  },
  {
    table: 'payload_membership_administration_actions_rels',
    columns: ['id', 'order', 'parent_id', 'path', 'payload_operator_notes_id'],
  },
]

function resolveSchema(environment = process.env) {
  const override = environment.PAYLOAD_MIGRATION_SCHEMA?.trim()
  if (override) {
    if (!IDENTIFIER.test(override)) throw new Error('invalid_schema')
    return override
  }

  let schema = 'jpvbootcamp'
  try {
    const configured = new URL(environment.DATABASE_URL).searchParams.get('schema')
    if (configured) schema = configured
  } catch {
    throw new Error('database_url_unavailable')
  }
  if (!IDENTIFIER.test(schema)) throw new Error('invalid_schema')
  return schema
}

function missingMigrationNames(rows) {
  const applied = new Set(rows.map((row) => String(row.name)))
  return REQUIRED_PAYLOAD_MIGRATIONS.filter((name) => !applied.has(name))
}

async function verifyPayloadMigrationState({ environment = process.env, clientFactory = (options) => new Client(options) } = {}) {
  if (!environment.DATABASE_URL?.trim()) throw new Error('database_url_unavailable')
  const schema = resolveSchema(environment)
  const client = clientFactory({ connectionString: environment.DATABASE_URL })

  try {
    await client.connect()
    const result = await client.query(`SELECT "name" FROM "${schema}"."payload_migrations" WHERE "batch" <> -1`)
    const pending = missingMigrationNames(result.rows)
    if (pending.length > 0) return pending
    const columns = await client.query(
      'SELECT "column_name" FROM information_schema.columns WHERE "table_schema" = $1 AND "table_name" = $2',
      [schema, 'payload_membership_audit_history'],
    )
    const present = new Set(columns.rows.map((row) => String(row.column_name)))
    const missingColumns = REQUIRED_AUDIT_HISTORY_COLUMNS.filter((column) => !present.has(column))
    if (missingColumns.length > 0) throw new Error('audit_history_schema_incompatible')

    const relationTables = REQUIRED_PAYLOAD_RELATION_TABLES.map(({ table }) => table)
    const relationColumns = await client.query(
      'SELECT "table_name", "column_name" FROM information_schema.columns WHERE "table_schema" = $1 AND "table_name" = ANY($2::text[])',
      [schema, relationTables],
    )
    const presentByTable = new Map()
    for (const row of relationColumns.rows) {
      const table = String(row.table_name)
      if (!presentByTable.has(table)) presentByTable.set(table, new Set())
      presentByTable.get(table).add(String(row.column_name))
    }
    const missingRelations = REQUIRED_PAYLOAD_RELATION_TABLES.flatMap(({ table, columns: requiredColumns }) => {
      const presentColumns = presentByTable.get(table) || new Set()
      return requiredColumns.filter((column) => !presentColumns.has(column)).map((column) => `${table}.${column}`)
    })
    if (missingRelations.length > 0) throw new Error('payload_relationship_schema_incompatible')
    return []
  } catch (error) {
    if (error instanceof Error && error.message === 'audit_history_schema_incompatible') throw error
    if (error instanceof Error && error.message === 'payload_relationship_schema_incompatible') throw error
    throw new Error('migration_state_unavailable')
  } finally {
    await client.end().catch(() => undefined)
  }
}

async function main() {
  try {
    const missing = await verifyPayloadMigrationState()
    if (missing.length > 0) {
      console.error(`[start] FATAL: Payload migrations are pending: ${missing.join(', ')}`)
      console.error('[start] Apply the reviewed environment-specific Payload migration job before application-only startup.')
      process.exitCode = 1
      return
    }
    console.log('[start] Payload migration state is current')
  } catch (error) {
    if (error instanceof Error && error.message === 'audit_history_schema_incompatible') {
      console.error('[start] FATAL: Payload audit-history schema is incomplete; apply the reviewed Payload migration before application-only startup.')
      process.exitCode = 1
      return
    }
    if (error instanceof Error && error.message === 'payload_relationship_schema_incompatible') {
      console.error('[start] FATAL: Payload relationship schema is incomplete; apply the reviewed Payload migration before application-only startup.')
      process.exitCode = 1
      return
    }
    console.error('[start] FATAL: Payload migration state cannot be verified; application-only startup is blocked.')
    console.error('[start] Verify DATABASE_URL schema and run the reviewed environment-specific Payload migration job.')
    process.exitCode = 1
  }
}

if (require.main === module) void main()

module.exports = {
  REQUIRED_PAYLOAD_MIGRATIONS,
  REQUIRED_AUDIT_HISTORY_COLUMNS,
  REQUIRED_PAYLOAD_RELATION_TABLES,
  loadCanonicalMigrationNames,
  missingMigrationNames,
  resolveSchema,
  verifyPayloadMigrationState,
}
