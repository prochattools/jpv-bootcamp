import { NextRequest, NextResponse } from 'next/server'
import { sendSupportEmail } from '@/lib/email'

// Support emails reuse the canonical Resend helpers in src/lib/email.ts.
const RATE_LIMIT_WINDOW_MS = 60_000
const lastSupportRequestByIp = new Map<string, number>()

function getClientIp(req: NextRequest): string {
	const forwardedFor = req.headers.get('x-forwarded-for')
	if (forwardedFor) {
		return forwardedFor.split(',')[0]?.trim() || 'unknown'
	}

	return (
		req.headers.get('x-real-ip') ??
		req.headers.get('cf-connecting-ip') ??
		req.headers.get('true-client-ip') ??
		'unknown'
	)
}

function isValidEmail(value: string): boolean {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export async function POST(req: NextRequest) {
	let body: unknown

	try {
		body = await req.json()
	} catch {
		return NextResponse.json(
			{ ok: false, error: 'Invalid JSON payload.' },
			{ status: 400 }
		)
	}

	if (!body || typeof body !== 'object') {
		return NextResponse.json(
			{ ok: false, error: 'Invalid request payload.' },
			{ status: 400 }
		)
	}

	const { name, email, question, source, page } = body as Record<string, unknown>
	const normalizedName = typeof name === 'string' ? name.trim() : ''
	const normalizedEmail = typeof email === 'string' ? email.trim() : ''
	const normalizedQuestion = typeof question === 'string' ? question.trim() : ''
	const normalizedSource =
		typeof source === 'string' && source.trim() ? source.trim() : 'unknown'
	const normalizedPage =
		typeof page === 'string' && page.trim() ? page.trim() : 'unknown'

	if (normalizedName.length < 2) {
		return NextResponse.json(
			{ ok: false, error: 'Name must be at least 2 characters.' },
			{ status: 400 }
		)
	}

	if (!isValidEmail(normalizedEmail)) {
		return NextResponse.json(
			{ ok: false, error: 'Please provide a valid email address.' },
			{ status: 400 }
		)
	}

	if (normalizedQuestion.length < 10) {
		return NextResponse.json(
			{ ok: false, error: 'Question must be at least 10 characters.' },
			{ status: 400 }
		)
	}

	const ip = getClientIp(req)
	const now = Date.now()
	const lastRequestAt = lastSupportRequestByIp.get(ip)

	if (lastRequestAt && now - lastRequestAt < RATE_LIMIT_WINDOW_MS) {
		return NextResponse.json(
			{
				ok: false,
				error: 'Please wait a moment before sending another support request.',
			},
			{ status: 429 }
		)
	}

	lastSupportRequestByIp.set(ip, now)

	try {
		if (process.env.NODE_ENV !== 'production') {
			console.log('[support] resendKeyPresent', Boolean(process.env.RESEND_API_KEY))
			console.log('[support] resendKeyLen', process.env.RESEND_API_KEY?.length ?? 0)
			console.log(
				'[support] resendBaseUrl',
				process.env.RESEND_BASE_URL ?? 'https://api.resend.com'
			)
			console.log('[support] resendAuthHeaderSet', Boolean(process.env.RESEND_API_KEY))
			console.log('[support] resendUsesSdk', true)
		}

		await sendSupportEmail({
			name: normalizedName,
			email: normalizedEmail,
			question: normalizedQuestion,
			source: normalizedSource,
			page: normalizedPage,
			submittedAt: new Date().toISOString(),
		})

		return NextResponse.json({ ok: true })
	} catch (error) {
		console.error('Support email send failed:', error)
		const message =
			error instanceof Error &&
			(error.message.startsWith('Support sender missing') ||
				error.message.startsWith('Support recipient missing') ||
				error.message.startsWith('FROM must be a verified domain'))
				? error.message
				: 'Failed to send support request. Please try again.'
		return NextResponse.json({ ok: false, error: message }, { status: 500 })
	}
}
