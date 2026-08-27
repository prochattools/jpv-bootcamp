#!/usr/bin/env node

import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { Client } = require('pg')

const MIGRATION_NAME = '20260827_090000_membership_support_relationship_tables'
const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/

const RELATION_TABLES = [
  {
    parent: 'payload_pay_it_forward_funding',
    notesIndex: 'payload_pay_it_forward_funding_rels_notes_idx',
    parentConstraint: 'payload_pay_it_forward_funding_rels_parent_fk',
    notesConstraint: 'payload_pay_it_forward_funding_rels_notes_fk',
  },
  {
    parent: 'payload_membership_vouchers',
    notesIndex: 'payload_membership_vouchers_rels_notes_idx',
    parentConstraint: 'payload_membership_vouchers_rels_parent_fk',
    notesConstraint: 'payload_membership_vouchers_rels_notes_fk',
  },
  {
    parent: 'payload_membership_administration_actions',
    notesIndex: 'payload_membership_administration_actions_rels_notes_idx',
    parentConstraint: 'payload_membership_administration_actions_rels_parent_fk',
    notesConstraint: 'payload_membership_administration_actions_rels_notes_fk',
  },
]

function quoteIdentifier(value) {
  if (!IDENTIFIER.test(value)) throw new Error('JPV_PAYLOAD_MIGRATION_FAILED invalid database identifier')
  return `"${value}"`
}

function requiredEnvironment(name) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`JPV_PAYLOAD_MIGRATION_FAILED ${name} is required`)
  return value
}

function validateProductionDatabaseBoundary() {
  const databaseUrl = requiredEnvironment('DATABASE_URL')
  const expected = {
    host: requiredEnvironment('PRODUCTION_DATABASE_HOST'),
    port: requiredEnvironment('PRODUCTION_DATABASE_PORT'),
    database: requiredEnvironment('PRODUCTION_DATABASE_NAME'),
    schema: requiredEnvironment('PRODUCTION_DATABASE_SCHEMA'),
  }

  if (process.env.DEPLOYMENT_ENV !== 'production') {
    throw new Error('JPV_PAYLOAD_MIGRATION_FAILED DEPLOYMENT_ENV must be exactly production')
  }
  if (!IDENTIFIER.test(expected.schema)) {
    throw new Error('JPV_PAYLOAD_MIGRATION_FAILED production schema identifier is invalid')
  }

  let parsed
  try {
    parsed = new URL(databaseUrl)
  } catch {
    throw new Error('JPV_PAYLOAD_MIGRATION_FAILED DATABASE_URL is not a valid URL')
  }
  if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') {
    throw new Error('JPV_PAYLOAD_MIGRATION_FAILED DATABASE_URL protocol is invalid')
  }
  if (parsed.hostname !== expected.host || (parsed.port || '5432') !== expected.port) {
    throw new Error('JPV_PAYLOAD_MIGRATION_FAILED DATABASE_URL host or port does not match the production boundary')
  }
  if (parsed.pathname.replace(/^\//, '') !== expected.database) {
    throw new Error('JPV_PAYLOAD_MIGRATION_FAILED DATABASE_URL database does not match the production boundary')
  }
  const schemas = parsed.searchParams.getAll('schema')
  if (schemas.length !== 1 || schemas[0] !== expected.schema) {
    throw new Error('JPV_PAYLOAD_MIGRATION_FAILED DATABASE_URL schema does not match the production boundary')
  }

  return { databaseUrl, schema: expected.schema }
}

async function tableExists(client, schema, table) {
  const result = await client.query(
    'SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2',
    [schema, table],
  )
  return result.rows.length > 0
}

async function tableColumns(client, schema, table) {
  const result = await client.query(
    'SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2',
    [schema, table],
  )
  return new Set(result.rows.map((row) => String(row.column_name)))
}

