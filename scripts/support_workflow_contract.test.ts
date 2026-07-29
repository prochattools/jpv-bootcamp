import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(path, 'utf8')

const route = read('src/app/api/support/route.ts')
const intake = read('src/lib/support/supportIntake.ts')
const templates = read('src/lib/payloadCourse/systemEmailTemplates.ts')
const inbox = read('src/app/(frontend)/operations/support-requests/page.tsx')
const dashboard = read('src/components/payload/JPVAdminDashboard.tsx')
const payloadConfig = read('src/payload.config.ts')
const schema = read('prisma/system.prisma')

assert.ok(
  existsSync('src/app/(frontend)/operations/support-requests/page.tsx'),
  'Protected support inbox route must exist',
)

assert.match(schema, /model SupportRequest \{[\s\S]*@@map\("support_requests"\)/)
assert.match(route, /prisma\.supportRequest\.create/)
assert.match(route, /prisma\.supportRequest\.update/)
assert.match(intake, /requesterEmail:\s*input\.normalizedEmail/)
assert.match(intake, /requesterName:\s*input\.name/)

assert.match(route, /templateKey:\s*'admin-notification'/)
assert.match(route, /purpose:\s*'support_request_pending_review'/)
assert.match(route, /templateKey:\s*SUPPORT_REQUEST_RECEIVED_TEMPLATE_KEY/)
assert.match(route, /purpose:\s*'support_request_received'/)
assert.match(route, /support-request-acknowledgement:\$\{input\.requestId\}/)
assert.match(route, /toEmail:\s*input\.requesterEmail/)
assert.match(templates, /SUPPORT_REQUEST_RECEIVED_TEMPLATE_KEY/)
assert.match(templates, /We received your JPV Bootcamp support request/)
assert.match(templates, /You do not need to submit the same question again/)

assert.match(inbox, /requireCurrentPayloadAdmin\(\)/)
assert.match(inbox, /prisma\.supportRequest\.findMany/)
assert.match(inbox, /prisma\.supportRequest\.update/)
assert.match(inbox, /reviewedByAccountId/)
assert.match(inbox, /\['pending', 'in_review', 'resolved'\]/)
assert.match(inbox, /Mark in review/)
assert.match(inbox, /Mark resolved/)
assert.match(inbox, /Reopen/)
assert.match(inbox, /mailto:\$\{request\.normalizedEmail\}/)
assert.match(inbox, /min-h-11/)

assert.match(dashboard, /safeOpenSupportCount/)
assert.match(dashboard, /Support requests to review/)
assert.match(dashboard, /\/operations\/support-requests/)
assert.match(dashboard, /reviewStatus:\s*\{\s*in:\s*\['pending', 'in_review'\]/)

assert.equal(
  payloadConfig.includes("slug: 'support_requests'"),
  false,
  'Support requests must not be duplicated into a second Payload collection',
)

console.log('support workflow contract passed')
