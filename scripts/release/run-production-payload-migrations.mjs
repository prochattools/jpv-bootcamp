#!/usr/bin/env node

import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { Client } = require('pg')

const MIGRATION_NAME = '20260827_090000_membership_support_relationship_tables'
const NOTIFICATION_EVENT_KEY_MIGRATION_NAME = '20260901_210000_notification_event_key'
const MEMBER_FOLLOWS_MIGRATION_NAME = '20260901_220000_member_follows'
const PRODUCTION_MIGRATION_LOCK_NAME = 'jpvbootcamp:payload-production-migrations'
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

async function constraintExists(client, schema, table, constraint) {
  const result = await client.query(
    `
      SELECT 1
      FROM pg_constraint constraint_record
      JOIN pg_class table_record ON table_record.oid = constraint_record.conrelid
      JOIN pg_namespace namespace_record ON namespace_record.oid = table_record.relnamespace
      WHERE namespace_record.nspname = $1
        AND table_record.relname = $2
        AND constraint_record.conname = $3
      LIMIT 1
    `,
    [schema, table, constraint],
  )
  return result.rows.length > 0
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

async function nextMigrationBatch(client, schema) {
  const batch = await client.query(
    `SELECT COALESCE(MAX("batch"), 0) + 1 AS next_batch FROM ${quoteIdentifier(schema)}."payload_migrations" WHERE "batch" <> -1`,
  )
  const nextBatch = Number(batch.rows[0]?.next_batch)
  if (!Number.isSafeInteger(nextBatch) || nextBatch < 1) {
    throw new Error('JPV_PAYLOAD_MIGRATION_FAILED payload migration batch is invalid')
  }
  return nextBatch
}

async function recordMigration(client, schema, migrationName, batch) {
  const applied = await client.query(
    `SELECT 1 FROM ${quoteIdentifier(schema)}."payload_migrations" WHERE "name" = $1 AND "batch" <> -1 LIMIT 1`,
    [migrationName],
  )
  if (applied.rows.length > 0) return

  await client.query(
    `INSERT INTO ${quoteIdentifier(schema)}."payload_migrations" ("name", "batch", "updated_at", "created_at") VALUES ($1, $2, NOW(), NOW())`,
    [migrationName, batch],
  )
}

async function runReviewedMigrations(databaseUrl, schema, migrations) {
  const client = new Client({ connectionString: databaseUrl })
  let transactionStarted = false

  try {
    await client.connect()
    if (!await tableExists(client, schema, 'payload_migrations')) {
      throw new Error('JPV_PAYLOAD_MIGRATION_FAILED payload migration ledger is missing')
    }

    await client.query('BEGIN')
    transactionStarted = true
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [PRODUCTION_MIGRATION_LOCK_NAME])
    const batch = await nextMigrationBatch(client, schema)
    for (const migration of migrations) {
      await migration.apply(client, schema)
      await recordMigration(client, schema, migration.name, batch)
    }

    await client.query('COMMIT')
    transactionStarted = false
    for (const migration of migrations) {
      console.log(`JPV_PAYLOAD_MIGRATION_APPLIED ${migration.name}`)
    }
  } catch (error) {
    if (transactionStarted) await client.query('ROLLBACK').catch(() => undefined)
    throw error
  } finally {
    await client.end().catch(() => undefined)
  }
}

async function applyMembershipSupportMigration(client, schema) {
  for (const definition of RELATION_TABLES) {
    await ensureRelationTable(client, schema, definition)
  }
}

