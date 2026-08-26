import { createHash } from 'node:crypto'

export type JsonObjectResult =
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; status: 400 | 413 | 415; error: 'invalid_request' | 'payload_too_large' | 'unsupported_media_type' }

export type RouteThrottleResult = {
  allowed: boolean
}

const DEFAULT_MAX_JSON_BYTES = 4096
const MAX_THROTTLE_ENTRIES = 512

type ThrottleEntry = {
  count: number
  resetAt: number
}

const throttleEntries = new Map<string, ThrottleEntry>()

function hashKey(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

function contentLength(request: Request): number | null {
  const raw = request.headers.get('content-length')
  if (!raw) return null
  const value = Number(raw)
  return Number.isSafeInteger(value) && value >= 0 ? value : null
}

export async function readBoundedJsonObject(
  request: Request,
  options: { maxBytes?: number } = {},
): Promise<JsonObjectResult> {
  const contentType = request.headers.get('content-type')?.toLowerCase() ?? ''
  if (!contentType.split(';')[0]?.trim().endsWith('/json') && !contentType.includes('+json')) {
    return { ok: false, status: 415, error: 'unsupported_media_type' }
  }

  const maxBytes = options.maxBytes ?? DEFAULT_MAX_JSON_BYTES
  const length = contentLength(request)
  if (length !== null && length > maxBytes) {
    return { ok: false, status: 413, error: 'payload_too_large' }
  }

  let text: string
  try {
    text = await request.text()
  } catch {
    return { ok: false, status: 400, error: 'invalid_request' }
  }
  if (text.length > maxBytes) {
    return { ok: false, status: 413, error: 'payload_too_large' }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, status: 400, error: 'invalid_request' }
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, status: 400, error: 'invalid_request' }
  }

  return { ok: true, body: parsed as Record<string, unknown> }
}

export function sameOriginRequest(request: Request): boolean {
  const requestOrigin = new URL(request.url).origin
  const origin = request.headers.get('origin')
  if (origin && origin !== requestOrigin) return false

  const secFetchSite = request.headers.get('sec-fetch-site')?.toLowerCase()
  if (secFetchSite === 'cross-site') return false

  return true
}

export function routeThrottle(
  request: Request,
  input: {
    scope: string
    identity?: string | null
    maxAttempts: number
    windowMs: number
    now?: number
  },
): RouteThrottleResult {
  const now = input.now ?? Date.now()
  for (const [key, entry] of throttleEntries) {
    if (entry.resetAt <= now || throttleEntries.size > MAX_THROTTLE_ENTRIES) {
      throttleEntries.delete(key)
    }
  }

  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? ''
  const network =
    forwardedFor ||
    request.headers.get('x-real-ip')?.trim() ||
    request.headers.get('cf-connecting-ip')?.trim() ||
    'unknown'
  const identity = input.identity?.trim().toLowerCase() || 'anonymous'
  const key = hashKey(`${input.scope}:${identity}:${network}`)
  const existing = throttleEntries.get(key)

  if (!existing || existing.resetAt <= now) {
    throttleEntries.set(key, { count: 1, resetAt: now + input.windowMs })
    return { allowed: true }
  }

  existing.count += 1
  return { allowed: existing.count <= input.maxAttempts }
}

export function resetAccountActionRouteThrottleForTests(): void {
  throttleEntries.clear()
}
