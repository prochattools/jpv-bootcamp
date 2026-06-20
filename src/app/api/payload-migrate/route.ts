import { getPayload } from 'payload'
import config from '@payload-config'
import { Pool } from 'pg'

export const dynamic = 'force-dynamic'

// Called by deploy-prod.sh after Prisma migrations to create payload_* tables.
// Uses migrateUp() which runs registered migration files (src/migrations/index.ts).
// Safe to call multiple times — already-applied migrations are skipped.
// Remove after feature/payload-v2 is stable in production.
export async function POST() {
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
  const queryTables = async () => {
    const res = await pool.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'jpvbootcamp' AND table_name LIKE 'payload_%'
      ORDER BY table_name
    `)
    return res.rows.map((r: { table_name: string }) => r.table_name)
  }

  let tablesBefore: string[] = []
  try {
    tablesBefore = await queryTables()
  } catch (e) {
    await pool.end().catch(() => {})
    return Response.json({ ok: false, error: `DB query failed: ${String(e)}` }, { status: 500 })
  }

  let migrateError: string | null = null
  try {
    const payload = await getPayload({ config })
    const db = payload.db as unknown as { migrateUp: () => Promise<void> }
    await db.migrateUp()
  } catch (err: unknown) {
    migrateError = err instanceof Error ? err.message : String(err)
  }

  let tablesAfter: string[] = []
  try {
    tablesAfter = await queryTables()
    await pool.end()
  } catch {
    await pool.end().catch(() => {})
  }

  return Response.json({
    ok: !migrateError,
    migrateError,
    tablesBefore,
    tablesAfter,
    tablesCreated: tablesAfter.length - tablesBefore.length,
  }, { status: migrateError ? 500 : 200 })
}
