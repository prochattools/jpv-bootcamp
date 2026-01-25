import { NextResponse } from 'next/server'
import {
	getSponsoredSeatCounts,
	getSponsoredPriceId,
	resolveSponsoredCheckoutMode,
} from '@/lib/sponsored-seats'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
	const counts = await getSponsoredSeatCounts()
	const mode = resolveSponsoredCheckoutMode()
	return NextResponse.json({
		...counts,
		proEnabled: Boolean(getSponsoredPriceId({ tier: 'pro', mode })),
		vipEnabled: Boolean(getSponsoredPriceId({ tier: 'vip', mode })),
	})
}
