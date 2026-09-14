import { timingSafeEqual } from 'node:crypto'

import { getStripe } from '@/lib/stripe'
import {
	bootstrapMightyAccessSync,
	PHASE_A_BOOTSTRAP_EMAIL,
	PHASE_A_BOOTSTRAP_PLAN_ID,
} from '@/lib/mighty/bootstrap'

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

function isExactProductionConfiguration(): boolean {
	return (
		process.env.MIGHTY_PROVIDER_ENV?.trim().toLowerCase() === 'production' &&
		process.env.MIGHTY_PRODUCTION_TEST_EMAIL?.trim().toLowerCase() === PHASE_A_BOOTSTRAP_EMAIL &&
		process.env.MIGHTY_ACCESS_PLAN_ID?.trim() === String(PHASE_A_BOOTSTRAP_PLAN_ID)
	)
}

export async function POST(request: Request): Promise<Response> {
	const secret = process.env.MIGHTY_ACCESS_SYNC_WORKER_SECRET?.trim()
	if (!secret) return json({ ok: false, error: 'not_configured' }, 500)
	if (!authorized(request, secret)) return json({ ok: false, error: 'unauthorized' }, 401)
	if (!isExactProductionConfiguration()) return json({ ok: false, error: 'bootstrap_not_configured' }, 503)

	let body: unknown
	try {
		body = await request.json()
	} catch {
		return json({ ok: false, error: 'invalid_json' }, 400)
	}
	if (!body || typeof body !== 'object') return json({ ok: false, error: 'invalid_request' }, 400)
	const record = body as Record<string, unknown>
	if (Object.keys(record).length !== 1 || typeof record.email !== 'string') {
		return json({ ok: false, error: 'exact_email_required' }, 400)
	}
	if (record.email.trim().toLowerCase() !== PHASE_A_BOOTSTRAP_EMAIL) {
		return json({ ok: false, error: 'email_not_authorized' }, 403)
	}

	try {
		const result = await bootstrapMightyAccessSync({ email: record.email, stripe: getStripe() })
		return json({
			ok: true,
			queued: result.queued,
			reason: result.reason,
			rowId: result.rowId,
			desiredAccess: result.desiredAccess,
			stateSource: result.stateSource,
			stateObservedAt: result.stateObservedAt.toISOString(),
		})
	} catch (error) {
		console.error('mighty_access_sync_bootstrap_failed', {
			error: error instanceof Error ? error.name : 'unknown_error',
			code: error instanceof Error && 'code' in error ? (error as { code?: unknown }).code : undefined,
		})
		return json({ ok: false, error: 'bootstrap_failed' }, 502)
	}
}