async function applyNotificationEventKeyMigration(client, migrationSchema) {
  const schemaIdentifier = quoteIdentifier(migrationSchema)
  if (!await tableExists(client, migrationSchema, 'payload_member_notifications')) {
    throw new Error('JPV_PAYLOAD_MIGRATION_FAILED member notifications table is missing')
  }

  await client.query(`
    ALTER TABLE ${schemaIdentifier}."payload_member_notifications"
      ADD COLUMN IF NOT EXISTS "event_key" varchar
  `)
  const duplicateEventKey = await client.query(`
    SELECT "event_key"
    FROM ${schemaIdentifier}."payload_member_notifications"
    WHERE "event_key" IS NOT NULL
    GROUP BY "event_key"
    HAVING COUNT(*) > 1
    LIMIT 1
  `)
  if (duplicateEventKey.rows.length > 0) {
    throw new Error('JPV_PAYLOAD_MIGRATION_FAILED duplicate notification event keys exist')
  }
  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS "payload_member_notifications_event_key_idx"
      ON ${schemaIdentifier}."payload_member_notifications" ("event_key")
      WHERE "event_key" IS NOT NULL
  `)
}

async function applyMemberFollowsMigration(client, migrationSchema) {
  const schemaIdentifier = quoteIdentifier(migrationSchema)
  const followsIdentifier = quoteIdentifier('payload_member_follows')
  const membersIdentifier = quoteIdentifier('payload_members')
  const lockedDocumentsRelationsIdentifier = quoteIdentifier('payload_locked_documents_rels')

  if (!await tableExists(client, migrationSchema, 'payload_members')) {
    throw new Error('JPV_PAYLOAD_MIGRATION_FAILED members table is missing')
  }
  if (!await tableExists(client, migrationSchema, 'payload_locked_documents_rels')) {
    throw new Error('JPV_PAYLOAD_MIGRATION_FAILED locked documents relationship table is missing')
  }

  await client.query(`
    CREATE TABLE IF NOT EXISTS ${schemaIdentifier}.${followsIdentifier} (
      "id" serial PRIMARY KEY NOT NULL,
      "follower_member_id" integer NOT NULL,
      "followed_member_id" integer NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      CONSTRAINT "payload_member_follows_not_self" CHECK ("follower_member_id" <> "followed_member_id")
    )
  `)
  const columns = await tableColumns(client, migrationSchema, 'payload_member_follows')
  const requiredColumns = ['id', 'follower_member_id', 'followed_member_id', 'updated_at', 'created_at']
  if (requiredColumns.some((column) => !columns.has(column))) {
    throw new Error('JPV_PAYLOAD_MIGRATION_FAILED member follows schema is incompatible; manual intervention required')
  }

  const selfFollow = await client.query(`
    SELECT 1
    FROM ${schemaIdentifier}.${followsIdentifier}
    WHERE "follower_member_id" = "followed_member_id"
    LIMIT 1
  `)
  if (selfFollow.rows.length > 0) {
    throw new Error('JPV_PAYLOAD_MIGRATION_FAILED self-follow rows exist')
  }
  const duplicateFollow = await client.query(`
    SELECT "follower_member_id", "followed_member_id"
    FROM ${schemaIdentifier}.${followsIdentifier}
    GROUP BY "follower_member_id", "followed_member_id"
    HAVING COUNT(*) > 1
    LIMIT 1
  `)
  if (duplicateFollow.rows.length > 0) {
    throw new Error('JPV_PAYLOAD_MIGRATION_FAILED duplicate member follow rows exist')
  }
  const orphanedFollower = await client.query(`
    SELECT 1
    FROM ${schemaIdentifier}.${followsIdentifier} follow_record
    LEFT JOIN ${schemaIdentifier}.${membersIdentifier} member_record
      ON member_record."id" = follow_record."follower_member_id"
    WHERE member_record."id" IS NULL
    LIMIT 1
  `)
  if (orphanedFollower.rows.length > 0) {
    throw new Error('JPV_PAYLOAD_MIGRATION_FAILED orphaned follower rows exist')
  }
  const orphanedFollowedMember = await client.query(`
    SELECT 1
    FROM ${schemaIdentifier}.${followsIdentifier} follow_record
    LEFT JOIN ${schemaIdentifier}.${membersIdentifier} member_record
      ON member_record."id" = follow_record."followed_member_id"
    WHERE member_record."id" IS NULL
    LIMIT 1
  `)
  if (orphanedFollowedMember.rows.length > 0) {
    throw new Error('JPV_PAYLOAD_MIGRATION_FAILED orphaned followed-member rows exist')
  }

  if (!await constraintExists(client, migrationSchema, 'payload_member_follows', 'payload_member_follows_not_self')) {
    await client.query(`
      ALTER TABLE ${schemaIdentifier}.${followsIdentifier}
        ADD CONSTRAINT "payload_member_follows_not_self"
        CHECK ("follower_member_id" <> "followed_member_id")
    `)
  }
  if (!await constraintExists(client, migrationSchema, 'payload_member_follows', 'payload_member_follows_follower_member_id_payload_members_id_fk')) {
    await client.query(`
      ALTER TABLE ${schemaIdentifier}.${followsIdentifier}
        ADD CONSTRAINT "payload_member_follows_follower_member_id_payload_members_id_fk"
        FOREIGN KEY ("follower_member_id") REFERENCES ${schemaIdentifier}.${membersIdentifier}("id") ON DELETE CASCADE ON UPDATE no action
    `)
  }
  if (!await constraintExists(client, migrationSchema, 'payload_member_follows', 'payload_member_follows_followed_member_id_payload_members_id_fk')) {
    await client.query(`
      ALTER TABLE ${schemaIdentifier}.${followsIdentifier}
        ADD CONSTRAINT "payload_member_follows_followed_member_id_payload_members_id_fk"
        FOREIGN KEY ("followed_member_id") REFERENCES ${schemaIdentifier}.${membersIdentifier}("id") ON DELETE CASCADE ON UPDATE no action
    `)
  }
  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS "payload_member_follows_follower_followed_unique_idx"
      ON ${schemaIdentifier}.${followsIdentifier} ("follower_member_id", "followed_member_id")
  `)
  await client.query(`
    CREATE INDEX IF NOT EXISTS "payload_member_follows_follower_idx"
      ON ${schemaIdentifier}.${followsIdentifier} USING btree ("follower_member_id")
  `)
  await client.query(`
    CREATE INDEX IF NOT EXISTS "payload_member_follows_followed_idx"
      ON ${schemaIdentifier}.${followsIdentifier} USING btree ("followed_member_id")
  `)
  await client.query(`
    CREATE INDEX IF NOT EXISTS "payload_member_follows_created_at_idx"
      ON ${schemaIdentifier}.${followsIdentifier} USING btree ("created_at")
  `)
  await client.query(`
    ALTER TABLE ${schemaIdentifier}.${lockedDocumentsRelationsIdentifier}
      ADD COLUMN IF NOT EXISTS "payload_member_follows_id" integer
  `)
  const orphanedLockedDocumentRelation = await client.query(`
    SELECT 1
    FROM ${schemaIdentifier}.${lockedDocumentsRelationsIdentifier} locked_relation
    LEFT JOIN ${schemaIdentifier}.${followsIdentifier} follow_record
      ON follow_record."id" = locked_relation."payload_member_follows_id"
    WHERE locked_relation."payload_member_follows_id" IS NOT NULL
      AND follow_record."id" IS NULL
    LIMIT 1
  `)
  if (orphanedLockedDocumentRelation.rows.length > 0) {
    throw new Error('JPV_PAYLOAD_MIGRATION_FAILED orphaned locked-document follow rows exist')
  }
  if (!await constraintExists(client, migrationSchema, 'payload_locked_documents_rels', 'payload_locked_documents_rels_member_follows_fk')) {
    await client.query(`
      ALTER TABLE ${schemaIdentifier}.${lockedDocumentsRelationsIdentifier}
        ADD CONSTRAINT "payload_locked_documents_rels_member_follows_fk"
        FOREIGN KEY ("payload_member_follows_id") REFERENCES ${schemaIdentifier}.${followsIdentifier}("id") ON DELETE CASCADE ON UPDATE no action
    `)
  }
  await client.query(`
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_member_follows_id_idx"
      ON ${schemaIdentifier}.${lockedDocumentsRelationsIdentifier} USING btree ("payload_member_follows_id")
  `)
}

try {
  const { databaseUrl, schema } = validateProductionDatabaseBoundary()
  await runReviewedMigrations(databaseUrl, schema, [
    { name: MIGRATION_NAME, apply: applyMembershipSupportMigration },
    { name: NOTIFICATION_EVENT_KEY_MIGRATION_NAME, apply: applyNotificationEventKeyMigration },
    { name: MEMBER_FOLLOWS_MIGRATION_NAME, apply: applyMemberFollowsMigration },
  ])
} catch (error) {
  console.error(error instanceof Error ? error.message : 'JPV_PAYLOAD_MIGRATION_FAILED unknown error')
  process.exitCode = 1
}
