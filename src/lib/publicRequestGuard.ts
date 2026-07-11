import { createHash } from 'node:crypto'

import { redactEmail } from '@/lib/log-redact'
import { normalizeEmail } from '@/lib/normalize-email'

export const DEFAULT_PUBLIC_REQUEST_MAX_BYTES = 8 * 1024

export type PublicRequestErrorCode =
  | 'method_not_allowed'
  | 'unsupported_media_type'
  | 'payload_too_large'
  | 'malformed_body'
  | 'origin_required'
  | 'origin_invalid'
  | 'origin_forbidden'
  | 'rate_limited'
  | 'rate_limit_unavailable'
  | 'field_required'
  | 'field_invalid'
  | 'field_too_long'
  | 'field_unknown'
  | 'field_nested'

export type PublicRequestFailure = {
  ok: false
  code: PublicRequestErrorCode
  status: 400 | 403 | 405 | 413 | 415 | 429 | 503
  field?: string
  retryAfterSeconds?: number
}

export type PublicRequestSuccess<T extends Record<string, unknown>> = {
  ok: true
  data: T
  client: {
    ipHash: string
    rateLimitKey: string | null
  }
}

export type PublicRequestResult<T extends Record<string, unknown>> =
  | PublicRequestSuccess<T>
  | PublicRequestFailure

export type PublicRequestFieldRule =
  | {
      type: 'string'
      required?: boolean
      minLength?: number
      maxLength: number
      trim?: boolean
    }
  | {
      type: 'email'
      required?: boolean
      maxLength?: number
    }
  | {
      type: 'enum'
      required?: boolean
      values: readonly string[]
    }
  | {
      type: 'redirect'
      required?: boolean
      fallback: string
      applicationOrigin?: string
      allowApplicationOriginUrl?: boolean
    }

export type PublicRequestFieldSchema = Record<string, PublicRequestFieldRule>

export type PublicRequestRateLimitDecision =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number }

export interface PublicRequestRateLimiter {
  consume(input: {
    namespace: string
    key: string
    limit: number
    windowMs: number
    now: number
  }): Promise<PublicRequestRateLimitDecision> | PublicRequestRateLimitDecision
}

export type PublicRequestGuardLog = {
  event: 'public_request_guard'
  namespace: string
  decision: 'allow' | 'deny'
  status: number
  reason: 'accepted' | PublicRequestErrorCode
  field?: string
  ipHash: string
  emailHash?: string | null
}

export type PublicRequestGuardLogger = (event: PublicRequestGuardLog) => void

export type PublicRequestGuardOptions<TSchema extends PublicRequestFieldSchema> = {
  namespace: string
  methods: readonly string[]
  bodyType: 'json' | 'form'
  fields: TSchema
  applicationOrigin: string
  missingOrigin: 'allow' | 'reject'
  maxBytes?: number
  allowUnknownFields?: boolean
  trustProxyHeaders?: boolean
  rateLimit?: {
    limiter: PublicRequestRateLimiter
    limit: number
    windowMs: number
    identityField?: keyof TSchema & string
    backendFailure: 'deny' | 'allow'
  }
  logger?: PublicRequestGuardLogger
  now?: number
}

type FieldOutput<TRule extends PublicRequestFieldRule> = TRule['required'] extends true
  ? string
  : string | undefined

export type PublicRequestValidatedFields<TSchema extends PublicRequestFieldSchema> = {
  [TKey in keyof TSchema]: FieldOutput<TSchema[TKey]>
}

type Bucket = { count: number; resetAt: number }

export class InMemoryPublicRequestRateLimiter implements PublicRequestRateLimiter {
  private readonly buckets = new Map<string, Bucket>()
  constructor(private readonly maxEntries = 1024) {}

  consume(input: {
    namespace: string
    key: string
    limit: number
    windowMs: number
    now: number
  }): PublicRequestRateLimitDecision {
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= input.now || this.buckets.size > this.maxEntries) {
        this.buckets.delete(key)
      }
    }

    const bucketKey = `${input.namespace}:${input.key}`
    const existing = this.buckets.get(bucketKey)
    if (!existing || existing.resetAt <= input.now) {
      this.buckets.set(bucketKey, { count: 1, resetAt: input.now + input.windowMs })
      return { allowed: true }
    }

    existing.count += 1
    if (existing.count <= input.limit) return { allowed: true }

    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - input.now) / 1000)),
    }
  }

  reset(): void {
    this.buckets.clear()
  }
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

export function redactIp(value: string | null | undefined): string {
  const normalized = value?.trim().toLowerCase() || 'unknown'
  return sha256(normalized).slice(0, 16)
}

export function resolvePublicRequestIp(
  request: Request,
  options: { trustProxyHeaders?: boolean } = {},
): string {
  if (!options.trustProxyHeaders) return 'unknown'

  const candidates = [
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
    request.headers.get('x-real-ip')?.trim(),
    request.headers.get('cf-connecting-ip')?.trim(),
    request.headers.get('true-client-ip')?.trim(),
  ]
  return candidates.find((value) => Boolean(value)) || 'unknown'
}

