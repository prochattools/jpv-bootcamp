import 'server-only'

import { NextResponse } from 'next/server'

import {
  InMemoryPublicRequestRateLimiter,
  type PublicRequestFailure,
  type PublicRequestGuardLog,
} from '@/lib/publicRequestGuard'

export const publicRequestRateLimiter = new InMemoryPublicRequestRateLimiter(4096)

function isEnvEnabled(value: string | undefined): boolean {
  if (!value) return false
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase())
}

export function getPublicRequestApplicationOrigin(): string {
  const raw = (process.env.APP_PUBLIC_URL || process.env.NEXT_PUBLIC_APP_URL || '').trim()
  if (!raw) throw new Error('public_request_application_origin_missing')
  return new URL(raw).origin
}

export function trustPublicRequestProxyHeaders(): boolean {
  return isEnvEnabled(process.env.PUBLIC_REQUEST_TRUST_PROXY_HEADERS)
}

export function logPublicRequestGuard(event: PublicRequestGuardLog): void {
  console.info(event.event, {
    namespace: event.namespace,
    decision: event.decision,
    status: event.status,
    reason: event.reason,
    field: event.field ?? null,
    ipHash: event.ipHash,
    emailHash: event.emailHash ?? null,
  })
}

export function publicRequestFailureResponse(failure: PublicRequestFailure): NextResponse {
  const headers = new Headers()
  if (failure.retryAfterSeconds !== undefined) {
    headers.set('Retry-After', String(failure.retryAfterSeconds))
  }

  return NextResponse.json(
    {
      ok: false,
      error: failure.code,
      ...(failure.field ? { field: failure.field } : {}),
    },
    { status: failure.status, headers },
  )
}
