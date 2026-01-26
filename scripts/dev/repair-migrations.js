#!/usr/bin/env node
// Repair failed Prisma migrations in development only.

const { Client } = require('pg')
const { spawnSync } = require('node:child_process')
const fs = require('fs')
const path = require('path')

if (process.env.NODE_ENV === 'production') {
  process.exit(0)
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', env: process.env })
  if (result.error) {
    console.error(`Failed to run ${command}:`, result.error.message)
    process.exit(1)
  }
  if (typeof result.status === 'number' && result.status !== 0) {
    process.exit(result.status)
  }
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

async function main() {
  const envPath = path.join(process.cwd(), '.env')
  const envFile = loadEnvFile(envPath)
  const connectionString =
    process.env.SYSTEM_DATABASE_URL ||
    process.env.DATABASE_URL ||
    envFile.SYSTEM_DATABASE_URL ||
    envFile.DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5433/postgres?schema=public'

  const client = new Client({ connectionString })
  await client.connect()

  try {
    const schemasResult = await client.query(
      `SELECT table_schema
         FROM information_schema.tables
        WHERE table_name = '_prisma_migrations'`
    )
    const schemas = schemasResult.rows.map((row) => row.table_schema).filter(Boolean)
    if (schemas.length === 0) {
      console.log('ℹ️ No _prisma_migrations table found; skipping migration repair.')
      return
    }

    let totalFixed = 0
    for (const schema of schemas) {
      const failed = await client.query(
        `SELECT migration_name
           FROM ${schema}._prisma_migrations
          WHERE finished_at IS NULL
            AND rolled_back_at IS NULL
          ORDER BY started_at ASC`
      )
      if (failed.rows.length === 0) continue

      for (const row of failed.rows) {
        const name = row.migration_name
        if (!name) continue
        console.log(`ℹ️ Marking failed migration as rolled back in ${schema}: ${name}`)
        await client.query(
          `UPDATE ${schema}._prisma_migrations
              SET rolled_back_at = NOW()
            WHERE migration_name = $1
              AND finished_at IS NULL
              AND rolled_back_at IS NULL`,
          [name]
        )
        totalFixed += 1
      }
    }

    if (totalFixed === 0) {
      return
    }
  } finally {
    await client.end().catch(() => {})
  }
}

main().catch((err) => {
  console.error('❌ Failed to repair migrations:', err)
  process.exit(1)
})
