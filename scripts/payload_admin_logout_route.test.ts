import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/app/(payload)/admin/logout/route.ts', 'utf8')

assert(source.includes("new URL('/admin/login'"), 'admin logout should redirect to admin login')
assert(source.includes("target.searchParams.set('loggedOut', '1')"), 'admin logout redirect should carry loggedOut state')
assert(source.includes('cookie.name.startsWith(prefix)'), 'admin logout should clear all Payload-prefixed cookies')
assert(source.includes('names.add(`${prefix}-token`)'), 'admin logout should clear the default Payload token cookie')
assert(source.includes('expires: new Date(0)'), 'admin logout should expire auth cookies')
assert(source.includes('path: \'/\''), 'admin logout cookie clearing should target the root path')
assert(source.includes('export async function GET'), 'admin logout should support GET navigation')
assert(source.includes('export async function POST'), 'admin logout should support POST submission')
assert(!source.includes('Coolify'), 'admin logout route must not mention Coolify')

console.log('payload_admin_logout_route.test.ts passed')
