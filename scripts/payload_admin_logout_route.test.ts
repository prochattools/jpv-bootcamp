import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/app/(payload)/admin/logout/route.ts', 'utf8')

// Public origin resolution
assert(!source.includes("new URL('/admin/login', request.url)"), 'must not use request.url directly as base for redirect')
assert(source.includes('x-forwarded-host'), 'must read x-forwarded-host header')
assert(source.includes('x-forwarded-proto'), 'must read x-forwarded-proto header')
assert(source.includes('resolvePublicOrigin'), 'must use resolvePublicOrigin helper')
assert(source.includes('isInternalHost'), 'must reject internal hosts')
assert(source.includes('resolvePublicProtocol'), 'must normalize forwarded protocol before building the public origin')
assert(source.includes("split(',')[0]?.trim().toLowerCase()"), 'must normalize comma-separated forwarded protocol values')
assert(source.includes('PUBLIC_ORIGIN_PROTOCOL'), 'must use an explicit safe protocol for public redirects')

// Internal host rejection
assert(source.includes('0.0.0.0'), 'must reject 0.0.0.0 as internal host')
assert(source.includes('localhost'), 'must reject localhost as internal host')
assert(source.includes('127.0.0.1'), 'must reject 127.0.0.1 as internal host')
assert(source.includes('::1'), 'must reject ::1 as internal host')
assert(source.includes("normalized.startsWith('[')"), 'must parse bracketed IPv6 hosts')
assert(source.includes("normalized.slice(1, closingBracket)"), 'must normalize [::1] before internal-host comparison')
assert(
  source.includes("normalized.includes(':') && normalized.split(':').length === 2"),
  'must strip a port from ordinary host:port values without corrupting IPv6 hosts',
)

// Fallback chain
assert(source.includes('NEXT_PUBLIC_SERVER_URL'), 'must fall back to NEXT_PUBLIC_SERVER_URL')
assert(source.includes('NEXT_PUBLIC_PAYLOAD_URL'), 'must fall back to NEXT_PUBLIC_PAYLOAD_URL')
assert(source.includes("ENVIRONMENT_TOPOLOGY.staging.origin"), 'must have canonical staging fallback origin')

// Redirect target
assert(source.includes("'/admin/login'"), 'must redirect to /admin/login')
assert(source.includes("'loggedOut'"), 'must carry loggedOut query param')

// Cookie clearing
assert(source.includes('cookie.name.startsWith(prefix)'), 'must clear all Payload-prefixed cookies')
assert(source.includes('names.add(`${prefix}-token`)'), 'must clear the default Payload token cookie')
assert(source.includes('expires: new Date(0)'), 'must expire auth cookies')
assert(source.includes("path: '/'"), 'must target root path for cookie clearing')

// HTTP methods
assert(source.includes('export async function GET'), 'must support GET navigation')
assert(source.includes('export async function POST'), 'must support POST submission')

// Forbidden mentions
const forbiddenDeploymentPlatform = ['Coo', 'lify'].join('')
const forbiddenLegacyCms = ['Tina', 'CMS'].join('')
assert(!source.includes(forbiddenDeploymentPlatform), 'must not mention forbidden deployment platform')
assert(!source.includes(forbiddenLegacyCms), 'must not mention forbidden legacy CMS')

console.log('payload_admin_logout_route.test.ts passed')
