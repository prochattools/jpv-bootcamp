#!/usr/bin/env node
// Remove legacy runtime tables from public schema and enforce tenant isolation.

const { Client } = require('pg')
const fs = require('fs')
const path = require('path')

function fail(message) {
  console.error(`❌ ${message}`)
  process.exit(1)
}

function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return {}
  const lines = fs
    .readFileSync(envPath, 'utf8')
    .split('\n')
    .filter((l) => l.trim().length > 0 && !l.trim().startsWith('#'))

  const map = {}
  for (const line of lines) {
    const idx = line.indexOf('=')
    if (idx <= 0) continue
    const key = line.slice(0, idx).trim()
    const value = line.slice(idx + 1).trim()
    map[key] = value
  }
  return map
}

function isSafeSchemaName(name) {
  return /^[a-z0-9_]+$/.test(name)
}

async function tableExists(client, schema, table) {
  const res = await client.query(
    `SELECT 1
       FROM information_schema.tables
      WHERE table_schema = $1 AND table_name = $2`,
    [schema, table]
  )
  return res.rowCount > 0
}

async function columnExists(client, schema, table, column) {
  const res = await client.query(
    `SELECT 1
       FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = $2 AND column_name = $3`,
    [schema, table, column]
  )
  return res.rowCount > 0
}

async function main() {
  const envPath = path.join(process.cwd(), '.env')
  const envFile = loadEnvFile(envPath)

  const systemUrl =
    process.env.SYSTEM_DATABASE_URL ||
    envFile.SYSTEM_DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5433/postgres?schema=public'

  const databaseUrl = process.env.DATABASE_URL || envFile.DATABASE_URL
  if (!databaseUrl) {
    fail('DATABASE_URL is required (tenant connection) to determine schema/user.')
  }

  const parsedDbUrl = new URL(databaseUrl)
  const tenantSchema = parsedDbUrl.searchParams.get('schema')
  const tenantUser = parsedDbUrl.username

  if (!tenantSchema || !tenantUser) {
    fail('Could not derive tenant schema/user from DATABASE_URL.')
  }

  if (!isSafeSchemaName(tenantSchema)) {
    fail(`Unsafe tenant schema name: ${tenantSchema}`)
  }

  const client = new Client({ connectionString: systemUrl })
  await client.connect()

  try {
    const publicTables = [
      { name: 'Audiences', columns: ['id', 'resend_id', 'name'] },
      {
        name: 'Project',
        columns: [
          'id',
          'connection_id',
          'webhook_id',
          'scenario_id',
          'user_clerk_id',
          'type',
          'status',
          'createdAt',
          'updatedAt',
          'assistant_id',
          'webhookLink',
        ],
      },
      {
        name: 'Subscription',
        columns: [
          'id',
          'user_email',
          'sub_status',
          'sub_type',
          'createdAt',
          'updatedAt',
          'last_stripe_cs_id',
          'stripe_customer_id',
          'sub_stripe_id',
          'user_clerk_id',
        ],
      },
      {
        name: 'email_subscribers',
        columns: ['id', 'email', 'name', 'source', 'createdAt', 'updatedAt'],
      },
    ]

    // Ensure tenant enum exists before copying Subscription rows.
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
            FROM pg_type t
            JOIN pg_namespace n ON n.oid = t.typnamespace
           WHERE n.nspname = '${tenantSchema}'
             AND t.typname = 'SubscriptionStatus'
        ) THEN
          CREATE TYPE "${tenantSchema}"."SubscriptionStatus" AS ENUM ('active', 'inactive');
        END IF;
      END $$;
    `)

    for (const table of publicTables) {
      const publicExists = await tableExists(client, 'public', table.name)
      if (!publicExists) continue

      const tenantExists = await tableExists(client, tenantSchema, table.name)
      if (!tenantExists) {
        console.warn(
          `⚠️ Skipping ${table.name}: tenant table ${tenantSchema}.${table.name} not found.`
        )
        continue
      }

      const columnList = table.columns.map((col) => `"${col}"`).join(', ')
      if (table.name === 'Subscription') {
        await client.query(
          `INSERT INTO "${tenantSchema}"."${table.name}" (${columnList})
           SELECT
             "id",
             "user_email",
             "sub_status"::text::"${tenantSchema}"."SubscriptionStatus",
             "sub_type",
             "createdAt",
             "updatedAt",
             "last_stripe_cs_id",
             "stripe_customer_id",
             "sub_stripe_id",
             "user_clerk_id"
           FROM "public"."${table.name}"
           ON CONFLICT DO NOTHING;`
        )
      } else {
        await client.query(
          `INSERT INTO "${tenantSchema}"."${table.name}" (${columnList})
           SELECT ${columnList} FROM "public"."${table.name}"
           ON CONFLICT DO NOTHING;`
        )
      }

      await client.query(`DROP TABLE "public"."${table.name}"`)
      console.log(`✅ Dropped public.${table.name}`)
    }

    // Handle stripe_webhook_events separately for schema differences.
    if (await tableExists(client, 'public', 'stripe_webhook_events')) {
      if (await tableExists(client, tenantSchema, 'stripe_webhook_events')) {
        const publicHasReceivedAt = await columnExists(
          client,
          'public',
          'stripe_webhook_events',
          'received_at'
        )
        const publicHasCreatedAt = await columnExists(
          client,
          'public',
          'stripe_webhook_events',
          'created_at'
        )
        const publicHasType = await columnExists(
          client,
          'public',
          'stripe_webhook_events',
          'type'
        )

        const receivedCol = publicHasReceivedAt
          ? '"received_at"'
          : publicHasCreatedAt
          ? '"created_at"'
          : 'CURRENT_TIMESTAMP'
        const typeCol = publicHasType ? 'COALESCE("type",\'unknown\')' : '\'unknown\''

        await client.query(
          `INSERT INTO "${tenantSchema}"."stripe_webhook_events" (
            "event_id",
            "received_at",
            "type",
            "livemode",
            "processed_at",
            "payload"
          )
          SELECT
            "event_id",
            ${receivedCol},
            ${typeCol},
            false,
            NULL,
            NULL
          FROM "public"."stripe_webhook_events"
          ON CONFLICT DO NOTHING;`
        )
      }

      await client.query('DROP TABLE "public"."stripe_webhook_events"')
      console.log('✅ Dropped public.stripe_webhook_events')
    }

    await client.query('DROP TYPE IF EXISTS "public"."SubscriptionStatus"')

    // Enforce isolation: no public privileges + strict search_path.
    await client.query(`ALTER ROLE "${tenantUser}" SET search_path = "${tenantSchema}", pg_catalog`)
    await client.query(`REVOKE ALL ON SCHEMA public FROM "${tenantUser}"`)
    await client.query(`REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM "${tenantUser}"`)
    await client.query(`REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM "${tenantUser}"`)
    await client.query(`REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public FROM "${tenantUser}"`)
    await client.query(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM "${tenantUser}"`
    )
    await client.query(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM "${tenantUser}"`
    )
    await client.query(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM "${tenantUser}"`
    )

    console.log('✅ Public runtime cleanup + isolation enforcement complete.')
  } finally {
    await client.end().catch(() => {})
  }
}

main().catch((err) => {
  console.error('❌ Cleanup failed:', err)
  process.exit(1)
})