function canonicalContentType(request: Request): string {
  return request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() ?? ''
}

function contentLength(request: Request): number | null {
  const raw = request.headers.get('content-length')
  if (!raw) return null
  const parsed = Number(raw)
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

async function readBody(
  request: Request,
  bodyType: 'json' | 'form',
  maxBytes: number,
): Promise<Record<string, unknown> | PublicRequestFailure> {
  const type = canonicalContentType(request)
  const approved =
    bodyType === 'json'
      ? type === 'application/json' || type.endsWith('+json')
      : type === 'application/x-www-form-urlencoded'

  if (!approved) return { ok: false, code: 'unsupported_media_type', status: 415 }

  const declaredLength = contentLength(request)
  if (declaredLength !== null && declaredLength > maxBytes) {
    return { ok: false, code: 'payload_too_large', status: 413 }
  }

  let text: string
  try {
    text = await request.text()
  } catch {
    return { ok: false, code: 'malformed_body', status: 400 }
  }

  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    return { ok: false, code: 'payload_too_large', status: 413 }
  }

  try {
    if (bodyType === 'json') {
      const parsed: unknown = JSON.parse(text)
      return isPlainRecord(parsed)
        ? parsed
        : { ok: false, code: 'malformed_body', status: 400 }
    }

    const params = new URLSearchParams(text)
    const output: Record<string, unknown> = {}
    for (const [key, value] of params) {
      if (Object.prototype.hasOwnProperty.call(output, key)) {
        return { ok: false, code: 'field_nested', status: 400, field: key }
      }
      output[key] = value
    }
    return output
  } catch {
    return { ok: false, code: 'malformed_body', status: 400 }
  }
}

function validateOrigin(
  request: Request,
  applicationOrigin: string,
  missingOrigin: 'allow' | 'reject',
): PublicRequestFailure | null {
  const raw = request.headers.get('origin')
  if (!raw) {
    return missingOrigin === 'allow'
      ? null
      : { ok: false, code: 'origin_required', status: 403 }
  }
  if (raw === 'null') return { ok: false, code: 'origin_invalid', status: 403 }

  let origin: string
  let expected: string
  try {
    origin = new URL(raw).origin
    expected = new URL(applicationOrigin).origin
  } catch {
    return { ok: false, code: 'origin_invalid', status: 403 }
  }

  if (origin !== raw || origin !== expected) {
    return { ok: false, code: 'origin_forbidden', status: 403 }
  }

  const fetchSite = request.headers.get('sec-fetch-site')?.toLowerCase()
  if (fetchSite === 'cross-site') {
    return { ok: false, code: 'origin_forbidden', status: 403 }
  }
  return null
}

function containsUnsafeRedirectEncoding(value: string): boolean {
  const lower = value.toLowerCase()
  return (
    /[\u0000-\u001f\u007f]/.test(value) ||
    lower.includes('%2f%2f') ||
    lower.includes('%5c') ||
    lower.includes('%00')
  )
}

export function sanitizePublicRedirect(input: {
  value: string | null | undefined
  fallback: string
  applicationOrigin?: string
  allowApplicationOriginUrl?: boolean
}): string {
  const fallback = input.fallback.startsWith('/') && !input.fallback.startsWith('//')
    ? input.fallback
    : '/'
  const candidate = input.value?.trim()
  if (!candidate || containsUnsafeRedirectEncoding(candidate)) return fallback

  if (candidate.startsWith('/') && !candidate.startsWith('//') && !candidate.includes('\\')) {
    try {
      const parsed = new URL(candidate, 'https://internal.invalid')
      const decoded = decodeURIComponent(parsed.pathname)
      if (decoded.startsWith('//') || decoded.includes('\\')) return fallback
      return `${parsed.pathname}${parsed.search}${parsed.hash}`
    } catch {
      return fallback
    }
  }

  if (input.allowApplicationOriginUrl && input.applicationOrigin) {
    try {
      const parsed = new URL(candidate)
      const expectedOrigin = new URL(input.applicationOrigin).origin
      if (parsed.origin !== expectedOrigin) return fallback
      return `${parsed.pathname}${parsed.search}${parsed.hash}`
    } catch {
      return fallback
    }
  }

  return fallback
}

