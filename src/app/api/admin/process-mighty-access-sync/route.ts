import { timingSafeEqual } from 'node:crypto'

import { processMightyAccessSync } from '@/lib/mighty/accessSync'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function json(body: unknown, status = 200): Response {
	return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

function authorized(request: Request, secret: string): boolean {
	const header = request.headers.get('authorization') ?? ''
	const token = header.startsWith('Bearer ') ? header.slice(7) : ''
	const actual = Buffer.from(token)
	const expected = Buffer.from(secret)
	return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export async function POST(request: Request): Promise<Response> {
	const secret = process.env.MIGHTY_ACCESS_SYNC_WORKER_SECRET?.trim()
	if (!secret) return json({ ok: false, error: 'not_configured' }, 500)
	if (!authorized(request, secret)) return json({ ok: false, error: 'unauthorized' }, 401)

	let limit = 25
	if ((request.headers.get('content-type') ?? '').includes('application/json')) {
		try {
			const body = await request.json() as { limit?: unknown }
			if (typeof body.limit === 'number' && Number.isInteger(body.limit) && body.limit > 0) {
				limit = Math.min(body.limit, 100)
			}
		} catch {
			return json({ ok: false, error: 'invalid_json' }, 400)
		}
	}

	try {
		return json({ ok: true, ...(await processMightyAccessSync(limit)) })
	} catch (error) {
		console.error('mighty_access_sync_worker_failed', {
			error: error instanceof Error ? error.name : 'unknown_error',
		})
		return json({ ok: false, error: 'processing_failed' }, 500)
	}
}