async function ensureRelationTable(client, schema, definition) {
  const schemaIdentifier = quoteIdentifier(schema)
  const parentIdentifier = quoteIdentifier(definition.parent)
  const relationTable = `${definition.parent}_rels`
  const relationIdentifier = quoteIdentifier(relationTable)

  if (!await tableExists(client, schema, definition.parent) || !await tableExists(client, schema, 'payload_operator_notes')) {
    throw new Error('JPV_PAYLOAD_MIGRATION_FAILED required membership-support table is missing')
  }

  if (!await tableExists(client, schema, relationTable)) {
    await client.query(`
      CREATE TABLE ${schemaIdentifier}.${relationIdentifier} (
        "id" serial PRIMARY KEY NOT NULL,
        "order" integer,
        "parent_id" integer NOT NULL,
        "path" varchar NOT NULL,
        "payload_operator_notes_id" integer
      )
    `)
  }

  const requiredColumns = ['id', 'order', 'parent_id', 'path', 'payload_operator_notes_id']
  const columns = await tableColumns(client, schema, relationTable)
  if (requiredColumns.some((column) => !columns.has(column))) {
    throw new Error('JPV_PAYLOAD_MIGRATION_FAILED payload relationship schema is incompatible')
  }

  await client.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint constraint_record
        JOIN pg_class table_record ON table_record.oid = constraint_record.conrelid
        JOIN pg_namespace namespace_record ON namespace_record.oid = table_record.relnamespace
        WHERE namespace_record.nspname = '${schema}'
          AND table_record.relname = '${relationTable}'
          AND constraint_record.conname = '${definition.parentConstraint}'
      ) THEN
        ALTER TABLE ${schemaIdentifier}.${relationIdentifier}
          ADD CONSTRAINT "${definition.parentConstraint}"
          FOREIGN KEY ("parent_id") REFERENCES ${schemaIdentifier}.${parentIdentifier}("id") ON DELETE cascade;
      END IF;
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint constraint_record
        JOIN pg_class table_record ON table_record.oid = constraint_record.conrelid
        JOIN pg_namespace namespace_record ON namespace_record.oid = table_record.relnamespace
        WHERE namespace_record.nspname = '${schema}'
          AND table_record.relname = '${relationTable}'
          AND constraint_record.conname = '${definition.notesConstraint}'
      ) THEN
        ALTER TABLE ${schemaIdentifier}.${relationIdentifier}
          ADD CONSTRAINT "${definition.notesConstraint}"
          FOREIGN KEY ("payload_operator_notes_id") REFERENCES ${schemaIdentifier}."payload_operator_notes"("id") ON DELETE cascade;
      END IF;
    END
    $$;
  `)

  await client.query(`CREATE INDEX IF NOT EXISTS "${relationTable}_order_idx" ON ${schemaIdentifier}.${relationIdentifier} ("order")`)
  await client.query(`CREATE INDEX IF NOT EXISTS "${relationTable}_parent_idx" ON ${schemaIdentifier}.${relationIdentifier} ("parent_id")`)
  await client.query(`CREATE INDEX IF NOT EXISTS "${relationTable}_path_idx" ON ${schemaIdentifier}.${relationIdentifier} ("path")`)
  await client.query(`CREATE INDEX IF NOT EXISTS "${definition.notesIndex}" ON ${schemaIdentifier}.${relationIdentifier} ("payload_operator_notes_id")`)
}

async function applyMigration() {
  const { databaseUrl, schema } = validateProductionDatabaseBoundary()
  const client = new Client({ connectionString: databaseUrl })
  let transactionStarted = false

  try {
    await client.connect()
    if (!await tableExists(client, schema, 'payload_migrations')) {
      throw new Error('JPV_PAYLOAD_MIGRATION_FAILED payload migration ledger is missing')
    }

    await client.query('BEGIN')
    transactionStarted = true
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [MIGRATION_NAME])
    for (const definition of RELATION_TABLES) {
      await ensureRelationTable(client, schema, definition)
    }

    const applied = await client.query(
      `SELECT 1 FROM ${quoteIdentifier(schema)}."payload_migrations" WHERE "name" = $1 AND "batch" <> -1 LIMIT 1`,
      [MIGRATION_NAME],
    )
    if (applied.rows.length === 0) {
      const batch = await client.query(
        `SELECT COALESCE(MAX("batch"), 0) + 1 AS next_batch FROM ${quoteIdentifier(schema)}."payload_migrations" WHERE "batch" <> -1`,
      )
      const nextBatch = Number(batch.rows[0]?.next_batch)
      if (!Number.isSafeInteger(nextBatch) || nextBatch < 1) {
        throw new Error('JPV_PAYLOAD_MIGRATION_FAILED payload migration batch is invalid')
      }
      await client.query(
        `INSERT INTO ${quoteIdentifier(schema)}."payload_migrations" ("name", "batch", "updated_at", "created_at") VALUES ($1, $2, NOW(), NOW())`,
        [MIGRATION_NAME, nextBatch],
      )
    }

    await client.query('COMMIT')
    transactionStarted = false
    console.log(`JPV_PAYLOAD_MIGRATION_APPLIED ${MIGRATION_NAME}`)
  } catch (error) {
    if (transactionStarted) await client.query('ROLLBACK').catch(() => undefined)
    throw error
  } finally {
    await client.end().catch(() => undefined)
  }
}

try {
  await applyMigration()
} catch (error) {
  console.error(error instanceof Error ? error.message : 'JPV_PAYLOAD_MIGRATION_FAILED unknown error')
  process.exitCode = 1
}