function validateFields<TSchema extends PublicRequestFieldSchema>(
  raw: Record<string, unknown>,
  schema: TSchema,
  allowUnknownFields: boolean,
): PublicRequestValidatedFields<TSchema> | PublicRequestFailure {
  if (!allowUnknownFields) {
    for (const key of Object.keys(raw)) {
      if (!Object.prototype.hasOwnProperty.call(schema, key)) {
        return { ok: false, code: 'field_unknown', status: 400, field: key }
      }
    }
  }

  const output: Record<string, string | undefined> = {}
  for (const [field, rule] of Object.entries(schema)) {
    const value = raw[field]
    if (value === undefined || value === null || value === '') {
      if (rule.required) {
        return { ok: false, code: 'field_required', status: 400, field }
      }
      output[field] = undefined
      continue
    }
    if (typeof value !== 'string') {
      return {
        ok: false,
        code: Array.isArray(value) || typeof value === 'object' ? 'field_nested' : 'field_invalid',
        status: 400,
        field,
      }
    }

    if (rule.type === 'string') {
      const normalized = rule.trim === false ? value : value.trim()
      if (normalized.length > rule.maxLength) {
        return { ok: false, code: 'field_too_long', status: 400, field }
      }
      if (rule.minLength !== undefined && normalized.length < rule.minLength) {
        return { ok: false, code: 'field_invalid', status: 400, field }
      }
      output[field] = normalized
      continue
    }

    if (rule.type === 'email') {
      if (value.length > (rule.maxLength ?? 320)) {
        return { ok: false, code: 'field_too_long', status: 400, field }
      }
      const normalized = normalizeEmail(value)
      if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
        return { ok: false, code: 'field_invalid', status: 400, field }
      }
      output[field] = normalized
      continue
    }

    if (rule.type === 'enum') {
      if (!rule.values.includes(value)) {
        return { ok: false, code: 'field_invalid', status: 400, field }
      }
      output[field] = value
      continue
    }

    output[field] = sanitizePublicRedirect({
      value,
      fallback: rule.fallback,
      applicationOrigin: rule.applicationOrigin,
      allowApplicationOriginUrl: rule.allowApplicationOriginUrl,
    })
  }

  return output as PublicRequestValidatedFields<TSchema>
}

function isGuardFailure(value: unknown): value is PublicRequestFailure {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<PublicRequestFailure>
  return candidate.ok === false && typeof candidate.code === 'string' && typeof candidate.status === 'number'
}

function guardLog(
  logger: PublicRequestGuardLogger | undefined,
  event: PublicRequestGuardLog,
): void {
  logger?.(event)
}

export async function guardPublicRequest<TSchema extends PublicRequestFieldSchema>(
  request: Request,
  options: PublicRequestGuardOptions<TSchema>,
): Promise<PublicRequestResult<PublicRequestValidatedFields<TSchema>>> {
  const method = request.method.toUpperCase()
  const allowedMethods = options.methods.map((value) => value.toUpperCase())
  const clientIp = resolvePublicRequestIp(request, {
    trustProxyHeaders: options.trustProxyHeaders,
  })
  const ipHash = redactIp(clientIp)

  const deny = (failure: PublicRequestFailure): PublicRequestFailure => {
    guardLog(options.logger, {
      event: 'public_request_guard',
      namespace: options.namespace,
      decision: 'deny',
      status: failure.status,
      reason: failure.code,
      field: failure.field,
      ipHash,
    })
    return failure
  }

  if (!allowedMethods.includes(method)) {
    return deny({ ok: false, code: 'method_not_allowed', status: 405 })
  }

  const originFailure = validateOrigin(
    request,
    options.applicationOrigin,
    options.missingOrigin,
  )
  if (originFailure) return deny(originFailure)

  const raw = await readBody(
    request,
    options.bodyType,
    options.maxBytes ?? DEFAULT_PUBLIC_REQUEST_MAX_BYTES,
  )
  if (isGuardFailure(raw)) return deny(raw)

  const validated = validateFields(raw, options.fields, options.allowUnknownFields ?? false)
  if (isGuardFailure(validated)) return deny(validated)

  let rateLimitKey: string | null = null
  if (options.rateLimit) {
    const identityField = options.rateLimit.identityField
    const identity = identityField ? validated[identityField] : undefined
    const identityKey = typeof identity === 'string' ? identity : 'anonymous'
    rateLimitKey = sha256(`${ipHash}:${identityKey}`).slice(0, 24)

    let decision: PublicRequestRateLimitDecision
    try {
      decision = await options.rateLimit.limiter.consume({
        namespace: options.namespace,
        key: rateLimitKey,
        limit: options.rateLimit.limit,
        windowMs: options.rateLimit.windowMs,
        now: options.now ?? Date.now(),
      })
    } catch {
      if (options.rateLimit.backendFailure === 'deny') {
        return deny({ ok: false, code: 'rate_limit_unavailable', status: 503 })
      }
      decision = { allowed: true }
    }

    if (decision.allowed === false) {
      return deny({
        ok: false,
        code: 'rate_limited',
        status: 429,
        retryAfterSeconds: decision.retryAfterSeconds,
      })
    }
  }

  const emailField = Object.entries(options.fields).find(([, rule]) => rule.type === 'email')?.[0]
  const emailValue = emailField ? validated[emailField] : undefined
  guardLog(options.logger, {
    event: 'public_request_guard',
    namespace: options.namespace,
    decision: 'allow',
    status: 200,
    reason: 'accepted',
    ipHash,
    emailHash: typeof emailValue === 'string' ? redactEmail(emailValue) : null,
  })

  return {
    ok: true,
    data: validated,
    client: { ipHash, rateLimitKey },
  }
}
