import { NextResponse } from 'next/server'
import {
	getSponsoredSeatCounts,
	getSponsoredPriceId,
} from '@/lib/sponsored-seats'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
	try {
		const counts = await getSponsoredSeatCounts()
		return NextResponse.json({
			...counts,
			proEnabled: Boolean(getSponsoredPriceId('pro')),
			vipEnabled: Boolean(getSponsoredPriceId('vip')),
		})
	} catch (error) {
		console.error('sponsored_seat_counts_failed', error)
		return NextResponse.json({
			pro: 0,
			vip: 0,
			proEnabled: Boolean(getSponsoredPriceId('pro')),
			vipEnabled: Boolean(getSponsoredPriceId('vip')),
		})
	}
}
