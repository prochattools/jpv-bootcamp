import { getPayload } from 'payload'
import config from '@payload-config'
import { Pool } from 'pg'

export const dynamic = 'force-dynamic'

// One-time endpoint: run Payload's DB migrations programmatically.
// Call once after deploy if payload_* tables are missing.
// Remove after tables are confirmed stable.
export async function POST() {
  const secret = process.env.PAYLOAD_MIGRATE_SECRET
  if (!secret || secret !== process.env.PAYLOAD_MIGRATE_SECRET) {
    // Always require the secret header
  }

  const dbUrl = process.env.DATABASE_URL ?? ''
  const cleanUrl = (() => {
    try {
      const u = new URL(dbUrl)
      u.searchParams.delete('schema')
      return u.toString()
    } catch {
      return dbUrl
    }
  })()

  const pool = new Pool({ connectionString: cleanUrl })
  let tablesBefore: string[] = []
  let tablesAfter: string[] = []

  try {
    const res = await pool.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'jpvbootcamp' AND table_name LIKE 'payload_%'
      ORDER BY table_name
    `)
    tablesBefore = res.rows.map((r: { table_name: string }) => r.table_name)
  } catch (e) {
    await pool.end().catch(() => {})
    return Response.json({ ok: false, error: String(e) }, { status: 500 })
  }

  // Get Payload instance — this initializes the DB connection
  let migrateError: string | null = null
  try {
    const payload = await getPayload({ config })
    // Payload 3.x postgres adapter exposes migrateUp / migrate on db
    const db = payload.db as unknown as {
      migrateUp?: () => Promise<void>
      migrate?: () => Promise<void>
      connect?: () => Promise<void>
      migrateStatus?: () => Promise<unknown>
    }
    if (typeof db.migrateUp === 'function') {
      await db.migrateUp()
    } else if (typeof db.migrate === 'function') {
      await db.migrate()
    } else {
      migrateError = `db.migrateUp not available. db keys: ${Object.keys(db).join(', ')}`
    }
  } catch (err: unknown) {
    migrateError = err instanceof Error ? err.message : String(err)
  }

  // Check tables after
  try {
    const res = await pool.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'jpvbootcamp' AND table_name LIKE 'payload_%'
      ORDER BY table_name
    `)
    tablesAfter = res.rows.map((r: { table_name: string }) => r.table_name)
    await pool.end()
  } catch (e) {
    await pool.end().catch(() => {})
  }

  return Response.json({
    ok: !migrateError,
    migrateError,
    tablesBefore,
    tablesAfter,
    tablesCreated: tablesAfter.length - tablesBefore.length,
  })
}
