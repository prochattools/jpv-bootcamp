import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /register → 410 Gone
 *
 * Public free-account registration is permanently disabled.
 * New members onboard exclusively through the Stripe Checkout flow at /upgrade.
 *
 * 410 (Gone) is the correct status for a route that previously accepted
 * registrations but no longer does, signalling to crawlers and clients
 * that the endpoint will not return.
 */
export async function GET() {
  return new NextResponse(
    JSON.stringify({
      error: 'Registration is permanently disabled.',
      message:
        'New accounts are created exclusively through the membership Checkout flow. Visit /upgrade to get started.',
      checkoutUrl: '/upgrade',
    }),
    {
      status: 410,
      headers: {
        'Content-Type': 'application/json',
        Location: '/upgrade',
      },
    },
  )
}
