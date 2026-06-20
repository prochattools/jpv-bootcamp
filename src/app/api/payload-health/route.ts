import { getPayload } from 'payload'
import config from '@payload-config'
import { Pool } from 'pg'

export const dynamic = 'force-dynamic'

export async function GET() {
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

  // Check if payload tables exist in the DB
  let tablesExist = false
  let tableCheckError: string | null = null
  const pool = new Pool({ connectionString: cleanUrl })
  try {
    const res = await pool.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'jpvbootcamp' AND table_name LIKE 'payload_%'
      ORDER BY table_name
    `)
    tablesExist = res.rows.length > 0
    const tables = res.rows.map((r: { table_name: string }) => r.table_name)
    await pool.end()

    // Try Payload init too
    try {
      const payload = await getPayload({ config })
      const collections = Object.keys(payload.config.collections ?? {})
      return Response.json({ ok: true, collections, tablesExist, tables })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      const stack = err instanceof Error ? err.stack?.split('\n').slice(0, 5).join('\n') : undefined
      return Response.json({ ok: false, error: message, stack, tablesExist, tables }, { status: 500 })
    }
  } catch (err: unknown) {
    tableCheckError = err instanceof Error ? err.message : String(err)
    try { await pool.end() } catch {}
    return Response.json({ ok: false, tableCheckError }, { status: 500 })
  }
}
