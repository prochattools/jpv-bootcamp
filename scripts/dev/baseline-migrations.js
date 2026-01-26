#!/usr/bin/env node
// Baseline Prisma migrations in development when the target schema is not empty.

const { Client } = require('pg')
const { spawnSync } = require('node:child_process')
const fs = require('fs')
const path = require('path')

if (process.env.NODE_ENV === 'production') {
  process.exit(0)
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

function readPrismaSchemas() {
  const prismaPath = path.join(process.cwd(), 'prisma', 'schema.prisma')
  if (!fs.existsSync(prismaPath)) return ['public']
  const content = fs.readFileSync(prismaPath, 'utf8')
  const schemas = new Set(['public'])

  const listMatch = content.match(/schemas\s*=\s*\[([^\]]+)\]/)
  if (listMatch && listMatch[1]) {
    const parts = listMatch[1]
      .split(',')
      .map((value) => value.replace(/["'\s]/g, ''))
      .filter(Boolean)
    for (const part of parts) {
      schemas.add(part)
    }
  }

  const regex = /@@schema\(["']([^"']+)["']\)/g
  let match = null
  while ((match = regex.exec(content))) {
    if (match[1]) {
      schemas.add(match[1])
    }
  }

  return Array.from(schemas)
}

function listMigrationDirs() {
  const migrationsDir = path.join(process.cwd(), 'prisma', 'migrations')
  if (!fs.existsSync(migrationsDir)) return []
  return fs
    .readdirSync(migrationsDir)
    .filter((name) => name && !name.startsWith('.') && fs.statSync(path.join(migrationsDir, name)).isDirectory())
    .sort()
}

function run(command, args, env) {
  const result = spawnSync(command, args, { stdio: 'inherit', env })
  if (result.error) {
    console.error(`Failed to run ${command}:`, result.error.message)
    process.exit(1)
  }
  if (typeof result.status === 'number' && result.status !== 0) {
    process.exit(result.status)
  }
}

async function main() {
  const envPath = path.join(process.cwd(), '.env')
  const envFile = loadEnvFile(envPath)
  const adminUrl =
    process.env.SYSTEM_DATABASE_URL ||
    envFile.SYSTEM_DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5433/postgres?schema=public'
  const tenantUrl =
    process.env.DATABASE_URL ||
    envFile.DATABASE_URL

  if (!tenantUrl) {
    console.log('ℹ️ No DATABASE_URL set; skipping migration baseline.')
    return
  }

  const targetSchemas = readPrismaSchemas()
  const tenantSchema =
    targetSchemas.find((schemaName) => schemaName.startsWith('tenant_')) ||
    (new URL(tenantUrl)).searchParams.get('schema') ||
    'public'

  const client = new Client({ connectionString: adminUrl })
  await client.connect()

  try {
    const tableCheck = await client.query(
      `SELECT table_schema
         FROM information_schema.tables
        WHERE table_name = '_prisma_migrations'
          AND table_schema = $1`,
      [tenantSchema]
    )
    if (tableCheck.rows.length > 0) {
      return
    }

    const tables = await client.query(
      `SELECT COUNT(*)::int as count
         FROM information_schema.tables
        WHERE table_schema = ANY($1::text[])
          AND table_type = 'BASE TABLE'
          AND table_name <> '_prisma_migrations'`
      ,
      [targetSchemas]
    )

    if ((tables.rows[0]?.count || 0) === 0) {
      return
    }

    const migrations = listMigrationDirs()
    if (migrations.length === 0) {
      return
    }

    console.log('ℹ️ Baseline: syncing schema with prisma db push before marking migrations applied.')
    const prismaCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx'

    const parsedAdminUrl = new URL(adminUrl)
    const shadowDbName = 'prisma_shadow_dev'
    const shadowExists = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [shadowDbName]
    )
    if (shadowExists.rowCount === 0) {
      await client.query(`CREATE DATABASE "${shadowDbName}"`)
    }

    parsedAdminUrl.pathname = `/${shadowDbName}`
    parsedAdminUrl.search = '?schema=public'

    const pushEnv = {
      ...process.env,
      DATABASE_URL: tenantUrl,
      SYSTEM_DATABASE_URL: parsedAdminUrl.toString()
    }
    run(
      prismaCmd,
      ['prisma', 'db', 'push', '--schema=prisma/schema.prisma', '--skip-generate'],
      pushEnv
    )

    console.log(`ℹ️ Baseline: marking ${migrations.length} migrations as applied.`)
    const resolveEnv = { ...process.env, DATABASE_URL: tenantUrl }
    for (const name of migrations) {
      run(
        prismaCmd,
        ['prisma', 'migrate', 'resolve', '--schema=prisma/schema.prisma', '--applied', name],
        resolveEnv
      )
    }

    const verify = await client.query(
      `SELECT to_regclass($1) as table_name`,
      [`${tenantSchema}._prisma_migrations`]
    )
    if (!verify.rows[0]?.table_name) {
      throw new Error(`_prisma_migrations not found in schema ${tenantSchema} after baseline`)
    }
  } finally {
    await client.end().catch(() => {})
  }
}

main().catch((err) => {
  console.error('❌ Failed to baseline migrations:', err)
  process.exit(1)
})
