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
			enabled: Boolean(getSponsoredPriceId()),
		})
	} catch (error) {
		console.error('sponsored_seat_counts_failed', error)
		return NextResponse.json({
			available: 0,
			enabled: Boolean(getSponsoredPriceId()),
		})
	}
}
