import { NextRequest, NextResponse } from 'next/server'

import prisma from '@/libs/prisma'
import { guardPublicRequest } from '@/lib/publicRequestGuard'
import {
  getPublicRequestApplicationOrigin,
  logPublicRequestGuard,
  publicRequestFailureResponse,
  publicRequestRateLimiter,
  trustPublicRequestProxyHeaders,
} from '@/lib/publicRequestRoute'

const SUBSCRIBE_MAX_BYTES = 2 * 1024

const subscribeFields = {
  email: { type: 'email', required: true, maxLength: 320 },
  name: { type: 'string', maxLength: 120 },
  source: { type: 'string', maxLength: 80 },
} as const

function isEnvEnabled(value?: string): boolean {
  if (!value) return false
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase())
}

export async function POST(req: NextRequest) {
  const guarded = await guardPublicRequest(req, {
    namespace: 'public-subscribe',
    methods: ['POST'],
    bodyType: 'json',
    fields: subscribeFields,
    applicationOrigin: getPublicRequestApplicationOrigin(),
    missingOrigin: 'reject',
    maxBytes: SUBSCRIBE_MAX_BYTES,
    allowUnknownFields: false,
    trustProxyHeaders: trustPublicRequestProxyHeaders(),
    rateLimit: {
      limiter: publicRequestRateLimiter,
      limit: 5,
      windowMs: 10 * 60_000,
      identityField: 'email',
      backendFailure: 'deny',
    },
    logger: logPublicRequestGuard,
  })

  if (guarded.ok === false) {
    return publicRequestFailureResponse(guarded)
  }

  const { email, name, source } = guarded.data

  try {
    const existingSubscriber = await prisma.emailSubscriber.findUnique({
      where: { email },
    })

    if (existingSubscriber) {
      return NextResponse.json({ error: 'Email already subscribed' }, { status: 409 })
    }

    const subscriber = await prisma.emailSubscriber.create({
      data: {
        email,
        name: name || null,
        source: source || 'website',
      },
    })

    try {
      console.info('newsletter_attempt', {
        at: 'newsletter_attempt',
        sourceRoute: '/api/subscribe',
        disableNonWebhookEmails: isEnvEnabled(process.env.DISABLE_NON_WEBHOOK_EMAILS),
      })
      const { resendService } = await import('@/libs/resend')
      await resendService.sendWelcomeEmail(email, name, 'signup')
    } catch (emailError) {
      console.error('Failed to send welcome email', {
        errorName: emailError instanceof Error ? emailError.name : 'unknown',
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Successfully subscribed!',
      subscriber: {
        id: subscriber.id,
        createdAt: subscriber.createdAt,
      },
    })
  } catch (error) {
    console.error('Subscription processing failed', {
      errorName: error instanceof Error ? error.name : 'unknown',
    })
    return NextResponse.json(
      { error: 'Failed to subscribe. Please try again.' },
      { status: 500 },
    )
  }
}
