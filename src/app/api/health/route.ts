import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/health
 *
 * Lightweight liveness probe used by load balancers, uptime monitors,
 * and staging smoke tests.  Returns 200 when the process is running.
 *
 * For a richer deployment check (import maps, email readiness, migration
 * inventory) use GET /api/health/deployment instead.
 */
export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      status: 'live',
      timestamp: new Date().toISOString(),
      imageTag: process.env.IMAGE_TAG ?? null,
    },
    { status: 200 },
  )
}
