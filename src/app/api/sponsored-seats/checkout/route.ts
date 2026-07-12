import { NextRequest, NextResponse } from 'next/server'

import { guardPublicRequest } from '@/lib/publicRequestGuard'
import {
  getPublicRequestApplicationOrigin,
  logPublicRequestGuard,
  publicRequestFailureResponse,
  publicRequestRateLimiter,
  trustPublicRequestProxyHeaders,
} from '@/lib/publicRequestRoute'
import { getStripe } from '@/lib/stripe'
import {
  getSponsoredSeatRedirects,
  getSponsoredPriceId,
} from '@/lib/sponsored-seats'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SPONSORED_SEAT_CHECKOUT_MAX_BYTES = 2 * 1024

const sponsoredSeatCheckoutFields = {
  tier: { type: 'enum', values: ['free'] as const },
  quantity: { type: 'enum', values: ['1'] as const },
  donorEmail: { type: 'email', maxLength: 320 },
  returnPath: { type: 'redirect', fallback: '/' },
} as const

export async function POST(req: NextRequest) {
  const applicationOrigin = getPublicRequestApplicationOrigin()
  const guarded = await guardPublicRequest(req, {
    namespace: 'public-sponsored-seat-checkout',
    methods: ['POST'],
    bodyType: 'json',
    fields: sponsoredSeatCheckoutFields,
    applicationOrigin,
    missingOrigin: 'reject',
    maxBytes: SPONSORED_SEAT_CHECKOUT_MAX_BYTES,
    allowUnknownFields: false,
    trustProxyHeaders: trustPublicRequestProxyHeaders(),
    rateLimit: {
      limiter: publicRequestRateLimiter,
      limit: 3,
      windowMs: 10 * 60_000,
      identityField: 'donorEmail',
      backendFailure: 'deny',
    },
    logger: logPublicRequestGuard,
  })

  if (guarded.ok === false) {
    return publicRequestFailureResponse(guarded)
  }

  const stripeEnv = (process.env.STRIPE_ENV || '').trim() || 'unknown'
  const stripeEnvNormalized = stripeEnv.toLowerCase()
  const stripeEnvSuffix = stripeEnvNormalized === 'live' ? 'LIVE' : 'TEST'
  const hasSecretKey = Boolean(
    (process.env[`STRIPE_SECRET_KEY_${stripeEnvSuffix}`] || '').trim(),
  )
  const hasPublishableKey = Boolean(
    (process.env[`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_${stripeEnvSuffix}`] || '').trim(),
  )
  const hasSupportCreditPrice = Boolean(getSponsoredPriceId())

  console.info('sponsored_checkout_env_check', {
    stripeEnv,
    hasSecretKey,
    hasPublishableKey,
    hasSupportCreditPrice,
  })

  if (
    (stripeEnvNormalized !== 'test' && stripeEnvNormalized !== 'live') ||
    !hasSecretKey ||
    !hasPublishableKey ||
    !hasSupportCreditPrice
  ) {
    return NextResponse.json(
      { ok: false, reason: 'missing_env' },
      { status: 400 },
    )
  }

  const priceId = getSponsoredPriceId()
  if (!priceId) {
    return NextResponse.json(
      { ok: false, reason: 'missing_env' },
      { status: 400 },
    )
  }

  let redirects: { successUrl: string; cancelUrl: string }
  try {
    redirects = getSponsoredSeatRedirects()
  } catch {
    return NextResponse.json(
      { ok: false, reason: 'missing_env' },
      { status: 500 },
    )
  }

  const cancelUrl = guarded.data.returnPath
    ? new URL(guarded.data.returnPath, applicationOrigin).toString()
    : redirects.cancelUrl

  let session: { url?: string | null } | null = null
  try {
    const stripe = getStripe()
    session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: redirects.successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
      ...(guarded.data.donorEmail ? { customer_email: guarded.data.donorEmail } : {}),
      metadata: {
        purpose: 'support_credit',
        access: 'free',
      },
    })
  } catch (error) {
    console.error('sponsored_checkout_failed', {
      errorName: error instanceof Error ? error.name : 'unknown',
    })
    return NextResponse.json(
      { ok: false, reason: 'stripe_error' },
      { status: 500 },
    )
  }

  if (!session?.url) {
    return NextResponse.json(
      { ok: false, reason: 'stripe_error' },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true, url: session.url })
}
