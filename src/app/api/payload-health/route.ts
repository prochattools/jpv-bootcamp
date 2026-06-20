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

  const pool = new Pool({ connectionString: cleanUrl })
  let tables: string[] = []
  try {
    const res = await pool.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'jpvbootcamp' AND table_name LIKE 'payload_%'
      ORDER BY table_name
    `)
    tables = res.rows.map((r: { table_name: string }) => r.table_name)
    await pool.end()
  } catch {
    await pool.end().catch(() => {})
  }

  try {
    const payload = await getPayload({ config })
    const collections = Object.keys(payload.config.collections ?? {})
    return Response.json({ ok: true, collections, tables })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return Response.json({ ok: false, error: message, tables }, { status: 500 })
  }
}
