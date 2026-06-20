import { getPayload } from 'payload'
import config from '@payload-config'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const payload = await getPayload({ config })
    const collections = Object.keys(payload.config.collections ?? {})
    return Response.json({ ok: true, collections })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? err.stack : undefined
    return Response.json({ ok: false, error: message, stack }, { status: 500 })
  }
}
