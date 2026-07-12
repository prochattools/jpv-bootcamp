import { NextRequest, NextResponse } from 'next/server'

import { guardPublicRequest } from '@/lib/publicRequestGuard'
import {
  getPublicRequestApplicationOrigin,
  logPublicRequestGuard,
  publicRequestFailureResponse,
  publicRequestRateLimiter,
  trustPublicRequestProxyHeaders,
} from '@/lib/publicRequestRoute'

const SUPPORT_MAX_BYTES = 8 * 1024

const supportFields = {
  name: { type: 'string', required: true, minLength: 2, maxLength: 120 },
  email: { type: 'email', required: true, maxLength: 320 },
  question: { type: 'string', required: true, minLength: 10, maxLength: 2_000 },
  source: { type: 'string', maxLength: 80 },
  page: { type: 'string', maxLength: 200 },
} as const

export async function POST(req: NextRequest) {
  const guarded = await guardPublicRequest(req, {
    namespace: 'public-support',
    methods: ['POST'],
    bodyType: 'json',
    fields: supportFields,
    applicationOrigin: getPublicRequestApplicationOrigin(),
    missingOrigin: 'reject',
    maxBytes: SUPPORT_MAX_BYTES,
    allowUnknownFields: false,
    trustProxyHeaders: trustPublicRequestProxyHeaders(),
    rateLimit: {
      limiter: publicRequestRateLimiter,
      limit: 3,
      windowMs: 60_000,
      identityField: 'email',
      backendFailure: 'deny',
    },
    logger: logPublicRequestGuard,
  })

  if (guarded.ok === false) {
    return publicRequestFailureResponse(guarded)
  }

  return NextResponse.json(
    {
      ok: false,
      error: 'preview_only',
      message:
        'Support requests are preview-only and are not submitted, stored, emailed, or assigned a reference.',
    },
    { status: 503 },
  )
}
