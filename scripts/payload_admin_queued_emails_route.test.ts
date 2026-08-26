import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/app/api/admin/queued-emails/route.ts', 'utf8')

assert.match(source, /process\.env\.PAYLOAD_SECRET/)
assert.match(source, /authorization/)
assert.match(source, /startsWith\('Bearer '\)/)
assert.match(source, /statusFilter = request\.nextUrl\.searchParams\.get\('status'\) \|\| 'queued'/)
assert.match(source, /statusFilter === 'all'/)
assert.match(source, /deliveryStatus: \{ equals: statusFilter \}/)
assert.match(source, /overrideAccess: true/)
assert.doesNotMatch(source, /toEmail:/)
assert.doesNotMatch(source, /metadata:/)

console.log('payload_admin_queued_emails_route.test.ts passed')
