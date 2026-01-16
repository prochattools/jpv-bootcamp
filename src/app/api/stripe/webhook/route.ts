/**
 * Disabled alias to avoid Stripe hitting the wrong handler.
 * Use /api/webhook/stripe instead.
 */
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST() {
	return NextResponse.json({ error: 'Use /api/webhook/stripe' }, { status: 404 })
}
