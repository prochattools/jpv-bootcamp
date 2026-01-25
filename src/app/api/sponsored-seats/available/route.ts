import { NextResponse } from 'next/server'
import { getSponsoredSeatCounts, getSponsoredSeatPriceId } from '@/lib/sponsored-seats'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
	const counts = await getSponsoredSeatCounts()
	return NextResponse.json({
		...counts,
		proEnabled: Boolean(getSponsoredSeatPriceId('pro')),
		vipEnabled: Boolean(getSponsoredSeatPriceId('vip')),
	})
}
